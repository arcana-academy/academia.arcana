# Academia Arcana — hCaptcha Free: prepared / NO-GO

## Scope
- Isolated integration for `src/components/auth/AuthForm.tsx`: login, signup and password-reset email.
- Do NOT add CAPTCHA to `updateUser({ password })` after authenticated recovery.
- CAPTCHA tokens are obtained only by the official browser SDK; Supabase Auth must perform the server-side verification.
- No new npm packages, paid resources, tokens in logs, external server routes, new databases or RLS changes.
- This change does **not** activate CAPTCHA protection on the live Supabase project.
- Production release remains **NO-GO**, Render Auto Deploy OFF, with all existing approval gates preserved.

## Configuration contract
1. **Create a site** in https://dashboard.hcaptcha.com/sites using the free/publisher tier as available, and obtain the **public sitekey**. Only the sitekey may reach the browser.
2. Obtain the **secret key** from hCaptcha account settings. Never put it in Git, a GitHub issue/PR, `NEXT_PUBLIC_*`, browser code, client telemetry or build arguments.
3. For **isolated tests**, set `NEXT_PUBLIC_HCAPTCHA_SITEKEY` to the non-production sitekey in the Next.js build environment. The Docker builder and runtime accept this **public** build argument; an existing built image must be rebuilt for the public variable to take effect.
4. In the **separate, non-production Supabase project** only, go to Project Settings > Authentication > Bot and Abuse Protection, select **hCaptcha**, paste its secret in the provider dashboard securely, and enable CAPTCHA. Only enable after the updated frontend is deployed in that same test environment.
5. Test `/login`, `/cadastro`, `/recuperar-senha`, and `/redefinir-senha`, including mobile viewport and keyboard-only navigation.
6. Only after a release is separately authorized, configure the production **public sitekey** as a build-time public environment variable, confirm the built image actually contains it, deploy the verified frontend under the established release procedure, and then enable CAPTCHA in Supabase. Never enable the server gate first.

## Fail-closed behavior
- With no public sitekey configured, existing authentication behavior is unchanged. This is a compatibility state, **not** evidence of bot protection.
- With a public sitekey configured, `AuthForm` requires a fresh completed challenge before each Supabase Auth request.
- The token is sent through `options.captchaToken` for signup/login or `captchaToken` for reset-password requests, then is reset after the request.
- Expired tokens and client SDK errors invalidate the challenge.
- If SDK initialization fails, the page presents a generic retry message. The Supabase call is not sent without a token.
- A missing or forged token must also be rejected by Supabase Auth **when server CAPTCHA is enabled**. Client-only checks are not a security boundary.
- Keep normal sign-in, password validation, generic account-recovery responses, rate limits, MFA, RLS and all other defenses.

## CSP
The existing nonce-based, strict-dynamic CSP remains in force. Only the official `https://hcaptcha.com` and `https://*.hcaptcha.com` sources were added as documented. No global `unsafe-inline` or `unsafe-eval` permission was introduced in production.

## Required validation before release
- Run `npm run typecheck`, `npm run lint`, and `npm test -- src/components/auth/AuthForm.test.tsx src/lib/security/csp.test.ts`.
- Run the non-production production build and all applicable authorization/accessibility/E2E gates. Keep previous green evidence; do not falsely mark unrun checks PASS.
- Confirm successful CAPTCHA token, missing token, invalid token, expired token, reused token, provider network failure, browser script block and small mobile viewport.
- Confirm provider's secret is configured and private in **test** Auth, no real student credentials used.
- Confirm fake accounts and generic recovery responses are handled correctly and no errors enumerate accounts.
- Observe external policy/API behavior, including CSP on real Chromium; unit mocks alone do not prove live hCaptcha compatibility.
- Add release evidence to draft PR; preserve NO-GO without the authorized release process.

## References
- https://docs.hcaptcha.com/integrations
- https://docs.hcaptcha.com/configuration
- https://docs.hcaptcha.com/
- https://supabase.com/docs/guides/auth/auth-captcha
