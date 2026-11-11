"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type HCaptchaAPI = {
  render: (
    container: HTMLElement,
    settings: {
      sitekey: string;
      size: "compact";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      "chalexpired-callback": () => void;
    },
  ) => number;
  reset: (widgetId: number) => void;
  remove?: (widgetId: number) => void;
};

declare global {
  interface Window {
    hcaptcha?: HCaptchaAPI;
    __aaHCaptchaReady?: () => void;
  }
}

export type HCaptchaChallengeHandle = {
  reset: () => void;
};

type HCaptchaChallengeProps = {
  sitekey: string;
  onTokenChange: (token: string | null) => void;
};

let loadingScript: Promise<HCaptchaAPI> | null = null;

// Official hCaptcha SDK. No npm dependency and no secret is handled in the browser.
function loadHCaptcha(): Promise<HCaptchaAPI> {
  if (window.hcaptcha) return Promise.resolve(window.hcaptcha);

  if (!loadingScript) {
    loadingScript = new Promise<HCaptchaAPI>((resolve, reject) => {
      const script = document.createElement("script");
      // hCaptcha's onload callback waits for its internal DOM initialization.
      // Calling render from the script load event can race that initialization.
      window.__aaHCaptchaReady = () => {
        if (window.hcaptcha) resolve(window.hcaptcha);
        else reject(new Error("hCaptcha SDK unavailable"));
      };
      script.src =
        "https://js.hcaptcha.com/1/api.js?onload=__aaHCaptchaReady&render=explicit&recaptchacompat=off";
      script.async = true;
      script.addEventListener(
        "error",
        () => {
          script.remove();
          reject(new Error("hCaptcha SDK failed to load"));
        },
        { once: true },
      );
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      loadingScript = null;
      throw error;
    });
  }

  return loadingScript;
}

export const HCaptchaChallenge = forwardRef<
  HCaptchaChallengeHandle,
  HCaptchaChallengeProps
>(function HCaptchaChallenge({ sitekey, onTokenChange }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const callback = useRef(onTokenChange);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    callback.current = onTokenChange;
  }, [onTokenChange]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      callback.current(null);
      if (widgetId.current !== null) {
        window.hcaptcha?.reset(widgetId.current);
      }
    },
  }), []);

  useEffect(() => {
    let active = true;
    void loadHCaptcha()
      .then((api) => {
        if (!active || !container.current) return;
        widgetId.current = api.render(container.current, {
          sitekey,
          size: "compact",
          callback: (token) => {
            if (!active) return;
            setLoadError(false);
            callback.current(token);
          },
          "expired-callback": () => {
            if (active) callback.current(null);
          },
          "chalexpired-callback": () => {
            if (active) callback.current(null);
          },
          "error-callback": () => {
            if (!active) return;
            callback.current(null);
            setLoadError(true);
          },
        });
      })
      .catch(() => {
        if (!active) return;
        callback.current(null);
        setLoadError(true);
      });

    return () => {
      active = false;
      if (widgetId.current !== null) {
        window.hcaptcha?.remove?.(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [sitekey]);

  return (
    <div className="aa-auth-captcha">
      <p>Verificação de segurança: confirme que você é uma pessoa.</p>
      <div ref={container} aria-label="Verificação hCaptcha" />
      {loadError ? (
        <p role="alert">
          A verificação de segurança está indisponível. Recarregue a página e tente novamente.
        </p>
      ) : null}
    </div>
  );
});
