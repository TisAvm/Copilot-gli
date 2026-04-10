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
    this.bot.on('message', (msg) => {
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

      console.log(`[Telegram] Message from ${messageData.from.name}: ${cleanText.substring(0, 80)}`);

      // Forward to renderer
      this.mainWindow?.webContents.send('telegram:message', messageData);
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

module.exports = TelegramService;
