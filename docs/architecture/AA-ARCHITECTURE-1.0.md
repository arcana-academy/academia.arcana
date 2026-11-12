# Academia Arcana — AA-ARCHITECTURE-1.0

## Status

**CANÔNICO — OPERATIONAL ARCHITECTURE BASELINE**

This document is the operational companion to the conceptual architecture specification. The conceptual specification remains historical/strategic; this document records the architecture as currently formalized in the repository.

**Repository:** `arcana-academy/academiaarcana`  
**Canonical branch:** `main`  
**Last repository revision captured by this architecture evidence:** `8022041c4eb1b80aa97aea7db8b7be5e0a7e979e`
**Latest observed production deployment evidence captured by this record:** Render deploy `dep-db1a5ig473hc738soqhg` was `LIVE` for repository revision `8022041c4eb1b80aa97aea7db8b7be5e0a7e979e`. Production Smoke `37226740318` completed successfully for the same revision and verified the production alias, health/readiness endpoints, public runtime routes, CSP and integration-status contract. The record is intentionally an evidence snapshot; later documentation-only commits may advance `main` without invalidating this captured runtime evidence. No application-runtime source change is attributed to this evidence synchronization.
**Prior live snapshot (historical):** deploy `dep-db0qg28ae00c73et8nug` for commit `393b841e34bf524518aa5ab886415fece7994ea8`
**Latest architecture audit:** `docs/architecture/AA-ARCHITECTURE-AUDIT-CONTINUATION-2026-10-04.md`

Status vocabulary:

- **CANÔNICO** — official architectural decision in force.
- **CONFIRMADO** — supported by repository or external evidence, but not itself a design decision.
- **IMPLEMENTADO** — represented in repository code.
- **VALIDADO** — covered by an appropriate automated or reviewable verification.
- **PROPOSTA** — not adopted.
- **PENDENTE** — unresolved decision or implementation required for this document's scope.
- **CONFLITANTE** — contradictory evidence exists.
- **DESCONHECIDO** — insufficient evidence.

---

## 0. Current-state reconciliation — 2026-10-04

The captured repository revision for this evidence record is `8022041c4eb1b80aa97aea7db8b7be5e0a7e979e`. Render deploy `dep-db1a5ig473hc738soqhg` for this revision is LIVE, and Production Smoke `37226740318` completed successfully with an exact production revision assertion. Later documentation-only commits may advance `main`; this record must be read as a captured evidence checkpoint rather than a perpetual HEAD claim.

For captured revision `8022041c...`, main Quality Gate run `37226554183`, Database Tests run `37226554114`, CodeQL run `37226554200`, Gitleaks run `37226554129` and Scorecard run `37226554141` completed successfully. Production Smoke run `37226740318` completed successfully for `8022041c...` and verified the production alias, health/readiness endpoints, public runtime routes, CSP and integration-status contract. Production Smoke remains separate post-deploy evidence and is not treated as an input to Render promotion.

The earlier audit records and the `393b841e34bf524518aa5ab886415fece7994ea8` deployment are historical evidence. Operational recovery exercises tracked separately remain distinct from architecture closure.

## 1. Architectural model

Academia Arcana uses a **modular monolith**.

The application remains an integrated product, while business responsibilities are separated into explicit domains. The monolith is therefore organized by architectural boundaries rather than by screens or arbitrary folders.

### Core rule

> High cohesion, low coupling, explicit contracts, controlled dependencies, proportional complexity.

### Non-goals

- No premature microservices.
- No distributed architecture merely for architectural appearance.
- No universal database client owned by AI or UI.
- No domain created only to organize files.
- No duplicate business invariants merely to satisfy a layer diagram.

---

## 2. Logical layers

The current architectural layer model is:

```text
ui
 ↓
application
 ↓
domain
 ↓
ports
 ↑
infrastructure
```

These are **logical responsibilities**, not mandatory directory names.

### UI

Pages, components, interaction, visual state and accessibility behavior.

### Application

Use-case orchestration and application services.

### Domain

Business concepts, invariants and domain behavior.

### Ports

Consumer-owned contracts expressing required capabilities.

### Infrastructure

Concrete persistence, external providers, adapters and runtime technical details.

---

## 3. Canonical domains

The repository currently formalizes **14 domains**:

1. identity
2. context
3. authorization
4. learning
5. planning
6. gamification
7. education
8. social
9. adaptive
10. intelligence
11. flonts
12. trust
13. data
14. sanctuary

The domain registry is implemented in `src/core/architecture/domains.ts`.

The first three foundations are represented under `src/core`; the business domains are represented under `src/domains`. This physical split does not change their logical status as architectural domains.

---

## 4. Domain responsibility contract

The canonical policy is implemented in `src/core/architecture/domain-policy.ts`.

