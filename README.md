<div align="center">

# ✦ GitHub Copilot GLI

### *Where CLI is text, GLI is visual.*

**Your personal AI operating system** — a stunning desktop app powered by GitHub Copilot. If you have Copilot CLI, just clone and run. **Zero config. No API keys.**

![Version](https://img.shields.io/badge/version-2.1.0-7c3aed?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-28-47848F?style=for-the-badge&logo=electron)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Copilot](https://img.shields.io/badge/GitHub%20Copilot-Powered-000?style=for-the-badge&logo=githubcopilot)

</div>

---

## ✨ What is GLI?

GLI (Graphical Language Interface) is the **GUI counterpart to GitHub Copilot CLI**. While CLI is command-line, GLI is a full desktop app — glassmorphism panels, particle effects, 9 feature panels, 65+ slash commands, Telegram bot control, system management, browser automation, and Obsidian knowledge management.

**Already have Copilot CLI?** You're ready. GLI uses your existing `gh` authentication — no API keys, no setup, no cost.

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/TisAvm/Copilot-gli.git
cd Copilot-gli

# 2. Install dependencies
npm install

# 3. Launch (that's it — if you have gh CLI, AI works instantly)
npm start

# Launch with DevTools
npm run dev
```

> **Prerequisites:** [Node.js 18+](https://nodejs.org) and [GitHub CLI](https://cli.github.com) (`gh auth login`)
>
> Already using Copilot CLI? You already have both. Just clone and run.

---

## 🧠 AI Backends

### 🟢 GitHub Copilot Models (Default — Free, Zero Config)

If you have `gh` CLI authenticated, GLI auto-detects your token and gives you access to:

| Model | Provider | Type |
|-------|----------|------|
| GPT-4o | OpenAI | Standard |
| GPT-4o Mini | OpenAI | Fast |
| GPT-4.1 / Mini / Nano | OpenAI | Standard / Fast / Free |
| DeepSeek R1 | DeepSeek | Reasoning |
| Llama 3.1 405B | Meta | Premium |
| Llama 3.3 70B | Meta | Standard |
| Llama 4 Scout | Meta | Standard |
| Codestral | Mistral | Code |
| Mistral Small | Mistral | Fast |
| Phi-4 / Mini / Multimodal | Microsoft | Fast / Free |
| Command R+ / R | Cohere | Standard / Fast |

**No API key needed.** 16 models across 6 providers — all free with your GitHub auth.

### 🔶 OpenRouter Models (Optional — 200+ Models)

Want Claude, Gemini, DeepSeek, Llama? Add an [OpenRouter API key](https://openrouter.ai/keys) to `.env`:

```bash
OPENROUTER_API_KEY=sk-or-...
```

This unlocks 200+ models including free ones (Llama 3.3 70B, DeepSeek V3, Gemma 3 27B).

---

## ⚡ Features

### 🧠 AI Chat — Works Instantly
- **GitHub Copilot models** — GPT-4o, GPT-4.1, o4-mini — free with `gh` auth
- **OpenRouter integration** — 200+ models (Claude, Gemini, DeepSeek, Llama) with API key
- **Smart routing** — Auto-selects the best available backend
- **3 modes** — Interactive, Plan, and Autopilot (cycle with `Shift+Tab`)
- **65+ slash commands** — All GitHub Copilot CLI commands included
- **@ file mentions** — Reference files directly in chat
- **! shell bypass** — Run terminal commands from chat

### 📱 Telegram Bot Integration
- **Bidirectional messaging** — Chat from Telegram, responses appear in both
- **65 slash commands** on Telegram — `/model`, `/mode`, `/screenshot`, `/browser`, etc.
- **Background agents** — Auto-responder, file watcher, scheduled messages, broadcast
- **Screenshots** — Send system/browser screenshots as Telegram photos

### 💻 Full PC Control
- **System info** — CPU, RAM, disk, GPU, network, battery
- **Process manager** — List, search, kill processes
- **App launcher** — Open any app, URL, or file path
- **Screenshot** — Capture entire screen
- **Clipboard** — Read, write, clear
- **Power actions** — Shutdown, restart, sleep, lock (with confirmation)
- **File operations** — Create, delete, rename, copy, info
- **Volume control** — Set volume, mute/unmute

### 🌐 Browser Automation
- **Puppeteer-core** — Uses your installed Edge or Chrome (no download)
- **Navigate, click, type** — Full page interaction
- **Extract data** — CSS selectors, attributes, text content
- **Run JavaScript** — Execute arbitrary code in the page
- **Screenshots** — Capture full pages
- **Multi-tab** — Open, switch, close tabs
- **Cookies** — Read cookies from any tab

### 🟣 Obsidian Knowledge Base
- **Auto-record conversations** — Every chat session saved as dated markdown
- **Project change tracking** — File changes recorded with backlinks
- **Daily notes** — Activity log updated in real-time
- **Vault browser** — Navigate and read notes from GLI
- **Search** — Full-text search across your vault
- **MCP compatible** — Works with `npx obsidian-mcp /path/to/vault`

### 🎨 Epic UI
- **9 panels** — Chat, Files, Search, Terminal, Telegram, Agents, System, Browser, Obsidian
- **3 themes** — Dark, Cyberpunk, Light
- **Glassmorphism** — Frosted glass effects with backdrop-filter
- **Particle background** — Animated canvas with connected nodes
- **Custom title bar** — Frameless window with drag support
- **Command palette** — `Ctrl+Shift+P` to access any command

---

## ⚙️ Configuration

### Zero Config (Copilot Users)

If you have `gh` CLI authenticated, **everything works out of the box**. No `.env` file needed.

```bash
# Check if you're authenticated
gh auth status
# If not: gh auth login
```

### `.env` File (Optional Extras)

Copy `.env.example` to `.env` for Telegram, Obsidian, or OpenRouter:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No | Override auto-detected `gh` token (optional) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token from @BotFather |
| `TELEGRAM_GROUP_ID` | No | Telegram group ID for broadcasting |
| `OBSIDIAN_VAULT_PATH` | No | Absolute path to your Obsidian vault |
| `OPENROUTER_API_KEY` | No | API key from [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENROUTER_DEFAULT_MODEL` | No | Default OpenRouter model ID |

**AI works without any `.env`** — Copilot models use `gh auth token` automatically.

---

## 📱 Telegram Setup

1. **Create a bot**: Open Telegram → search `@BotFather` → send `/newbot` → follow prompts
2. **Copy token**: BotFather gives you a token like `123456:ABC-DEF...`
3. **Add to .env**: `TELEGRAM_BOT_TOKEN=your-token-here`
4. **Get group ID** (optional):
   - Add bot to your group
   - Send a message in the group
   - Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Find the group `chat.id` (negative number)
   - Add to .env: `TELEGRAM_GROUP_ID=-123456789`
5. **Launch GLI** — Bot connects automatically

### Telegram Commands

All 65 GitHub Copilot CLI commands work in Telegram:

```
/help /model /mode /status /clear /screenshot
/browser /navigate /system /processes /kill
/launch /clipboard /volume /shell /search
/files /ls /cat /pwd /open /explain /fix
/tests /commit /review /pr /agent /skills
...and 40+ more
```

---

## 🟣 Obsidian Setup

1. Set `OBSIDIAN_VAULT_PATH` in `.env` to your vault folder
2. Launch GLI — it creates a `GLI/` folder in your vault:

```
YourVault/
└── GLI/
    ├── Index.md              ← Master index with links
    ├── Daily/
    │   └── 2025-07-12.md     ← Daily activity log
    ├── Conversations/
    │   └── 2025-07-12-session-abc123.md
    └── Projects/
        └── MyProject/
            ├── README.md
            └── Changes.md
```

3. All conversations are auto-saved with YAML frontmatter
4. Project changes create backlinks (`[[project/README|Project]]`)
5. Use the Obsidian panel (`Ctrl+9`) to browse notes

### MCP Server

For integration with other tools:

```bash
npx obsidian-mcp /path/to/your/vault
```

---

## 🤖 OpenRouter Setup (Optional)

Want Claude or Gemini models that aren't on GitHub Models yet?

1. Get an API key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Add to `.env`: `OPENROUTER_API_KEY=sk-or-...`
3. Launch GLI — OpenRouter models appear in the model picker (marked with 🔶)

### Additional Models via OpenRouter

| Model | Provider | Tier |
|-------|----------|------|
| Claude Sonnet 4 | Anthropic | Standard |
| Claude Opus 4 | Anthropic | Premium |
| GPT-4o | OpenAI | Standard |
| Gemini 2.5 Pro | Google | Standard |
| DeepSeek R1 | DeepSeek | Premium |
| Llama 4 Maverick | Meta | Standard |
| Codestral | Mistral | Standard |
| Llama 3.3 70B | Meta | **Free** |
| DeepSeek V3 | DeepSeek | **Free** |
| Qwen 2.5 72B | Qwen | **Free** |

---

## 🎮 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Chat panel |
| `Ctrl+2` | File Explorer |
| `Ctrl+3` | Search |
| `Ctrl+4` | Terminal |
| `Ctrl+5` | Telegram |
| `Ctrl+6` | Agents |
| `Ctrl+7` | System Control |
| `Ctrl+8` | Browser |
| `Ctrl+9` | Obsidian Vault |
| `Ctrl+,` | Settings |
| `Ctrl+Shift+P` | Command Palette |
| `Shift+Tab` | Cycle AI mode |
| `Ctrl+L` | Clear chat |
| `/` | Slash commands |
| `@` | Mention files |
| `!` | Shell command |
| `Escape` | Close overlay |

---

## 🏗️ Architecture

```
Copilot-gli/
├── main.js              # Electron main process + IPC handlers
├── preload.js           # Secure IPC bridge (10 namespaces)
├── copilot-api.js       # GitHub Copilot / Models API (zero config)
├── telegram.js          # Telegram bot service (65 commands)
├── system-control.js    # Full PC control module
├── browser-control.js   # Puppeteer-core browser automation
├── obsidian.js          # Obsidian vault integration
├── openrouter.js        # OpenRouter AI service (200+ models)
├── package.json         # Dependencies & scripts
├── .env.example         # Configuration template
├── .gitignore           # Protects .env, node_modules, etc.
└── renderer/
    ├── index.html       # App shell with 9 panels
    ├── styles.css       # 2800+ lines of epic CSS
    ├── app.js           # Core application logic
    └── assets/
        └── icon.svg     # App icon
```

### IPC Namespaces

| Namespace | Purpose |
|-----------|---------|
| `gli.window` | Minimize, maximize, close |
| `gli.fs` | File system operations |
| `gli.terminal` | Command execution |
| `gli.shell` | Open external links |
| `gli.telegram` | Bot messaging & agents |
| `gli.copilot` | GitHub Copilot AI (models, chat) |
| `gli.system` | PC control (30+ handlers) |
| `gli.browser` | Browser automation (25+ handlers) |
| `gli.obsidian` | Vault operations |
| `gli.openrouter` | OpenRouter AI models |

---

## 🛠️ Tech Stack

- **Electron 28** — Cross-platform desktop runtime
- **Vanilla HTML/CSS/JS** — Zero build step, instant dev loop
- **GitHub Models API** — GPT-4o, GPT-4.1, o4-mini (via `gh` auth)
- **OpenRouter API** — 200+ additional AI models (optional)
- **node-telegram-bot-api** — Telegram bot integration
- **Puppeteer-core** — Browser automation
- **systeminformation** — Hardware stats
- **CSS Custom Properties** — Dynamic theming
- **Canvas API** — Particle background system

---

## 📦 Dependencies

```json
{
  "electron": "^28.3.3",
  "dotenv": "^16.x",
  "node-telegram-bot-api": "^0.66.x",
  "systeminformation": "^5.x",
  "puppeteer-core": "^22.x",
  "screenshot-desktop": "^1.x"
}
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit using conventional commits: `git commit -m "feat: add cool feature"`
4. Push and open a PR

---

## 📄 License

MIT © [TisAvm](https://github.com/TisAvm)

---

<div align="center">

*Built with 💜 by humans and AI, together.*

**GLI — Your AI, Your OS, Your Way.**

**[⬆ Back to top](#-github-copilot-gli)**

</div>
