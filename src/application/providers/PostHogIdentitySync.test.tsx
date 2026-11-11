import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationIdentityState } from "@/application/identity/contracts";

const mocks = vi.hoisted(() => ({
  identify: vi.fn(),
  reset: vi.fn(),
  isIdentified: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    identify: mocks.identify,
    reset: mocks.reset,
    _isIdentified: mocks.isIdentified,
  },
}));

import { PostHogIdentitySync } from "./PostHogIdentitySync";

const authenticated: ApplicationIdentityState = {
  status: "authenticated",
  identity: { subjectId: "user-123", status: "active" },
  error: null,
};

const anonymous: ApplicationIdentityState = {
  status: "anonymous",
  identity: null,
  error: null,
};

describe("PostHogIdentitySync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("identifica a pessoa autenticada pelo subjectId", () => {
    render(<PostHogIdentitySync identity={authenticated} />);

    expect(mocks.identify).toHaveBeenCalledWith("user-123");
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("reinicia a identidade depois do logout", () => {
    mocks.isIdentified.mockReturnValue(true);
    const { rerender } = render(<PostHogIdentitySync identity={authenticated} />);

    rerender(<PostHogIdentitySync identity={anonymous} />);

    expect(mocks.reset).toHaveBeenCalledTimes(1);
  });

  it("preserva o id anônimo de quem nunca entrou", () => {
    mocks.isIdentified.mockReturnValue(false);

    render(<PostHogIdentitySync identity={anonymous} />);

    expect(mocks.identify).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("não chama o SDK quando o PostHog não está configurado", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

    render(<PostHogIdentitySync identity={authenticated} />);

    expect(mocks.identify).not.toHaveBeenCalled();
  });
});
