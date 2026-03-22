############################
# Builder
############################
FROM node:24-bookworm-slim AS builder
ARG DOCKER_BUILD="1"
WORKDIR /app

COPY . . 

# Install pnpm
RUN corepack enable pnpm
RUN pnpm install --frozen-lockfile

# Makes the next output standalone
ENV NEXT_STANDALONE_OUTPUT="true"
RUN pnpm build

############################
# Runner (production + Playwright)
############################
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

RUN adduser --system --uid 1001 --home /home/nextjs --shell /bin/bash nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nogroup /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nogroup /app/.next/static ./.next/static

# Copy migrations content
COPY --from=builder /app/src/lib/db/migrations ./src/lib/db/migrations

USER root

# Set Playwright configurations
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# 1. Install system dependencies (curl) \
# 2. Install uv and uvx \
# 3. Install Playwright browser and system libraries \
# 4. Clean apt cache to reduce image size
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR="/usr/local/bin" sh && \
    chmod +x /usr/local/bin/uv /usr/local/bin/uvx && \
    npx -y playwright install --with-deps chromium && \
    rm -rf /var/lib/apt/lists/*

# Create symlink for MCP chrome compatibility and ensure proper ownership
RUN CHROMIUM_DIR=$(find /ms-playwright -maxdepth 1 -type d -name "chromium-*" | head -n 1) && \
    CHROMIUM_PATH=$(find "${CHROMIUM_DIR}" -name "chrome" -type f 2>/dev/null | head -n 1) && \
    echo "Found chromium at: ${CHROMIUM_PATH}" && \
    mkdir -p /opt/google/chrome/ && \
    ln -sf "${CHROMIUM_PATH}" /opt/google/chrome/chrome

# Centralize directory creation and permission assignment to reduce image layers
RUN mkdir -p /home/nextjs/.npm /app/outputs /app/logs/audit && \
    chown -R nextjs:nogroup /home/nextjs /app/logs /ms-playwright && \
    chown 1001:65534 /app/outputs && \
    chmod 700 /app/logs/audit

USER nextjs

# Set npm cache directory for nextjs user
ENV npm_config_cache=/home/nextjs/.npm
ENV HOME=/home/nextjs

ENV PORT=8300
ENV HOSTNAME="0.0.0.0"
EXPOSE 8300

# server.js is created by next build from the standalone output
CMD ["node", "server.js"]