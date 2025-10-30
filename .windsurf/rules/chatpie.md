---
trigger: always_on
---

This rules document summarizes ChatPie’s architecture, key technologies, core third-party components, and frontend-backend interaction patterns for team-wide alignment.

## Architecture
- Monolithic full-stack application using Next.js 15 (App Router) with React 19.
- Frontend pages and backend capabilities (API Routes, Server Actions) live in the same repository and process.
- Supports standalone build via NEXT_STANDALONE_OUTPUT.

## Frontend Key Technologies
- Framework & Language
  - Next.js 15 (App Router)
  - React 19
  - TypeScript
- Styling & Theming
  - Tailwind CSS 4 (@tailwindcss/postcss)
  - tailwind-merge
  - next-themes
- UI/Interaction
  - Radix UI (@radix-ui/react-*)
  - lucide-react (icons)
  - framer-motion (animations)
  - vaul (drawer/interaction)
  - @xyflow/react (graph/flow editing)
- Rich Text & Rendering
  - tiptap (with mention/suggestion/starter-kit)
  - react-markdown + remark-gfm (Markdown rendering)
  - shiki (code highlighting)
  - mermaid (diagrams/flowcharts)
- State & Data
  - zustand (state management)
  - SWR (data fetching & caching)
- Internationalization
  - next-intl (messages/*.json)
- AI (Frontend Integration)
  - Vercel AI SDK v5 (ai, @ai-sdk/react)
  - Providers: @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, @ai-sdk/groq, @ai-sdk/xai, @openrouter/ai-sdk-provider, ollama-ai-provider-v2
  - @google/genai, @modelcontextprotocol/sdk (MCP)

## Backend Key Technologies
- Server Framework & Routing
  - Next.js API Routes (src/app/api/**)
  - Server Actions ("use server", e.g., src/app/api/*/actions.ts)
- Authentication & Users
  - better-auth (auth/session)
  - bcrypt-ts (password hashing)
- Database & ORM
  - PostgreSQL (Docker Postgres 17)
  - drizzle-orm + drizzle-kit (drizzle.config.ts, src/lib/db/pg/**)
  - pg (driver)
- Caching
  - ioredis (see src/lib/cache/redis-cache.ts, safe-redis-cache.ts)
- Object Storage / Files
  - AWS S3 (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner for presigned URLs)
  - Vercel Blob (@vercel/blob)
- AI (Server-Side)
  - Unified server-side wrappers (src/lib/ai/**) with multiple providers (OpenAI, Anthropic, Google, Groq, xAI, OpenRouter, Ollama, etc.)
  - Real-time/voice: OpenAI Realtime routes and hooks (e.g., src/app/api/chat/openai-realtime/route.ts, src/lib/ai/speech/open-ai/**)

## Frontend-Backend Interaction Rules
- Server Actions (preferred for sensitive operations requiring session context)
  - Import and call directly from components; Next compiles them as server entrypoints.
  - Typical locations:
    - src/app/api/chat/actions.ts
    - src/app/api/admin/actions.ts
    - src/app/api/archive/actions.ts
    - src/app/api/auth/actions.ts
    - src/app/api/mcp/actions.ts
    - src/app/api/storage/actions.ts
    - src/app/api/user/actions.ts
    - src/app/api/workflow/actions.ts
- API Routes (REST/streaming/real-time)
  - Called via fetch/SWR on the client.
  - Typical routes:
    - src/app/api/export/[id]/comments/route.ts
    - src/app/api/mcp/[id]/route.ts
    - src/app/api/chat/route.ts (chat/possibly streaming)
    - src/app/api/chat/openai-realtime/route.ts (real-time proxy)
- File Uploads
  - Flow: request presigned URL on server → browser direct upload → write back metadata.
  - Hook: src/hooks/use-presigned-upload.ts
  - Server: src/app/api/storage/actions.ts
- Authentication & Session
  - better-auth with cookie-based sessions.
  - See src/app/api/auth/[...all]/route.ts, src/lib/auth/*, src/middleware.ts.

- Shared Types
  - All shared application types live under src/types/*.
  - Import via TypeScript path alias app-types/* (configured in tsconfig.json).
- Database Schema
  - Uses Drizzle ORM (drizzle-orm/pg-core) for PostgreSQL.
  - Schema is defined in src/lib/db/pg/schema.pg.ts.
  - Define tables with pgTable, columns with text, uuid, timestamp, json, boolean, varchar, etc.
  - Use references(() => OtherTable.id, { onDelete: "cascade" }) for FKs.
  - Use unique() and index() to declare constraints and indices.
  - Map column types to app-level types via $type<T>() when storing JSON, e.g. $type<UserPreferences>().
- CRUD Repositories
  - Repository per domain/table, implemented with Drizzle query builder and helpers.
  - PostgreSQL repositories in src/lib/db/pg/repositories/*.pg.ts.
  - Public repository exports in src/lib/db/repository.ts re-export PG implementations with generic names (e.g. userRepository).
  - Use Drizzle helpers like eq, count, getTableColumns, and sql for projections and computed fields.
  - Return plain typed objects; avoid leaking ORM-specific types to callers.
  - Keep cross-table logic inside repositories; do not access DB directly from UI or API handlers.

## Conventions & Recommendations
- Data Access Boundary: Access DB/Redis only on the server; clients must use Server Actions or API Routes.
- Sensitive Operations: Prefer Server Actions (automatic session context, lower CSRF risk).
- Long-running/Streaming: Use API Routes with streaming (SSE/chunked) or real-time routes.
- AI Calls: Initiate from server-side wrappers; the frontend handles results/stream rendering only.
- Internationalization: Use next-intl for all text; avoid hardcoded multilingual strings in components.
- Environment Variables: Manage via .env and custom load-env; do not expose secrets to the client.