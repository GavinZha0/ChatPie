

## Getting Started

> This project uses [pnpm](https://pnpm.io/) as the recommended package manager.

```bash
# If you don't have pnpm:
npm install -g pnpm
```

### Quick Start (Docker Compose Version) 🐳

```bash
# 1. Install dependencies
pnpm i

# 2. Enter only the LLM PROVIDER API key(s) you want to use in the .env file at the project root.
# Example: The app works with just OPENAI_API_KEY filled in.
# (The .env file is automatically created when you run pnpm i.)

# 3. Build and start all services (including PostgreSQL) with Docker Compose
pnpm docker-compose:up

```

### Quick Start (Local Version) 🚀

```bash
pnpm i

#(Optional) Start a local PostgreSQL instance
# If you already have your own PostgreSQL running, you can skip this step.
# In that case, make sure to update the PostgreSQL URL in your .env file.
pnpm docker:pg

# Enter required information in the .env file
# The .env file is created automatically. Just fill in the required values.
# For the fastest setup, provide at least one LLM provider's API key (e.g., OPENAI_API_KEY, CLAUDE_API_KEY, GEMINI_API_KEY, etc.) and the PostgreSQL URL you want to use.

pnpm build:local && pnpm start

# (Recommended for most cases. Ensures correct cookie settings.)
# For development mode with hot-reloading and debugging, you can use:
# pnpm dev
```

Alternative: Use Docker Compose for DB only (run app via pnpm)

```bash
# Start Postgres only via compose
# Ensure your .env includes: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB matching POSTGRES_URL
docker compose -f docker/compose.yml up -d postgres

# Apply migrations
pnpm db:migrate


# Run app locally
pnpm dev   # or: pnpm build && pnpm start
```

Open [http://localhost:8300](http://localhost:8300) in your browser to get started.

### Environment Variables

The `pnpm i` command generates a `.env` file. Add your API keys there.

```dotenv
# === LLM Provider API Keys ===
# You only need to enter the keys for the providers you plan to use
GOOGLE_GENERATIVE_AI_API_KEY=****
OPENAI_API_KEY=****
XAI_API_KEY=****
ANTHROPIC_API_KEY=****
OPENROUTER_API_KEY=****
OLLAMA_BASE_URL=http://localhost:11434/api



# Secret for Better Auth (generate with: npx @better-auth/cli@latest secret)
BETTER_AUTH_SECRET=****

# (Optional)
# URL for Better Auth (the URL you access the app from)
BETTER_AUTH_URL=

# === Database ===
# If you don't have PostgreSQL running locally, start it with: pnpm docker:pg
POSTGRES_URL=postgres://chatpie:chatpie123@localhost:5432/chatpie

# (Optional)
# === Tools ===
# Exa AI for web search and content extraction (optional, but recommended for @web and research features)
EXA_API_KEY=your_exa_api_key_here


# Whether to use file-based MCP config (default: false)
FILE_BASED_MCP_CONFIG=false

# === File Storage ===
# Vercel Blob is the default storage driver (works in both local dev and production)
# Pull the token locally with `vercel env pull`
FILE_STORAGE_TYPE=vercel-blob
FILE_STORAGE_PREFIX=uploads
BLOB_READ_WRITE_TOKEN=

# -- S3 (coming soon) --
# FILE_STORAGE_TYPE=s3
# FILE_STORAGE_PREFIX=uploads
# FILE_STORAGE_S3_BUCKET=
# FILE_STORAGE_S3_REGION=

# (Optional)
# === OAuth Settings ===
# Fill in these values only if you want to enable Google/GitHub/Microsoft login

#GitHub
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

#Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Set to 1 to force account selection
GOOGLE_FORCE_ACCOUNT_SELECTION=


# Microsoft
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
# Optional Tenant Id
MICROSOFT_TENANT_ID=
# Set to 1 to force account selection
MICROSOFT_FORCE_ACCOUNT_SELECTION=

# Set this to 1 to disable user sign-ups.
DISABLE_SIGN_UP=

# Set this to 1 to disallow adding MCP servers.
NOT_ALLOW_ADD_MCP_SERVERS=
```

<br/>


## 💖 Support

If this project has been helpful to you, please consider supporting its development:

- ⭐ **Star** this repository
- 🐛 **Report** bugs and suggest features
- 💰 **Become sponsor** to support ongoing development

Your support helps maintain and improve this project. Thank you! 🙏

## 🙏 Acknowledgments

- Forked from: https://github.com/cgoinglove/better-chatbot.git
- Special thanks to the original author: [cgoinglove]

## 🙌 Contributing

We welcome all contributions! Bug reports, feature ideas, code improvements — everything helps us build the best local AI assistant.

> **⚠️ Please read our [Contributing Guide](./CONTRIBUTING.md) before submitting any Pull Requests or Issues.** This helps us work together more effectively and saves time for everyone.

**For detailed contribution guidelines**, please see our [Contributing Guide](./CONTRIBUTING.md).

**Language Translations:** Help us make the chatbot accessible to more users by adding new language translations. See [language.md](./messages/language.md) for instructions on how to contribute translations.

Let's build it together 🚀


