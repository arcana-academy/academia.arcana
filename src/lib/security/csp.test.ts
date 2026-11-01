import { describe, expect, it } from "vitest";

import {
  createContentSecurityPolicy,
  getContentSecurityPolicyHeaderName,
} from "./csp";

describe("createContentSecurityPolicy", () => {
  it("uses the request nonce and removes unsafe script execution", () => {
    const csp = createContentSecurityPolicy("abc123", { isDevelopment: false });

    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123' https://use.typekit.net");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("https://hcaptcha.com https://*.hcaptcha.com");
    expect(csp).not.toContain("style-src 'self' 'unsafe-inline'");
  });

  it("allows React style attributes without relaxing style elements", () => {
    const csp = createContentSecurityPolicy("abc123", { isDevelopment: false });

    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    expect(csp.split("; ")).toContain(
      "style-src 'self' 'nonce-abc123' https://use.typekit.net https://hcaptcha.com https://*.hcaptcha.com",
    );
  });

  it("keeps a strict policy with HTTPS upgrades in production", () => {
    const csp = createContentSecurityPolicy("abc123", { isDevelopment: false });

    expect(csp).toContain("connect-src 'self' https: wss:");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("keeps the development relaxations in the report-only policy", () => {
    const csp = createContentSecurityPolicy("abc123", { isDevelopment: true });

    // `next dev` compiles with eval-source-map and Fast Refresh injects styles,
    // so the report-only development policy must tolerate both.
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' https: wss: ws: http:");
    expect(csp).toContain(
      "style-src 'self' 'unsafe-inline' https://use.typekit.net",
    );
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
  });
});

describe("getContentSecurityPolicyHeaderName", () => {
  it("enforces the policy in production", () => {
    expect(getContentSecurityPolicyHeaderName({ isDevelopment: false })).toBe(
      "Content-Security-Policy",
    );
  });

  it("reports violations without blocking development tooling", () => {
    expect(getContentSecurityPolicyHeaderName({ isDevelopment: true })).toBe(
      "Content-Security-Policy-Report-Only",
    );
  });
});
