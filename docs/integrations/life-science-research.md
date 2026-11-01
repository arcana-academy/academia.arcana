# Life Science Research — Academia Arcana

**Status: ChatGPT host-only capability; proposed reusable reference helper; NO-GO for website connection or publication.**

## Actual capabilities verified on 2026-11-01

The Life Science Research skill catalog includes research routing and specialist
lookups for literature (NCBI Entrez/PubMed), clinical trials (ClinicalTrials.gov),
proteins (UniProt, AlphaFold, RCSB), genetics (ClinVar, GWAS Catalog, gnomAD),
chemistry (ChEMBL, PubChem), pathways (Reactome), and public data.

These tools are available through the connected ChatGPT host. The **Academia
Arcana website cannot directly invoke the ChatGPT skills** by importing this
file. The existing `CHATGPT_PLUGIN_CATALOG` entry is left untouched; the
integration hub must continue to report it as `catalogued`, not `connected`.

## Bounded project use

1. Human or assistant researches a learning topic with a relevant host skill.
2. Review each source's existence, topic relevance, publication status,
   limitations, and license. A preprint or association alone is not proof of
   clinical efficacy or causality.
3. Curate a short source record using title, external identifier, access date,
   claims actually supported, and provenance. Do not copy full papers or
   restricted abstracts into the application.
4. Optionally use `toScientificReferenceLink()` to construct safe outbound
   PubMed, ClinicalTrials.gov, or DOI links. The helper **only validates
   identifier format**. It does not consult those services or verify claims.
5. Only after editorial review, map the curated explanation and source link to
   Grimórios, course materials, practice explanations, or the Mestre Arcano.
   Maintain the existing owner/permissions model and do not feed unreviewed
   material into scoring, progress, or credential decisions.

The platform remains universal: scientific research is an optional content lane,
not a compulsory dependency of the Santuário, learning system or MVP.

## Repository paths

- `src/infrastructure/integrations/life-science-research.ts`: host skill manifest
  and pure scientific-reference URL utility.
- `src/infrastructure/integrations/life-science-research.test.ts`: contract and
  malformed-identifier checks.

No API route, schema migration, background job, browser token, Supabase table,
third-party SDK, new environment variable or external network call is introduced.
No changes to `status.ts` or the existing plugin catalog are needed.

## Optional future public API integration (not implemented)

NCBI documents public E-utilities for PubMed and related databases. A separate
server-side adapter could use their documented HTTP interface; it would **not**
be an API to the ChatGPT Life Science Research plugin. The NCBI policy specifies
at most 3 requests per second without an API key and asks distributed apps to
provide `tool` and developer `email` metadata. Any later live integration needs
rate limiting across instances, cache, request-size/time limits, attribution,
provider errors, safe outbound-host restrictions and a privacy/security review.
Do not deploy it or declare it connected from this plan.

Official references:
- https://www.ncbi.nlm.nih.gov/home/develop/api/
- https://www.ncbi.nlm.nih.gov/home/about/policies/
- https://clinicaltrials.gov/data-api/api

## Permissions, privacy, cost and release

- ChatGPT connector authorization belongs to the ChatGPT host and is not shared
  with the Academia Arcana web server.
- No student records, individual medical data, authentication tokens or private
  content are sent to scientific sources by this proposal.
- No additional paid plan or runtime API has been activated; incremental
  dependency and external-call cost of these files is R$ 0.
- The PR #847 and main branch are not modified by this isolated work.
- Before using new scientific content for a lesson or grading, require source
  verification, scientific/editorial review and normal product QA.
- Publication remains NO-GO under existing protected release requirements.
