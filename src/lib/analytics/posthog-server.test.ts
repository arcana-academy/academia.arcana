import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  constructor: vi.fn(),
}));

vi.mock("posthog-node", () => ({
  PostHog: class {
    capture = mocks.capture;

    constructor(...args: unknown[]) {
      mocks.constructor(...args);
    }
  },
}));

async function loadCaptureServerEvent() {
  vi.resetModules();
  return (await import("./posthog-server")).captureServerEvent;
}

describe("captureServerEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("não envia nada e avisa fora de produção quando a chave está ausente", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const captureServerEvent = await loadCaptureServerEvent();

    captureServerEvent("user-123", "feedback_submitted");

    expect(mocks.constructor).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("NEXT_PUBLIC_POSTHOG_KEY"),
    );
  });

  it("reutiliza um único cliente por processo", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
    const captureServerEvent = await loadCaptureServerEvent();

    captureServerEvent("user-123", "feedback_submitted", { feedback_length: 3 });
    captureServerEvent("user-456", "feedback_submitted");

    expect(mocks.constructor).toHaveBeenCalledTimes(1);
    expect(mocks.constructor).toHaveBeenCalledWith("phc_test", {
      host: "https://us.i.posthog.com",
    });
    expect(mocks.capture).toHaveBeenCalledWith({
      distinctId: "user-123",
      event: "feedback_submitted",
      properties: { feedback_length: 3 },
    });
  });

  it("nunca propaga falhas do SDK para a requisição", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    mocks.capture.mockImplementation(() => {
      throw new Error("network down");
    });
    const captureServerEvent = await loadCaptureServerEvent();

    expect(() => captureServerEvent("user-123", "feedback_submitted")).not.toThrow();
  });
});