| Domain | Canonical responsibility | Excludes |
|---|---|---|
| identity | Stable identity and identity lifecycle | authorization, full profile, context membership, UI preferences, gamification |
| context | Resolve action/resource context, membership context and visibility semantics | authorization decisions, authentication, UI rendering |
| authorization | Decide whether an actor may perform an action on a resource in a context | authentication, context ownership, UI visibility, business content |
| learning | Learning processes and learner progress | educational content ownership, planning policy, visual presentation |
| planning | Study planning and productivity orchestration | learning progress invariants, gamification rewards, UI layout |
| gamification | XP, levels, missions, achievements, streak and rewards | identity ownership, authorization policy, learning content, UI effects |
| education | Educational content and educational structures | learner progress, planning state, authorization decisions |
| social | Social relationships, groups and social interaction | authorization policy, context policy, private resource ownership |
| adaptive | Bounded adaptation and personalization signals | unrestricted data access, identity authority, authorization policy |
| intelligence | Authorized Master Arcane orchestration and tool/context boundaries | superuser access, universal table access, unbounded mutation |
| flonts | Scoped Flonts runtime/product experience | universal data access, authorization bypass, ownership outside Flonts |
| trust | Trust, safety and governance distinct from access decisions | authorization policy, unbounded surveillance, content ownership |
| data | Persistence and portability infrastructure | business invariants, authorization ownership, UI state |
| sanctuary | Personalized learner entry point, snapshot, continuation and priorities | learning progress ownership, educational ownership, planning policy, authorization, UI rendering |

### Resolution of previous pending boundary questions

- **Learning vs Education:** Learning owns learning processes/progress; Education owns educational content/structures.
- **Context:** owns context resolution, membership context and visibility semantics; it does not make authorization decisions.
- **Trust:** owns trust/safety/governance mechanisms distinct from authorization.
- **Flonts:** owns the scoped Flonts runtime/product layer, not universal application data.
- **Data:** owns persistence/portability infrastructure, not business-domain state.
- **Sanctuary:** is a formal domain, not merely a page-level feature.

These are now **CANÔNICO + IMPLEMENTADO**.

---

## 5. Canonical dependency matrix

The dependency matrix is derived from the domain policies and validated for unknown, duplicate, self and cyclic dependencies.

### Allowed dependencies

```text
identity      -> none
context       -> identity
authorization -> identity, context
learning      -> identity, context, authorization, education
planning      -> identity, context, authorization, learning
gamification  -> identity, context, authorization, learning, planning
education     -> identity, context, authorization
social        -> identity, context, authorization
adaptive      -> identity, context, authorization, learning, education
intelligence  -> identity, context, authorization, learning, education, adaptive
flonts        -> identity, context, authorization
trust         -> identity, context, authorization
data          -> none
sanctuary     -> identity, context, authorization, learning, education, planning, gamification, adaptive
```

### Architectural direction

```text
ui -> application
application -> domain
domain -> ports
infrastructure -> ports
```

Cross-domain imports are checked against the declared dependency policy and must use public domain barrels rather than private internals.

State: **CANÔNICO + IMPLEMENTADO + VALIDADO**.

---

## 6. Domain communication contract

Cross-domain communication is explicitly classified as:

- **Query** — read request.
- **Command** — change intent.
- **Event** — immutable fact after a successful change.

Direct domain communication therefore requires:

```text
source
target
kind = query | command
contractName
```

Events require:

```text
source
kind = event
eventName
```

A domain event belongs to its producer. Direct communication to self, unknown targets, undeclared targets, unnamed contracts and undeclared events are invalid.

Implemented in:

```
src/core/architecture/domain-communication.ts
src/core/architecture/domain-communication.test.ts
```

State: **CANÔNICO + IMPLEMENTADO + VALIDADO**.

---

## 7. Commands, Queries, Use Cases, Ports, Repositories and Events

### Commands

Represent the **intention to change**.

### Queries

Represent reads without business side effects.

### Use Cases

Represent the **unit of application behavior** and orchestrate an operation.

### Ports

Contracts owned by the consumer/domain defining the required capability.

### Repositories

Persistence ports implemented by infrastructure.

### Events

Immutable facts emitted after a successful state transition when another part of the system needs to react or record the fact.

This semantic separation is canonical.

---

## 8. Persistent data ownership

The ownership registry is implemented in:

```
src/core/architecture/data-ownership.ts
src/core/architecture/data-ownership.test.ts
```

### Current ownership

| Resource | Kind | Owner |
|---|---|---|
| public.grimoires | table | learning |
| public.notebooks | table | learning |
| public.chapters | table | learning |
| public.pages | table | learning |
| public.page_progress | table | learning |
| public.study_tasks | table | planning |
| public.gamification_profiles | table | gamification |
| public.missions | table | gamification |
| public.focus_sessions | table | planning |
| public.friend_connections | table | social |
| public.feedback_responses | table | trust |
| public.educational_practice_items | table | education |
| public.educational_practice_attempts | table | education |
| public.integration_credentials | table | infrastructure |
| public.external_document_sources | table | infrastructure |
| public.complete_study_task_with_reward | database-rpc | cross-domain |
| public.record_educational_practice_attempt | database-rpc | cross-domain |
| public.record_criterion_referenced_practice_attempt | database-rpc | cross-domain |
| public.move_workspace_page | database-rpc | learning |
| storage.grimoire-covers | storage-bucket | learning |

The two educational-practice RPCs coordinate `education` (educational evidence) and `learning` (learner progress) without transferring ownership of `public.page_progress` from `learning`.

### Ownership rules

