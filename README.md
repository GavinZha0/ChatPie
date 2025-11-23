<div align="center">
  <h1>
    <img src="./public/logo.png" alt="ChatPie Logo" height="50" style="vertical-align: middle;"/>
    ChatPie 🥧
  </h1>
</div>

<div align="center">
  <img src="./public/image/preview/Chat.png" alt="ChatPie Preview" width="800"/>
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
        <img src="./public/image/preview/Chat-web-search.png" alt="Web Search Integration"/>
        <p align="center"><b>Web Search Integration</b></p>
      </td>
      <td width="50%">
        <img src="./public/image/preview/Agent.png" alt="AI Agent Builder"/>
        <p align="center"><b>AI Agent Builder</b></p>
      </td>
    </tr>
    <tr>
      <td width="50%">
        <img src="./public/image/preview/Providers.png" alt="Multi-Model Providers"/>
        <p align="center"><b>Multi-Model Providers</b></p>
      </td>
      <td width="50%">
        <img src="./public/image/preview/Users-profile.png" alt="User Profile Management"/>
        <p align="center"><b>User Profile Management</b></p>
      </td>
    </tr>
  </table>
</div>

<p align="center">
  📷 <a href="./public/image/preview">View more screenshots</a>
</p>

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

# 2. Build and start all services (including PostgreSQL) with Docker Compose
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

The `pnpm i` command generates a `.env` file. Fill in the required values.

```dotenv
# Secret for Better Auth (generate with: npx @better-auth/cli@latest secret)
BETTER_AUTH_SECRET=****

# (Optional)
# URL for Better Auth (the URL you access the app from)
BETTER_AUTH_URL=

# === Database ===
# If you don't have PostgreSQL running locally, start it with: pnpm docker:pg
POSTGRES_URL=postgres://chatpie:chatpie123@localhost:5432/chatpie

# Whether to use file-based MCP config (default: false)
FILE_BASED_MCP_CONFIG=false

# === File Storage ===
# Vercel Blob is the default storage driver (works in both local dev and production)
# Pull the token locally with `vercel env pull`
FILE_STORAGE_TYPE=vercel-blob
FILE_STORAGE_PREFIX=uploads
BLOB_READ_WRITE_TOKEN=

# Set this to 1 to disable user sign-ups.
DISABLE_SIGN_UP=
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

Let's build it together 🚀


