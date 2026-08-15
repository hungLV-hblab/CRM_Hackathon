# The ONE container that holds a Claude credential and no database credential (ADR-0038).
#
# Build context is the REPOSITORY ROOT (`context: ..` in the compose file), same as the API
# image: a pnpm workspace package cannot be built from its own directory.

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
COPY apps/agent-runtime/package.json apps/agent-runtime/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/agent-runtime apps/agent-runtime

# The runtime reads enum values out of @crm/contracts to fill the {{...}} placeholders in
# SKILL.md, so contracts has to be built first — same dependency order as the API image.
RUN pnpm --filter @crm/contracts build \
 && pnpm --filter @crm/agent-runtime build

# ---------- runtime --------------------------------------------------------------------
FROM base AS runtime
WORKDIR /repo
ENV NODE_ENV=production

# Claude Code itself. Pinned rather than floating: this binary decides what flags exist, and
# `--permission-mode` / `--strict-mcp-config` in claude-cli.ts are not guaranteed across major
# versions. An upgrade should be a commit somebody reviewed, not whatever npm served that day.
RUN npm install -g @anthropic-ai/claude-code@2.0.76

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/agent-runtime/package.json apps/agent-runtime/
RUN pnpm install --frozen-lockfile --prod --filter @crm/agent-runtime...

COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/apps/agent-runtime/dist apps/agent-runtime/dist
# Skills are DATA, read at boot from this directory — not compiled into the bundle. Editing a
# prompt is editing a file in here plus a container restart (see skill-registry.ts).
COPY apps/agent-runtime/skills apps/agent-runtime/skills

# The CLI writes nothing to $HOME (`--no-session-persistence`), but it still expects the
# variable to exist, and `childEnv()` in claude-cli.ts passes exactly this one through.
ENV HOME=/tmp

WORKDIR /repo/apps/agent-runtime
CMD ["node", "dist/main.js"]
