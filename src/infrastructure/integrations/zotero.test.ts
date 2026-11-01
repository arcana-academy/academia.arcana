import { describe, expect, it, vi } from "vitest";

import {
  ZOTERO_INTEGRATION_DEFINITION,
  ZoteroPublicReadError,
  listZoteroPublicReferences,
} from "./zotero";

const library = { kind: "groups", id: "12345" } as const;
const reference = {
  key: "ABCD1234",
  data: {
    itemType: "journalArticle",
    title: " Ciência aberta ",
    date: "2025",
    DOI: "10.1234/example",
    url: "https://example.org/article",
    creators: [{ firstName: "Ana", lastName: "Silva" }],
  },
};
const makeResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Zotero read-only public metadata adapter", () => {
  it("does not declare private library connection or write capabilities", () => {
    expect(ZOTERO_INTEGRATION_DEFINITION).toMatchObject({
      authMode: "none", serverSideOnly: true, userConnectionRequired: false,
      scopes: [], capabilities: ["read", "metadata"],
    });
  });

  it("only sends a public HTTPS GET with Zotero API version 3", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => makeResponse([reference]));
    const result = await listZoteroPublicReferences(library, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.zotero.org/groups/12345/items/top?format=json&limit=25&sort=dateAdded&direction=desc");
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ "Accept": "application/json", "Zotero-API-Version": "3" });
    expect(init.credentials).toBe("omit");
    expect(init.redirect).toBe("error");
    expect(init.cache).toBe("no-store");
    expect(result).toEqual([{ key: "ABCD1234", itemType: "journalArticle", title: "Ciência aberta", authors: ["Ana Silva"], date: "2025", doi: "10.1234/example", url: "https://example.org/article" }]);
  });

  it("filters out attachments, notes and annotations", async () => {
    const entries = [reference, ...["attachment", "note", "annotation"].map((itemType, i) => ({ key: "ZZZZ123" + i, data: { itemType, title: "private metadata" } }))];
    const result = await listZoteroPublicReferences(library, { fetchImpl: async () => makeResponse(entries) });
    expect(result).toHaveLength(1);
  });

  it("rejects an invalid library ID without making a request", async () => {
    const fetchImpl = vi.fn(async () => makeResponse([]));
    await expect(listZoteroPublicReferences({ kind: "users", id: "1/../../users/2" }, { fetchImpl })).rejects.toMatchObject({ code: "invalid_library" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("enforces a strict server-side per-request limit", async () => {
    await expect(listZoteroPublicReferences(library, { limit: 51 })).rejects.toThrow(RangeError);
    await expect(listZoteroPublicReferences(library, { limit: 0 })).rejects.toThrow(RangeError);
  });

  it.each([{ status: 403, code: "access_denied" }, { status: 429, code: "rate_limited" }, { status: 500, code: "unavailable" }])("reports $status without echoing response bodies", async ({ status, code }) => {
    await expect(listZoteroPublicReferences(library, { fetchImpl: async () => makeResponse({ secret: "should-not-log" }, status) }))
      .rejects.toMatchObject({ code });
  });

  it("rejects invalid JSON structures", async () => {
    await expect(listZoteroPublicReferences(library, { fetchImpl: async () => makeResponse({ items: [] }) }))
      .rejects.toBeInstanceOf(ZoteroPublicReadError);
  });
});