1. Domain ownership does not move merely because another domain consumes the data.
2. Cross-domain transactions may coordinate invariants without transferring ownership.
3. Infrastructure credentials and external-source descriptors remain infrastructure resources.
4. Storage is a persistence mechanism; semantic ownership stays with the relevant business domain.
5. Data is not a universal business-domain owner.

State: **CANÔNICO + IMPLEMENTADO + VALIDADO**.

---

## 9. Application/use-case inventory

The current implementation inventory is intentionally evidence-based.

### Implemented application behavior

**Identity**
- IdentityResolver
- identity contracts

**Learning**
- Workspace service
- Workspace state

**Planning**
- StudyTaskService
- FocusSessionService

**Gamification**
- Complete study task / reward orchestration

**Intelligence**
- Execute Mestre Arcano

**Flonts**
- FlontsProvider

**Sanctuary**
- getSanctuary
- sanctuary view-model assembly

**Accessibility**
- accessibility-preferences application provider/context/hooks

### Domains with canonical contracts but no dedicated application use-case implementation currently visible

- education
- social
- adaptive
- trust
- data

This is **not an architectural defect**. It means these domains currently provide contracts/policy boundaries while their future application behaviors remain implementation scope for the corresponding product capabilities.

No placeholder use cases are created merely to make every domain appear symmetric.

State: **CONFIRMADO + IMPLEMENTADO PARCIALMENTE**.

---

## 10. Infrastructure/repository ownership

Concrete persistence remains infrastructure.

Known repository families include:

- Learning workspace repositories
- Learning page-progress repository
- Planning study-task repository
- Planning focus-session repository
- Gamification repository
- study-task reward repository
- Sanctuary repository
- Trust feedback repository
- Intelligence document-source repository

The application/server boundary composes these concrete adapters as needed.

The rule is not “never instantiate infrastructure from a server boundary”; the rule is that business/domain code must not depend on infrastructure details.

---

## 11. Focus architecture — resolved

The Focus persistence boundary was previously an architectural gap.

It is now resolved.

Current flow:

```text
src/app/foco/actions.ts
    ↓
FocusSessionService
    ↓
FocusSessionRepository
    ↓
SupabaseFocusSessionRepository
    ↓
focus_sessions
```

The Server Action no longer performs `.from("focus_sessions")` directly.

The implementation includes:

- duration validation;
- authenticated owner binding;
- FocusSession domain contract;
- repository port;
- Supabase adapter;
- service tests;
- adapter tests;
- architectural boundary test.

PR #419 was merged into `main` as commit `fb227dff47420495ab03b2a8e6cf786a760e12d2`.

State: **IMPLEMENTADO + VALIDADO**.

---

## 12. Mestre Arcano architecture — resolved

The AI runtime is not a universal database client.

The current architecture uses:

```text
authenticated route
    ↓
server-side context composition
    ↓
MestreArcanoToolContext
    ├── learner port
    └── document port
             ↓
authorized infrastructure adapters
             ↓
Supabase / SharePoint / external providers
```

The OpenAI runtime and tools do not directly access Supabase.

The Intelligence boundary now exposes:

- typed learner snapshots;
- typed mission snapshots;
- typed study-task snapshots;
- typed SharePoint source snapshots;
- typed document context;
- learner context port;
- document context port;
- composite tool context.

Credential ownership and authenticated-subject binding are preserved at the server boundary.

PR #417 was merged into `main` as commit `ae53e2d5dec033ac4d00fca6d938e0aa9926fa83`.

State: **CANÔNICO + IMPLEMENTADO + VALIDADO**.

---

## 13. AI safety and authority

The Master Arcane:

- is an assistant, not a superuser;
- receives only authorized/minimum context required by tools;
- cannot grant itself permissions;
- cannot access arbitrary tables by model choice;
- must not invent learner progress, notes, tasks, XP, streaks, missions or personal data;
- must treat external document content as untrusted data;
- keeps credentials server-side;
- uses typed boundary DTOs rather than domain internals.

High-impact changes must remain subject to the appropriate application authorization and confirmation rules.

---

## 14. Security architecture

Canonical security principles:

- least privilege;
- server-side authorization;
- Supabase RLS;
- owner scoping;
- input validation;
- data minimization;
- separation of identity and authorization;
- no unnecessary superuser capability;
- no client exposure of server secrets.

The frontend is never treated as the security boundary.

RLS and application authorization complement each other.

State: **CANÔNICO**.

---

## 15. Accessibility and neurodesign

Baseline:

**WCAG 2.2 AA**

Accessibility is structural and cross-cutting.

Required architectural support includes:

- keyboard navigation;
- visible focus;
- semantic markup;
- screen-reader compatibility;
- scalable typography;
- contrast;
- reduced motion;
- predictable interactions;
- user-controlled preferences;
- cognitive-load reduction;
- personalization without component duplication.

Existing application/core support includes an accessibility-preferences module with motion/environment resolution and preference merging.

State: **CANÔNICO + IMPLEMENTADO PARCIALMENTE**.

---

## 16. Product architecture mapping

