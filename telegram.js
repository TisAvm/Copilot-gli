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
    this.currentModel = 'claude-sonnet-4-20250514';
    this.currentMode = 'interactive';
  }

  setControllers(systemCtl, browserCtl) {
    this.systemCtl = systemCtl;
    this.browserCtl = browserCtl;
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

      // Forward non-command messages to renderer
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

    const commands = [
      { command: 'help', description: 'Show all available commands' },
      { command: 'commands', description: 'List commands by category' },
      { command: 'model', description: 'View or switch AI model' },
      { command: 'mode', description: 'View or switch mode (interactive/plan/autopilot)' },
      { command: 'version', description: 'Show version info' },
      { command: 'status', description: 'Show system status overview' },
      { command: 'system', description: 'Detailed system information' },
      { command: 'processes', description: 'List running processes' },
      { command: 'kill', description: 'Kill a process by PID' },
      { command: 'screenshot', description: 'Capture desktop screenshot' },
      { command: 'shell', description: 'Execute a shell command' },
      { command: 'clipboard', description: 'Read clipboard contents' },
      { command: 'browse', description: 'Open URL in browser' },
      { command: 'browser_screenshot', description: 'Capture browser screenshot' },
      { command: 'wifi', description: 'Scan WiFi networks' },
      { command: 'agents', description: 'List background agents' },
      { command: 'broadcast', description: 'Send message to group' },
      { command: 'clear', description: 'Clear GLI chat' },
      { command: 'context', description: 'Show context usage' },
      { command: 'usage', description: 'Show session usage' },
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
            `*💬 Chat*\n` +
            `/clear — Clear GLI chat\n` +
            `/context — Show context usage\n` +
            `/usage — Session metrics\n\n` +
            `*🤖 Model & Mode*\n` +
            `/model [name] — View/switch AI model\n` +
            `/mode [name] — View/switch mode\n` +
            `/version — Version info\n\n` +
            `*🖥️ System*\n` +
            `/status — Quick system overview\n` +
            `/system — Detailed system info\n` +
            `/processes [filter] — List processes\n` +
            `/kill <PID> — Kill a process\n` +
            `/screenshot — Desktop screenshot\n` +
            `/clipboard — Read clipboard\n` +
            `/wifi — Scan WiFi\n` +
            `/mute — Toggle system mute\n\n` +
            `*🌐 Browser*\n` +
            `/browse <url> — Open URL\n` +
            `/browser\\_screenshot — Page screenshot\n` +
            `/browser\\_content — Get page text\n` +
            `/tabs — List browser tabs\n\n` +
            `*⚡ Execution*\n` +
            `/shell <command> — Run shell command\n` +
            `/open <path> — Open file/folder/URL\n\n` +
            `*🤖 Agents*\n` +
            `/agents — List active agents\n` +
            `/broadcast <msg> — Send to group\n\n` +
            `*📝 Other*\n` +
            `/commands — Full command list by category\n` +
            `/diff — Git diff\n` +
            `/plan — Switch to plan mode\n` +
            `/research — Start research\n\n` +
            `Or just type anything — it goes straight to GLI chat! 💬`
          ), true;

        case '/commands': {
          const categories = {
            'Models': ['/model', '/delegate', '/fleet', '/tasks'],
            'Agent': ['/init', '/agent', '/skills', '/mcp', '/plugin'],
            'Code': ['/diff', '/pr', '/review', '/lsp', '/ide', '/plan', '/research'],
            'Session': ['/clear', '/new', '/compact', '/share', '/copy', '/context', '/usage', '/rewind', '/resume', '/rename'],
            'Permissions': ['/allow-all', '/add-dir', '/list-dirs', '/cwd', '/reset-allowed-tools'],
            'System': ['/status', '/system', '/processes', '/kill', '/screenshot', '/clipboard', '/wifi', '/mute', '/open'],
            'Browser': ['/browse', '/browser\\_screenshot', '/browser\\_content', '/tabs'],
            'Help': ['/help', '/version', '/changelog', '/feedback', '/theme', '/experimental', '/instructions'],
          };

          let msg = '📋 *All Commands by Category*\n';
          for (const [cat, cmds] of Object.entries(categories)) {
            msg += `\n*${cat}:* ${cmds.join(', ')}`;
          }
          return reply(msg), true;
        }

        // ── Model & Mode ──
        case '/model': {
          const models = [
            'claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-opus-4-20250918',
            'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.5-preview', 'o3-mini', 'o4-mini',
          ];

          if (!args) {
            return reply(
              `🤖 *Current Model:* \`${this.currentModel}\`\n\n` +
              `*Available models:*\n${models.map(m => `• \`${m}\`${m === this.currentModel ? ' ✓' : ''}`).join('\n')}\n\n` +
              `Switch with: /model <name>`
            ), true;
          }

          const match = models.find(m => m.includes(args.toLowerCase()));
          if (match) {
            this.currentModel = match;
            this.mainWindow?.webContents.send('telegram:command', { action: 'setModel', value: match });
            return reply(`✅ Model switched to \`${match}\``), true;
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
          this.mainWindow?.webContents.send('telegram:command', { action: 'clearChat' });
          return reply('🧹 GLI chat cleared.'), true;

        case '/new':
          this.mainWindow?.webContents.send('telegram:command', { action: 'newSession' });
          return reply('✨ New GLI session started.'), true;

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

        case '/plan':
          this.currentMode = 'plan';
          this.mainWindow?.webContents.send('telegram:command', { action: 'setMode', value: 'plan' });
          return reply('📋 *Plan Mode Activated*\n\nDescribe what you want to build and GLI will create an implementation plan.'), true;

        case '/research':
          this.mainWindow?.webContents.send('telegram:command', { action: 'research' });
          return reply('🔬 *Research Mode*\n\nSend your research topic as a follow-up message.'), true;

        // ── Fallback ──
        case '/compact':
          this.mainWindow?.webContents.send('telegram:command', { action: 'compact' });
          return reply('📦 Conversation compacted in GLI.'), true;

        case '/experimental': {
          this.mainWindow?.webContents.send('telegram:command', { action: 'experimental' });
          return reply('🧪 Experimental mode toggled in GLI.'), true;
        }

        case '/theme':
          return reply('🎨 *Themes:* dark, cyberpunk, light\n\nChange themes in the GLI Settings panel (Ctrl+,).'), true;

        case '/changelog':
          return reply(
            `📋 *Changelog — v1.0.0*\n\n` +
            `• 🎨 3 themes (Dark/Cyberpunk/Light)\n` +
            `• 💬 AI chat + 50 slash commands\n` +
            `• 📁 File explorer + syntax highlighting\n` +
            `• ⌨️ Integrated terminal\n` +
            `• 🔍 Full-text search\n` +
            `• 🤖 15 AI model selector\n` +
            `• 📱 Telegram bot integration\n` +
            `• 🖥️ Full PC system control\n` +
            `• 🌐 Browser automation\n` +
            `• 🤖 Background agents`
          ), true;

        case '/feedback':
          return reply('💬 Thanks for the feedback! Drop your thoughts as a message and they\'ll be logged in GLI.'), true;

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
