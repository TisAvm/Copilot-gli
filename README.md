<div align="center">

# ✦ GitHub Copilot GLI

### *Where CLI is text, GLI is visual.*

A stunning, GPU-accelerated GUI desktop app for AI-assisted coding.  
Built with Electron — featuring glassmorphism, particle effects, and a cyberpunk soul.

![Version](https://img.shields.io/badge/version-1.0.0-7c3aed?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-28-2563eb?style=for-the-badge&logo=electron&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-06b6d4?style=for-the-badge)

</div>

---

## ⚡ Features

| Feature | Description |
|---------|-------------|
| 💬 **AI Chat** | Conversational interface with animated message bubbles and syntax-highlighted code blocks |
| 📁 **File Explorer** | Browse your project tree with expand/collapse folders and file type icons |
| 🔍 **Search** | Full-text search across your entire project with regex support |
| ⌨️ **Terminal** | Integrated shell — run commands without leaving the app |
| 🎨 **3 Themes** | Dark (default), Cyberpunk (neon), and Light — switch instantly |
| ✨ **Particle Background** | Animated canvas particle system with connected nodes |
| 🪟 **Custom Title Bar** | Frameless window with draggable title bar and window controls |
| ⌨️ **Keyboard Shortcuts** | `Ctrl+1-4` panel switching, command history, and more |
| 📝 **Syntax Highlighting** | Powered by highlight.js — 190+ languages supported |

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/TisAvm/Copilot-gli.git
cd Copilot-gli

# Install dependencies
npm install

# Launch the app
npm start

# Launch with DevTools open
npm run dev
```

---

## 🎮 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Switch to Chat |
| `Ctrl+2` | Switch to File Explorer |
| `Ctrl+3` | Switch to Search |
| `Ctrl+4` | Switch to Terminal |
| `Ctrl+,` | Open Settings |
| `Enter` | Send chat message / Execute command |
| `Shift+Enter` | New line in chat |
| `↑ / ↓` | Navigate command history (Terminal) |

---

## 🎨 Themes

### Dark (Default)
GitHub's signature dark palette with purple/blue accents.

### Cyberpunk
Neon magenta & cyan on deep black — for the futuristic coder.

### Light
Clean, bright, and easy on the eyes.

---

## 🏗️ Architecture

```
Copilot-gli/
├── main.js              # Electron main process
├── preload.js           # Secure IPC bridge
├── package.json
├── renderer/
│   ├── index.html       # App shell with all panels
│   ├── styles.css       # 800+ lines of epic CSS
│   ├── app.js           # Core application logic
│   └── assets/
│       └── icon.svg     # App icon
└── README.md
```

### IPC Bridge

The app uses Electron's `contextBridge` for secure communication:

- **`gli.window`** — Minimize, maximize, close
- **`gli.fs`** — Read directories, read files, open folder dialog
- **`gli.terminal`** — Execute commands, spawn processes
- **`gli.shell`** — Open external links

---

## 🛠️ Tech Stack

- **Electron 28** — Cross-platform desktop runtime
- **Vanilla JS** — Zero build step, instant dev loop
- **CSS Custom Properties** — Dynamic theming
- **Canvas API** — Particle system
- **highlight.js** — Syntax highlighting

---

## 📄 License

MIT © Copilot GLI Team

---

<div align="center">

*Built with 💜 by humans and AI, together.*

**[⬆ Back to top](#-github-copilot-gli)**

</div>
