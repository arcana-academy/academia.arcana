"use client";

import { useEffect, useRef, useState } from "react";

export type AuthCaptchaProvider = "turnstile" | "hcaptcha";

type CaptchaWidgetId = string | number;

type CaptchaWidgetOptions = {
  sitekey: string;
  size?: "compact" | "flexible";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type CaptchaApi = {
  render: (element: HTMLElement, options: CaptchaWidgetOptions) => CaptchaWidgetId;
  remove?: (widgetId: CaptchaWidgetId) => void;
  reset?: (widgetId: CaptchaWidgetId) => void;
};

type CaptchaWindow = Window & {
  turnstile?: CaptchaApi;
  hcaptcha?: CaptchaApi;
  aaArcanaHCaptchaLoaded?: () => void;
  aaArcanaHCaptchaReady?: boolean;
};

const SCRIPT_URLS: Record<AuthCaptchaProvider, string> = {
  turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit&onload=aaArcanaHCaptchaLoaded&recaptchacompat=off",
};

function getCaptchaApi(provider: AuthCaptchaProvider): CaptchaApi | undefined {
  return (window as CaptchaWindow)[provider];
}

type Props = {
  provider: AuthCaptchaProvider;
  siteKey: string;
  onTokenChange: (token: string | null) => void;
};

/**
 * Generates a short-lived CAPTCHA token in the browser. The token is sent only
 * to Supabase Auth, never to application logs or a custom verification endpoint.
 * The configured provider must match Supabase Auth Bot and Abuse Protection.
 */
export function CaptchaChallenge({ provider, siteKey, onTokenChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let widgetId: CaptchaWidgetId | undefined;
    const element = container.current;
    if (!element) return;

    function invalidate() {
      if (!active) return;
      onTokenChange(null);
    }

    function markError() {
      if (!active) return;
      invalidate();
      setFailed(true);
    }

    function mountWidget() {
      if (!active || widgetId !== undefined) return;
      // hCaptcha requires its own onload callback. Script.onload can fire
      // before the SDK is ready, especially on mobile/slow connections.
      if (provider === "hcaptcha" && !(window as CaptchaWindow).aaArcanaHCaptchaReady) return;
      const api = getCaptchaApi(provider);
      if (!api) return;
      try {
        widgetId = api.render(element!, {
          sitekey: siteKey,
          size: provider === "turnstile" ? "flexible" : "compact",
          ...(provider === "hcaptcha" ? { theme: "dark" } : {}),
          callback: (token) => {
            if (!active) return;
            setFailed(false);
            onTokenChange(token);
          },
          "expired-callback": invalidate,
          "error-callback": markError,
        });
      } catch {
        markError();
      }
    }

    if (provider === "hcaptcha") {
      (window as CaptchaWindow).aaArcanaHCaptchaLoaded = () => {
        (window as CaptchaWindow).aaArcanaHCaptchaReady = true;
        document.dispatchEvent(new Event("aa-arcana-hcaptcha-ready"));
      };
      document.addEventListener("aa-arcana-hcaptcha-ready", mountWidget);
    }

    let script = document.querySelector<HTMLScriptElement>(
      `script[data-aa-captcha-provider="${provider}"]`,
    );

    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.src = SCRIPT_URLS[provider];
      script.dataset.aaCaptchaProvider = provider;
      document.head.appendChild(script);
    }

    if (provider === "turnstile") {
      script.addEventListener("load", mountWidget);
    }
    script.addEventListener("error", markError);
    mountWidget();

    return () => {
      active = false;
      script?.removeEventListener("load", mountWidget);
      script?.removeEventListener("error", markError);
      document.removeEventListener("aa-arcana-hcaptcha-ready", mountWidget);
      if (widgetId !== undefined) {
        try {
          const api = getCaptchaApi(provider);
          if (provider === "turnstile") api?.remove?.(widgetId);
          else api?.reset?.(widgetId);
        } catch {
          // The provider may have already invalidated the challenge.
        }
      }
    };
  }, [provider, siteKey, onTokenChange]);

  return (
    <div className="aa-auth-captcha">
      <div
        ref={container}
        role="group"
        aria-label="Verificação de segurança contra robôs"
      />
      {failed ? (
        <p role="alert">
          Não foi possível carregar a verificação de segurança. Atualize a página e tente novamente.
        </p>
      ) : null}
    </div>
  );
}