| Product area | Primary architectural owner |
|---|---|
| Santuário | sanctuary, consuming planning/learning/gamification/adaptive context |
| Academia | education + learning experience |
| Grimórios | learning |
| Capítulos | learning |
| Páginas | learning |
| Missões | gamification |
| Cronograma | planning |
| Foco | planning |
| Streak | gamification |
| Estatísticas | projection of learning/gamification data |
| Conquistas | gamification |
| Amigos | social |
| Perfil | identity/application-facing profile capabilities |
| Personalização | accessibility/preferences + adaptive where applicable |
| Configurações | application/integration configuration surfaces |
| Mestre Arcano | intelligence |
| Flonts | flonts |

This table is an ownership map, not a prohibition on a view consuming other domains.

---

## 17. Repository-to-architecture mapping

### Foundation

```
src/core/identity
src/core/context
src/core/authorization
src/core/architecture
src/core/accessibility-preferences
```

### Domains

```
src/domains/adaptive
src/domains/data
src/domains/education
src/domains/flonts
src/domains/gamification
src/domains/intelligence
src/domains/learning
src/domains/planning
src/domains/sanctuary
src/domains/social
src/domains/trust
```

### Application

The application layer currently contains implemented behavior for Identity, Learning, Planning, Gamification, Intelligence, Flonts and Sanctuary, plus accessibility/preferences infrastructure at the application boundary.

### Infrastructure

Concrete persistence and integration adapters remain under `src/infrastructure`.

### Composition root / server boundary

Next.js App Router server routes, Server Actions, layouts and explicitly designated server-side composition modules act as **composition roots** for the modular monolith. They may instantiate concrete infrastructure adapters and wire them into application services/use cases.

The boundary is:

```text
server composition root
    ├── application use case
    └── infrastructure adapter
             ↓
        domain-owned port
```

This is wiring, not business ownership. The following remain prohibited:

- domain importing infrastructure;
- application use-case code importing concrete infrastructure;
- client components importing server-only infrastructure;
- business invariants being placed in the composition root.

This formalizes the repository's existing pattern while preserving dependency inversion at the domain/application boundary.

The physical organization has now been reconciled with the logical architecture closely enough for the current monolith.

---

## 18. Architectural verification

Current repository safeguards include:

### Domain policy validation

Checks:

- exact domain registry;
- policy coverage;
- forbidden presentation/infrastructure dependencies;
- declared dependency direction;
- acyclic matrix;
- duplicate/self/unknown dependency rejection.

### Communication validation

Checks:

- allowed communication targets;
- command/query classification;
- producer-owned event declarations;
- contract/event naming;
- self-communication rejection.

### Data ownership validation

Checks:

- unique resource ownership;
- approved owners;
- approved supporting domains;
- explicit cross-domain transaction ownership;
- storage classification.

### Import boundary validation

Checks:

- no React/Next/Supabase dependencies in domain/core source;
- no local cycles across the measured architecture graph;
- only declared cross-domain dependencies;
- public-barrel usage;
- no infrastructure/presentation leakage through domain barrels.

State: **IMPLEMENTADO + VALIDADO**.

---

## 19. Historical technical validation

The file `docs/engineering/technical-validation.md` records a prior validation cycle and must be read as historical evidence, not current live status.

It documents a successful clean-room pipeline on an earlier baseline.

Current package/runtime values are read from the current repository and are not taken from that historical report.

This distinction is intentional and canonical.

---

## 20. Resolved architecture pendências

The following previously identified items are now closed as architecture decisions:

| Previous pending item | Resolution | State |
|---|---|---|
| Learning/Education boundary | Learning owns process/progress; Education owns content/structure | CLOSED |
| Context boundary | context owns context/membership/visibility; authorization owns access decisions | CLOSED |
| Trust scope | trust/safety/governance distinct from authorization | CLOSED |
| Flonts scope | scoped runtime/product layer without universal data access | CLOSED |
| Data boundary | persistence/portability infrastructure without business ownership | CLOSED |
| Sanctuary status | formal architecture domain | CLOSED |
| Domain dependency matrix | explicit and validated | CLOSED |
| Domain communication model | query/command/event contract | CLOSED |
| Persistent data ownership | explicit resource ownership contract | CLOSED |
| Mestre Arcano boundary | typed authorized learner/document ports | CLOSED |
| Focus persistence boundary | Planning application/service + repository | CLOSED |
| Domain ↔ code mapping | 14-domain registry plus physical domain barrels | CLOSED |
| Historical vs current validation | explicit distinction in this document | CLOSED |

---

## 21. Educational persistence reconciliation

The current Supabase schema contains `public.educational_practice_items` and `public.educational_practice_attempts`, both with RLS enabled. Their persistence ownership is **education**, while learner-progress effects remain governed by the learning domain. Educational evidence writes are constrained by the authenticated atomic RPC boundary already represented in the migration history and database tests.

This separation preserves the Learning/Education boundary: Education owns educational practice content/evidence structures; Learning owns learner progress and progression state.

State: **CANÔNICO + IMPLEMENTADO + VALIDADO**.

## 22. Items intentionally not promoted to architectural debt

The following are implementation backlog, not unresolved architectural decisions:

- adding new use cases for domains whose product capabilities have not yet been implemented;
- adding future repositories for future resources;
- adding future events for future workflows;
- adding future integrations;
- expanding statistics beyond currently available evidence;
- implementing future education/social/adaptive/trust/data behaviors.

No empty placeholder architecture is required for these items.

---

## 23. Current risks

### Risk: application composition can grow too broad

