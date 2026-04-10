/**
 * GitHub Copilot / GitHub Models API Integration
 *
 * Uses your existing GitHub authentication (gh CLI) to access AI models
 * via the GitHub Models API — no extra API key needed.
 *
 * Available models: gpt-4o, gpt-4o-mini, o4-mini, etc.
 * Endpoint: models.inference.ai.azure.com
 */

const https = require('https');
const { execSync } = require('child_process');

class CopilotAPI {
  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN || this._getGhToken();
    this.hostname = 'models.inference.ai.azure.com';
    this.defaultModel = 'gpt-4o-mini';
    this.enabled = !!this.githubToken;

    // Models available via GitHub Models API
    this.models = [
      { id: 'gpt-4o', name: 'GPT-4o', tier: 'standard' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tier: 'fast' },
      { id: 'o4-mini', name: 'o4-mini', tier: 'standard' },
      { id: 'gpt-4.1', name: 'GPT-4.1', tier: 'standard' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', tier: 'fast' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', tier: 'free' },
    ];

    if (this.enabled) {
      console.log('[CopilotAPI] GitHub token found — AI models available');
    } else {
      console.log('[CopilotAPI] No GitHub token — run "gh auth login" first');
    }
  }

  /**
   * Try to get token from gh CLI
   */
  _getGhToken() {
    try {
      const token = execSync('gh auth token', {
        timeout: 5000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PATH: this._getFullPath() },
      }).trim();
      return token || null;
    } catch {
      return null;
    }
  }

  _getFullPath() {
    // Ensure gh CLI is findable on Windows
    const base = process.env.PATH || '';
    const localAppData = process.env.LOCALAPPDATA || '';
    const extras = [
      `${localAppData}\\GitHub CLI`,
      `${localAppData}\\Programs\\GitHub CLI`,
      'C:\\Program Files\\GitHub CLI',
      'C:\\Program Files (x86)\\GitHub CLI',
    ];
    return base + ';' + extras.join(';');
  }

  /**
   * Send a chat completion request
   */
  async chat(messages, options = {}) {
    if (!this.enabled) {
      return { success: false, error: 'GitHub token not found. Run "gh auth login" to authenticate.' };
    }

    const model = options.model || this.defaultModel;
    const payload = JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    });

    return new Promise((resolve) => {
      const req = https.request({
        hostname: this.hostname,
        path: '/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.githubToken}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              resolve({ success: false, error: parsed.error.message || JSON.stringify(parsed.error) });
              return;
            }
            const choice = parsed.choices?.[0];
            resolve({
              success: true,
              content: choice?.message?.content || '',
              model: parsed.model || model,
              usage: parsed.usage || {},
            });
          } catch (err) {
            resolve({ success: false, error: `Parse error: ${err.message}` });
          }
        });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.setTimeout(60000, () => { req.destroy(); resolve({ success: false, error: 'Request timed out' }); });
      req.write(payload);
      req.end();
    });
  }

  getModels() {
    return this.models;
  }

  getInfo() {
    return {
      enabled: this.enabled,
      hasToken: !!this.githubToken,
      defaultModel: this.defaultModel,
      models: this.models.map(m => m.id),
    };
  }
}

module.exports = CopilotAPI;
