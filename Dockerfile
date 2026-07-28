# Deterministic build for Railway.
#
# Nixpacks was guessing the Node and pnpm versions and injecting its own install
# step, which fails on this workspace two different ways:
#   - corepack's pnpm shim crashes on Node 24
#   - the `overrides` block lives in pnpm-workspace.yaml, which only pnpm 10+
#     reads, so older pnpm reports ERR_PNPM_LOCKFILE_CONFIG_MISMATCH
# Pinning the toolchain here removes both, and makes the build reproducible.

FROM node:24-slim

WORKDIR /app

# pnpm 11 is required to read `overrides` from pnpm-workspace.yaml.
RUN npm install -g pnpm@11.17.0

COPY . .

# NODE_ENV is deliberately unset here: vite, esbuild and typescript are
# devDependencies and are needed to build. It is set for runtime further down.
RUN pnpm install --frozen-lockfile

# api-server serves the two frontends from disk, so all three must be built.
RUN pnpm --filter @workspace/ep-app build \
 && pnpm --filter @workspace/admin build \
 && pnpm --filter @workspace/api-server build

ENV NODE_ENV=production

# Railway overrides this with its own PORT; the app falls back to 8080.
EXPOSE 8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