Server boundaries may compose several adapters. This is acceptable while the composition remains orchestration and does not absorb domain rules.

### Risk: Data becomes a catch-all abstraction

Controlled by explicit ownership and the rule that Data does not own business invariants.

### Risk: Intelligence becomes a superdomain

Controlled by typed, authorized context ports and bounded tool contracts.

### Risk: new domains bypass the registry

Controlled by explicit domain registry/policy validation.

### Risk: documentation drifts from code

Controlled by this operational baseline and the architectural tests.

### Risk: sensitive integration credentials remain in an exposed application table

The current `public.integration_credentials` table has RLS enabled and no `anon` table privileges, while `authenticated` retains row-scoped CRUD. Runtime code accesses the table server-side and stores only encrypted token ciphertext, with the encryption secret kept outside the client.

This is **not classified as a current authorization bypass** because row ownership is enforced by RLS and the runtime binds access to the authenticated subject. It is a defense-in-depth concern because encrypted credential material is still directly addressable through the Data API by an authenticated owner.

The target hardening is to place credential persistence behind a non-exposed/server-only boundary with an explicit least-privilege access mechanism. Do not introduce a service-role bypass or schema migration solely to remove this warning without a complete authorization, migration, test and operational plan.

---

## 24. Canonical rules for future architecture changes

Every new architecture change must preserve:

1. Explicit ownership.
2. Explicit dependency.
3. Explicit contract.
4. Authenticated and authorized access.
5. Testable behavior.
6. No unnecessary infrastructure coupling.
7. No silent replacement of prior decisions.
8. Product-driven complexity.
9. Accessibility and privacy as cross-cutting properties.
10. Render is the standard infrastructure/deployment platform for Academia Arcana; production mutations remain explicit and authorized.

---

## 25. Canonical infrastructure provider policy

Each infrastructure responsibility has one canonical platform. A provider with equivalent responsibility must not be introduced as an operational substitute or parallel production path without an explicit architecture decision.

| Responsibility | Canonical platform | Equivalent platforms excluded from the default architecture |
|---|---|---|
| Source control | GitHub | GitLab, Bitbucket, Codeberg, Azure Repos |
| CI/CD and Quality Gate | GitHub Actions | GitLab CI/CD, CircleCI, Travis CI, Jenkins, Bitbucket Pipelines, Azure Pipelines, Buildkite |
| Application hosting and production runtime | Render | Netlify, GitHub Pages, Railway, Fly.io, Heroku, AWS App Runner, AWS Amplify, Cloudflare Pages, Cloudflare Workers, DigitalOcean App Platform, Google Cloud Run, Azure Static Web Apps, AppDeploy, Hatchable, Hercules, Floot, Replit, Base44, Lovable, Webflow, Wix |
| Database, Auth, RLS and application data services | Supabase | Firebase, Appwrite, PocketBase, Neon, Convex, PlanetScale |

The policy is implemented in `src/core/architecture/provider-policy.ts` and protected by `tests/infrastructure/canonical-provider-policy.test.ts`.

The policy applies to operational architecture. It does not prohibit SaaS tools whose role is materially different from these four infrastructure responsibilities. It does prohibit using an equivalent platform as a second source-control system, CI/CD system, production runtime or application data backend.

State: **CANÔNICO + IMPLEMENTADO + TESTADO**.

### 25.1 CSS stack resolution — AA-ARCH-001

The repository currently implements authored semantic CSS using custom properties and `aa-*` component classes. The `tailwind-merge` package is retained only as a class-name composition utility; Tailwind CSS itself is not installed as an operational dependency.

This remains an **implementation state**, not a valid constitutional removal of Tailwind CSS, because the Prompt 02 supplied to this chat states that Tailwind is part of the official stack defined by the Constitution Master.

**Architecture decision: AA-ARCH-001**.

**Current status: CONFLITANTE / IMPLEMENTADO / VALIDADO TECNICAMENTE / PENDENTE DE RECONCILIAÇÃO CONSTITUCIONAL.**

The implementation should not be changed solely to resolve this documentation conflict until Chat 00 establishes whether the constitutional stack statement remains current or whether AA-ARCH-001 is authorized to supersede it through the proper governance process.

### 25.2 Governance synchronization — AA-ARCH-002

AA-ARCH-002 exists to prevent a lower-level architecture document from silently redefining a higher-level constitutional stack decision.

The current state has two authoritative-looking statements:

- Constitution Master / Prompt 02: Tailwind CSS is part of the official stack.
- Repository implementation / AA-ARCH-001: authored semantic CSS is the operational styling implementation.

These statements cannot both be treated as an unconditional canonical decision. The correct resolution is an explicit governance reconciliation by Chat 00.

Architecture decision: **AA-ARCH-002**.

State: **APROVADA + IMPLEMENTADA COMO GATE DE GOVERNANÇA; RECONCILIAÇÃO FINAL PENDENTE.**

### 25.3 Historical document precedence — AA-ARCH-003

Documents under `docs/superpowers/plans/`, `docs/superpowers/specs/` and other explicitly historical/strategic records may preserve technology assumptions that existed when they were written.

Those documents are **not operational architecture authorities** unless explicitly promoted by a subsequent canonical architecture decision. They also cannot override the Constitution Master.

