import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CORE_DOMAINS } from "./domains";

const srcRoot = resolve(process.cwd(), "src");
const domainsRoot = join(srcRoot, "domains");
const coreRoot = join(srcRoot, "core");

describe("Foundation 1 — modular structure", () => {
  it("contains exactly the approved business-domain modules", () => {
    const actualDomains = readdirSync(domainsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const approvedDomains = CORE_DOMAINS
      .filter(
        (domain) =>
          !["identity", "context", "authorization"].includes(domain),
      )
      .sort();

    expect(actualDomains).toEqual(approvedDomains);
  });

  it("contains the approved cross-cutting core identity/context/authorization modules", () => {
    for (const domain of ["identity", "context", "authorization"] as const) {
      const domainRoot = join(coreRoot, domain);

      expect(existsSync(domainRoot), domainRoot).toBe(true);
      expect(
        existsSync(join(domainRoot, "index.ts")),
        `${domainRoot}/index.ts`,
      ).toBe(true);
      expect(
        statSync(join(domainRoot, "index.ts")).isFile(),
        `${domainRoot}/index.ts`,
      ).toBe(true);
      expect(
        existsSync(join(domainRoot, "contracts.ts")),
        `${domainRoot}/contracts.ts`,
      ).toBe(true);
      expect(
        statSync(join(domainRoot, "contracts.ts")).isFile(),
        `${domainRoot}/contracts.ts`,
      ).toBe(true);
    }
  });

  it("gives every approved business domain a public index barrel", () => {
    const businessDomains = CORE_DOMAINS.filter(
      (domain) =>
        !["identity", "context", "authorization"].includes(domain),
    );

    for (const domain of businessDomains) {
      const indexPath = join(domainsRoot, domain, "index.ts");

      expect(existsSync(indexPath), indexPath).toBe(true);
      expect(statSync(indexPath).isFile(), indexPath).toBe(true);
    }
  });

  it("keeps architecture policy as a single source of truth", async () => {
    const architectureIndex = join(
      srcRoot,
      "core",
      "architecture",
      "index.ts",
    );

    expect(existsSync(architectureIndex)).toBe(true);

    const { DOMAIN_POLICIES } = await import("./domain-policy");

    expect(Object.keys(DOMAIN_POLICIES).sort()).toEqual(
      [...CORE_DOMAINS].sort(),
    );

    for (const domain of CORE_DOMAINS) {
      expect(
        DOMAIN_POLICIES[domain].responsibility.trim().length,
      ).toBeGreaterThan(0);
    }
  });
});
