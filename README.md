<div align="center">
  <h1>
    <img src="./public/logo.png" alt="ChatPie Logo" height="50" style="vertical-align: middle;"/>
    ChatPie
  </h1>
</div>

<div align="center">
  <img src="./public/image/preview/Chat.png" alt="ChatPie Preview" width="800"/>
</div>

<div align="center">
  <a href="./README.zh.md">中文</a> / <a href="./README.md">English</a>
</div>

<br/>

ChatPie, a modern AI-powered chatbot platform designed to foster seamless human-AI collaboration. ChatPie transforms AI from a simple tool into a true partner or colleague, enabling users to chat naturally, work efficiently, and accomplish tasks together with AI as a helpful assistant.

## ✨ Key Features

### 🤖 AI Collaboration Platform
- **Classic Chatbot Interface**: Intuitive and user-friendly chat experience
- **Human-AI Partnership**: Designed for natural conversations and productive collaboration
- **Multi-User Support**: Enterprise-ready platform with comprehensive user management

### 🎯 Advanced Chat Capabilities
- **Multiple Chat Modes**: Support for both one-on-one and group conversations
- **AI Agent Builder**: Create and customize intelligent agents for specific tasks
- **Workflow Construction**: Build automated workflows to streamline complex processes
- **Chat Archive & Management**: Archive conversations with configurable retention policies
- **Real-Time Voice Chat**: Powered by OpenAI `gpt-realtime` (API key required)
- **Web Search**: Enhanced search capabilities powered by Exa API (API key required)

### 🔌 Model & Integration Support
- **Multi-Model Support**: Seamlessly integrate with leading AI providers via Vercel AI SDK:
  - OpenAI
  - Anthropic
  - xAI
  - OpenRouter
  - Groq
  - Qwen
  - Dify
  - And more...
- **MCP Server Integration**: Support for both local and remote Model Context Protocol (MCP) servers
- **Secure API Management**: All API keys managed securely on the backend by administrators, never exposed to the frontend

### 🌍 User Experience
- **Multi-Language Support**: Localized experience for global users
- **Multiple Themes**: Customizable visual themes to suit user preferences
- **Flexible Authentication**: Multiple login methods for convenient access

## 📸 Screenshots

<div align="center">
  <table>
    <tr>
      <td width="50%">
        <img src="./public/image/preview/Chat-web-search.png" alt="Web search"/>
        <p align="center"><b>Web search</b></p>
      </td>
      <td width="50%">
        <img src="./public/image/preview/Chat-team.png" alt="Team chat"/>
        <p align="center"><b>Team chat</b></p>
      </td>
    </tr>
    <tr>
      <td width="50%">
        <img src="./public/image/preview/Chat-temporary.png" alt="Temporary chat"/>
        <p align="center"><b>Temporary chat</b></p>
      </td>
      <td width="50%">
        <img src="./public/image/preview/Chat-voice.png" alt="Voice chat"/>
        <p align="center"><b>Voice chat</b></p>
      </td>
    </tr>
    <tr>
      <td width="50%">
        <img src="./public/image/preview/Provider.png" alt="Model providers"/>
        <p align="center"><b>Model providers</b></p>
      </td>
      <td width="50%">
        <img src="./public/image/preview/User-detail.png" alt="User detail"/>
        <p align="center"><b>User detail</b></p>
      </td>
    </tr>
  </table>
</div>

<p align="center">
  📷 <a href="./public/image/preview">View more screenshots</a>
</p>

## Getting Started

### One-Command Start (Prebuilt docker image) 🐳

Use the prebuilt image and the root `docker-compose.yaml` for a simple start. No Node.js or pnpm required.

```bash
# In the project root
docker compose up -d

# Open the app in your browser
open http://localhost:8300
```

Optional configuration:

- Create a `.env` in the project root to override defaults used by `docker-compose.yaml`:
  - `BETTER_AUTH_SECRET` (set your own secret)
  - `BETTER_AUTH_URL` (e.g., `http://localhost:8300` or your LAN IP)
  - Database config: set `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (and optional `POSTGRES_PORT`); or set `POSTGRES_URL` to override
  - `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY` (model providers)
  - `CHATPIE_IMAGE` (override image tag; defaults to `ghcr.io/gavinzha0/chatpie:main`)

Notes:

- The developer-focused Compose remains at `docker/compose.yml` and builds from source.
- `latest` tag will appear after the next container publishing run; `main` is available now.

### Quick Start from Source (Build local image) 🐳

```bash
# 1. Install dependencies
pnpm i

# 2. Build and start all services (including PostgreSQL) with Docker Compose
pnpm docker-compose:up

```

### Start development environment (Local version) 🚀

```bash
pnpm i

#(Optional) Start a local PostgreSQL instance
# If you already have your own PostgreSQL running, you can skip this step.
# In that case, make sure to update the PostgreSQL URL in your .env file.
pnpm docker:pg

# Enter required information in the .env file
# The .env file is created automatically. Just fill in the required values.
# Apply migrations
pnpm db:migrate

# Build and start the application
pnpm build:local && pnpm start

# (Recommended for most cases. Ensures correct cookie settings.)
# For development mode with hot-reloading and debugging, you can use:
# pnpm dev
```

Alternative: Use Docker Compose for DB only (run app via pnpm)

```bash
# Start Postgres only via compose
# Ensure your .env includes: POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (or set POSTGRES_URL)
docker compose -f docker/compose.yml up -d piedb

# Apply migrations
pnpm db:migrate


# Run app locally
pnpm dev   # or: pnpm build && pnpm start
```

Open [http://localhost:8300](http://localhost:8300) in your browser to get started.

### Environment Variables

For local development, `pnpm i` will generate a `.env` file automatically. Fill in the required values.

For user Docker Compose (`docker-compose.yaml` in the project root), a `.env` file is optional; add one to override defaults used by the Compose file.

Refer to the [.env.example](./.env.example) file for a complete list of environment variables.

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

Let's build it together 🚀


