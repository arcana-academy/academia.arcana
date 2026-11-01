import { describe, expect, it } from "vitest";

import { verifyHCaptchaReleaseConfiguration } from "./verify-public-runtime-config.mjs";

describe("hCaptcha protected-release preflight", () => {
  const liveSitekey = "23456789-abcd-4abc-9abc-123456789012";

  it("does not change builds without an explicit protected-release flag", () => {
    expect(verifyHCaptchaReleaseConfiguration({})).toEqual({ required: false });
    expect(
      verifyHCaptchaReleaseConfiguration({
        NEXT_PUBLIC_HCAPTCHA_SITEKEY: "",
      }),
    ).toEqual({ required: false });
  });

  it("fails closed for missing sitekey when protected release is required", () => {
    expect(() =>
      verifyHCaptchaReleaseConfiguration({
        ACADEMIA_ARCANA_REQUIRE_HCAPTCHA: "1",
      }),
    ).toThrow(/configure a non-test public sitekey/);
  });

  it("rejects the hCaptcha public test key and malformed keys", () => {
    for (const value of [
      "10000000-ffff-ffff-ffff-000000000001",
      "not-a-sitekey",
      " ",
    ]) {
      expect(() =>
        verifyHCaptchaReleaseConfiguration({
          ACADEMIA_ARCANA_REQUIRE_HCAPTCHA: "1",
          NEXT_PUBLIC_HCAPTCHA_SITEKEY: value,
        }),
      ).toThrow(/hCaptcha release preflight failed/);
    }
  });

  it("accepts a syntactically valid public sitekey without logging it", () => {
    expect(
      verifyHCaptchaReleaseConfiguration({
        ACADEMIA_ARCANA_REQUIRE_HCAPTCHA: "1",
        NEXT_PUBLIC_HCAPTCHA_SITEKEY: liveSitekey,
      }),
    ).toEqual({ required: true });
  });
});
