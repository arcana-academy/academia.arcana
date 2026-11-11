import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaptchaChallenge } from "./CaptchaChallenge";

type MockHCaptcha = {
  render: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};
type TestWindow = Window & {
  hcaptcha?: MockHCaptcha;
  aaArcanaHCaptchaLoaded?: () => void;
  aaArcanaHCaptchaReady?: boolean;
};

afterEach(() => {
  document.querySelector('script[data-aa-captcha-provider="hcaptcha"]')?.remove();
  const target = window as TestWindow;
  delete target.hcaptcha;
  delete target.aaArcanaHCaptchaReady;
  delete target.aaArcanaHCaptchaLoaded;
  vi.restoreAllMocks();
});

describe("CaptchaChallenge — hCaptcha", () => {
  it("waits for SDK readiness, emits the token and resets the widget", () => {
    const callback = vi.fn();
    const reset = vi.fn();
    const renderWidget = vi.fn((_node: HTMLElement, options: {
      sitekey: string;
      size?: string;
      theme?: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
    }) => {
      options.callback("synthetic-hcaptcha-token");
      return "widget-01";
    });
    (window as TestWindow).hcaptcha = { render: renderWidget, reset };
    const widget = render(
      <CaptchaChallenge
        provider="hcaptcha"
        siteKey="synthetic-public-sitekey"
        onTokenChange={callback}
      />,
    );

    expect(renderWidget).not.toHaveBeenCalled();
    expect(document.querySelector('script[data-aa-captcha-provider="hcaptcha"]'))
      .toHaveAttribute("src", expect.stringContaining("onload=aaArcanaHCaptchaLoaded"));

    act(() => {
      (window as TestWindow).aaArcanaHCaptchaLoaded?.();
    });

    expect(renderWidget).toHaveBeenCalledTimes(1);
    expect(renderWidget.mock.calls[0][1]).toMatchObject({
      sitekey: "synthetic-public-sitekey",
      size: "compact",
      theme: "dark",
    });
    expect(callback).toHaveBeenCalledWith("synthetic-hcaptcha-token");

    act(() => {
      renderWidget.mock.calls[0][1]["expired-callback"]();
    });
    expect(callback).toHaveBeenCalledWith(null);

    widget.unmount();
    expect(reset).toHaveBeenCalledWith("widget-01");
  });
});
