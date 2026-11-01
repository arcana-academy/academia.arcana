/**
 * Zotero Web API v3: OPTIONAL public-library metadata reader.
 * This is NOT the Zotero ChatGPT plugin, an OAuth flow, or a private-library
 * connection. Keep this adapter server-side; never accept user API keys here.
 */
import type { IntegrationCapability, IntegrationDefinition } from "./contracts";

export const ZOTERO_PROVIDER_ID = "zotero" as const;
export const ZOTERO_API_BASE_URL = "https://api.zotero.org" as const;
export const ZOTERO_INTEGRATION_DEFINITION = {
  id: ZOTERO_PROVIDER_ID,
  displayName: "Zotero (bibliotecas públicas)",
  authMode: "none",
  capabilities: ["read", "metadata"] satisfies readonly IntegrationCapability[],
  userConnectionRequired: false,
  serverSideOnly: true,
  scopes: [],
  documentationUrl: "https://www.zotero.org/support/dev/web_api/v3/basics",
} satisfies IntegrationDefinition;

export type ZoteroPublicLibrary = {
  readonly kind: "users" | "groups";
  /** Numeric public user or group ID, NOT a username or API key. */
  readonly id: string;
};

export type ZoteroPublicReference = {
  readonly key: string;
  readonly itemType: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly date: string | null;
  readonly doi: string | null;
  readonly url: string | null;
};

type JsonRecord = Record<string, unknown>;
export type ZoteroFetch = (url: string, init: RequestInit) => Promise<Response>;

export class ZoteroPublicReadError extends Error {
  readonly code: "invalid_library" | "access_denied" | "rate_limited" | "unavailable" | "invalid_response";

  constructor(code: ZoteroPublicReadError["code"]) {
    super("Zotero public metadata: " + code);
    this.name = "ZoteroPublicReadError";
    this.code = code;
  }
}

function record(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function field(row: JsonRecord, key: string, maxLength = 500): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function creators(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((creator: unknown) => {
    if (!record(creator)) return [];
    const name = field(creator, "name", 150)
      ?? [field(creator, "firstName", 75), field(creator, "lastName", 75)]
        .filter(Boolean).join(" ");
    return name ? [name] : [];
  });
}

/**
 * Read *public* bibliographic metadata only; never files, notes or attachments.
 * No runtime route, persistence, user-account linking, or UI is enabled by
 * this function. The caller must enforce its own quotas before invoking it.
 */
export async function listZoteroPublicReferences(
  library: ZoteroPublicLibrary,
  options: { readonly limit?: number; readonly fetchImpl?: ZoteroFetch } = {},
): Promise<readonly ZoteroPublicReference[]> {
  if ((library.kind !== "users" && library.kind !== "groups") ||
      !/^[1-9][0-9]{0,15}$/.test(library.id)) {
    throw new ZoteroPublicReadError("invalid_library");
  }

  const limit = options.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new RangeError("Zotero public metadata limit must be between 1 and 50");
  }

  const url = new URL(ZOTERO_API_BASE_URL + "/" + library.kind + "/" + library.id + "/items/top");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "dateAdded");
  url.searchParams.set("direction", "desc");

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url.toString(), {
      method: "GET",
      headers: { "Accept": "application/json", "Zotero-API-Version": "3" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    });
  } catch {
    throw new ZoteroPublicReadError("unavailable");
  }

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    throw new ZoteroPublicReadError("access_denied");
  }
  if (response.status === 429) throw new ZoteroPublicReadError("rate_limited");
  if (!response.ok) throw new ZoteroPublicReadError("unavailable");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ZoteroPublicReadError("invalid_response");
  }
  if (!Array.isArray(payload)) throw new ZoteroPublicReadError("invalid_response");

  return payload.flatMap((item: unknown): ZoteroPublicReference[] => {
    if (!record(item) || !record(item.data)) return [];
    const key = field(item, "key", 20);
    const kind = field(item.data, "itemType", 50);
    if (!key || !/^[A-Za-z0-9]{8}$/.test(key) || !kind ||
      kind === "note" || kind === "attachment" || kind === "annotation") return [];
    return [{
      key,
      itemType: kind,
      title: field(item.data, "title", 500) ?? "(Sem título)",
      authors: creators(item.data.creators),
      date: field(item.data, "date", 100),
      doi: field(item.data, "DOI", 200),
      url: field(item.data, "url", 1200),
    }];
  }).slice(0, limit);
}
