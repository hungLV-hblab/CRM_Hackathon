# ONE image, used by THREE compose services: api, worker and the one-shot migrate job
# (ADR-0011). They differ only by `APP_ROLE` and by the command, never by content — which is
# what makes it impossible for the worker to run a different version of the domain than the
# API serving the same screens.
#
# Build context is the REPOSITORY ROOT (`context: ..` in the compose file): a pnpm workspace
# package cannot be built from its own directory, its dependencies live in sibling folders.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---------- build ----------------------------------------------------------------------
FROM base AS build
WORKDIR /repo

# Manifests first, sources second. Docker caches by layer, so editing a `.ts` file does not
# re-run the install — which is the difference between a 15-second rebuild and a 3-minute one.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/db packages/db
COPY apps/api apps/api

# Dependency order is not optional: the API imports the types `@crm/contracts` emits.
RUN pnpm --filter @crm/contracts build \
 && pnpm --filter @crm/db build \
 && pnpm --filter @crm/api build

# ---------- runtime --------------------------------------------------------------------
FROM base AS runtime
WORKDIR /repo
ENV NODE_ENV=production

# A SECOND install, production-only, instead of copying the build stage's `node_modules`.
# The build tree carries the Nest CLI, SWC and Playwright; none of them belong in something
# that calls itself a production image.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --filter @crm/api...

COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/packages/db/dist packages/db/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
# Drizzle reads the SQL files at run time; without them the migrate job silently applies nothing.
COPY packages/db/migrations packages/db/migrations
# `loadDefaultDataset()` (`packages/db/src/seed/default-dataset.ts`) reads this zip at run time —
# both `pnpm seed`'s CLI path AND `resolve-observation-source.ts`'s I-16 gate, the latter at
# MODULE LOAD time, so its absence crashes the api/worker container on boot rather than failing
# one request. Exactly the ENOENT-on-standalone-build risk ADR-0021 named and declined to take
# for a different reason — caught here by actually running `pnpm start`, not by reasoning about it.
COPY packages/db/seed-assets packages/db/seed-assets

WORKDIR /repo/apps/api
# `node dist/main.js` — never `nest start`, never `--watch`. Spec 7.3 asks for a real build.
CMD ["node", "dist/main.js"]
