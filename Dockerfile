# --platform is deliberate: the digest pin below is the linux/amd64 image
# that Render runs, regardless of the builder host architecture.
# hadolint ignore=DL3029
FROM --platform=linux/amd64 node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS builder

WORKDIR /app

# Pin npm through Corepack (bundled with Node 24) instead of an unpinned
# global npm install; the exact version comes from package.json's
# packageManager pin and Corepack verifies the download signature.
RUN corepack enable npm \
  && corepack prepare npm@11.19.1 --activate

COPY package.json package-lock.json ./
COPY scripts/verify-dependency-lifecycle-scripts.cjs ./scripts/verify-dependency-lifecycle-scripts.cjs

RUN node scripts/verify-dependency-lifecycle-scripts.cjs \
  && npm ci --ignore-scripts \
  && npm rebuild unrs-resolver --ignore-scripts=false

COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ADOBE_FONTS_KIT_ID
# NEXT_PUBLIC_* values are published to the browser bundle by design; the
# build-secret-isolation guard (scripts/security) rejects anything else.
# hadolint ignore=DL3064
ARG NEXT_PUBLIC_HONEYBADGER_API_KEY
ARG NEXT_PUBLIC_HONEYBADGER_ASSETS_URL
ARG ACADEMIA_ARCANA_REVISION

# See the NEXT_PUBLIC_* note above; no server secret is assigned here.
# hadolint ignore=DL3064
ENV NODE_ENV=production \
  PORT=10000 \
  HOSTNAME=0.0.0.0 \
  NEXT_PUBLIC_APP_ENV=production \
  NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
  NEXT_PUBLIC_ADOBE_FONTS_KIT_ID=${NEXT_PUBLIC_ADOBE_FONTS_KIT_ID} \
  NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} \
  NEXT_PUBLIC_HONEYBADGER_API_KEY=${NEXT_PUBLIC_HONEYBADGER_API_KEY} \
  NEXT_PUBLIC_HONEYBADGER_ASSETS_URL=${NEXT_PUBLIC_HONEYBADGER_ASSETS_URL} \
  NEXT_PUBLIC_HONEYBADGER_REVISION=${ACADEMIA_ARCANA_REVISION} \
  ACADEMIA_ARCANA_REVISION=${ACADEMIA_ARCANA_REVISION}

RUN npm run build \
  && npm prune --omit=dev --ignore-scripts \
  && mkdir -p .next/cache

# hadolint ignore=DL3029
FROM --platform=linux/amd64 node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS runtime

WORKDIR /app

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ADOBE_FONTS_KIT_ID
# hadolint ignore=DL3064
ARG NEXT_PUBLIC_HONEYBADGER_API_KEY
ARG NEXT_PUBLIC_HONEYBADGER_ASSETS_URL
ARG ACADEMIA_ARCANA_REVISION

# hadolint ignore=DL3064
ENV NODE_ENV=production \
  PORT=10000 \
  HOSTNAME=0.0.0.0 \
  NEXT_PUBLIC_APP_ENV=production \
  NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
  NEXT_PUBLIC_ADOBE_FONTS_KIT_ID=${NEXT_PUBLIC_ADOBE_FONTS_KIT_ID} \
  NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} \
  NEXT_PUBLIC_HONEYBADGER_API_KEY=${NEXT_PUBLIC_HONEYBADGER_API_KEY} \
  NEXT_PUBLIC_HONEYBADGER_ASSETS_URL=${NEXT_PUBLIC_HONEYBADGER_ASSETS_URL} \
  NEXT_PUBLIC_HONEYBADGER_REVISION=${ACADEMIA_ARCANA_REVISION} \
  ACADEMIA_ARCANA_REVISION=${ACADEMIA_ARCANA_REVISION}

COPY --from=builder --chown=node:node /app /app

USER node

EXPOSE 10000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