Historical references such as a plan's “Tech Stack: Tailwind CSS” therefore do not settle the current conflict. The decisive reconciliation must occur in the constitutional governance chain.

Any future change to the operational CSS stack requires an explicit architecture decision, implementation, testing and governance synchronization, with the final authority determined by the Constitution Master.

Architecture decision: **AA-ARCH-003**.

State: **CANÔNICO + DOCUMENTADO + VALIDADO**, with the current CSS-versus-Tailwind conflict tracked separately under AA-ARCH-001/002.

---

### 25.4 Current Render exclusivity — AA-ARCH-004

**ID:** AA-ARCH-004

**TÍTULO:** Exclusividade operacional do Render no baseline atual

**CONTEXTO:** A arquitetura atual utiliza Render como plataforma canônica de runtime e deployment. A documentação de publicação deve refletir exclusivamente essa plataforma e o Quality Gate vigente.

**PROBLEMA:** Referências a plataformas descontinuadas podem criar uma segunda cadeia operacional indevida.

**DECISÃO:** No baseline atual, Render é o único provedor canônico de application runtime/production deployment. Provedores alternativos não fazem parte da cadeia operacional corrente e não devem ser introduzidos como caminho paralelo, fallback, preview de produção ou substituição implícita. Qualquer futura transição de plataforma dependerá da autoridade superior aplicável e de uma nova decisão arquitetural explícita, com migração, validação e não-regressão.

**ALTERNATIVAS CONSIDERADAS:**
- manter dois provedores de runtime em paralelo;
- permitir fallback implícito;
- manter Render como único runtime atual e tratar qualquer migração futura como decisão formal.

**JUSTIFICATIVA:** Preserva a regra de uma responsabilidade arquitetural por plataforma, reduz superfície operacional e evita que uma referência histórica seja interpretada como infraestrutura ativa.

**IMPACTO:** Nenhuma alteração no pipeline atual. Apenas reforça a governança e a rastreabilidade da exclusão de plataformas concorrentes.

**DEPENDÊNCIAS:** Constituição Master para eventual mudança futura; GitHub/GitHub Actions/Render/Supabase permanecem canônicos no estado atual.

**STATUS:** APROVADA + IMPLEMENTADA + VALIDADA.



### 25.5 Authority versus evidence model — governance clarification

Architecture governance uses two distinct axes that must not be conflated.

**Normative authority** answers what decision is officially in force:

```text
Constitution Master
    ↓
approved domain/architecture decisions
    ↓
operational documentation
    ↓
proposals / assumptions
```

**Factual evidence** answers what is actually implemented or running:

```text
live environment / repository state
    ↓
verified CI, deployment and database evidence
    ↓
current documentation
    ↓
historical records
```

A repository or runtime state may prove divergence from an approved decision, but it does not silently redefine that decision. Conversely, a constitutional or architectural statement does not make an unverified implementation claim true.

When the axes disagree, record the divergence explicitly and resolve it through the governing decision chain.

For architecture-local records this repository uses the **AA-ARCH-XXX** namespace. The Constitution's **AA-ADR-XXX** namespace remains authoritative whenever a decision has constitutional/global scope. Existing AA-ARCH records are not retroactively renamed solely for naming consistency.

### 25.6 CI/CD semantic ordering

The required ordering for a future release, **only after separate authorization**, is:

```text
commit
  ↓
GitHub Actions — pre-release Quality Gate
  ↓
Human / operational release authorization — currently NO-GO
  ↓ (only if GO is explicitly granted)
Render — manual deployment (Auto Deploy OFF)
  ↓
Application runtime
  ↓
Production Smoke — post-deploy verification
```

This diagram specifies order and gates; it does not claim that release approval or deployment has occurred.

Production Smoke is evidence about the deployed runtime; it is not an input to the same Render promotion decision. Any future change that introduces a reverse dependency must be treated as an architecture regression and explicitly reviewed.

> **Implementation note (2026-10-23).** Render's `checksPass` trigger makes every check on the commit an input to the promotion decision, which includes Production Smoke and therefore reverses this ordering. The reverse dependency reproduced on `b808779`: the smoke saw the previous deployment, failed, and Render then withheld the deploy permanently. At that historical point, `autoDeployTrigger: commit` was considered to avoid the deadlock; it is **not** the current release policy. The examined `render.yaml` declares `autoDeployTrigger: "off"`, and NO-GO remains in force. Hosted Render settings require independent read-only verification. See `docs/engineering/2026-10-23-render-promotion-deadlock.md`.


## 26. Current canonical state

**AA-ARCHITECTURE-1.0 = CANÔNICO COMO BASE OPERACIONAL, COM EXCEÇÕES EXPLICITAMENTE RASTREADAS**

The architecture is structurally consolidated for the current product scope, but this document must not claim unconditional closure while higher-authority governance and operational evidence remain unresolved.

Open closure gates at this checkpoint:

