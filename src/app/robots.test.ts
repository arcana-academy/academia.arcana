import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";

const authenticatedRoutes = [
  "/santuario",
  "/academia",
  "/grimorios",
  "/workspace",
  "/pratica",
  "/cronograma",
  "/missoes",
  "/foco",
  "/streak",
  "/estatisticas",
  "/conquistas",
  "/amigos",
  "/perfil",
  "/personalizar",
  "/configuracoes",
];

describe("public crawl boundaries", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("blocks all crawlers without advertising a sitemap in owner-only mode", () => {
    vi.stubEnv("ACADEMIA_ARCANA_PERSONAL_MODE", "true");
    const result = robots();
    expect(result.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    expect(result.sitemap).toBeUndefined();
    expect(result.host).toBeUndefined();
  });
  it("allows public landing and discourages crawling authenticated routes", () => {
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBe(true);
    if (!Array.isArray(rules)) throw new Error("Expected explicit crawl rules");

    const rule = rules[0];
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    const blocked = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    for (const path of authenticatedRoutes) {
      expect(blocked).toContain(path);
    }
  });

  it("blocks callback and API endpoints while keeping public auth pages crawlable", () => {
    const rules = robots().rules;
    if (!Array.isArray(rules)) throw new Error("Expected explicit crawl rules");
    const blocked = Array.isArray(rules[0].disallow)
      ? rules[0].disallow
      : [rules[0].disallow];
    expect(blocked).toEqual(
      expect.arrayContaining(["/api/", "/auth/"]),
    );
    expect(blocked).not.toContain("/login");
    expect(blocked).not.toContain("/cadastro");
    expect(blocked).not.toContain("/_next/");
  });
});
