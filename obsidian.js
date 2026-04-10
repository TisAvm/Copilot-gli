/**
 * Obsidian Vault Integration for Copilot GLI
 *
 * Records every chat conversation, project change, and session to an
 * Obsidian vault with date-based organization and wikilink backlinks.
 *
 * Vault structure:
 *   vault/
 *   ├── GLI/
 *   │   ├── Daily/          ← date-wise daily notes
 *   │   │   └── 2026-04-10.md
 *   │   ├── Conversations/  ← full chat logs
 *   │   │   └── 2026-04-10-session-abc.md
 *   │   ├── Projects/       ← per-project README + change log
 *   │   │   └── Copilot-gli/
 *   │   │       ├── README.md
 *   │   │       └── Changes.md
 *   │   └── Index.md        ← master index with links
 */

const fs = require('fs');
const path = require('path');

class ObsidianService {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.vaultPath = process.env.OBSIDIAN_VAULT_PATH || '';
    this.gliRoot = 'GLI';
    this.enabled = false;
    this.sessionId = this._generateSessionId();
    this.conversationBuffer = [];
    this.flushInterval = null;
  }

  _generateSessionId() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const rand = Math.random().toString(36).substring(2, 8);
    return `${date}-session-${rand}`;
  }

  _today() {
    return new Date().toISOString().split('T')[0];
  }

  _timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  async init() {
    if (!this.vaultPath) {
      console.log('[Obsidian] No OBSIDIAN_VAULT_PATH set. Vault integration disabled.');
      this.sendStatus('disabled', 'Set OBSIDIAN_VAULT_PATH in .env to enable');
      return false;
    }

    if (!fs.existsSync(this.vaultPath)) {
      console.error(`[Obsidian] Vault path does not exist: ${this.vaultPath}`);
      this.sendStatus('error', `Vault path not found: ${this.vaultPath}`);
      return false;
    }

    // Create GLI directory structure
    const dirs = [
      path.join(this.vaultPath, this.gliRoot),
      path.join(this.vaultPath, this.gliRoot, 'Daily'),
      path.join(this.vaultPath, this.gliRoot, 'Conversations'),
      path.join(this.vaultPath, this.gliRoot, 'Projects'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.enabled = true;
    console.log(`[Obsidian] Connected to vault: ${this.vaultPath}`);
    this.sendStatus('connected', `Vault: ${path.basename(this.vaultPath)}`);

    // Ensure master index exists
    await this._ensureIndex();

    // Ensure today's daily note exists
    await this._ensureDailyNote();

    // Auto-flush conversation buffer every 30 seconds
    this.flushInterval = setInterval(() => this.flushConversation(), 30000);

    return true;
  }

  setVaultPath(vaultPath) {
    this.vaultPath = vaultPath;
    return this.init();
  }

  // ═══════════════════════════════════════════════════════════
  //  Recording — Chat Messages
  // ═══════════════════════════════════════════════════════════

  recordMessage(role, content, metadata = {}) {
    if (!this.enabled) return;

    this.conversationBuffer.push({
      time: this._timestamp(),
      date: this._today(),
      role,
      content,
      model: metadata.model || 'unknown',
      mode: metadata.mode || 'interactive',
      source: metadata.source || 'chat',
    });

    // Flush if buffer gets large
    if (this.conversationBuffer.length >= 20) {
      this.flushConversation();
    }
  }

  async flushConversation() {
    if (!this.enabled || this.conversationBuffer.length === 0) return;

    const messages = [...this.conversationBuffer];
    this.conversationBuffer = [];

    try {
      const convPath = path.join(
        this.vaultPath, this.gliRoot, 'Conversations',
        `${this.sessionId}.md`
      );

      let content = '';
      if (!fs.existsSync(convPath)) {
        content += `---\n`;
        content += `session: ${this.sessionId}\n`;
        content += `date: ${this._today()}\n`;
        content += `model: ${messages[0]?.model || 'unknown'}\n`;
        content += `mode: ${messages[0]?.mode || 'interactive'}\n`;
        content += `tags: [gli, conversation]\n`;
        content += `---\n\n`;
        content += `# 💬 GLI Conversation — ${this.sessionId}\n\n`;
        content += `> Session started at ${messages[0]?.time || this._timestamp()}\n`;
        content += `> See [[${this._today()}|Daily Note]]\n\n---\n\n`;
      }

      for (const msg of messages) {
        const icon = msg.role === 'user' ? '👤' : '🤖';
        const label = msg.role === 'user' ? 'You' : 'Copilot GLI';
        content += `### ${icon} ${label} — ${msg.time}\n\n`;
        content += `${msg.content}\n\n---\n\n`;
      }

      fs.appendFileSync(convPath, content, 'utf-8');

      // Update daily note with conversation reference
      await this._appendToDailyNote(
        `- ${this._timestamp()} — [[${this.sessionId}|Conversation]] (${messages.length} messages)`
      );

    } catch (err) {
      console.error('[Obsidian] Failed to flush conversation:', err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  Recording — Project Changes
  // ═══════════════════════════════════════════════════════════

  async recordProjectChange(projectName, change) {
    if (!this.enabled) return;

    const projectDir = path.join(this.vaultPath, this.gliRoot, 'Projects', this._sanitize(projectName));
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Ensure project README
    const readmePath = path.join(projectDir, 'README.md');
    if (!fs.existsSync(readmePath)) {
      const readmeContent = `---\nproject: ${projectName}\ncreated: ${this._today()}\ntags: [gli, project]\n---\n\n# 📁 ${projectName}\n\n> Auto-generated by Copilot GLI\n\n## Overview\n\nProject tracked by GLI. See [[${projectName} - Changes|Changes]] for history.\n\n## Links\n\n- [[GLI/Index|← GLI Index]]\n- [[${projectName} - Changes|📝 Change Log]]\n`;
      fs.writeFileSync(readmePath, readmeContent, 'utf-8');
    }

    // Append to changes log
    const changesPath = path.join(projectDir, 'Changes.md');
    if (!fs.existsSync(changesPath)) {
      const header = `---\nproject: ${projectName}\ntype: changelog\ntags: [gli, changelog]\n---\n\n# 📝 ${projectName} — Change Log\n\n> Auto-recorded by Copilot GLI\n> See [[${projectName}/README|Project README]]\n\n`;
      fs.writeFileSync(changesPath, header, 'utf-8');
    }

    const entry = `\n## ${this._today()} — ${this._timestamp()}\n\n${change.description || change}\n\n`;
    if (change.files) {
      const fileList = change.files.map(f => `- \`${f}\``).join('\n');
      fs.appendFileSync(changesPath, entry + `\n**Files changed:**\n${fileList}\n\n---\n`, 'utf-8');
    } else {
      fs.appendFileSync(changesPath, entry + `---\n`, 'utf-8');
    }

    // Update daily note
    await this._appendToDailyNote(
      `- ${this._timestamp()} — 📁 [[${projectName}/README|${projectName}]]: ${typeof change === 'string' ? change : change.description}`
    );

    // Update master index
    await this._updateProjectInIndex(projectName);
  }

  // ═══════════════════════════════════════════════════════════
  //  Recording — Commands & Actions
  // ═══════════════════════════════════════════════════════════

  async recordAction(action, details = '') {
    if (!this.enabled) return;

    await this._appendToDailyNote(
      `- ${this._timestamp()} — ⚡ ${action}${details ? `: ${details}` : ''}`
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Vault Operations
  // ═══════════════════════════════════════════════════════════

  async searchVault(query) {
    if (!this.enabled) return [];

    const results = [];
    const searchDir = path.join(this.vaultPath, this.gliRoot);

    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.toLowerCase().includes(query.toLowerCase())) {
              const relPath = path.relative(path.join(this.vaultPath, this.gliRoot), fullPath);
              const lines = content.split('\n');
              const matchLine = lines.findIndex(l => l.toLowerCase().includes(query.toLowerCase()));
              results.push({
                file: relPath,
                title: lines.find(l => l.startsWith('# '))?.replace('# ', '') || entry.name,
                match: lines[matchLine]?.trim() || '',
                line: matchLine + 1,
              });
            }
          } catch {}
        }
      }
    };

    try { walkDir(searchDir); } catch {}
    return results;
  }

  async listNotes(subdir = '') {
    if (!this.enabled) return [];

    const dir = subdir
      ? path.join(this.vaultPath, this.gliRoot, subdir)
      : path.join(this.vaultPath, this.gliRoot);

    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'folder' : 'file',
      path: path.relative(path.join(this.vaultPath, this.gliRoot), path.join(dir, e.name)),
    }));
  }

  async readNote(notePath) {
    if (!this.enabled) return null;

    const fullPath = path.join(this.vaultPath, this.gliRoot, notePath);
    if (!fs.existsSync(fullPath)) return null;

    return fs.readFileSync(fullPath, 'utf-8');
  }

  async createNote(notePath, content) {
    if (!this.enabled) return { success: false, error: 'Vault not connected' };

    const fullPath = path.join(this.vaultPath, this.gliRoot, notePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(fullPath, content, 'utf-8');
    return { success: true, path: notePath };
  }

  // ═══════════════════════════════════════════════════════════
  //  Internal Helpers
  // ═══════════════════════════════════════════════════════════

  async _ensureIndex() {
    const indexPath = path.join(this.vaultPath, this.gliRoot, 'Index.md');
    if (fs.existsSync(indexPath)) return;

    const content = `---\ntags: [gli, index, MOC]\n---\n\n# ✦ Copilot GLI — Knowledge Base\n\n> Auto-maintained index of all GLI activity\n\n## 📅 Daily Notes\n\n- See [[GLI/Daily/|Daily Notes Folder]]\n\n## 💬 Conversations\n\n- See [[GLI/Conversations/|Conversations Folder]]\n\n## 📁 Projects\n\n_Projects will be listed here as they are tracked._\n\n---\n\n*Auto-generated by Copilot GLI*\n`;
    fs.writeFileSync(indexPath, content, 'utf-8');
  }

  async _ensureDailyNote() {
    const today = this._today();
    const dailyPath = path.join(this.vaultPath, this.gliRoot, 'Daily', `${today}.md`);
    if (fs.existsSync(dailyPath)) return;

    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const content = `---\ndate: ${today}\ntags: [gli, daily]\n---\n\n# 📅 ${dayName}\n\n> [[GLI/Index|← GLI Index]]\n\n## Activity Log\n\n`;
    fs.writeFileSync(dailyPath, content, 'utf-8');
  }

  async _appendToDailyNote(line) {
    await this._ensureDailyNote();
    const dailyPath = path.join(this.vaultPath, this.gliRoot, 'Daily', `${this._today()}.md`);
    fs.appendFileSync(dailyPath, line + '\n', 'utf-8');
  }

  async _updateProjectInIndex(projectName) {
    const indexPath = path.join(this.vaultPath, this.gliRoot, 'Index.md');
    if (!fs.existsSync(indexPath)) return;

    let content = fs.readFileSync(indexPath, 'utf-8');
    const projectLink = `- [[${this._sanitize(projectName)}/README|📁 ${projectName}]]`;

    if (!content.includes(projectName)) {
      content = content.replace(
        '_Projects will be listed here as they are tracked._',
        `${projectLink}\n\n_Projects will be listed here as they are tracked._`
      );
      fs.writeFileSync(indexPath, content, 'utf-8');
    }
  }

  _sanitize(name) {
    return name.replace(/[<>:"/\\|?*]/g, '-').trim();
  }

  sendStatus(status, message) {
    this.mainWindow?.webContents.send('obsidian:status', { status, message });
  }

  getInfo() {
    return {
      enabled: this.enabled,
      vaultPath: this.vaultPath,
      vaultName: this.vaultPath ? path.basename(this.vaultPath) : null,
      sessionId: this.sessionId,
      bufferSize: this.conversationBuffer.length,
    };
  }

  destroy() {
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flushConversation(); // Final flush
  }
}

module.exports = ObsidianService;