1. Constitutional reconciliation of Tailwind CSS versus AA-ARCH-001.
2. Synchronization of the Prompt 02 domain inventory with the canonical `sanctuary` domain.
3. Successful Quality Gate and Production Smoke post-deploy verification for captured revision `8022041c...`. **RESOLVIDO PARA O CHECKPOINT:** main Quality Gate `37226554183` SUCCESS, Database Tests `37226554114` SUCCESS, CodeQL `37226554200` SUCCESS, Gitleaks `37226554129` SUCCESS, Scorecard `37226554141` SUCCESS; Render deploy `dep-db1a5ig473hc738soqhg` LIVE; Production Smoke `37226740318` SUCCESS with exact production revision assertion.
4. Supabase Auth Leaked Password Protection remains an external security configuration dependency. A Supabase security advisor check on 2026-10-04 explicitly reports this control as disabled.
5. Operational resilience evidence remains required for rollback, backup/restore, RTO/RPO, disaster recovery and incident response.
6. Authenticated access hardening for `public.integration_credentials` remains a P1 defense-in-depth item; no authorization bypass is currently evidenced.

The architecture topology itself remains a modular monolith with explicit boundaries, directional dependencies, contracts, ownership and security controls.

Canonical operational loop:

```text
DECIDIR
  ↓
CONTRATO
  ↓
IMPLEMENTAR
  ↓
TESTAR
  ↓
VALIDAR
  ↓
CONSOLIDAR
```

The architecture remains a living system, but changes must be explicit, traceable and subordinate to the Constitution Master.


---

## 27. Implementation reconciliation checkpoint — 2026-10-29 (local proposal; no homologation)

**Base read:** `b4f5eb3cdd345002349e7d9d30f826b4a57e5889` on `work/aa-master360-mvp-isolated-20261026`, initially clean. This section documents a **locally edited, uncommitted candidate**, not the canonical `main` state, a current production SHA, or a deployment approval. No tests, installations, migrations, commits or production actions were performed as part of this checkpoint.

### 27.1 Operational release freeze versus historical promotion semantics

The 2026-10-23 note in §25.6 describes why the earlier `checksPass` trigger caused a promotion/smoke deadlock and why `commit` was considered at that historical point. The examined `render.yaml` instead declares `autoDeployTrigger: "off"` with an explicit release freeze. **The current source contract is manual, Auto Deploy OFF and NO-GO.** The chronological explanation does not authorize re-enabling `commit`, GHCR promotion, or any deployment. Actual hosted settings require separately authorized read-only confirmation; the Blueprint alone cannot prove live service configuration.

### 27.2 Focused architectural reconciliation

| Requirement | Evidence at the base revision | Local candidate adjustment | Validation status |
|---|---|---|---|
| Education resource ownership | §8 and §21 describe `educational_practice_items` and `educational_practice_attempts` as Education-owned, but the code registry omitted them | Add the two table entries; leave `page_progress` owned by Learning | Implemented in local code; not tested |
| Atomic education-to-learning operations | Versioned SQL functions `record_educational_practice_attempt` and `record_criterion_referenced_practice_attempt` record attempts and update page progress | Register cross-domain RPC ownership with Education and Learning as supporting domains | Implemented in local registry; not tested; does not apply SQL |
| JSON input budgets | `/api/ia-aberta` used a stream-bounded 256 KiB reader; Mestre Arcano used unbounded `request.json()` before its 8,000-character guard | Reuse one shared bounded JSON reader for both while preserving route-specific validation and existing quotas | Local candidate only; runtime unverified |
| Provider capability versus invocability | AI catalog mixes frameworks, vector stores and chat inference engines; generic gateway calls `/v1/chat/completions` | Explicitly distinguish cataloged products and locally supported chat-completions adapters; require eligibility before calling a provider | Static contract proposed in local code; no external provider tested |
| Protection of build/runtime | Guard `assert-build-secret-isolation-536.cjs`, runtime secret reader and frozen Render Blueprint are present | Preserve controls and record the release freeze; no image migration or live change | Runtime segregation remains separately gated by #536 |
| Product and governance boundary | §25.1–25.3 and C17–C19 track unresolved constitutional and institutional decisions | Do not resolve CSS/Tailwind, institution/teacher scope, privacy, or release governance by inference | BLOCKED by relevant authorities |

The scope remains a modular monolith with the 14 approved domains and directional dependencies in §1–5. No new domain, service, table, provider account or migration is implied by this checkpoint.

### 27.3 Isolated local test expectations — not executed

- Architectural ownership assertions: unique owners and two Education-owned practice tables; cross-domain education/progress RPCs; no new cycles or forbidden imports.
- HTTP request limits: valid JSON succeeds, malformed JSON returns 400, actual stream body above 256 KiB returns 413 before quota or provider use; the existing 8,000-character Mestre Arcano limit remains unchanged.
- Gateway eligibility: documented catalog-only entries cannot invoke a chat endpoint or consume the IA Aberta quota; supported adapters still require runtime configuration and separate operational validation.
- Persistence/RLS: reuse existing Supabase educational tests and local C117/P0 work rather than overwriting or repeating already accepted evidence; any needed future execution must be explicitly authorized in an isolated environment.
- Build/Render: verify the frozen source configuration without attempting deploy, release or secret mutation.

**Closure boundary:** Passing these tests would support the targeted local architecture changes only. It would not constitute MVP acceptance, independent review, protected release approval, the closing of #536/#594/#595/C03/ORG02, or proof of runtime provider availability. The previously published 46.6% architecture index is not reproducible from this record; the completion percentage is **not determinable**.


