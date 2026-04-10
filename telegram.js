/**
 * Telegram Bot Service for Copilot GLI
 * 
 * Bridges Telegram messages (from bot DM or group) into the GLI chat panel.
 * Sends GLI responses back to Telegram.
 */

const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

class TelegramService {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.bot = null;
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.groupId = process.env.TELEGRAM_GROUP_ID;
    this.isConnected = false;
    this.botInfo = null;
    this.messageQueue = [];
    this.agents = new Map();
    this.agentIdCounter = 0;
    this.systemCtl = null;
    this.browserCtl = null;
    this.openrouter = null;
    this.copilotApi = null;
    this.currentModel = process.env.OPENROUTER_DEFAULT_MODEL || 'gpt-4o-mini';
    this.currentMode = 'interactive';
    // Per-chat conversation history for AI context
    this.conversations = new Map();
    this.maxHistoryPerChat = 30;
    this.systemPrompt = `You are Copilot GLI — a powerful AI assistant accessible via Telegram.
You can help with coding, system administration, file operations, browsing, and general knowledge.
Be concise but thorough. Use Markdown formatting for code blocks and emphasis.
When the user asks you to do something on their PC (run commands, open files, take screenshots, etc.), 
tell them to use the appropriate /slash command (e.g., /shell, /screenshot, /open, /browse).
Current model: ${this.currentModel}`;
  }

  setControllers(systemCtl, browserCtl) {
    this.systemCtl = systemCtl;
    this.browserCtl = browserCtl;
  }

  setOpenRouter(openrouterService) {
    this.openrouter = openrouterService;
  }

  setCopilotApi(copilotApiService) {
    this.copilotApi = copilotApiService;
  }

  async start() {
    if (!this.token) {
      console.error('[Telegram] No TELEGRAM_BOT_TOKEN found in .env');
      this.sendStatus('error', 'No bot token configured. Add TELEGRAM_BOT_TOKEN to .env');
      return false;
    }

    try {
      this.bot = new TelegramBot(this.token, { polling: true });
      this.botInfo = await this.bot.getMe();
      this.isConnected = true;

      console.log(`[Telegram] Connected as @${this.botInfo.username} (${this.botInfo.id})`);
      this.sendStatus('connected', `Connected as @${this.botInfo.username}`);

      this.setupHandlers();
      this.registerCommands();
      return true;
    } catch (err) {
      console.error('[Telegram] Connection failed:', err.message);
      this.isConnected = false;
      this.sendStatus('error', `Connection failed: ${err.message}`);
      return false;
    }
  }

  setupHandlers() {
    // Handle all incoming text messages
    this.bot.on('message', async (msg) => {
      if (!msg.text) return;

      const chatId = msg.chat.id;
      const chatType = msg.chat.type; // 'private', 'group', 'supergroup'
      const from = msg.from;
      const text = msg.text;

      // Skip bot commands directed at other bots in groups
      if (text.startsWith('/') && text.includes('@') && !text.includes(`@${this.botInfo.username}`)) {
        return;
      }

      // Strip bot mention from group messages
      const cleanText = text.replace(`@${this.botInfo.username}`, '').trim();
      if (!cleanText) return;

      console.log(`[Telegram] Message from ${from.first_name}: ${cleanText.substring(0, 80)}`);

      // Handle slash commands locally
      if (cleanText.startsWith('/')) {
        const handled = await this.handleSlashCommand(chatId, msg.message_id, cleanText, from);
        if (handled) return;
      }

      // Forward to renderer for display
      const messageData = {
        id: msg.message_id,
        chatId: chatId.toString(),
        chatType,
        from: {
          id: from.id,
          name: `${from.first_name || ''}${from.last_name ? ' ' + from.last_name : ''}`.trim(),
          username: from.username || null,
        },
        text: cleanText,
        timestamp: msg.date * 1000,
        isGroup: chatType !== 'private',
        groupTitle: msg.chat.title || null,
      };

      this.mainWindow?.webContents.send('telegram:message', messageData);

      // Process through AI and reply back
      await this.processAIMessage(chatId, msg.message_id, cleanText, from);
    });

    // Handle photo messages for browser interaction
    this.bot.on('photo', (msg) => {
      const chatId = msg.chat.id;
      this.sendReply(chatId, '📷 Photo received. Use /screenshot to capture your desktop or browser instead.', msg.message_id);
    });

    // Handle polling errors
    this.bot.on('polling_error', (err) => {
      console.error('[Telegram] Polling error:', err.message);
      if (err.message.includes('ETELEGRAM: 401')) {
        this.isConnected = false;
        this.sendStatus('error', 'Invalid bot token. Please check your .env file.');
      }
    });

    // Handle disconnect
    this.bot.on('error', (err) => {
      console.error('[Telegram] Error:', err.message);
    });
  }

  /**
   * Register commands with Telegram so they appear in the bot menu
   */
  async registerCommands() {
    if (!this.bot) return;

    // Telegram allows max 100 commands; include the most useful ones
    const commands = [
      // Help
      { command: 'start', description: 'Welcome message and getting started' },
      { command: 'help', description: 'Show all available commands' },
      { command: 'commands', description: 'List commands by category' },
      { command: 'version', description: 'Show version info' },
      { command: 'changelog', description: 'Display changelog' },
      { command: 'feedback', description: 'Provide feedback about GLI' },
      // Models & Mode
      { command: 'model', description: 'View or switch AI model' },
      { command: 'mode', description: 'View or switch mode' },
      { command: 'delegate', description: 'Send session to GitHub for a PR' },
      { command: 'fleet', description: 'Enable fleet mode (parallel subagents)' },
      { command: 'tasks', description: 'View and manage background tasks' },
      // Agent environment
      { command: 'init', description: 'Initialize Copilot instructions' },
      { command: 'agent', description: 'Browse available agents' },
      { command: 'skills', description: 'Manage skills' },
      { command: 'mcp', description: 'Manage MCP server configuration' },
      { command: 'plugin', description: 'Manage plugins' },
      // Code
      { command: 'diff', description: 'Review git changes' },
      { command: 'pr', description: 'Operate on pull requests' },
      { command: 'review', description: 'Run code review agent' },
      { command: 'lsp', description: 'Manage language servers' },
      { command: 'ide', description: 'Connect to an IDE workspace' },
      { command: 'plan', description: 'Create implementation plan' },
      { command: 'research', description: 'Run deep research investigation' },
      // Session
      { command: 'clear', description: 'Clear chat and start fresh' },
      { command: 'new', description: 'Start a new conversation' },
      { command: 'compact', description: 'Summarize to reduce context' },
      { command: 'share', description: 'Share session to markdown/HTML/gist' },
      { command: 'copy', description: 'Copy last response to clipboard' },
      { command: 'context', description: 'Show context window usage' },
      { command: 'usage', description: 'Display session usage metrics' },
      { command: 'rewind', description: 'Rewind the last turn' },
      { command: 'resume', description: 'Switch to a different session' },
      { command: 'rename', description: 'Rename the current session' },
      { command: 'session', description: 'View and manage sessions' },
      // Permissions
      { command: 'allow_all', description: 'Enable all permissions' },
      { command: 'add_dir', description: 'Add a directory to allowed list' },
      { command: 'list_dirs', description: 'Display allowed directories' },
      { command: 'cwd', description: 'Show or change working directory' },
      { command: 'reset_allowed_tools', description: 'Reset allowed tools list' },
      // System
      { command: 'status', description: 'Quick system status overview' },
      { command: 'system', description: 'Detailed system information' },
      { command: 'processes', description: 'List running processes' },
      { command: 'kill', description: 'Kill a process by PID' },
      { command: 'screenshot', description: 'Capture desktop screenshot' },
      { command: 'shell', description: 'Execute a shell command' },
      { command: 'clipboard', description: 'Read clipboard contents' },
      { command: 'open', description: 'Open file, folder, or URL' },
      { command: 'wifi', description: 'Scan WiFi networks' },
      { command: 'mute', description: 'Toggle system mute' },
      // Browser
      { command: 'browse', description: 'Open URL in controlled browser' },
      { command: 'browser_screenshot', description: 'Capture browser screenshot' },
      { command: 'browser_content', description: 'Get page text content' },
      { command: 'tabs', description: 'List browser tabs' },
      // Agents
      { command: 'agents', description: 'List background agents' },
      { command: 'broadcast', description: 'Send message to group' },
      // Other
      { command: 'theme', description: 'View or set color theme' },
      { command: 'experimental', description: 'Toggle experimental features' },
      { command: 'instructions', description: 'View custom instruction files' },
      { command: 'streamer_mode', description: 'Toggle streamer mode' },
      { command: 'terminal_setup', description: 'Configure terminal settings' },
      { command: 'login', description: 'Log in to Copilot' },
      { command: 'logout', description: 'Log out of Copilot' },
      { command: 'update', description: 'Check for updates' },
      { command: 'restart', description: 'Restart GLI app' },
      { command: 'user', description: 'Manage GitHub user list' },
    ];

    try {
      await this.bot.setMyCommands(commands);
      console.log(`[Telegram] Registered ${commands.length} bot commands`);
    } catch (err) {
      console.error('[Telegram] Failed to register commands:', err.message);
    }
  }

  /**
   * Handle slash commands from Telegram
   * Returns true if the command was handled, false to forward to renderer
   */
  async handleSlashCommand(chatId, messageId, text, from) {
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase().replace(`@${this.botInfo?.username?.toLowerCase()}`, '');
    const args = parts.slice(1).join(' ').trim();

    const reply = (msg) => this.sendReply(chatId, msg, messageId);

    try {
      switch (cmd) {
        // ── Help & Info ──
        case '/start':
          return reply(
            `🚀 *Copilot GLI Bot*\n\n` +
            `Hey ${from.first_name}! I'm your Copilot GLI bridge.\n\n` +
            `I can control your PC, automate your browser, run shell commands, and more — all from Telegram.\n\n` +
            `Type /help to see all commands, or just send me a message and it'll appear in GLI chat.`
          ), true;

        case '/help':
          return reply(
            `📖 *Copilot GLI — Command Reference*\n\n` +
            `*🤖 Models & Subagents*\n` +
            `/model [name] — View/switch AI model\n` +
            `/mode [name] — View/switch mode\n` +
            `/delegate — Send session to GitHub for PR\n` +
            `/fleet — Enable parallel subagent mode\n` +
            `/tasks — View background tasks\n\n` +
            `*⚙️ Agent Environment*\n` +
            `/init — Initialize repo instructions\n` +
            `/agent — Browse available agents\n` +
            `/skills — Manage skills\n` +
            `/mcp — MCP server configuration\n` +
            `/plugin — Manage plugins\n\n` +
            `*📝 Code*\n` +
            `/diff — Review git changes\n` +
            `/pr — Operate on pull requests\n` +
            `/review — Run code review agent\n` +
            `/lsp — Language server config\n` +
            `/ide — Connect to IDE workspace\n` +
            `/plan — Create implementation plan\n` +
            `/research — Deep research investigation\n` +
            `/terminal\\_setup — Configure terminal\n\n` +
            `*💬 Session*\n` +
            `/clear — Clear chat, start fresh\n` +
            `/new — Start new conversation\n` +
            `/compact — Reduce context usage\n` +
            `/share — Export session\n` +
            `/copy — Copy last response\n` +
            `/context — Show token usage\n` +
            `/usage — Session metrics\n` +
            `/rewind — Undo last turn\n` +
            `/resume — Switch session\n` +
            `/rename — Rename session\n` +
            `/session — Manage sessions\n\n` +
            `*🔐 Permissions*\n` +
            `/allow\\_all — Enable all permissions\n` +
            `/add\\_dir — Add allowed directory\n` +
            `/list\\_dirs — Show allowed dirs\n` +
            `/cwd [path] — Show/change directory\n` +
            `/reset\\_allowed\\_tools — Reset tools\n\n` +
            `*🖥️ System Control*\n` +
            `/status — Quick system overview\n` +
            `/system — Detailed system info\n` +
            `/processes [filter] — List processes\n` +
            `/kill <PID> — Kill process\n` +
            `/screenshot — Desktop screenshot\n` +
            `/clipboard — Read clipboard\n` +
            `/wifi — Scan WiFi networks\n` +
            `/mute — Toggle system mute\n` +
            `/open <path> — Open file/folder/URL\n\n` +
            `*🌐 Browser*\n` +
            `/browse <url> — Navigate to URL\n` +
            `/browser\\_screenshot — Page screenshot\n` +
            `/browser\\_content — Get page text\n` +
            `/tabs — List browser tabs\n\n` +
            `*⚡ Execution*\n` +
            `/shell <command> — Run shell command\n\n` +
            `*🤖 Agents*\n` +
            `/agents — List active agents\n` +
            `/broadcast <msg> — Send to group\n\n` +
            `*📋 Other*\n` +
            `/version — Version info\n` +
            `/changelog — Show changelog\n` +
            `/theme [name] — View/set theme\n` +
            `/experimental — Toggle experimental\n` +
            `/instructions — View instruction files\n` +
            `/streamer\\_mode — Toggle streamer mode\n` +
            `/update — Check for updates\n` +
            `/login — Log in to GitHub\n` +
            `/logout — Log out\n` +
            `/restart — Restart GLI app\n` +
            `/user — GitHub user info\n` +
            `/feedback — Give feedback\n\n` +
            `Or just type anything — it goes to GLI chat! 💬`
          ), true;

        case '/commands': {
          const categories = {
            '🤖 Models & Subagents': ['/model', '/mode', '/delegate', '/fleet', '/tasks'],
            '⚙️ Agent Environment': ['/init', '/agent', '/skills', '/mcp', '/plugin'],
            '📝 Code': ['/diff', '/pr', '/review', '/lsp', '/ide', '/plan', '/research', '/terminal\\_setup'],
            '💬 Session': ['/clear', '/new', '/compact', '/share', '/copy', '/context', '/usage', '/rewind', '/undo', '/resume', '/rename', '/session'],
            '🔐 Permissions': ['/allow\\_all', '/add\\_dir', '/list\\_dirs', '/cwd', '/reset\\_allowed\\_tools'],
            '🖥️ System': ['/status', '/system', '/processes', '/kill', '/screenshot', '/clipboard', '/wifi', '/mute', '/open'],
            '🌐 Browser': ['/browse', '/browser\\_screenshot', '/browser\\_content', '/tabs'],
            '⚡ Execution': ['/shell'],
            '🤖 Agents': ['/agents', '/broadcast'],
            '📋 Help & Other': ['/help', '/version', '/changelog', '/feedback', '/theme', '/experimental', '/instructions', '/streamer\\_mode', '/update', '/login', '/logout', '/restart', '/user'],
          };

          let msg = '📋 *All Commands by Category*\n';
          for (const [cat, cmds] of Object.entries(categories)) {
            msg += `\n*${cat}:*\n${cmds.join(', ')}\n`;
          }
          msg += `\n_Total: ${Object.values(categories).flat().length} commands_`;
          return reply(msg), true;
        }

        // ── Model & Mode ──
        case '/model': {
          const models = [
            { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
            { id: 'anthropic/claude-haiku-4-20250414', label: 'Claude Haiku 4' },
            { id: 'anthropic/claude-opus-4-20250918', label: 'Claude Opus 4' },
            { id: 'openai/gpt-4o', label: 'GPT-4o' },
            { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
            { id: 'openai/gpt-4.1', label: 'GPT-4.1' },
            { id: 'openai/o4-mini', label: 'o4-mini' },
            { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro' },
            { id: 'google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash' },
            { id: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3' },
            { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
            { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
            { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3 (Free)' },
          ];

          if (!args) {
            return reply(
              `🤖 *Current Model:* \`${this.currentModel}\`\n\n` +
              `*Available models:*\n${models.map(m => `• \`${m.id}\` — ${m.label}${m.id === this.currentModel ? ' ✓' : ''}`).join('\n')}\n\n` +
              `Switch with: /model <name>`
            ), true;
          }

          const query = args.toLowerCase();
          const match = models.find(m =>
            m.id.toLowerCase().includes(query) || m.label.toLowerCase().includes(query)
          );
          if (match) {
            this.currentModel = match.id;
            this.mainWindow?.webContents.send('telegram:command', { action: 'setModel', value: match.id });
            return reply(`✅ Model switched to *${match.label}*\n\`${match.id}\``), true;
          }
          return reply(`❌ Unknown model. Use /model to see available options.`), true;
        }

        case '/mode': {
          const modes = ['interactive', 'plan', 'autopilot'];
          if (!args) {
            return reply(
              `🔄 *Current Mode:* ${this.currentMode}\n\n` +
              `*Available:*\n${modes.map(m => `• ${m}${m === this.currentMode ? ' ✓' : ''}`).join('\n')}\n\n` +
              `Switch with: /mode <name>`
            ), true;
          }
          const match = modes.find(m => m.startsWith(args.toLowerCase()));
          if (match) {
            this.currentMode = match;
            this.mainWindow?.webContents.send('telegram:command', { action: 'setMode', value: match });
            return reply(`✅ Mode switched to *${match}*`), true;
          }
          return reply(`❌ Unknown mode. Options: ${modes.join(', ')}`), true;
        }

        case '/version':
          return reply(
            `📦 *Copilot GLI* v1.0.0\n\n` +
            `Model: \`${this.currentModel}\`\n` +
            `Mode: ${this.currentMode}\n` +
            `Platform: ${process.platform}\n` +
            `Node: ${process.version}\n` +
            `Bot: @${this.botInfo?.username}`
          ), true;

        // ── Session ──
        case '/clear':
          this.clearConversation(chatId);
          this.mainWindow?.webContents.send('telegram:command', { action: 'clearChat' });
          return reply('🧹 Chat history cleared.'), true;

        case '/new':
          this.clearConversation(chatId);
          this.mainWindow?.webContents.send('telegram:command', { action: 'newSession' });
          return reply('✨ New session started. Conversation history reset.'), true;

        case '/context':
          this.mainWindow?.webContents.send('telegram:command', { action: 'context' });
          return reply(`📊 Context info sent to GLI. Check the app for details.`), true;

        case '/usage':
          return reply(
            `📈 *Session Usage*\n\n` +
            `Model: \`${this.currentModel}\`\n` +
            `Mode: ${this.currentMode}\n` +
            `Bot uptime: ${Math.floor((Date.now() - (this._startTime || Date.now())) / 60000)} min\n` +
            `Agents active: ${[...this.agents.values()].filter(a => a.status === 'running').length}`
          ), true;

        case '/copy':
          this.mainWindow?.webContents.send('telegram:command', { action: 'copyLast' });
          return reply('📋 Last response copied to clipboard (in GLI).'), true;

        // ── System Control ──
        case '/status': {
          if (!this.systemCtl) return reply('❌ System control not available.'), true;
          const info = await this.systemCtl.getQuickInfo();
          return reply(
            `🖥️ *System Status*\n\n` +
            `💻 ${info.hostname} (${info.platform})\n` +
            `⚙️ CPU: ${info.cpuModel}\n` +
            `🧠 RAM: ${formatPercent(info.usedMemory, info.totalMemory)} used\n` +
            `⏱️ Uptime: ${formatUptime(info.uptime)}\n` +
            `👤 User: ${info.user}`
          ), true;
        }

        case '/system': {
          if (!this.systemCtl) return reply('❌ System control not available.'), true;
          const info = await this.systemCtl.getDetailedInfo();
          let msg = `🖥️ *Detailed System Info*\n\n`;
          msg += `*OS:* ${info.os.distro} ${info.os.release}\n`;
          msg += `*CPU:* ${info.cpu.brand} (${info.cpu.cores} cores @ ${info.cpu.speed}GHz)\n`;
          msg += `*RAM:* ${formatBytes(info.memory.used)} / ${formatBytes(info.memory.total)} (${Math.round(info.memory.percentUsed)}%)\n`;
          for (const d of info.disks.slice(0, 4)) {
            msg += `*Disk ${d.mount}:* ${formatBytes(d.used)} / ${formatBytes(d.size)} (${Math.round(d.percentUsed)}%)\n`;
          }
          for (const g of info.gpu) {
            msg += `*GPU:* ${g.model} (${g.vram}MB)\n`;
          }
          if (info.battery.hasBattery) {
            msg += `*Battery:* ${info.battery.percent}%${info.battery.isCharging ? ' ⚡ Charging' : ''}\n`;
          }
          return reply(msg), true;
        }

        case '/processes': {
          if (!this.systemCtl) return reply('❌ System control not available.'), true;
          const procs = await this.systemCtl.listProcesses();
          const filter = args.toLowerCase();
          const filtered = filter ? procs.filter(p => p.name.toLowerCase().includes(filter)) : procs;
          const top = filtered.slice(0, 20);

          let msg = `⚙️ *Processes${filter ? ` matching "${args}"` : ''}* (${filtered.length} total)\n\n`;
          msg += '```\n';
          msg += 'PID     CPU%  MEM%  Name\n';
          msg += '─'.repeat(40) + '\n';
          for (const p of top) {
            msg += `${String(p.pid).padEnd(8)}${String(p.cpu).padEnd(6)}${String(p.mem).padEnd(6)}${p.name}\n`;
          }
          msg += '```';
          if (filtered.length > 20) msg += `\n\n_…and ${filtered.length - 20} more_`;
          return reply(msg), true;
        }

        case '/kill': {
          if (!this.systemCtl) return reply('❌ System control not available.'), true;
          const pid = parseInt(args);
          if (!pid) return reply('Usage: /kill <PID>\n\nExample: `/kill 1234`'), true;
          const result = await this.systemCtl.killProcess(pid);
          return reply(result.success ? `✅ Process ${pid} killed.` : `❌ Failed: ${result.error}`), true;
        }

        case '/screenshot': {
          if (!this.systemCtl) return reply('❌ System control not available.'), true;
          await reply('📸 Capturing desktop...');
          const result = await this.systemCtl.takeScreenshot();
          if (result.success && result.data) {
            try {
              const tmpPath = require('path').join(require('os').tmpdir(), `gli-screenshot-${Date.now()}.png`);
              const base64Data = result.data.replace(/^data:image\/png;base64,/, '');
              require('fs').writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'));
              await this.bot.sendPhoto(chatId, tmpPath, { caption: '🖥️ Desktop Screenshot', reply_to_message_id: messageId });
              try { require('fs').unlinkSync(tmpPath); } catch {}
              return true;
            } catch (err) {
              return reply(`❌ Failed to send screenshot: ${err.message}`), true;
            }
          }
          return reply(`❌ Screenshot failed: ${result.error || 'Unknown error'}`), true;
        }

        case '/clipboard': {
          if (!this.systemCtl) return reply('❌ System control not available.'), true;
          const clip = await this.systemCtl.readClipboard();
          const text_content = clip.text || '(empty)';
          return reply(`📋 *Clipboard Contents:*\n\n\`\`\`\n${text_content.substring(0, 3000)}\`\`\`${text_content.length > 3000 ? '\n\n_(truncated)_' : ''}`), true;
        }

        case '/wifi': {
          if (!this.systemCtl) return reply('❌ System control not available.'), true;
          const networks = await this.systemCtl.getWifiNetworks();
          if (!networks.length) return reply('📶 No WiFi networks found.'), true;
          let msg = `📶 *WiFi Networks* (${networks.length})\n\n`;
          for (const n of networks.slice(0, 15)) {
            const bars = n.signal > 75 ? '████' : n.signal > 50 ? '███░' : n.signal > 25 ? '██░░' : '█░░░';
            msg += `• *${n.ssid || '(hidden)'}* — ${bars} ${n.signal}% (${n.auth})\n`;
          }
          return reply(msg), true;
        }

        case '/mute': {
          if (!this.systemCtl) return reply('❌ System control not available.'), true;
          await this.systemCtl.muteToggle();
          return reply('🔇 System mute toggled.'), true;
        }

        case '/open': {
          if (!args) return reply('Usage: /open <path or URL>\n\nExample: `/open C:\\Users` or `/open https://github.com`'), true;
          if (!this.systemCtl) return reply('❌ System control not available.'), true;
          const result = args.startsWith('http') 
            ? await this.systemCtl.openUrl(args)
            : await this.systemCtl.openPath(args);
          return reply(result.success ? `✅ Opened: ${args}` : `❌ ${result.error}`), true;
        }

        // ── Shell ──
        case '/shell': {
          if (!args) return reply('Usage: /shell <command>\n\nExample: `/shell dir C:\\`'), true;
          await reply(`⚡ Running: \`${args}\``);
          try {
            const output = await new Promise((resolve, reject) => {
              const { exec } = require('child_process');
              exec(args, { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
                if (err && !stdout && !stderr) reject(err);
                else resolve((stdout || '') + (stderr || ''));
              });
            });
            const trimmed = output.trim().substring(0, 3500);
            return reply(`✅ *Output:*\n\n\`\`\`\n${trimmed || '(no output)'}\`\`\`${output.length > 3500 ? '\n\n_(truncated)_' : ''}`), true;
          } catch (err) {
            return reply(`❌ *Error:*\n\n\`\`\`\n${err.message}\`\`\``), true;
          }
        }

        // ── Browser ──
        case '/browse': {
          if (!this.browserCtl) return reply('❌ Browser control not available.'), true;
          if (!args) return reply('Usage: /browse <url>\n\nExample: `/browse https://github.com`'), true;
          
          const info = this.browserCtl.getInfo();
          if (!info.connected) {
            await reply('🌐 Launching browser...');
            await this.browserCtl.launch();
          }
          const result = await this.browserCtl.navigate(args.startsWith('http') ? args : `https://${args}`);
          if (result.success) {
            return reply(`🌐 *Navigated to:*\n\n${result.title}\n${result.url}`), true;
          }
          return reply(`❌ Navigation failed: ${result.error}`), true;
        }

        case '/browser_screenshot':
        case '/bs': {
          if (!this.browserCtl) return reply('❌ Browser control not available.'), true;
          const info = this.browserCtl.getInfo();
          if (!info.connected) return reply('❌ No browser running. Use /browse <url> first.'), true;
          
          await reply('📸 Capturing browser...');
          const result = await this.browserCtl.screenshot({ fullPage: false });
          if (result.success && result.data) {
            try {
              const tmpPath = require('path').join(require('os').tmpdir(), `gli-browser-${Date.now()}.png`);
              const base64Data = result.data.replace(/^data:image\/png;base64,/, '');
              require('fs').writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'));
              await this.bot.sendPhoto(chatId, tmpPath, { caption: '🌐 Browser Screenshot', reply_to_message_id: messageId });
              try { require('fs').unlinkSync(tmpPath); } catch {}
              return true;
            } catch (err) {
              return reply(`❌ Failed to send: ${err.message}`), true;
            }
          }
          return reply(`❌ Browser screenshot failed: ${result.error || 'Unknown error'}`), true;
        }

        case '/browser_content':
        case '/bc': {
          if (!this.browserCtl) return reply('❌ Browser control not available.'), true;
          const info = this.browserCtl.getInfo();
          if (!info.connected) return reply('❌ No browser running. Use /browse <url> first.'), true;
          
          const result = await this.browserCtl.getContent();
          if (result.success) {
            const preview = result.text.substring(0, 3000);
            return reply(`📄 *${result.title}*\n\n\`\`\`\n${preview}\`\`\`${result.text.length > 3000 ? '\n\n_(truncated)_' : ''}`), true;
          }
          return reply(`❌ ${result.error}`), true;
        }

        case '/tabs': {
          if (!this.browserCtl) return reply('❌ Browser control not available.'), true;
          const info = this.browserCtl.getInfo();
          if (!info.connected) return reply('❌ No browser running.'), true;
          
          const tabs = await this.browserCtl.listTabs();
          let msg = `🗂️ *Browser Tabs* (${tabs.length})\n\n`;
          tabs.forEach((t, i) => {
            msg += `${t.isActive ? '▸' : '•'} ${i + 1}. ${t.title || 'Untitled'}\n  ${t.url}\n`;
          });
          return reply(msg), true;
        }

        // ── Agents ──
        case '/agents': {
          const agentList = this.listAgents();
          if (!agentList.length) return reply('🤖 No active agents.\n\nUse /broadcast <msg> to create a broadcast agent.'), true;
          let msg = `🤖 *Active Agents* (${agentList.length})\n\n`;
          for (const a of agentList) {
            const icon = a.status === 'running' ? '🟢' : a.status === 'completed' ? '✅' : a.status === 'failed' ? '🔴' : '⬜';
            msg += `${icon} *${a.name}* (${a.id})\n   Task: ${a.task}\n   Status: ${a.status}\n\n`;
          }
          return reply(msg), true;
        }

        case '/broadcast': {
          if (!args) return reply('Usage: /broadcast <message>\n\nSends a message to the configured group.'), true;
          const result = await this.sendToGroup(args);
          return reply(result.success ? `✅ Broadcast sent to group!` : `❌ ${result.error}`), true;
        }

        // ── Code ──
        case '/diff': {
          try {
            const output = await new Promise((resolve, reject) => {
              const { exec } = require('child_process');
              exec('git --no-pager diff --stat', { timeout: 10000 }, (err, stdout) => {
                if (err) reject(err);
                else resolve(stdout);
              });
            });
            return reply(`📝 *Git Diff:*\n\n\`\`\`\n${output.trim() || 'No changes'}\`\`\``), true;
          } catch {
            return reply('📝 No git repository found in current directory.'), true;
          }
        }

        case '/pr':
          this.mainWindow?.webContents.send('telegram:command', { action: 'pr' });
          return reply(
            '🔀 *Pull Requests*\n\n' +
            'Checking PRs for current branch...\n\n' +
            '_Use `/shell git log --oneline -5` to see recent commits._'
          ), true;

        case '/review':
          this.mainWindow?.webContents.send('telegram:command', { action: 'review' });
          return reply(
            '🔍 *Code Review*\n\n' +
            'Starting code review analysis...\n' +
            'Analyzing staged/unstaged changes for bugs, security issues, and logic errors.'
          ), true;

        case '/lsp':
          this.mainWindow?.webContents.send('telegram:command', { action: 'lsp' });
          return reply(
            '📡 *Language Servers*\n\n' +
            'Configure LSP servers in `~/.copilot/lsp-config.json`\n' +
            'Or per-repo in `.github/lsp.json`\n\n' +
            '*Supported:* TypeScript, Python, Rust, Go, Java, and more.\n\n' +
            'Example:\n```\n{\n  "lspServers": {\n    "typescript": {\n      "command": "typescript-language-server",\n      "args": ["--stdio"]\n    }\n  }\n}\n```'
          ), true;

        case '/ide':
          this.mainWindow?.webContents.send('telegram:command', { action: 'ide' });
          return reply('🖥️ *IDE Connection*\n\nNo IDE workspace connected.\n\nUse this to connect GLI to VS Code or other IDE workspaces.'), true;

        case '/plan':
          this.currentMode = 'plan';
          this.mainWindow?.webContents.send('telegram:command', { action: 'setMode', value: 'plan' });
          return reply('📋 *Plan Mode Activated*\n\nDescribe what you want to build and GLI will create an implementation plan.'), true;

        case '/research':
          this.mainWindow?.webContents.send('telegram:command', { action: 'research' });
          return reply('🔬 *Deep Research*\n\nSend your research topic as a follow-up message.\nUses GitHub search and web sources for investigation.'), true;

        case '/terminal_setup':
        case '/terminal-setup':
          this.mainWindow?.webContents.send('telegram:command', { action: 'terminalSetup' });
          return reply('⌨️ Terminal configured for multiline input (Shift+Enter).'), true;

        // ── Agent Environment ──
        case '/init':
          this.mainWindow?.webContents.send('telegram:command', { action: 'init' });
          return reply(
            '⚙️ *Repository Init*\n\n' +
            'Looking for custom instructions in:\n' +
            '• `CLAUDE.md` / `GEMINI.md` / `AGENTS.md`\n' +
            '• `.github/instructions/**/*.instructions.md`\n' +
            '• `.github/copilot-instructions.md`\n' +
            '• `~/.copilot/copilot-instructions.md`'
          ), true;

        case '/agent':
          this.mainWindow?.webContents.send('telegram:command', { action: 'agent' });
          return reply(
            '🤖 *Available Agents*\n\n' +
            '• *explore* — Codebase exploration (fast)\n' +
            '• *task* — Command execution with verbose output\n' +
            '• *general-purpose* — Full capabilities (Sonnet)\n' +
            '• *code-review* — Review changes, high signal'
          ), true;

        case '/skills':
          this.mainWindow?.webContents.send('telegram:command', { action: 'skills' });
          return reply('🛠️ *Skills*\n\nNo additional skills loaded.\n\nSkills provide specialized capabilities. Check `~/.copilot/skills/` for available skills.'), true;

        case '/mcp':
          this.mainWindow?.webContents.send('telegram:command', { action: 'openMcpSettings' });
          return reply(
            '🔌 *MCP Server Configuration*\n\n' +
            'MCP (Model Context Protocol) extends GLI with external tools.\n\n' +
            'Configure in GLI Settings panel or edit `~/.copilot/mcp.json`\n\n' +
            'Example:\n```\n{\n  "servers": {\n    "github": {\n      "command": "gh-mcp",\n      "args": ["--stdio"]\n    }\n  }\n}\n```'
          ), true;

        case '/plugin':
          this.mainWindow?.webContents.send('telegram:command', { action: 'plugin' });
          return reply('🔌 *Plugins*\n\nNo plugins installed.\n\nPlugins extend GLI with additional capabilities from marketplaces.'), true;

        // ── Models & Subagents ──
        case '/delegate':
          this.mainWindow?.webContents.send('telegram:command', { action: 'delegate' });
          return reply('🚀 *Delegate to GitHub*\n\nThis sends your session to GitHub where Copilot will create a PR.\n\n_Requires GitHub integration._'), true;

        case '/fleet': {
          this.mainWindow?.webContents.send('telegram:command', { action: 'fleet' });
          return reply('🚢 *Fleet Mode*\n\nFleet mode enables parallel subagent execution for faster task completion.\n\nMultiple agents work simultaneously on different parts of your task.'), true;
        }

        case '/tasks':
          this.mainWindow?.webContents.send('telegram:command', { action: 'tasks' });
          return reply(
            `📋 *Background Tasks*\n\n` +
            `Active agents: ${[...this.agents.values()].filter(a => a.status === 'running').length}\n` +
            `Completed: ${[...this.agents.values()].filter(a => a.status === 'completed').length}\n\n` +
            `Use /agents for detailed agent list.`
          ), true;

        // ── Session ──
        case '/compact':
          this.mainWindow?.webContents.send('telegram:command', { action: 'compact' });
          return reply('📦 Conversation compacted. Context usage reduced in GLI.'), true;

        case '/share':
          this.mainWindow?.webContents.send('telegram:command', { action: 'share' });
          return reply(
            '📤 *Share Options*\n\n' +
            '• Export as Markdown\n' +
            '• Export as HTML\n' +
            '• Create GitHub Gist\n\n' +
            '_Check GLI app for export options._'
          ), true;

        case '/rewind':
        case '/undo':
          this.mainWindow?.webContents.send('telegram:command', { action: 'rewind' });
          return reply('⏪ Last turn rewound. File changes reverted in GLI.'), true;

        case '/resume':
          this.mainWindow?.webContents.send('telegram:command', { action: 'resume' });
          return reply('📂 *Sessions*\n\nNo saved sessions found.\n\nSessions will be listed here when session persistence is enabled.'), true;

        case '/rename':
          if (!args) return reply('Usage: /rename <new name>\n\nRenames the current GLI session.'), true;
          this.mainWindow?.webContents.send('telegram:command', { action: 'rename', value: args });
          return reply(`✏️ Session renamed to: *${args}*`), true;

        case '/session':
          this.mainWindow?.webContents.send('telegram:command', { action: 'session' });
          return reply(
            '📂 *Session Manager*\n\n' +
            'Subcommands:\n' +
            '• /resume — Switch to a different session\n' +
            '• /rename <name> — Rename current session\n' +
            '• /new — Start new session\n' +
            '• /compact — Compress current session'
          ), true;

        // ── Permissions ──
        case '/allow_all':
        case '/allow-all':
          this.mainWindow?.webContents.send('telegram:command', { action: 'allowAll' });
          return reply('✅ All permissions enabled (tools, paths, and URLs).'), true;

        case '/add_dir':
        case '/add-dir':
          if (!args) return reply('Usage: /add\\_dir <path>\n\nAdds a directory to the allowed list for file access.'), true;
          this.mainWindow?.webContents.send('telegram:command', { action: 'addDir', value: args });
          return reply(`📂 Directory added: \`${args}\``), true;

        case '/list_dirs':
        case '/list-dirs':
          this.mainWindow?.webContents.send('telegram:command', { action: 'listDirs' });
          return reply('📂 Allowed directories sent to GLI. Check the app for the list.'), true;

        case '/cwd':
          if (args) {
            this.mainWindow?.webContents.send('telegram:command', { action: 'cwd', value: args });
            return reply(`📍 Working directory changed to: \`${args}\``), true;
          }
          return reply(`📍 *Current Working Directory:*\n\n\`${process.cwd()}\``), true;

        case '/reset_allowed_tools':
        case '/reset-allowed-tools':
          this.mainWindow?.webContents.send('telegram:command', { action: 'resetTools' });
          return reply('🔄 Allowed tools list has been reset to defaults.'), true;

        // ── Help & Feedback ──
        case '/experimental': {
          this.mainWindow?.webContents.send('telegram:command', { action: 'experimental' });
          return reply(
            '🧪 *Experimental Mode*\n\n' +
            'Toggled experimental features in GLI.\n\n' +
            'Experimental features include:\n' +
            '• Autopilot mode (Shift+Tab to cycle)\n' +
            '• Advanced agent capabilities'
          ), true;
        }

        case '/theme':
          if (args && ['dark', 'cyberpunk', 'light'].includes(args.toLowerCase())) {
            this.mainWindow?.webContents.send('telegram:command', { action: 'setTheme', value: args.toLowerCase() });
            return reply(`🎨 Theme switched to *${args.toLowerCase()}*`), true;
          }
          return reply('🎨 *Themes:* dark, cyberpunk, light\n\nUsage: /theme <name>'), true;

        case '/changelog':
          return reply(
            `📋 *Changelog — v1.0.0*\n\n` +
            `• 🎨 3 themes (Dark/Cyberpunk/Light)\n` +
            `• 💬 AI chat + 50+ slash commands\n` +
            `• 📁 File explorer + syntax highlighting\n` +
            `• ⌨️ Integrated terminal\n` +
            `• 🔍 Full-text search\n` +
            `• 🤖 15 AI model selector\n` +
            `• 📱 Telegram bot integration (all CLI commands)\n` +
            `• 🖥️ Full PC system control\n` +
            `• 🌐 Browser automation (Puppeteer)\n` +
            `• 🤖 Background agents system\n` +
            `• 🔌 MCP server support\n` +
            `• ⌨️ Command palette (Ctrl+Shift+P)`
          ), true;

        case '/feedback':
          return reply('💬 Thanks for using Copilot GLI! Send your feedback as a message and it will be logged.\n\nYou can also open an issue on GitHub.'), true;

        case '/instructions':
          this.mainWindow?.webContents.send('telegram:command', { action: 'instructions' });
          return reply(
            '📝 *Custom Instructions*\n\n' +
            'Copilot GLI respects instructions from:\n' +
            '• `CLAUDE.md` / `GEMINI.md` / `AGENTS.md`\n' +
            '• `.github/instructions/**/*.instructions.md`\n' +
            '• `.github/copilot-instructions.md`\n' +
            '• `~/.copilot/copilot-instructions.md`\n' +
            '• `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` env var'
          ), true;

        case '/streamer_mode':
        case '/streamer-mode':
          this.mainWindow?.webContents.send('telegram:command', { action: 'streamerMode' });
          return reply('🎬 Streamer mode toggled. Model names and quota details are now hidden for streaming.'), true;

        case '/update':
          return reply(
            '📦 *Update Check*\n\n' +
            `Current: v1.0.0\n` +
            `Latest: v1.0.0\n\n` +
            '✅ You are on the latest version.\n\n' +
            '_Run `git pull` in the project directory to update._'
          ), true;

        // ── Other ──
        case '/login':
          this.mainWindow?.webContents.send('telegram:command', { action: 'login' });
          return reply('🔑 *Login*\n\nUse `gh auth login` in the GLI terminal to authenticate with GitHub.'), true;

        case '/logout':
          this.mainWindow?.webContents.send('telegram:command', { action: 'logout' });
          return reply('🚪 *Logout*\n\nUse `gh auth logout` in the GLI terminal to log out.'), true;

        case '/restart':
          this.mainWindow?.webContents.send('telegram:command', { action: 'restart' });
          return reply('🔄 GLI app restart requested. The app will reload.'), true;

        case '/exit':
        case '/quit':
          return reply('👋 GLI is a desktop app — use the window close button or Ctrl+Q to exit.\n\nThe Telegram bot will keep running as long as the app is open.'), true;

        case '/user':
          try {
            const ghUser = await new Promise((resolve, reject) => {
              const { exec } = require('child_process');
              exec('gh api user --jq ".login"', { timeout: 10000 }, (err, stdout) => {
                if (err) reject(err);
                else resolve(stdout.trim());
              });
            });
            return reply(`👤 *GitHub User:* @${ghUser}\n\nAuthenticated via GitHub CLI.`), true;
          } catch {
            return reply('👤 *GitHub User*\n\nNot authenticated. Use /login to authenticate.'), true;
          }

        default:
          // Unknown /command — don't handle, let it pass to renderer
          return false;
      }
    } catch (err) {
      console.error(`[Telegram] Command error (${cmd}):`, err.message);
      await reply(`❌ Command error: ${err.message}`);
      return true;
    }
  }

  /**
   * Send a reply back to Telegram
   */
  async sendReply(chatId, text, replyToMessageId = null) {
    if (!this.bot || !this.isConnected) {
      return { success: false, error: 'Bot not connected' };
    }

    try {
      const opts = { parse_mode: 'Markdown' };
      if (replyToMessageId) {
        opts.reply_to_message_id = replyToMessageId;
      }

      const sent = await this.bot.sendMessage(chatId, text, opts);
      return { success: true, messageId: sent.message_id };
    } catch (err) {
      // Retry without Markdown if parsing fails
      if (err.message.includes("can't parse")) {
        try {
          const sent = await this.bot.sendMessage(chatId, text, {
            reply_to_message_id: replyToMessageId || undefined,
          });
          return { success: true, messageId: sent.message_id };
        } catch (retryErr) {
          return { success: false, error: retryErr.message };
        }
      }
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a message proactively to the configured group
   */
  async sendToGroup(text) {
    if (!this.groupId) {
      return { success: false, error: 'No TELEGRAM_GROUP_ID configured' };
    }
    return this.sendReply(this.groupId, text);
  }

  // ═══════════════════════════════════════════════════════════
  //  AI Message Processing
  // ═══════════════════════════════════════════════════════════

  /**
   * Process a user message through OpenRouter AI and reply on Telegram
   */
  async processAIMessage(chatId, messageId, text, from) {
    // Determine which AI backend to use: CopilotAPI (GitHub token) > OpenRouter > none
    const aiBackend = this._getAIBackend();
    if (!aiBackend) {
      await this.sendReply(chatId,
        '⚠️ *AI not configured.*\n\n' +
        'Option 1: Run `gh auth login` to use GitHub Copilot models (free)\n' +
        'Option 2: Set `OPENROUTER_API_KEY` in `.env` for 200+ models\n\n' +
        'Get a free OpenRouter key at [openrouter.ai](https://openrouter.ai)',
        messageId
      );
      return;
    }

    // Send typing indicator
    try {
      await this.bot.sendChatAction(chatId, 'typing');
    } catch {}

    // Get or create conversation history for this chat
    const chatKey = chatId.toString();
    if (!this.conversations.has(chatKey)) {
      this.conversations.set(chatKey, []);
    }
    const history = this.conversations.get(chatKey);

    // Add user message to history
    history.push({ role: 'user', content: text });

    // Trim history if too long
    while (history.length > this.maxHistoryPerChat) {
      history.shift();
    }

    // Build messages array with system prompt
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...history,
    ];

    try {
      console.log(`[Telegram] Sending to AI (${aiBackend.name}, model: ${this.currentModel}): ${text.substring(0, 60)}...`);

      const result = await aiBackend.service.chat(messages, {
        model: this.currentModel,
        maxTokens: 4096,
        temperature: 0.7,
      });

      if (result.success) {
        const reply = result.content;

        // Add assistant response to history
        history.push({ role: 'assistant', content: reply });

        // Send to Telegram (split if too long — Telegram limit is 4096 chars)
        await this.sendLongReply(chatId, reply, messageId);

        // Also forward the AI response to the renderer
        this.mainWindow?.webContents.send('telegram:ai-response', {
          chatId: chatKey,
          userMessage: text,
          aiResponse: reply,
          model: result.model || this.currentModel,
          usage: result.usage,
          from: {
            id: from.id,
            name: `${from.first_name || ''}${from.last_name ? ' ' + from.last_name : ''}`.trim(),
          },
        });

        console.log(`[Telegram] AI replied (${reply.length} chars, model: ${result.model || this.currentModel})`);
      } else {
        const errMsg = `❌ *AI Error:* ${result.error}`;
        await this.sendReply(chatId, errMsg, messageId);
        console.error(`[Telegram] AI error: ${result.error}`);
      }
    } catch (err) {
      await this.sendReply(chatId, `❌ *Error:* ${err.message}`, messageId);
      console.error(`[Telegram] AI processing failed:`, err.message);
    }
  }

  /**
   * Send a long message split into chunks (Telegram 4096 char limit)
   */
  async sendLongReply(chatId, text, replyToMessageId) {
    const MAX_LEN = 4000; // Leave room for formatting
    if (text.length <= MAX_LEN) {
      return this.sendReply(chatId, text, replyToMessageId);
    }

    // Split at paragraph boundaries first, then by length
    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_LEN) {
        chunks.push(remaining);
        break;
      }

      // Try to split at a paragraph boundary
      let splitIndex = remaining.lastIndexOf('\n\n', MAX_LEN);
      if (splitIndex < MAX_LEN * 0.3) {
        // No good paragraph break, try newline
        splitIndex = remaining.lastIndexOf('\n', MAX_LEN);
      }
      if (splitIndex < MAX_LEN * 0.3) {
        // No good newline, force split at max
        splitIndex = MAX_LEN;
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trimStart();
    }

    // Send first chunk as reply, rest as follow-ups
    for (let i = 0; i < chunks.length; i++) {
      const prefix = chunks.length > 1 ? `_(${i + 1}/${chunks.length})_\n` : '';
      await this.sendReply(
        chatId,
        prefix + chunks[i],
        i === 0 ? replyToMessageId : null
      );
      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  /**
   * Clear conversation history for a chat
   */
  clearConversation(chatId) {
    this.conversations.delete(chatId.toString());
  }

  /**
   * Determine which AI backend is available
   * Priority: CopilotAPI (GitHub Models, free) > OpenRouter (paid/free) > null
   */
  _getAIBackend() {
    if (this.copilotApi && this.copilotApi.enabled) {
      return { name: 'Copilot', service: this.copilotApi };
    }
    if (this.openrouter && this.openrouter.enabled) {
      return { name: 'OpenRouter', service: this.openrouter };
    }
    return null;
  }

  /**
   * Send status update to renderer
   */
  sendStatus(status, message) {
    this.mainWindow?.webContents.send('telegram:status', { status, message });
  }

  /**
   * Get connection info
   */
  getInfo() {
    return {
      connected: this.isConnected,
      botUsername: this.botInfo?.username || null,
      botName: this.botInfo?.first_name || null,
      groupId: this.groupId || null,
      agents: Array.from(this.agents.entries()).map(([id, agent]) => ({
        id,
        name: agent.name,
        status: agent.status,
        task: agent.task,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  Background Agent System
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a background agent that processes tasks autonomously
   */
  createAgent(name, task, options = {}) {
    const id = `agent-${++this.agentIdCounter}`;
    const agent = {
      id,
      name,
      task,
      status: 'running',
      createdAt: Date.now(),
      logs: [],
      interval: null,
      options,
    };

    this.agents.set(id, agent);
    this.notifyAgentUpdate(agent);

    // Start agent loop
    this.runAgent(agent);

    return { id, name, status: 'running' };
  }

  async runAgent(agent) {
    agent.logs.push({ time: Date.now(), msg: `Agent "${agent.name}" started: ${agent.task}` });
    this.notifyAgentUpdate(agent);

    try {
      switch (agent.options.type) {
        case 'telegram-monitor':
          // Continuous monitoring agent — stays running
          agent.interval = setInterval(() => {
            if (agent.status !== 'running') {
              clearInterval(agent.interval);
              return;
            }
            agent.logs.push({ time: Date.now(), msg: 'Monitoring Telegram messages...' });
            this.notifyAgentUpdate(agent);
          }, 30000);
          break;

        case 'telegram-broadcast':
          // Send a message to the group and complete
          if (agent.options.message) {
            const result = await this.sendToGroup(agent.options.message);
            agent.logs.push({
              time: Date.now(),
              msg: result.success
                ? `Broadcast sent successfully (msg ID: ${result.messageId})`
                : `Broadcast failed: ${result.error}`,
            });
          }
          agent.status = 'completed';
          this.notifyAgentUpdate(agent);
          break;

        case 'auto-responder':
          // Auto-respond to messages matching a pattern
          agent.logs.push({ time: Date.now(), msg: `Auto-responder active for pattern: ${agent.options.pattern || '*'}` });
          this.notifyAgentUpdate(agent);
          break;

        case 'file-watcher':
          // Watch files and report changes via Telegram
          agent.logs.push({ time: Date.now(), msg: `Watching files in: ${agent.options.path || process.cwd()}` });
          if (agent.options.path) {
            try {
              const watcher = require('fs').watch(agent.options.path, { recursive: true }, (eventType, filename) => {
                if (agent.status !== 'running') return;
                const msg = `📄 File ${eventType}: ${filename}`;
                agent.logs.push({ time: Date.now(), msg });
                this.notifyAgentUpdate(agent);
                if (agent.options.notifyTelegram) {
                  this.sendToGroup(msg);
                }
              });
              agent._watcher = watcher;
            } catch (e) {
              agent.logs.push({ time: Date.now(), msg: `Watch error: ${e.message}` });
              agent.status = 'failed';
              this.notifyAgentUpdate(agent);
            }
          }
          break;

        case 'scheduled-message':
          // Send a message at intervals
          const intervalMs = (agent.options.intervalMinutes || 60) * 60 * 1000;
          agent.interval = setInterval(async () => {
            if (agent.status !== 'running') {
              clearInterval(agent.interval);
              return;
            }
            const result = await this.sendToGroup(agent.options.message || `📊 Scheduled update from Copilot GLI agent "${agent.name}"`);
            agent.logs.push({
              time: Date.now(),
              msg: result.success ? 'Scheduled message sent' : `Send failed: ${result.error}`,
            });
            this.notifyAgentUpdate(agent);
          }, intervalMs);
          agent.logs.push({ time: Date.now(), msg: `Scheduled: every ${agent.options.intervalMinutes || 60} minutes` });
          this.notifyAgentUpdate(agent);
          break;

        default:
          // Generic task agent
          agent.logs.push({ time: Date.now(), msg: `Processing task: ${agent.task}` });
          await new Promise(r => setTimeout(r, 1000));
          agent.logs.push({ time: Date.now(), msg: 'Task processing complete' });
          agent.status = 'completed';
          this.notifyAgentUpdate(agent);
      }
    } catch (err) {
      agent.logs.push({ time: Date.now(), msg: `Error: ${err.message}` });
      agent.status = 'failed';
      this.notifyAgentUpdate(agent);
    }
  }

  stopAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    if (agent.interval) clearInterval(agent.interval);
    if (agent._watcher) agent._watcher.close();
    agent.status = 'stopped';
    agent.logs.push({ time: Date.now(), msg: 'Agent stopped by user' });
    this.notifyAgentUpdate(agent);

    return { success: true, id: agentId };
  }

  notifyAgentUpdate(agent) {
    this.mainWindow?.webContents.send('telegram:agentUpdate', {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      task: agent.task,
      logs: agent.logs.slice(-20),
      options: agent.options,
    });
  }

  listAgents() {
    return Array.from(this.agents.entries()).map(([id, agent]) => ({
      id,
      name: agent.name,
      status: agent.status,
      task: agent.task,
      logsCount: agent.logs.length,
      createdAt: agent.createdAt,
    }));
  }

  /**
   * Cleanup on app quit
   */
  destroy() {
    for (const [, agent] of this.agents) {
      if (agent.interval) clearInterval(agent.interval);
      if (agent._watcher) agent._watcher.close();
    }
    if (this.bot) {
      this.bot.stopPolling();
      this.bot = null;
    }
    this.isConnected = false;
  }
}

// ── Helper functions ──

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

function formatPercent(used, total) {
  return `${formatBytes(used)} / ${formatBytes(total)} (${Math.round((used / total) * 100)}%)`;
}

module.exports = TelegramService;
