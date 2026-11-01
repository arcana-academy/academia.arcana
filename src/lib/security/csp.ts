export type ContentSecurityPolicyOptions = {
  /**
   * Builds the policy for local development.
   *
   * Development responses send this policy as `Content-Security-Policy-Report-Only`
   * instead of enforcing it, because the tooling cannot satisfy a nonce-only
   * policy: `next dev` compiles with the webpack `eval-source-map` devtool
   * (Next.js reverts custom `devtool` overrides in development) and Fast Refresh
   * injects `<style>` elements without a nonce.
   *
   * The relaxations therefore never reach production: production responses
   * enforce a policy without `'unsafe-eval'`, without inline scripts and with
   * nonce-bound style elements.
   */
  readonly isDevelopment?: boolean;
};

export function createContentSecurityPolicy(
  nonce: string,
  options: ContentSecurityPolicyOptions = {},
): string {
  const isDevelopment =
    options.isDevelopment ?? process.env.NODE_ENV === "development";

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // Scripts stay nonce-based in both modes. `'unsafe-eval'` is only present
    // in the development report-only policy, which is never enforced.
    isDevelopment
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://hcaptcha.com https://*.hcaptcha.com`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://hcaptcha.com https://*.hcaptcha.com`,
    isDevelopment
      ? "style-src 'self' 'unsafe-inline' https://use.typekit.net https://hcaptcha.com https://*.hcaptcha.com"
      : `style-src 'self' 'nonce-${nonce}' https://use.typekit.net https://hcaptcha.com https://*.hcaptcha.com`,
    "script-src-attr 'none'",
    // React `style={{...}}` attributes cannot carry a nonce, so the attribute
    // directive must allow inline styles. Keeping it scoped to
    // `style-src-attr` means `<style>`, `<link rel=stylesheet>` and inline
    // `<style>` blocks still require the request nonce.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://use.typekit.net",
    isDevelopment
      ? "connect-src 'self' https: wss: ws: http: https://hcaptcha.com https://*.hcaptcha.com"
      : "connect-src 'self' https: wss: https://hcaptcha.com https://*.hcaptcha.com",
    "frame-src 'self' https: https://hcaptcha.com https://*.hcaptcha.com",
    "media-src 'self' data: blob: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];

  if (!isDevelopment) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}

/**
 * Development policies are reported, not enforced, so that HMR and Fast Refresh
 * keep working while CSP regressions still surface in the browser console.
 *
 * Production always enforces.
 */
export function getContentSecurityPolicyHeaderName(
  options: ContentSecurityPolicyOptions = {},
): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  const isDevelopment =
    options.isDevelopment ?? process.env.NODE_ENV === "development";

  return isDevelopment
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";
}