### 27.4 Subsequent targeted local validation — 2026-10-29 (isolated; no release)

This later checkpoint supersedes the **validation status only** of the initial local proposal in §§27.2–27.3. In the isolated checkout at base `b4f5eb3cdd345002349e7d9d30f826b4a57e5889`, the 10 targeted Vitest files completed with **84 passed tests and no assertion failures**: 7 files / 48 tests in the first post-dependency-recovery run, followed by the other 3 files / 36 tests with serialized workers after default parallel worker startup timed out. The initial homologation of the same 10 files had also completed with 84 passed tests before the dependency recovery. A subsequent `tsc --noEmit --incremental false --pretty false` exited 0 with no errors, and `git diff --check` reported no whitespace errors.

The Windows `node_modules` recovery used a local donor checkout with identical `package.json` and `package-lock.json` hashes, after network attempts failed with `ECONNRESET` and `EIDLETIMEOUT`. `npm ls --depth=0 --offline --omit=optional` subsequently listed the expected direct dependencies. No productive migration, remote provider call, merge, image publication, GHCR push, Render deploy, or production configuration mutation was part of this validation. The actual hosted Auto Deploy setting is not proven by `render.yaml` alone.

**Remaining release gates:** Quality Gate on a proposed PR, independent review, build/runtime secret isolation #536, durable OCI backup and custodial approval #594, ratified DEP-C17 authority decisions #595, and C03/ORG02 operational assurance. All remain separate; `DRAFT / NO-GO` must be preserved until their own verifiable acceptance criteria are met. No project-wide E2E, production smoke, or live provider readiness is claimed here.

### 27.5 Approved minimal documentation reconciliation — 2026-10-29

**Local reference:** `work/aa-master360-mvp-isolated-20261026` at `d0c839fe37a1c809585183fd57426877753ca119`; the GitHub reference compared was `b4f5eb3cdd345002349e7d9d30f826b4a57e5889`. The branch/ref and commit identify the inspected checkout, not a new integration or deployment.

Before this documentation edit, `git status --porcelain=v1 --untracked-files=normal` reported no tracked-file changes and two untracked directories: `scripts/security/__pycache__/` and `supabase/.temp/`. Both are preserved. This checkpoint does not authorize removing or overwriting any local material.

The existing local commit already contains the scoped code for shared bounded JSON reading, AI adapter eligibility, and the two educational evidence RPC ownership entries. This document now reconciles the §8 ownership table with those entries and distinguishes the current `autoDeployTrigger: "off"` source contract from historical release discussions in §25.6. No new business invariant, provider, table, migration, auth rule, quota, or API contract is introduced by this documentation change.

**Verification boundary:** This documentation-only update has not run tests, builds, installations, migrations, commits, pushes, merges, deploys, or external mutations. The 84 targeted PASS and TypeScript checks in §27.4 describe a prior, bounded validation cycle; they must not be represented as fresh results or as approval of this documentation revision. The post-edit local Git diff was inspected: only this architecture document changed among tracked files (24 additions, 4 deletions); both untracked directories remain intact. Any automated validation remains a separate, not-yet-authorized step.

**Decision boundary:** The AA-ARCH-001/002 constitutional CSS reconciliation, institutional/teacher DEP-C17 decisions, privacy/retention decisions, #536, #594, #595 and C03/ORG02 remain subject to their respective authorities. **R$ 0 additional expense, Auto Deploy OFF, and protected-release NO-GO remain unchanged.** Architecture documentation closure alone is not product homologation or publication authorization.

### 27.6 Subsequent authorized targeted verification — 2026-10-29 (isolated, no release)

After explicit authorization for targeted validation and integration review, the isolated checkout remained at `d0c839fe37a1c809585183fd57426877753ca119`. No installation, code changes, migration, commit, push, merge, hosted service operation, external provider invocation or deployment occurred.

- **PASS:** `src/core/architecture/data-ownership.test.ts` — 6/6 assertions, Vitest exit code 0.
- **PASS:** `tests/infrastructure/blueprint-trigger.test.ts` — 7/7 assertions, Vitest exit code 0.
- **PASS:** `git diff --check` — no whitespace errors. Git emitted only an informational LF/CRLF normalization warning.
- **Static reconciliation:** §8 ownership resources match the inspected local ownership declarations, including the two Education/Learning cross-domain RPCs. The shared JSON reader enforces 256 KiB of stream bytes, the Mestre Arcano route retains its 8,000-character semantic limit, and the IA Aberta request validator rejects catalog-only providers before quota or invocation. The gateway also checks provider eligibility.
- **Release-source freeze:** `render.yaml` contains the quoted `autoDeployTrigger: "off"`; the hosted Render settings were not independently queried in this checkpoint.
- **Workspace preservation:** only `docs/architecture/AA-ARCHITECTURE-1.0.md` was modified among tracked files. The pre-existing untracked `scripts/security/__pycache__/` and `supabase/.temp/` were not touched.

These 13 fresh targeted PASS are **not additive** to the historical 84 PASS as a unique-test total and do not validate Supabase hosted policies, provider uptime, release authority, complete E2E behavior or production Smoke. Existing NO-GO gates (#536, #594, #595, C03/ORG02) and independent human review remain open.
