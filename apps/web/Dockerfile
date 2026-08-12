# Next.js in `standalone` mode: the build emits a self-contained server plus exactly the
# `node_modules` it traced, so the runtime image never runs an install of its own.
#
# Build context is the REPOSITORY ROOT (`context: ..` in the compose file).

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---------- build ----------------------------------------------------------------------
FROM base AS build
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @crm/contracts build \
 && pnpm --filter @crm/web build

# ---------- runtime --------------------------------------------------------------------
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# THREE copies, and all three are needed. `standalone` holds the server and its traced
# dependencies but deliberately excludes static assets; leave `.next/static` behind and the
# page renders with every stylesheet 404ing — a blank white screen with no error in the log.
# It is the single most common way this step is got wrong.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

# `outputFileTracingRoot` is the workspace root, so the emitted tree keeps the monorepo shape.
CMD ["node", "apps/web/server.js"]
