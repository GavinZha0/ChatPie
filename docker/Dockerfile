############################
# Builder
############################
FROM node:22-bookworm-slim AS builder
ARG DOCKER_BUILD="1"
WORKDIR /app

COPY . . 

# Install pnpm
RUN corepack enable pnpm
RUN pnpm install --frozen-lockfile

# Install Playwright browsers with dependencies
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium
RUN chmod -R 755 /ms-playwright

# Makes the next output standalone
ENV NEXT_STANDALONE_OUTPUT="true"
RUN pnpm build

############################
# Runner (production + Playwright)
############################
FROM node:22-bookworm-slim AS runner
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

# Copy Playwright browsers from builder
COPY --from=builder /ms-playwright /ms-playwright

# Copy node_modules for Playwright
COPY --from=builder /app/node_modules ./node_modules

# Create and set permissions for npm cache directory
RUN mkdir -p /home/nextjs/.npm && chown -R nextjs:nogroup /home/nextjs

# Create outputs directory for Playwright files
RUN mkdir -p /app/outputs && chown 1001:65534 /app/outputs

# Create logs directory for MCP servers
RUN mkdir -p /app/logs && chown nextjs:nogroup /app/logs
RUN mkdir -p /app/logs/audit && chown nextjs:nogroup /app/logs/audit
RUN chmod 700 /app/logs/audit

# Set Playwright browsers path and ensure permissions
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN chown -R nextjs:nogroup /ms-playwright

# Create symlink for MCP chrome compatibility
USER root
RUN npx playwright install --with-deps chromium
RUN CHROMIUM_PATH=$(find /ms-playwright -maxdepth 1 -type d -name "chromium-*" | head -n 1) && mkdir -p /opt/google/chrome/ && ln -sf "${CHROMIUM_PATH}/chrome-linux64/chrome" /opt/google/chrome/chrome

# Install uv for uvx-based MCP servers
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR="/usr/local/bin" sh
RUN /usr/local/bin/uv --version
RUN chmod +x /usr/local/bin/uv
RUN chmod +x /usr/local/bin/uvx

USER nextjs

# Set npm cache directory for nextjs user
ENV npm_config_cache=/home/nextjs/.npm
ENV HOME=/home/nextjs

ENV PORT=8300
ENV HOSTNAME="0.0.0.0"
EXPOSE 8300

# server.js is created by next build from the standalone output
CMD ["node", "server.js"]