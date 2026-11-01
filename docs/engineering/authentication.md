# Academia Arcana — Authentication Contract

## Status
Current authentication contract for the Next.js + Supabase implementation.
Provider-side settings that are not versioned in GitHub remain external configuration and must be verified separately.

## 1. Components
| Layer | Component | Responsibility |
| --- | --- | --- |
| UI | `src/components/auth/AuthForm.tsx` | Collects email/password and invokes Supabase Auth from the browser |
| Browser adapter | `src/infrastructure/supabase/browser.ts` | Creates the browser Supabase client with the public URL and publishable key |
| Server adapter | `src/infrastructure/supabase/server.ts` | Creates the server Supabase client and connects it to Next.js cookies |
| Session proxy | `proxy.ts` + `src/infrastructure/supabase/session.ts` | Synchronizes the Supabase session with request/response cookies and refreshes claims |
| Auth guard | `src/lib/auth/require-authenticated-user.ts` | Verifies authenticated claims server-side and redirects unauthenticated requests |
| Callback | `src/app/auth/callback/route.ts` | Exchanges a one-time authorization code for a session and allows only same-origin relative destinations |
| Server actions | `src/app/workspace/actions.ts` | Require authenticated claims before mutations |
| Identity adapter | `src/lib/identity/resolve-subject-id-server.ts` | Resolves the authenticated subject from verified claims |
| Database | Supabase Auth + Postgres RLS | Authenticates identities and enforces ownership at the data boundary |

## 2. Runtime configuration
The application reads only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for its Supabase client configuration.

They are intentionally public runtime configuration. The repository does not use `SUPABASE_SERVICE_ROLE_KEY` in application code. The publishable key is not an administrative credential; authorization is enforced by the authenticated session and Postgres RLS.

No password, access token, refresh token, database password, or service-role secret is stored in `.env.example`.

## 3. Login flow
```text
Browser
  | email + password
  v
AuthForm
  | supabase.auth.signInWithPassword(...)
  v
Supabase Auth
  | authenticated session
  v
Supabase SSR cookie/session state
  |
  v
Next.js protected route
  | createServerClient() + auth.getClaims()
  v
requireAuthenticatedUser()
  | claims.sub
  v
Application / repository
  |
  v
Supabase Postgres + RLS
```

The browser submits the password to Supabase Auth through the Supabase client. The application does not persist or log the password.

## 3.1. CAPTCHA requirement (incident 31 October 2026)
Supabase Auth returned `captcha_failed` with HTTP 400 for password login, signup,
and password recovery when no `captcha_token` was supplied. This requires
integrating the challenge in all three browser flows before enabling the
provider-side CAPTCHA toggle.

Configure `NEXT_PUBLIC_AUTH_CAPTCHA_PROVIDER` as `turnstile` or `hcaptcha`,
and `NEXT_PUBLIC_AUTH_CAPTCHA_SITE_KEY` to the matching provider's **public**
site key. The provider and secret key **must match the active Supabase Auth**
Bot and Abuse Protection configuration. Never put the CAPTCHA secret key in
GitHub, browser code, or `NEXT_PUBLIC_*` variables. The authorized operator
must verify the provider in the Supabase dashboard; it is not readable by the
connected Supabase tools.

The CAPTCHA component obtains a temporary token, sends it only to Supabase
Auth, blocks requests without a token when configured, and reinitializes the
challenge after an authentication attempt. Tokens are not logged. Keep the
provider's hostname allow-list limited to the actual live domain, and validate
with a test identity before opening public access. A Render build must include
the public site key at build time to embed it in Next.js client assets.

No supported provider/site key is hard-coded; the code does not relax RLS,
password requirements, or the protected release's NO-GO. An absent provider
configuration still requires an operator fix; deploying only this source
change cannot resolve the current hosted login failure.

## 4. Signup and recovery
`AuthForm` uses Supabase Auth for signup, email confirmation, password recovery, and password update. The application does not implement its own password store.

Password recovery deliberately returns a generic success message so the form does not enumerate accounts.

## 5. Callback and code exchange
The callback receives a short-lived authorization `code`. A missing `code` is rejected. For the optional `next` destination, invalid values—including absolute URLs, protocol-relative paths such as `//evil.example`, malformed input, and destinations whose resolved origin differs from the application origin—are normalized to `/` before the callback continues.

Only after that destination normalization does the server call `supabase.auth.exchangeCodeForSession(code)`. Failed code exchanges redirect to `/login?error=auth`.

## 6. Session and token handling
The repository delegates session and token lifecycle to `@supabase/ssr` and Supabase Auth.

- Browser: `createBrowserClient()` uses the public project URL and publishable key.
- Server: `createServerClient()` reads the Supabase session through Next.js cookies.
- Proxy: `proxy.ts` invokes `updateSupabaseSession()`, which reads request cookies, calls `auth.getClaims()`, propagates cookie changes, and marks the response `Cache-Control: private, no-store`.
- The application does not manually parse, sign, persist, rotate, or log JWTs.

## 7. Authorization boundary
Authentication is not treated as authorization.

```text
request
  -> authenticated claims
  -> subject id (claims.sub)
  -> application operation
  -> Supabase query
  -> PostgreSQL RLS
  -> owner/context validation
```

Workspace RLS uses `auth.uid()` to enforce ownership through the hierarchy Grimoire → Notebook → Chapter → Page.

## 8. Server-side mutation contract
Workspace Server Actions call `requireAuthenticatedUser()` before accessing repositories. Client-supplied IDs are not trusted as proof of ownership; RLS remains the database-level authorization boundary.

## 9. Logout
Logout uses the server Supabase client and `supabase.auth.signOut()`, then redirects to `/login`. No application-level token blacklist or custom credential store is maintained.

## 10. Credential and secret invariants
1. Never introduce `SUPABASE_SERVICE_ROLE_KEY` into browser code.
2. Never put database passwords or service-role secrets in `NEXT_PUBLIC_*` variables.
3. Never log passwords, access tokens, refresh tokens, authorization codes, or cookies.
4. Never persist passwords in application tables.
5. Never use authentication as a substitute for RLS/ownership checks.
6. Never accept an arbitrary external callback destination.
7. Never return provider error text directly when it can disclose authentication-sensitive information.
8. Keep provider credentials in environment/provider configuration rather than source control.

## 11. External provider checks
The repository cannot by itself prove the target Supabase environment's email-confirmation setting, leaked-password protection, abuse/rate-limit settings, production redirect allow-list, production environment variables, or operational Auth backup/restore capability.

Those are external configuration/evidence items and must not be marked verified from source code alone.

## 12. Validation
Authentication changes must pass typecheck, lint, unit/component tests, accessibility tests, production build, callback redirect safety tests, and E2E tests when dedicated non-production authentication credentials are available. Ownership-sensitive operations must also pass database/RLS tests.

Static builds and repository unit tests must not require production secrets.