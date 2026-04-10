/* ═══════════════════════════════════════════════════════════
   GitHub Copilot GLI — Application Core
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const App = {
    currentPanel: 'chat',
    openFiles: [],
    activeFile: null,
    currentFolder: null,
    commandHistory: [],
    historyIndex: -1,
    currentMode: 'interactive',
    currentModel: 'claude-sonnet-4.5',
    mcpServers: JSON.parse(localStorage.getItem('gli-mcp-servers') || '[]'),
    experimental: false,
    slashMenuIndex: 0,
    mentionMenuIndex: 0,
    paletteIndex: 0,
  };

  // ── DOM References ────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ═══════════════════════════════════════════════════════════
  //  Window Controls
  // ═══════════════════════════════════════════════════════════
  $('#btn-minimize')?.addEventListener('click', () => window.gli.window.minimize());
  $('#btn-maximize')?.addEventListener('click', () => window.gli.window.maximize());
  $('#btn-close')?.addEventListener('click', () => window.gli.window.close());

  // ═══════════════════════════════════════════════════════════
  //  Models Registry
  // ═══════════════════════════════════════════════════════════
  const MODELS = [
    { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6', tier: 'standard', family: 'Anthropic' },
    { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', tier: 'standard', family: 'Anthropic' },
    { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', tier: 'standard', family: 'Anthropic' },
    { id: 'claude-opus-4.6', name: 'Claude Opus 4.6', tier: 'premium', family: 'Anthropic' },
    { id: 'claude-opus-4.6-fast', name: 'Claude Opus 4.6 (fast)', tier: 'premium', family: 'Anthropic' },
    { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', tier: 'premium', family: 'Anthropic' },
    { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', tier: 'fast', family: 'Anthropic' },
    { id: 'gpt-5.4', name: 'GPT-5.4', tier: 'standard', family: 'OpenAI' },
    { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', tier: 'standard', family: 'OpenAI' },
    { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', tier: 'standard', family: 'OpenAI' },
    { id: 'gpt-5.2', name: 'GPT-5.2', tier: 'standard', family: 'OpenAI' },
    { id: 'gpt-5.1', name: 'GPT-5.1', tier: 'standard', family: 'OpenAI' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', tier: 'fast', family: 'OpenAI' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', tier: 'fast', family: 'OpenAI' },
    { id: 'gpt-4.1', name: 'GPT-4.1', tier: 'fast', family: 'OpenAI' },
  ];

  // ═══════════════════════════════════════════════════════════
  //  Slash Commands Registry
  // ═══════════════════════════════════════════════════════════
  const SLASH_COMMANDS = [
    // Models and subagents
    { cmd: '/model', desc: 'Select AI model to use', category: 'Models', shortcut: '', action: 'openModelSelector' },
    { cmd: '/delegate', desc: 'Send session to GitHub to create a PR', category: 'Models', action: 'delegate' },
    { cmd: '/fleet', desc: 'Enable fleet mode for parallel subagents', category: 'Models', action: 'fleet' },
    { cmd: '/tasks', desc: 'View and manage background tasks', category: 'Models', action: 'tasks' },
    // Agent environment
    { cmd: '/init', desc: 'Initialize Copilot instructions for this repo', category: 'Agent', action: 'init' },
    { cmd: '/agent', desc: 'Browse and select available agents', category: 'Agent', action: 'agent' },
    { cmd: '/skills', desc: 'Manage skills for enhanced capabilities', category: 'Agent', action: 'skills' },
    { cmd: '/mcp', desc: 'Manage MCP server configuration', category: 'Agent', shortcut: '', action: 'openMcpSettings' },
    { cmd: '/plugin', desc: 'Manage plugins and plugin marketplaces', category: 'Agent', action: 'plugin' },
    // Code
    { cmd: '/diff', desc: 'Review changes made in current directory', category: 'Code', action: 'diff' },
    { cmd: '/pr', desc: 'Operate on pull requests for current branch', category: 'Code', action: 'pr' },
    { cmd: '/review', desc: 'Run code review agent to analyze changes', category: 'Code', action: 'review' },
    { cmd: '/lsp', desc: 'Manage language server configuration', category: 'Code', action: 'lsp' },
    { cmd: '/ide', desc: 'Connect to an IDE workspace', category: 'Code', action: 'ide' },
    { cmd: '/plan', desc: 'Create an implementation plan before coding', category: 'Code', action: 'plan' },
    { cmd: '/research', desc: 'Run deep research investigation', category: 'Code', action: 'research' },
    // Session
    { cmd: '/clear', desc: 'Abandon session and start fresh', category: 'Session', shortcut: 'Ctrl+L', action: 'clearChat' },
    { cmd: '/new', desc: 'Start a new conversation', category: 'Session', action: 'newSession' },
    { cmd: '/compact', desc: 'Summarize conversation to reduce context', category: 'Session', action: 'compact' },
    { cmd: '/share', desc: 'Share session to markdown, HTML, or gist', category: 'Session', action: 'share' },
    { cmd: '/copy', desc: 'Copy the last response to clipboard', category: 'Session', action: 'copyLast' },
    { cmd: '/context', desc: 'Show context window token usage', category: 'Session', action: 'context' },
    { cmd: '/usage', desc: 'Display session usage metrics', category: 'Session', action: 'usage' },
    { cmd: '/rewind', desc: 'Rewind the last turn and revert changes', category: 'Session', action: 'rewind' },
    { cmd: '/undo', desc: 'Alias for /rewind', category: 'Session', action: 'rewind' },
    { cmd: '/resume', desc: 'Switch to a different session', category: 'Session', action: 'resume' },
    { cmd: '/rename', desc: 'Rename the current session', category: 'Session', action: 'rename' },
    // Permissions
    { cmd: '/allow-all', desc: 'Enable all permissions (tools, paths, URLs)', category: 'Permissions', action: 'allowAll' },
    { cmd: '/add-dir', desc: 'Add a directory to allowed list', category: 'Permissions', action: 'addDir' },
    { cmd: '/list-dirs', desc: 'Display all allowed directories', category: 'Permissions', action: 'listDirs' },
    { cmd: '/cwd', desc: 'Change or show current working directory', category: 'Permissions', action: 'cwd' },
    { cmd: '/reset-allowed-tools', desc: 'Reset the list of allowed tools', category: 'Permissions', action: 'resetTools' },
    // Help and feedback
    { cmd: '/help', desc: 'Show help for interactive commands', category: 'Help', shortcut: '', action: 'help' },
    { cmd: '/version', desc: 'Display version information and check for updates', category: 'Help', action: 'version' },
    { cmd: '/changelog', desc: 'Display changelog for CLI versions', category: 'Help', action: 'changelog' },
    { cmd: '/feedback', desc: 'Provide feedback about GLI', category: 'Help', action: 'feedback' },
    { cmd: '/theme', desc: 'View or set color mode', category: 'Help', action: 'theme' },
    { cmd: '/update', desc: 'Update the CLI to the latest version', category: 'Help', action: 'update' },
    { cmd: '/experimental', desc: 'Toggle experimental features', category: 'Help', action: 'experimental' },
    { cmd: '/instructions', desc: 'View and toggle custom instruction files', category: 'Help', action: 'instructions' },
    { cmd: '/streamer-mode', desc: 'Toggle streamer mode (hides model names)', category: 'Help', action: 'streamerMode' },
    // Other
    { cmd: '/terminal-setup', desc: 'Configure terminal for multiline input (Shift+Enter)', category: 'Other', action: 'terminalSetup' },
    { cmd: '/login', desc: 'Log in to Copilot', category: 'Other', action: 'login' },
    { cmd: '/logout', desc: 'Log out of Copilot', category: 'Other', action: 'logout' },
    { cmd: '/exit', desc: 'Exit the CLI', category: 'Other', action: 'exit' },
    { cmd: '/quit', desc: 'Exit the CLI', category: 'Other', action: 'exit' },
    { cmd: '/restart', desc: 'Restart the CLI, preserving current session', category: 'Other', action: 'restart' },
    { cmd: '/session', desc: 'View and manage sessions', category: 'Session', action: 'session' },
    { cmd: '/user', desc: 'Manage GitHub user list', category: 'Other', action: 'user' },
  ];

  // ═══════════════════════════════════════════════════════════
  //  Keyboard Shortcuts Registry
  // ═══════════════════════════════════════════════════════════
  const KEYBOARD_SHORTCUTS = [
    { keys: 'Ctrl+1', action: 'Chat panel', fn: () => switchPanel('chat') },
    { keys: 'Ctrl+2', action: 'File Explorer', fn: () => switchPanel('files') },
    { keys: 'Ctrl+3', action: 'Search', fn: () => switchPanel('search') },
    { keys: 'Ctrl+4', action: 'Terminal', fn: () => switchPanel('terminal') },
    { keys: 'Ctrl+,', action: 'Settings', fn: () => switchPanel('settings') },
    { keys: 'Ctrl+Shift+P', action: 'Command Palette', fn: () => toggleCommandPalette() },
    { keys: 'Shift+Tab', action: 'Cycle mode', fn: () => cycleMode() },
    { keys: 'Ctrl+L', action: 'Clear screen', fn: () => executeSlashCommand('clearChat') },
    { keys: 'Ctrl+D', action: 'Shutdown / Exit', fn: () => window.gli.window.close() },
    { keys: 'Ctrl+T', action: 'Toggle reasoning', fn: () => toggleReasoning() },
    { keys: 'Ctrl+S', action: 'Send preserving input', fn: () => sendPreservingInput() },
    { keys: 'Ctrl+G', action: 'Edit in external editor', fn: () => editExternal() },
    { keys: 'Escape', action: 'Cancel / Close overlay', fn: () => closeAllOverlays() },
    { keys: '@', action: 'Mention files', fn: null },
    { keys: '/', action: 'Slash commands', fn: null },
    { keys: '!', action: 'Execute shell command', fn: null },
    { keys: '↑ / ↓', action: 'Navigate history', fn: null },
    { keys: 'Ctrl+C', action: 'Cancel / Clear / Copy', fn: null },
    { keys: 'Ctrl+A', action: 'Move to start of line', fn: null },
    { keys: 'Ctrl+E', action: 'Move to end of line', fn: null },
    { keys: 'Ctrl+W', action: 'Delete previous word', fn: null },
    { keys: 'Ctrl+U', action: 'Delete to line start', fn: null },
    { keys: 'Ctrl+K', action: 'Delete to line end', fn: null },
    { keys: 'Ctrl+O', action: 'Expand recent timeline', fn: null },
  ];

  // ═══════════════════════════════════════════════════════════
  //  Sidebar Navigation
  // ═══════════════════════════════════════════════════════════
  function switchPanel(panelName) {
    if (panelName === App.currentPanel) return;

    $$('.sidebar-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.panel === panelName));
    $$('.panel').forEach(p => p.classList.remove('active'));

    const target = $(`#panel-${panelName}`);
    if (target) {
      target.classList.add('active');
      App.currentPanel = panelName;
      updateStatus(`Viewing ${panelName}`);
    }
  }

  $$('.sidebar-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  // ═══════════════════════════════════════════════════════════
  //  Model Selector
  // ═══════════════════════════════════════════════════════════
  function updateModelDisplay() {
    const model = MODELS.find(m => m.id === App.currentModel);
    const shortName = model ? model.name.replace('Claude ', '').replace('GPT-', 'GPT ') : App.currentModel;
    $('#current-model-name').textContent = shortName;
    $('#status-model-name').textContent = shortName;
    $('#model-dropdown-current').textContent = model ? model.name : App.currentModel;
    localStorage.setItem('gli-model', App.currentModel);
  }

  function renderModelDropdown(filter = '') {
    const list = $('#model-dropdown-list');
    list.innerHTML = '';
    const lower = filter.toLowerCase();
    const families = [...new Set(MODELS.map(m => m.family))];

    for (const family of families) {
      const models = MODELS.filter(m => m.family === family &&
        (m.name.toLowerCase().includes(lower) || m.id.toLowerCase().includes(lower)));
      if (models.length === 0) continue;

      const groupLabel = document.createElement('div');
      groupLabel.className = 'model-group-label';
      groupLabel.textContent = family;
      list.appendChild(groupLabel);

      for (const model of models) {
        const opt = document.createElement('div');
        opt.className = `model-option ${model.id === App.currentModel ? 'active' : ''}`;
        const badgeClass = model.tier === 'premium' ? 'badge-premium' : model.tier === 'fast' ? 'badge-fast' : 'badge-standard';
        opt.innerHTML = `
          <div class="model-option-info">
            <span class="model-option-name">${model.name}</span>
            <span class="model-option-id">${model.id}</span>
          </div>
          <span class="model-option-badge ${badgeClass}">${model.tier}</span>`;
        opt.addEventListener('click', () => {
          App.currentModel = model.id;
          updateModelDisplay();
          closeModelDropdown();
          addChatMessage('assistant', `✓ Model switched to **${model.name}** (\`${model.id}\`)\n\nTier: ${model.tier} | Family: ${model.family}`);
        });
        list.appendChild(opt);
      }
    }
  }

  function openModelSelector() {
    const dd = $('#model-dropdown');
    dd.classList.remove('hidden');
    renderModelDropdown();
    const searchInput = $('#model-search');
    searchInput.value = '';
    searchInput.focus();
    searchInput.oninput = () => renderModelDropdown(searchInput.value);

    // Close on click outside
    const backdrop = document.createElement('div');
    backdrop.className = 'overlay-backdrop';
    backdrop.id = 'model-backdrop';
    backdrop.addEventListener('click', closeModelDropdown);
    document.body.insertBefore(backdrop, dd);
  }

  function closeModelDropdown() {
    $('#model-dropdown')?.classList.add('hidden');
    $('#model-backdrop')?.remove();
  }

  $('#model-selector-btn')?.addEventListener('click', openModelSelector);
  $('#status-model')?.addEventListener('click', openModelSelector);

  // Restore saved model
  const savedModel = localStorage.getItem('gli-model');
  if (savedModel && MODELS.find(m => m.id === savedModel)) {
    App.currentModel = savedModel;
  }
  updateModelDisplay();

  // ═══════════════════════════════════════════════════════════
  //  Mode System (Interactive / Plan / Autopilot)
  // ═══════════════════════════════════════════════════════════
  const MODES = ['interactive', 'plan', 'autopilot'];
  const MODE_ICONS = {
    interactive: '💬',
    plan: '📋',
    autopilot: '⚡',
  };

  function setMode(mode) {
    App.currentMode = mode;
    $$('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    $('#chat-mode-label').textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    $('#status-mode').innerHTML = `
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${mode === 'plan' ? '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' :
          mode === 'autopilot' ? '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' :
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'}
      </svg>
      ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
    localStorage.setItem('gli-mode', mode);
  }

  function cycleMode() {
    const idx = MODES.indexOf(App.currentMode);
    const next = MODES[(idx + 1) % MODES.length];
    setMode(next);
    addChatMessage('assistant', `${MODE_ICONS[next]} Mode switched to **${next.charAt(0).toUpperCase() + next.slice(1)}**\n\n${
      next === 'interactive' ? 'I\'ll respond to each message and ask before taking actions.' :
      next === 'plan' ? 'I\'ll create an implementation plan before coding. Prefix messages with [[PLAN]].' :
      'I\'ll work autonomously until the task is complete, asking fewer questions.'
    }`);
  }

  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  $('#status-mode')?.addEventListener('click', cycleMode);

  // Restore saved mode
  const savedMode = localStorage.getItem('gli-mode');
  if (savedMode && MODES.includes(savedMode)) setMode(savedMode);

  // ═══════════════════════════════════════════════════════════
  //  Slash Command Engine
  // ═══════════════════════════════════════════════════════════
  const slashMenu = $('#slash-menu');

  function showSlashMenu(filter = '') {
    const lower = filter.toLowerCase();
    const filtered = SLASH_COMMANDS.filter(c =>
      c.cmd.toLowerCase().includes(lower) || c.desc.toLowerCase().includes(lower));

    if (filtered.length === 0) {
      slashMenu.classList.add('hidden');
      return;
    }

    slashMenu.classList.remove('hidden');
    slashMenu.innerHTML = '';
    App.slashMenuIndex = 0;

    const categories = [...new Set(filtered.map(c => c.category))];
    for (const cat of categories) {
      const group = document.createElement('div');
      group.className = 'slash-menu-group';

      const label = document.createElement('div');
      label.className = 'slash-menu-group-label';
      label.textContent = cat;
      group.appendChild(label);

      for (const cmd of filtered.filter(c => c.category === cat)) {
        const item = document.createElement('div');
        item.className = 'slash-menu-item';
        item.dataset.action = cmd.action;
        item.innerHTML = `
          <span class="slash-cmd-name">${cmd.cmd}</span>
          <span class="slash-cmd-desc">${cmd.desc}</span>
          ${cmd.shortcut ? `<span class="slash-cmd-shortcut">${cmd.shortcut}</span>` : ''}`;
        item.addEventListener('click', () => {
          chatInput.value = '';
          hideSlashMenu();
          executeSlashCommand(cmd.action);
        });
        group.appendChild(item);
      }
      slashMenu.appendChild(group);
    }

    // Highlight first item
    const items = slashMenu.querySelectorAll('.slash-menu-item');
    if (items[0]) items[0].classList.add('selected');
  }

  function hideSlashMenu() { slashMenu.classList.add('hidden'); }

  function navigateSlashMenu(direction) {
    const items = slashMenu.querySelectorAll('.slash-menu-item');
    if (items.length === 0) return;
    items[App.slashMenuIndex]?.classList.remove('selected');
    App.slashMenuIndex = (App.slashMenuIndex + direction + items.length) % items.length;
    items[App.slashMenuIndex]?.classList.add('selected');
    items[App.slashMenuIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function selectSlashMenuItem() {
    const items = slashMenu.querySelectorAll('.slash-menu-item');
    const selected = items[App.slashMenuIndex];
    if (selected) {
      chatInput.value = '';
      hideSlashMenu();
      executeSlashCommand(selected.dataset.action);
    }
  }

  function executeSlashCommand(action) {
    const actions = {
      openModelSelector: () => openModelSelector(),
      clearChat: () => {
        chatMessages.innerHTML = '';
        addChatMessage('assistant', '🧹 Chat cleared. Starting fresh!\n\nType `/help` to see available commands.');
      },
      newSession: () => {
        chatMessages.innerHTML = '';
        addChatMessage('assistant', '✨ New session started.\n\nHow can I help you today?');
      },
      help: () => addChatMessage('assistant', generateHelpText()),
      version: () => addChatMessage('assistant', `**Copilot GLI** v1.0.0\n\nModel: \`${App.currentModel}\`\nMode: ${App.currentMode}\nPlatform: ${navigator.platform}\nElectron: Chromium-based`),
      theme: () => { switchPanel('settings'); },
      openMcpSettings: () => { switchPanel('settings'); setTimeout(() => { document.getElementById('mcp-server-list')?.scrollIntoView({ behavior: 'smooth' }); }, 200); },
      copyLast: () => {
        const lastMsg = chatMessages.querySelector('.chat-msg.assistant:last-of-type .chat-bubble');
        if (lastMsg) {
          navigator.clipboard.writeText(lastMsg.textContent);
          addChatMessage('assistant', '📋 Last response copied to clipboard!');
        }
      },
      context: () => {
        const msgCount = chatMessages.querySelectorAll('.chat-msg').length;
        const approxTokens = Math.floor(chatMessages.textContent.length / 4);
        addChatMessage('assistant', `📊 **Context Window Usage**\n\nMessages: ${msgCount}\nApprox tokens: ~${approxTokens.toLocaleString()}\nModel: \`${App.currentModel}\`\nMode: ${App.currentMode}`);
      },
      usage: () => {
        addChatMessage('assistant', `📈 **Session Usage**\n\nMessages sent: ${chatMessages.querySelectorAll('.chat-msg.user').length}\nResponses: ${chatMessages.querySelectorAll('.chat-msg.assistant').length}\nModel: \`${App.currentModel}\`\nMode: ${App.currentMode}\nSession duration: ${Math.floor((Date.now() - performance.timeOrigin) / 60000)} min`);
      },
      compact: () => addChatMessage('assistant', '📦 Conversation compacted. Context usage reduced.\n\n*In a full implementation, this would summarize the conversation history to free up context tokens.*'),
      share: () => addChatMessage('assistant', '📤 **Share Options**\n\n• Export as Markdown\n• Export as HTML\n• Create GitHub Gist\n\n*Share functionality will be available in a future update.*'),
      rewind: () => {
        const msgs = chatMessages.querySelectorAll('.chat-msg');
        if (msgs.length >= 2) {
          msgs[msgs.length - 1].remove();
          msgs[msgs.length - 2].remove();
          addChatMessage('assistant', '⏪ Last turn rewound.');
        }
      },
      experimental: () => {
        App.experimental = !App.experimental;
        addChatMessage('assistant', `🧪 Experimental mode: **${App.experimental ? 'Enabled' : 'Disabled'}**\n\n${App.experimental ? 'Autopilot mode and other experimental features are now available.' : 'Experimental features disabled.'}`);
      },
      diff: () => addChatMessage('assistant', '📝 **Diff Viewer**\n\nNo git changes detected in the current directory.\n\n*Use the terminal to run `git diff` or open a git repository first.*'),
      pr: () => addChatMessage('assistant', '🔀 **Pull Requests**\n\nNo active PR found for the current branch.\n\n*Open a git repository and create a PR to use this feature.*'),
      review: () => addChatMessage('assistant', '🔍 **Code Review**\n\nStarting code review analysis...\n\n*This feature analyzes staged/unstaged changes and surfaces important issues like bugs, security vulnerabilities, and logic errors.*'),
      plan: () => {
        setMode('plan');
        addChatMessage('assistant', '📋 **Plan Mode Activated**\n\nI\'ll create an implementation plan before coding. Describe what you want to build and I\'ll break it down into steps.');
      },
      research: () => addChatMessage('assistant', '🔬 **Deep Research**\n\nStarting research investigation...\n\n*This feature uses GitHub search and web sources to deeply investigate a topic. Describe what you want to research.*'),
      delegate: () => addChatMessage('assistant', '🚀 **Delegate to GitHub**\n\nThis will send your session to GitHub where Copilot will create a PR.\n\n*Feature requires GitHub integration to be configured.*'),
      fleet: () => addChatMessage('assistant', '🚢 **Fleet Mode**\n\nFleet mode enables parallel subagent execution for faster task completion.\n\n*Toggle fleet mode to run multiple agents simultaneously.*'),
      tasks: () => addChatMessage('assistant', '📋 **Background Tasks**\n\nNo background tasks running.\n\n*Tasks will appear here when using fleet mode or background agents.*'),
      init: () => addChatMessage('assistant', '⚙️ **Repository Init**\n\nLooking for custom instructions...\n\n*Checks for CLAUDE.md, AGENTS.md, .github/copilot-instructions.md, and other instruction files.*'),
      agent: () => addChatMessage('assistant', '🤖 **Available Agents**\n\n• **explore** — Codebase exploration (fast)\n• **task** — Command execution\n• **general-purpose** — Full capabilities\n• **code-review** — Review changes'),
      skills: () => addChatMessage('assistant', '🛠️ **Skills**\n\nNo additional skills loaded.\n\n*Skills provide specialized capabilities. Check ~/.copilot/skills/ for available skills.*'),
      plugin: () => addChatMessage('assistant', '🔌 **Plugins**\n\nNo plugins installed.\n\n*Plugins extend GLI with additional capabilities from marketplaces.*'),
      lsp: () => addChatMessage('assistant', '📡 **Language Servers**\n\nNo LSP servers configured.\n\n*Configure LSP servers in ~/.copilot/lsp-config.json for enhanced code intelligence.*'),
      ide: () => addChatMessage('assistant', '🖥️ **IDE Connection**\n\nNo IDE workspace connected.\n\n*Use this to connect GLI to VS Code or other IDE workspaces.*'),
      allowAll: () => addChatMessage('assistant', '✅ All permissions enabled (tools, paths, and URLs).'),
      addDir: () => addChatMessage('assistant', '📂 Use the File Explorer (Ctrl+2) to open a folder, or specify a path.'),
      listDirs: () => addChatMessage('assistant', `📂 **Allowed Directories**\n\n• ${App.currentFolder || 'No folder open'}`),
      cwd: () => addChatMessage('assistant', `📍 **Current Working Directory**\n\n\`${App.currentFolder || 'Not set — open a folder first'}\``),
      resetTools: () => addChatMessage('assistant', '🔄 Allowed tools list has been reset to defaults.'),
      resume: () => addChatMessage('assistant', '📂 **Sessions**\n\nNo saved sessions found.\n\n*Sessions will be listed here when session persistence is enabled.*'),
      rename: () => addChatMessage('assistant', '✏️ Enter a new session name in the chat.'),
      changelog: () => addChatMessage('assistant', '📋 **Changelog — v1.0.0**\n\n• 🎨 Initial release with 3 themes\n• 💬 Chat with AI responses\n• 📁 File explorer with syntax highlighting\n• ⌨️ Integrated terminal\n• 🔍 Full-text search\n• ✨ Particle background system\n• 🎯 Slash command autocomplete\n• 🤖 Model selection (15 models)\n• 🔀 Mode switching (Interactive/Plan/Autopilot)\n• 🔌 MCP server configuration\n• ⌨️ Full keyboard shortcut system\n• 🎨 Command palette (Ctrl+Shift+P)'),
      feedback: () => addChatMessage('assistant', '💬 **Feedback**\n\nThank you for using Copilot GLI! Your feedback helps us improve.\n\n*In a future update, this will link to a feedback form.*'),
      instructions: () => addChatMessage('assistant', '📝 **Custom Instructions**\n\nCopilot GLI respects instructions from:\n• `CLAUDE.md` / `GEMINI.md` / `AGENTS.md`\n• `.github/instructions/**/*.instructions.md`\n• `.github/copilot-instructions.md`\n• `~/.copilot/copilot-instructions.md`'),
      streamerMode: () => addChatMessage('assistant', '🎬 Streamer mode toggled. Model names and quota details are now hidden for streaming.'),
      terminalSetup: () => { switchPanel('terminal'); addChatMessage('assistant', '⌨️ Terminal configured. Use Shift+Enter for multiline input in the terminal panel.'); },
      login: () => addChatMessage('assistant', '🔑 **Login**\n\nUse `gh auth login` in the terminal to authenticate with GitHub.'),
      logout: () => addChatMessage('assistant', '🚪 **Logout**\n\nUse `gh auth logout` in the terminal to log out.'),
      exit: () => addChatMessage('assistant', '👋 Use the window close button or **Ctrl+Q** to exit GLI.'),
      restart: () => { addChatMessage('assistant', '🔄 Restarting GLI...'); setTimeout(() => location.reload(), 1000); },
      session: () => addChatMessage('assistant', '📂 **Session Manager**\n\nSubcommands:\n• `/resume` — Switch to a different session\n• `/rename` — Rename current session\n• `/new` — Start new session\n• `/compact` — Compress current session'),
      update: () => addChatMessage('assistant', '📦 **Update Check**\n\nCurrent: v1.0.0\nLatest: v1.0.0\n\n✅ You are on the latest version.\n\n*Run `git pull` in the project directory to update.*'),
      user: () => addChatMessage('assistant', '👤 **GitHub User**\n\nUse `gh api user` in the terminal to check your authenticated GitHub user.'),
    };

    const fn = actions[action];
    if (fn) fn();
    else addChatMessage('assistant', `Command \`${action}\` is not yet implemented.`);
  }

  function generateHelpText() {
    return `⌨️ **Copilot GLI — Help**

**Global Shortcuts:**
\`@\` — Mention files, include contents in context
\`Ctrl+S\` — Run command while preserving input
\`Shift+Tab\` — Cycle modes (Interactive → Plan → Autopilot)
\`Ctrl+T\` — Toggle model reasoning display
\`Ctrl+Shift+P\` — Command palette
\`↑ ↓\` — Navigate command history
\`Ctrl+C\` — Cancel / Clear input
\`!\` — Execute command in shell (bypass Copilot)
\`Esc\` — Cancel the current operation
\`Ctrl+D\` — Shutdown
\`Ctrl+L\` — Clear the screen

**Slash Commands:** Type \`/\` to see all ${SLASH_COMMANDS.length} commands

**Models:** \`/model\` — Choose from ${MODELS.length} models (current: \`${App.currentModel}\`)

**Modes:** \`Shift+Tab\` to cycle
• **Interactive** — Ask before acting
• **Plan** — Plan first, then implement
• **Autopilot** — Work autonomously until done

**MCP Servers:** \`/mcp\` — Manage MCP servers (${App.mcpServers.length} configured)

**Panels:** \`Ctrl+1\` Chat | \`Ctrl+2\` Files | \`Ctrl+3\` Search | \`Ctrl+4\` Terminal | \`Ctrl+,\` Settings`;
  }

  // ═══════════════════════════════════════════════════════════
  //  @ File Mention System
  // ═══════════════════════════════════════════════════════════
  const mentionMenu = $('#mention-menu');

  async function showMentionMenu(filter = '') {
    if (!App.currentFolder) {
      mentionMenu.classList.add('hidden');
      return;
    }

    const entries = await window.gli.fs.readDirectory(App.currentFolder);
    if (entries.error) { mentionMenu.classList.add('hidden'); return; }

    const lower = filter.toLowerCase();
    const filtered = entries.filter(e => e.name.toLowerCase().includes(lower)).slice(0, 12);

    if (filtered.length === 0) { mentionMenu.classList.add('hidden'); return; }

    mentionMenu.classList.remove('hidden');
    mentionMenu.innerHTML = '';
    App.mentionMenuIndex = 0;

    for (const entry of filtered) {
      const item = document.createElement('div');
      item.className = 'mention-item';
      item.innerHTML = `<span>${entry.isDirectory ? '📁' : getFileIcon(entry.extension)}</span> <span>${entry.name}</span>`;
      item.addEventListener('click', () => {
        insertMention(entry.name);
      });
      mentionMenu.appendChild(item);
    }

    const items = mentionMenu.querySelectorAll('.mention-item');
    if (items[0]) items[0].classList.add('selected');
  }

  function hideMentionMenu() { mentionMenu.classList.add('hidden'); }

  function insertMention(name) {
    const val = chatInput.value;
    const atIdx = val.lastIndexOf('@');
    chatInput.value = val.substring(0, atIdx) + '@' + name + ' ';
    hideMentionMenu();
    chatInput.focus();
  }

  // ═══════════════════════════════════════════════════════════
  //  Command Palette (Ctrl+Shift+P)
  // ═══════════════════════════════════════════════════════════
  function toggleCommandPalette() {
    const overlay = $('#cmd-palette-overlay');
    if (overlay.classList.contains('hidden')) {
      openCommandPalette();
    } else {
      closeCommandPalette();
    }
  }

  function openCommandPalette() {
    const overlay = $('#cmd-palette-overlay');
    overlay.classList.remove('hidden');
    const input = $('#cmd-palette-input');
    input.value = '';
    input.focus();
    renderPaletteItems('');
    App.paletteIndex = 0;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeCommandPalette();
    });
  }

  function closeCommandPalette() {
    $('#cmd-palette-overlay').classList.add('hidden');
  }

  function renderPaletteItems(filter) {
    const list = $('#cmd-palette-list');
    list.innerHTML = '';
    const lower = filter.toLowerCase();
    App.paletteIndex = 0;

    // Combine slash commands + shortcuts + actions
    const allItems = [
      ...SLASH_COMMANDS.map(c => ({ label: `${c.cmd} — ${c.desc}`, icon: '/', shortcut: c.shortcut || '', action: () => executeSlashCommand(c.action) })),
      { label: 'Switch to Chat', icon: '💬', shortcut: 'Ctrl+1', action: () => switchPanel('chat') },
      { label: 'Switch to Files', icon: '📁', shortcut: 'Ctrl+2', action: () => switchPanel('files') },
      { label: 'Switch to Search', icon: '🔍', shortcut: 'Ctrl+3', action: () => switchPanel('search') },
      { label: 'Switch to Terminal', icon: '⌨', shortcut: 'Ctrl+4', action: () => switchPanel('terminal') },
      { label: 'Switch to Settings', icon: '⚙', shortcut: 'Ctrl+,', action: () => switchPanel('settings') },
      { label: 'Cycle Mode', icon: '🔄', shortcut: 'Shift+Tab', action: () => cycleMode() },
      { label: 'Select Model', icon: '🤖', shortcut: '', action: () => openModelSelector() },
      { label: 'Open Folder', icon: '📂', shortcut: '', action: () => openFolder() },
      { label: 'Clear Chat', icon: '🧹', shortcut: 'Ctrl+L', action: () => executeSlashCommand('clearChat') },
      { label: 'Toggle Dark Theme', icon: '🌙', shortcut: '', action: () => setTheme('dark') },
      { label: 'Toggle Cyberpunk Theme', icon: '💜', shortcut: '', action: () => setTheme('cyberpunk') },
      { label: 'Toggle Light Theme', icon: '☀️', shortcut: '', action: () => setTheme('light') },
    ];

    const filtered = allItems.filter(item => item.label.toLowerCase().includes(lower));

    for (const [i, item] of filtered.entries()) {
      const el = document.createElement('div');
      el.className = `cmd-palette-item ${i === 0 ? 'selected' : ''}`;
      el.innerHTML = `
        <div class="cmd-palette-item-left">
          <span class="cmd-palette-item-icon">${item.icon}</span>
          <span class="cmd-palette-item-label">${item.label}</span>
        </div>
        ${item.shortcut ? `<span class="cmd-palette-item-shortcut">${item.shortcut}</span>` : ''}`;
      el.addEventListener('click', () => {
        closeCommandPalette();
        item.action();
      });
      list.appendChild(el);
    }
  }

  $('#cmd-palette-input')?.addEventListener('input', (e) => {
    renderPaletteItems(e.target.value);
  });

  $('#cmd-palette-input')?.addEventListener('keydown', (e) => {
    const items = $$('#cmd-palette-list .cmd-palette-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[App.paletteIndex]?.classList.remove('selected');
      App.paletteIndex = (App.paletteIndex + 1) % items.length;
      items[App.paletteIndex]?.classList.add('selected');
      items[App.paletteIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[App.paletteIndex]?.classList.remove('selected');
      App.paletteIndex = (App.paletteIndex - 1 + items.length) % items.length;
      items[App.paletteIndex]?.classList.add('selected');
      items[App.paletteIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[App.paletteIndex]?.click();
    } else if (e.key === 'Escape') {
      closeCommandPalette();
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  MCP Server Management
  // ═══════════════════════════════════════════════════════════
  function renderMcpServers() {
    const list = $('#mcp-server-list');
    if (!list) return;
    list.innerHTML = '';

    if (App.mcpServers.length === 0) {
      list.innerHTML = '<div class="search-empty" style="padding:16px;font-size:12px;color:var(--text-muted);">No MCP servers configured. Click "Add MCP Server" to get started.</div>';
      return;
    }

    for (const server of App.mcpServers) {
      const card = document.createElement('div');
      card.className = 'mcp-server-card';
      card.innerHTML = `
        <div class="mcp-server-info">
          <span class="mcp-server-name">${escapeHtml(server.name)}</span>
          <span class="mcp-server-cmd">${escapeHtml(server.command)}</span>
        </div>
        <div class="mcp-server-status">
          <span class="mcp-status-dot inactive"></span>
          <div class="mcp-server-actions">
            <button title="Remove" data-name="${escapeHtml(server.name)}">✕</button>
          </div>
        </div>`;
      card.querySelector('button').addEventListener('click', () => {
        App.mcpServers = App.mcpServers.filter(s => s.name !== server.name);
        localStorage.setItem('gli-mcp-servers', JSON.stringify(App.mcpServers));
        renderMcpServers();
        addChatMessage('assistant', `🔌 MCP server **${server.name}** removed.`);
      });
      list.appendChild(card);
    }
  }

  $('#btn-add-mcp')?.addEventListener('click', () => {
    $('#mcp-modal-overlay').classList.remove('hidden');
    $('#mcp-name').value = '';
    $('#mcp-command').value = '';
    $('#mcp-args').value = '';
    $('#mcp-env').value = '';
    $('#mcp-name').focus();
  });

  $('#mcp-modal-close')?.addEventListener('click', () => $('#mcp-modal-overlay').classList.add('hidden'));
  $('#mcp-cancel')?.addEventListener('click', () => $('#mcp-modal-overlay').classList.add('hidden'));

  $('#mcp-save')?.addEventListener('click', () => {
    const name = $('#mcp-name').value.trim();
    const command = $('#mcp-command').value.trim();
    const args = $('#mcp-args').value.trim();
    const env = $('#mcp-env').value.trim();

    if (!name || !command) return;

    App.mcpServers.push({ name, command, args, env });
    localStorage.setItem('gli-mcp-servers', JSON.stringify(App.mcpServers));
    renderMcpServers();
    $('#mcp-modal-overlay').classList.add('hidden');
    addChatMessage('assistant', `🔌 MCP server **${name}** added!\n\n\`${command}\`\n\nUse \`/mcp\` to manage servers.`);
  });

  renderMcpServers();

  // ═══════════════════════════════════════════════════════════
  //  Settings: Shortcuts & Commands Reference Grids
  // ═══════════════════════════════════════════════════════════
  function renderSettingsGrids() {
    const shortcutsGrid = $('#shortcuts-grid');
    if (shortcutsGrid) {
      shortcutsGrid.innerHTML = KEYBOARD_SHORTCUTS
        .filter(s => s.keys !== '/' && s.keys !== '@' && s.keys !== '!')
        .map(s => `<div class="shortcut-row"><span class="shortcut-keys">${s.keys}</span><span class="shortcut-action">${s.action}</span></div>`)
        .join('');
    }

    const commandsGrid = $('#commands-grid');
    if (commandsGrid) {
      commandsGrid.innerHTML = SLASH_COMMANDS
        .map(c => `<div class="command-row"><span class="command-name">${c.cmd}</span><span class="command-desc">${c.desc}</span></div>`)
        .join('');
    }
  }

  renderSettingsGrids();

  // ═══════════════════════════════════════════════════════════
  //  Helper: Close all overlays
  // ═══════════════════════════════════════════════════════════
  function closeAllOverlays() {
    closeModelDropdown();
    closeCommandPalette();
    hideSlashMenu();
    hideMentionMenu();
    $('#mcp-modal-overlay')?.classList.add('hidden');
  }

  function toggleReasoning() {
    addChatMessage('assistant', '💭 Reasoning display toggled.\n\n*When using reasoning models, their thinking process will be shown/hidden.*');
  }

  function sendPreservingInput() {
    const text = chatInput.value.trim();
    if (!text) return;
    // Send but don't clear input
    addChatMessage('user', text);
    showTypingIndicator();
    updateStatus('Thinking...');
    generateResponse(text).then(response => {
      removeTypingIndicator();
      addChatMessage('assistant', response);
      updateStatus('Ready');
    });
  }

  function editExternal() {
    addChatMessage('assistant', '📝 Opening prompt in external editor...\n\n*This feature opens your default text editor for composing longer prompts.*');
  }

  // ═══════════════════════════════════════════════════════════
  //  Chat System
  // ═══════════════════════════════════════════════════════════
  const chatMessages = $('#chat-messages');
  const chatInput = $('#chat-input');
  const chatSend = $('#chat-send');

  // Welcome message
  addChatMessage('assistant', `👋 **Welcome to Copilot GLI!**

I'm your AI coding assistant with a visual twist. Here's what I can help with:

• **Code questions** — Ask me anything about programming
• **File explorer** — Browse your project files (\`Ctrl+2\`)
• **Terminal** — Run commands directly (\`Ctrl+4\`)
• **Search** — Find text across files (\`Ctrl+3\`)

**Quick start:** Type \`/\` for commands, \`@\` to mention files, \`!\` to run shell commands
**Shortcuts:** \`Ctrl+Shift+P\` command palette, \`Shift+Tab\` cycle modes
**Model:** \`/model\` to switch between ${MODELS.length} AI models`);

  function addChatMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = role === 'user' ? 'U' : '✦';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = formatMessage(text);

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return msg;
  }

  function formatMessage(text) {
    return text
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const highlighted = lang && typeof hljs !== 'undefined'
          ? hljs.highlight(code.trim(), { language: lang, ignoreIllegals: true }).value
          : escapeHtml(code.trim());
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
      })
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
      .replace(/• /g, '&bull; ');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showTypingIndicator() {
    const msg = document.createElement('div');
    msg.className = 'chat-msg assistant';
    msg.id = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = '✦';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeTypingIndicator() {
    $('#typing-indicator')?.remove();
  }

  async function handleChatSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    hideSlashMenu();
    hideMentionMenu();

    // Handle slash commands
    if (text.startsWith('/')) {
      const cmdName = text.split(' ')[0].toLowerCase();
      const matched = SLASH_COMMANDS.find(c => c.cmd === cmdName);
      if (matched) {
        addChatMessage('user', text);
        executeSlashCommand(matched.action);
        return;
      }
    }

    // Handle ! shell commands
    if (text.startsWith('!')) {
      const shellCmd = text.substring(1).trim();
      if (shellCmd) {
        addChatMessage('user', text);
        addChatMessage('assistant', `⚡ Executing: \`${shellCmd}\``);
        try {
          const result = await window.gli.terminal.execute(shellCmd);
          const output = (result.stdout || '') + (result.stderr || '');
          addChatMessage('assistant', `\`\`\`\n${output || '(no output)'}\n\`\`\`\n\n${result.exitCode === 0 ? '✓ Success' : `✗ Exit code: ${result.exitCode}`}`);
        } catch (err) {
          addChatMessage('assistant', `❌ Error: ${err.message}`);
        }
        return;
      }
    }

    addChatMessage('user', text);
    showTypingIndicator();
    updateStatus('Thinking...');

    const response = await generateResponse(text);

    removeTypingIndicator();
    addChatMessage('assistant', response);
    updateStatus('Ready');
  }

  async function generateResponse(userMessage) {
    await sleep(800 + Math.random() * 1200);

    const lower = userMessage.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return `Hello! 👋 Great to see you. I'm Copilot GLI — your visual AI assistant. What can I help you with today?`;
    }

    if (lower.includes('help') || lower.includes('what can you')) {
      return `Here's what Copilot GLI can do:

• **💬 Chat** — Ask coding questions, get explanations, debug issues
• **📁 File Explorer** — Browse and view project files with syntax highlighting
• **🔍 Search** — Search across your files
• **⌨ Terminal** — Execute shell commands directly
• **🎨 Themes** — Switch between Dark, Cyberpunk, and Light themes

**Keyboard Shortcuts:**
\`Ctrl+1\` Chat | \`Ctrl+2\` Files | \`Ctrl+3\` Search | \`Ctrl+4\` Terminal | \`Ctrl+,\` Settings`;
    }

    if (lower.includes('theme') || lower.includes('dark') || lower.includes('light') || lower.includes('cyberpunk')) {
      return `You can change themes in **Settings** (Ctrl+,). We have three themes:

• **Dark** — The default GitHub dark experience
• **Cyberpunk** — Neon magenta & cyan for that futuristic feel
• **Light** — Clean and bright

Try the Cyberpunk theme — it's *electric* ⚡`;
    }

    if (lower.includes('sort') || lower.includes('algorithm')) {
      return `Here are common sorting algorithms by complexity:

| Algorithm | Best | Average | Worst |
|-----------|------|---------|-------|
| Quick Sort | O(n log n) | O(n log n) | O(n²) |
| Merge Sort | O(n log n) | O(n log n) | O(n log n) |
| Heap Sort | O(n log n) | O(n log n) | O(n log n) |

Here's a quick sort implementation:

\`\`\`javascript
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[arr.length - 1];
  const left = arr.filter((x, i) => x <= pivot && i < arr.length - 1);
  const right = arr.filter(x => x > pivot);
  return [...quickSort(left), pivot, ...quickSort(right)];
}
\`\`\``;
    }

    if (lower.includes('python') || lower.includes('javascript') || lower.includes('typescript') || lower.includes('code')) {
      const lang = lower.includes('python') ? 'python' : 'javascript';
      const examples = {
        python: `Here's a useful Python pattern — a decorator for timing functions:

\`\`\`python
import time
from functools import wraps

def timer(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper

@timer
def process_data(items):
    return [x ** 2 for x in items]
\`\`\``,
        javascript: `Here's a modern async pattern in JavaScript:

\`\`\`javascript
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
}
\`\`\``,
      };
      return examples[lang];
    }

    if (lower.includes('git')) {
      return `Here are some essential Git commands:

\`\`\`bash
# Stage and commit
git add -A && git commit -m "feat: your message"

# Create and switch branch
git checkout -b feature/new-feature

# Interactive rebase last 3 commits
git rebase -i HEAD~3

# Stash with message
git stash push -m "work in progress"
\`\`\`

Pro tip: Use \`git log --oneline --graph --all\` for a visual branch history!`;
    }

    // Default responses
    const defaults = [
      `That's a great question! While I'm running in demo mode right now, here's what I can tell you:\n\nCopilot GLI is designed to be your visual AI companion. Try exploring the **File Explorer** (Ctrl+2) to browse your project, or the **Terminal** (Ctrl+4) to run commands.\n\nThe full AI integration is coming soon — imagine having GPT-level intelligence right in this beautiful interface! 🚀`,

      `Interesting! Let me think about that...\n\nCopilot GLI is currently in **v1.0.0** with these panels:\n• Chat (you're here!)\n• File Explorer with syntax highlighting\n• Search across files\n• Integrated terminal\n• Theme customization\n\nTry switching to the **Cyberpunk** theme in Settings for a wild experience! 🎨`,

      `I appreciate the question! Here's a fun fact while I'm in demo mode:\n\n> *"The best way to predict the future is to invent it."* — Alan Kay\n\nCopilot GLI is all about inventing a better developer experience. Each panel is designed to keep you in flow state — no context switching needed.\n\nTry the terminal panel to run some commands! ⚡`,
    ];

    return defaults[Math.floor(Math.random() * defaults.length)];
  }

  chatSend.addEventListener('click', handleChatSend);
  chatInput.addEventListener('keydown', (e) => {
    // Slash menu navigation
    if (!slashMenu.classList.contains('hidden')) {
      if (e.key === 'ArrowDown') { e.preventDefault(); navigateSlashMenu(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); navigateSlashMenu(-1); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectSlashMenuItem(); return; }
      if (e.key === 'Escape') { e.preventDefault(); hideSlashMenu(); return; }
    }

    // Mention menu navigation
    if (!mentionMenu.classList.contains('hidden')) {
      const items = mentionMenu.querySelectorAll('.mention-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[App.mentionMenuIndex]?.classList.remove('selected');
        App.mentionMenuIndex = (App.mentionMenuIndex + 1) % items.length;
        items[App.mentionMenuIndex]?.classList.add('selected');
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[App.mentionMenuIndex]?.classList.remove('selected');
        App.mentionMenuIndex = (App.mentionMenuIndex - 1 + items.length) % items.length;
        items[App.mentionMenuIndex]?.classList.add('selected');
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        items[App.mentionMenuIndex]?.click();
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); hideMentionMenu(); return; }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  });

  // Auto-resize textarea + slash/mention triggers
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';

    const val = chatInput.value;

    // Trigger slash command menu
    if (val.startsWith('/')) {
      showSlashMenu(val.substring(1));
    } else {
      hideSlashMenu();
    }

    // Trigger @ mention menu
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) {
      showMentionMenu(atMatch[1]);
    } else {
      hideMentionMenu();
    }
  });

  // Clear chat
  $('#btn-clear-chat')?.addEventListener('click', () => {
    executeSlashCommand('clearChat');
  });

  // ═══════════════════════════════════════════════════════════
  //  File Explorer
  // ═══════════════════════════════════════════════════════════
  const fileTree = $('#file-tree');

  async function openFolder() {
    const folderPath = await window.gli.fs.openFolder();
    if (!folderPath) return;
    App.currentFolder = folderPath;
    await loadDirectory(folderPath, fileTree, 0);
    updateStatus(`Opened: ${folderPath.split('\\').pop() || folderPath.split('/').pop()}`);
  }

  async function loadDirectory(dirPath, container, depth) {
    const entries = await window.gli.fs.readDirectory(dirPath);
    if (entries.error) {
      container.innerHTML = `<div class="file-tree-empty"><p>Error: ${entries.error}</p></div>`;
      return;
    }

    container.innerHTML = '';
    for (const entry of entries) {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.style.setProperty('--depth', depth);

      if (entry.isDirectory) {
        const chevron = document.createElement('span');
        chevron.className = 'file-chevron';
        chevron.textContent = '▶';

        const icon = document.createElement('span');
        icon.className = 'file-icon folder';
        icon.textContent = '📁';

        const name = document.createElement('span');
        name.textContent = entry.name;

        item.appendChild(chevron);
        item.appendChild(icon);
        item.appendChild(name);

        const children = document.createElement('div');
        children.className = 'file-children';
        children.style.display = 'none';

        let loaded = false;

        item.addEventListener('click', async (e) => {
          e.stopPropagation();
          const isOpen = children.style.display !== 'none';

          if (!loaded) {
            await loadDirectory(entry.path, children, depth + 1);
            loaded = true;
          }

          children.style.display = isOpen ? 'none' : 'block';
          chevron.classList.toggle('expanded', !isOpen);
          icon.textContent = isOpen ? '📁' : '📂';
        });

        container.appendChild(item);
        container.appendChild(children);
      } else {
        const icon = document.createElement('span');
        icon.className = 'file-icon file';
        icon.textContent = getFileIcon(entry.extension);

        const name = document.createElement('span');
        name.textContent = entry.name;

        item.appendChild(document.createElement('span')); // spacer for alignment
        item.appendChild(icon);
        item.appendChild(name);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          openFile(entry);
        });

        container.appendChild(item);
      }
    }
  }

  function getFileIcon(ext) {
    const icons = {
      js: '📜', ts: '🔷', jsx: '⚛️', tsx: '⚛️',
      py: '🐍', rb: '💎', go: '🔵', rs: '🦀',
      html: '🌐', css: '🎨', scss: '🎨', less: '🎨',
      json: '📋', yaml: '📋', yml: '📋', toml: '📋',
      md: '📝', txt: '📄', csv: '📊',
      png: '🖼️', jpg: '🖼️', gif: '🖼️', svg: '🖼️',
      sh: '⚙️', bat: '⚙️', ps1: '⚙️',
      lock: '🔒', env: '🔐',
    };
    return icons[ext] || '📄';
  }

  async function openFile(entry) {
    const result = await window.gli.fs.readFile(entry.path);
    if (result.error) {
      updateStatus(`Error: ${result.error}`);
      return;
    }

    // Add tab if not already open
    const existing = App.openFiles.find(f => f.path === entry.path);
    if (!existing) {
      App.openFiles.push({ path: entry.path, name: entry.name, ext: entry.extension });
    }
    App.activeFile = entry.path;

    renderTabs();
    renderCode(result.content, entry.extension || 'text');
    updateStatus(`Editing: ${entry.name}`);
    $('#status-file').textContent = entry.name;

    // Highlight active file in tree
    $$('.file-item').forEach(i => i.classList.remove('active'));
    const items = $$('.file-item');
    items.forEach(i => {
      if (i.textContent.includes(entry.name)) i.classList.add('active');
    });
  }

  function renderTabs() {
    const tabsContainer = $('#code-tabs');
    tabsContainer.innerHTML = '';

    for (const file of App.openFiles) {
      const tab = document.createElement('button');
      tab.className = `code-tab ${file.path === App.activeFile ? 'active' : ''}`;

      const icon = document.createElement('span');
      icon.textContent = getFileIcon(file.ext);
      icon.style.fontSize = '12px';

      const name = document.createElement('span');
      name.textContent = file.name;

      const close = document.createElement('span');
      close.className = 'code-tab-close';
      close.textContent = '×';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(file.path);
      });

      tab.appendChild(icon);
      tab.appendChild(name);
      tab.appendChild(close);

      tab.addEventListener('click', async () => {
        App.activeFile = file.path;
        renderTabs();
        const result = await window.gli.fs.readFile(file.path);
        if (!result.error) renderCode(result.content, file.ext || 'text');
      });

      tabsContainer.appendChild(tab);
    }
  }

  function closeTab(filePath) {
    App.openFiles = App.openFiles.filter(f => f.path !== filePath);
    if (App.activeFile === filePath) {
      App.activeFile = App.openFiles.length > 0 ? App.openFiles[App.openFiles.length - 1].path : null;
    }
    renderTabs();

    if (App.activeFile) {
      const file = App.openFiles.find(f => f.path === App.activeFile);
      if (file) {
        window.gli.fs.readFile(file.path).then(r => {
          if (!r.error) renderCode(r.content, file.ext || 'text');
        });
      }
    } else {
      $('#code-viewer').innerHTML = `<div class="code-viewer-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1" opacity="0.3">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        <p>Select a file to view</p>
      </div>`;
      $('#status-file').textContent = 'No file open';
    }
  }

  function renderCode(content, ext) {
    const viewer = $('#code-viewer');
    const pre = document.createElement('pre');
    const code = document.createElement('code');

    const langMap = {
      js: 'javascript', ts: 'typescript', py: 'python', rb: 'ruby',
      go: 'go', rs: 'rust', html: 'html', css: 'css', json: 'json',
      md: 'markdown', sh: 'bash', bat: 'dos', ps1: 'powershell',
      yaml: 'yaml', yml: 'yaml', toml: 'ini', xml: 'xml',
      java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp', jsx: 'javascript',
      tsx: 'typescript', scss: 'scss', less: 'less', sql: 'sql',
    };

    const lang = langMap[ext] || 'plaintext';
    code.className = `language-${lang}`;
    code.textContent = content;

    if (typeof hljs !== 'undefined') {
      try {
        const result = hljs.highlight(content, { language: lang, ignoreIllegals: true });
        code.innerHTML = result.value;
      } catch {
        code.textContent = content;
      }
    }

    // Add line numbers
    const lines = content.split('\n');
    const numbered = document.createElement('div');
    numbered.style.display = 'flex';

    const gutterEl = document.createElement('div');
    gutterEl.style.cssText = 'text-align: right; padding-right: 16px; color: var(--text-muted); user-select: none; min-width: 40px; border-right: 1px solid var(--border); margin-right: 16px;';
    gutterEl.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');

    const codeWrapper = document.createElement('div');
    codeWrapper.style.flex = '1';
    codeWrapper.appendChild(code);

    pre.appendChild(numbered);
    numbered.appendChild(gutterEl);
    numbered.appendChild(codeWrapper);

    viewer.innerHTML = '';
    viewer.appendChild(pre);
  }

  // Open folder buttons
  $('#btn-open-folder')?.addEventListener('click', openFolder);
  $('#btn-open-folder-2')?.addEventListener('click', openFolder);

  // Load home directory on start
  (async () => {
    try {
      const home = await window.gli.fs.getHome();
      App.currentFolder = home;
      await loadDirectory(home, fileTree, 0);
    } catch { /* ignore */ }
  })();

  // ═══════════════════════════════════════════════════════════
  //  Search
  // ═══════════════════════════════════════════════════════════
  const searchInput = $('#search-input');
  const searchResults = $('#search-results');
  let searchDebounce = null;

  searchInput?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => performSearch(searchInput.value), 300);
  });

  async function performSearch(query) {
    if (!query.trim()) {
      searchResults.innerHTML = '<div class="search-empty"><p>Type to search across your files</p></div>';
      return;
    }

    if (!App.currentFolder) {
      searchResults.innerHTML = '<div class="search-empty"><p>Open a folder first to search files</p></div>';
      return;
    }

    updateStatus('Searching...');
    const results = await searchFiles(App.currentFolder, query, 0);
    searchResults.innerHTML = '';

    if (results.length === 0) {
      searchResults.innerHTML = `<div class="search-empty"><p>No results for "${escapeHtml(query)}"</p></div>`;
    } else {
      for (const r of results.slice(0, 50)) {
        const item = document.createElement('div');
        item.className = 'search-result-item';

        const pathEl = document.createElement('div');
        pathEl.className = 'search-result-path';
        pathEl.textContent = r.path;

        const lineEl = document.createElement('div');
        lineEl.className = 'search-result-line';
        lineEl.innerHTML = r.line.replace(new RegExp(`(${escapeRegex(query)})`, 'gi'),
          '<span class="search-result-match">$1</span>');

        item.appendChild(pathEl);
        item.appendChild(lineEl);

        item.addEventListener('click', () => {
          openFile({ path: r.fullPath, name: r.name, extension: r.ext });
        });

        searchResults.appendChild(item);
      }
    }

    updateStatus(`Found ${results.length} results`);
  }

  async function searchFiles(dirPath, query, depth) {
    if (depth > 3) return [];
    const entries = await window.gli.fs.readDirectory(dirPath);
    if (entries.error) return [];

    const results = [];
    for (const entry of entries) {
      if (entry.isDirectory) {
        if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(entry.name)) continue;
        const subResults = await searchFiles(entry.path, query, depth + 1);
        results.push(...subResults);
      } else {
        const textExts = ['js', 'ts', 'py', 'html', 'css', 'json', 'md', 'txt', 'yaml', 'yml', 'toml', 'sh', 'bat', 'ps1', 'xml', 'csv', 'jsx', 'tsx', 'scss', 'less', 'sql', 'go', 'rs', 'rb', 'java', 'c', 'cpp', 'cs', 'h'];
        if (!textExts.includes(entry.extension)) continue;

        const file = await window.gli.fs.readFile(entry.path);
        if (file.error) continue;

        const lines = file.content.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              path: entry.path.replace(App.currentFolder, '').replace(/^[\\/]/, ''),
              fullPath: entry.path,
              name: entry.name,
              ext: entry.extension,
              line: line.trim().substring(0, 120),
            });
          }
        }
      }
    }
    return results;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ═══════════════════════════════════════════════════════════
  //  Terminal
  // ═══════════════════════════════════════════════════════════
  const terminalOutput = $('#terminal-output');
  const terminalInput = $('#terminal-input');

  terminalInput?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const cmd = terminalInput.value.trim();
      if (!cmd) return;

      App.commandHistory.push(cmd);
      App.historyIndex = App.commandHistory.length;
      terminalInput.value = '';

      appendTerminalCommand(cmd);
      updateStatus(`Running: ${cmd}`);

      try {
        const result = await window.gli.terminal.execute(cmd);
        appendTerminalOutput(result.stdout, result.stderr, result.exitCode);
      } catch (err) {
        appendTerminalOutput('', `Error: ${err.message}`, 1);
      }

      updateStatus('Ready');
    }

    // Command history navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (App.historyIndex > 0) {
        App.historyIndex--;
        terminalInput.value = App.commandHistory[App.historyIndex];
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (App.historyIndex < App.commandHistory.length - 1) {
        App.historyIndex++;
        terminalInput.value = App.commandHistory[App.historyIndex];
      } else {
        App.historyIndex = App.commandHistory.length;
        terminalInput.value = '';
      }
    }
  });

  function appendTerminalCommand(cmd) {
    const entry = document.createElement('div');
    entry.className = 'terminal-entry';

    const cmdLine = document.createElement('div');
    cmdLine.className = 'terminal-cmd';
    cmdLine.innerHTML = `<span class="terminal-cmd-prompt">❯</span> <span class="terminal-cmd-text">${escapeHtml(cmd)}</span>`;

    entry.appendChild(cmdLine);
    terminalOutput.appendChild(entry);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function appendTerminalOutput(stdout, stderr, exitCode) {
    const entries = terminalOutput.querySelectorAll('.terminal-entry');
    const lastEntry = entries[entries.length - 1];

    if (stdout) {
      const out = document.createElement('div');
      out.className = 'terminal-stdout';
      out.textContent = stdout;
      lastEntry.appendChild(out);
    }

    if (stderr) {
      const err = document.createElement('div');
      err.className = 'terminal-stderr';
      err.textContent = stderr;
      lastEntry.appendChild(err);
    }

    const code = document.createElement('div');
    code.className = `terminal-exit-code ${exitCode === 0 ? 'success' : 'error'}`;
    code.textContent = exitCode === 0 ? '✓ Done' : `✗ Exit code: ${exitCode}`;
    lastEntry.appendChild(code);

    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  // Clear terminal
  $('#btn-clear-terminal')?.addEventListener('click', () => {
    terminalOutput.innerHTML = '';
  });

  // ═══════════════════════════════════════════════════════════
  //  Settings & Themes
  // ═══════════════════════════════════════════════════════════
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gli-theme', theme);

    $$('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Restart particles with new colors
    initParticles();
  }

  $$('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.theme));
  });

  // Restore saved theme
  const savedTheme = localStorage.getItem('gli-theme');
  if (savedTheme) setTheme(savedTheme);

  // Particles toggle
  $('#toggle-particles')?.addEventListener('change', (e) => {
    const canvas = $('#particle-canvas');
    canvas.classList.toggle('hidden', !e.target.checked);
    localStorage.setItem('gli-particles', e.target.checked);
  });

  const savedParticles = localStorage.getItem('gli-particles');
  if (savedParticles === 'false') {
    $('#toggle-particles').checked = false;
    $('#particle-canvas').classList.add('hidden');
  }

  // Sidebar labels toggle
  $('#toggle-sidebar-labels')?.addEventListener('change', (e) => {
    const sidebar = $('#sidebar');
    sidebar.classList.toggle('no-labels', !e.target.checked);
    localStorage.setItem('gli-sidebar-labels', e.target.checked);
  });

  const savedLabels = localStorage.getItem('gli-sidebar-labels');
  if (savedLabels === 'false') {
    $('#toggle-sidebar-labels').checked = false;
    $('#sidebar').classList.add('no-labels');
  }

  // ═══════════════════════════════════════════════════════════
  //  Particle System
  // ═══════════════════════════════════════════════════════════
  const canvas = $('#particle-canvas');
  const ctx = canvas?.getContext('2d');
  let particles = [];
  let animationFrame = null;

  function initParticles() {
    if (!canvas || !ctx) return;

    cancelAnimationFrame(animationFrame);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const style = getComputedStyle(document.documentElement);
    const colorStr = style.getPropertyValue('--particle-color').trim();

    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 18000);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 0.5,
        color: colorStr || 'rgba(124, 58, 237, 0.15)',
      });
    }

    animateParticles();
  }

  function animateParticles() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    // Draw connections
    const maxDist = 120;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = particles[i].color.replace(/[\d.]+\)$/, `${alpha})`);
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    animationFrame = requestAnimationFrame(animateParticles);
  }

  window.addEventListener('resize', () => {
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });

  initParticles();

  // ═══════════════════════════════════════════════════════════
  //  Keyboard Shortcuts (Global)
  // ═══════════════════════════════════════════════════════════
  document.addEventListener('keydown', (e) => {
    // Shift+Tab — Cycle modes
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      cycleMode();
      return;
    }

    // Ctrl+Shift+P — Command Palette
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    // Escape — Close overlays
    if (e.key === 'Escape') {
      closeAllOverlays();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case '1': e.preventDefault(); switchPanel('chat'); break;
        case '2': e.preventDefault(); switchPanel('files'); break;
        case '3': e.preventDefault(); switchPanel('search'); break;
        case '4': e.preventDefault(); switchPanel('terminal'); break;
        case ',': e.preventDefault(); switchPanel('settings'); break;
        case 'l': e.preventDefault(); executeSlashCommand('clearChat'); break;
        case 'd': e.preventDefault(); executeSlashCommand('clearContext'); break;
        case 'g': e.preventDefault(); executeSlashCommand('generateCommit'); break;
        case 't': e.preventDefault(); executeSlashCommand('runTests'); break;
        case '5': e.preventDefault(); switchPanel('telegram'); break;
        case '6': e.preventDefault(); switchPanel('agents'); break;
        case 's': e.preventDefault(); if (App.currentPanel === 'search') { searchInput?.focus(); } break;
      }
      return;
    }

    // Focus terminal input when in terminal panel
    if (App.currentPanel === 'terminal' && e.key !== 'Control' && e.key !== 'Meta' && !e.ctrlKey && !e.metaKey) {
      terminalInput?.focus();
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  Telegram Integration
  // ═══════════════════════════════════════════════════════════
  const tgMessages = $('#tg-messages');
  const tgBadge = $('#tg-badge');
  let tgMessageCount = 0;
  let tgUnread = 0;

  function addTelegramMessage(data, direction = 'incoming') {
    // Remove empty state
    const emptyState = tgMessages?.querySelector('.telegram-empty');
    if (emptyState) emptyState.remove();

    const msg = document.createElement('div');
    msg.className = 'telegram-msg';

    const timeStr = new Date(data.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const initial = (data.from?.name || 'Bot')[0].toUpperCase();

    msg.innerHTML = `
      <div class="telegram-msg-avatar ${direction}">${direction === 'incoming' ? '✈' : '◈'}</div>
      <div class="telegram-msg-content">
        <div class="telegram-msg-header">
          <span class="telegram-msg-name">${escapeHtml(data.from?.name || 'You')}</span>
          <span class="telegram-msg-time">${timeStr}</span>
        </div>
        <div class="telegram-msg-text">${escapeHtml(data.text)}</div>
        ${data.forwarded ? '<div class="telegram-msg-forwarded">↗ Forwarded to Chat</div>' : ''}
      </div>`;

    tgMessages?.appendChild(msg);
    if (tgMessages) tgMessages.scrollTop = tgMessages.scrollHeight;
    tgMessageCount++;
  }

  function updateTelegramBadge() {
    if (tgBadge) {
      if (tgUnread > 0) {
        tgBadge.textContent = tgUnread > 99 ? '99+' : tgUnread;
        tgBadge.classList.remove('hidden');
      } else {
        tgBadge.classList.add('hidden');
      }
    }
  }

  function updateTelegramStatus(status, message) {
    const dot = $('#tg-status-dot');
    const dotBar = $('#tg-status-dot-bar');
    const text = $('#tg-status-text');
    const barText = $('#status-tg-text');

    const className = status === 'connected' ? 'connected' : status === 'error' ? 'disconnected' : 'connecting';

    if (dot) { dot.className = `telegram-status-dot ${className}`; }
    if (dotBar) { dotBar.className = `tg-dot ${className}`; }
    if (text) { text.textContent = message; }
    if (barText) {
      barText.textContent = status === 'connected'
        ? `TG: ${message.replace('Connected as ', '')}`
        : `TG: ${status === 'error' ? 'Error' : 'Connecting...'}`;
    }
  }

  // Listen for incoming Telegram messages
  if (window.gli.telegram) {
    window.gli.telegram.onMessage((data) => {
      // Add to Telegram panel
      addTelegramMessage({ ...data, forwarded: true }, 'incoming');

      // Update badge if not on Telegram panel
      if (App.currentPanel !== 'telegram') {
        tgUnread++;
        updateTelegramBadge();
      }

      // Forward to chat as a prompt
      const prefix = data.isGroup
        ? `📨 *Telegram (${data.groupTitle || 'Group'})*\n**${data.from.name}:** `
        : `📨 *Telegram DM*\n**${data.from.name}:** `;

      addChatMessage('user', prefix + data.text);

      // Generate AI response and send back to Telegram
      (async () => {
        showTypingIndicator();
        updateStatus('Thinking (Telegram)...');

        const response = await generateResponse(data.text);

        removeTypingIndicator();
        addChatMessage('assistant', response);
        updateStatus('Ready');

        // Send response back to Telegram
        const result = await window.gli.telegram.sendReply(data.chatId, response, data.id);
        if (result.success) {
          addTelegramMessage({
            from: { name: 'Copilot GLI' },
            text: response,
            timestamp: Date.now(),
          }, 'outgoing');
        }
      })();
    });

    window.gli.telegram.onStatus((data) => {
      updateTelegramStatus(data.status, data.message);
    });

    // Handle commands forwarded from Telegram bot
    window.gli.telegram.onCommand((cmd) => {
      switch (cmd.action) {
        case 'setModel': {
          const model = MODELS.find(m => m.id === cmd.value);
          if (model) {
            App.currentModel = model.id;
            localStorage.setItem('gli-model', model.id);
            const modelName = $('#model-name');
            if (modelName) modelName.textContent = model.name;
            addChatMessage('assistant', `🤖 Model switched to **${model.name}** (via Telegram)`);
          }
          break;
        }
        case 'setMode':
          setMode(cmd.value);
          addChatMessage('assistant', `🔄 Mode switched to **${cmd.value}** (via Telegram)`);
          break;
        case 'setTheme': {
          const theme = cmd.value;
          document.documentElement.setAttribute('data-theme', theme);
          localStorage.setItem('gli-theme', theme);
          addChatMessage('assistant', `🎨 Theme switched to **${theme}** (via Telegram)`);
          break;
        }
        case 'clearChat':
          chatMessages.innerHTML = '';
          addChatMessage('assistant', '🧹 Chat cleared (via Telegram command).');
          break;
        case 'newSession':
          chatMessages.innerHTML = '';
          addChatMessage('assistant', '✨ New session started (via Telegram).');
          break;
        case 'restart':
          addChatMessage('assistant', '🔄 Restarting GLI (via Telegram)...');
          setTimeout(() => location.reload(), 1000);
          break;
        case 'rename':
          addChatMessage('assistant', `✏️ Session renamed to: **${cmd.value || 'Untitled'}** (via Telegram)`);
          break;
        case 'addDir':
          addChatMessage('assistant', `📂 Directory added: \`${cmd.value}\` (via Telegram)`);
          break;
        case 'cwd':
          if (cmd.value) App.currentFolder = cmd.value;
          addChatMessage('assistant', `📍 Working directory: \`${cmd.value || App.currentFolder || 'Not set'}\` (via Telegram)`);
          break;
        default: {
          // Try to execute as a slash command action
          const fn = {
            context: 'context', compact: 'compact', copyLast: 'copyLast',
            experimental: 'experimental', research: 'research', rewind: 'rewind',
            share: 'share', resume: 'resume', session: 'session', update: 'update',
            pr: 'pr', review: 'review', lsp: 'lsp', ide: 'ide', init: 'init',
            agent: 'agent', skills: 'skills', openMcpSettings: 'openMcpSettings',
            plugin: 'plugin', delegate: 'delegate', fleet: 'fleet', tasks: 'tasks',
            terminalSetup: 'terminalSetup', instructions: 'instructions',
            streamerMode: 'streamerMode', login: 'login', logout: 'logout',
            allowAll: 'allowAll', listDirs: 'listDirs', resetTools: 'resetTools',
            user: 'user',
          }[cmd.action];
          if (fn) {
            executeSlashCommand(fn);
          } else {
            addChatMessage('assistant', `⚡ Telegram command: ${cmd.action}`);
          }
        }
      }
    });

    // Initial status check
    (async () => {
      const info = await window.gli.telegram.getInfo();
      if (info.connected) {
        updateTelegramStatus('connected', `Connected as @${info.botUsername}`);
        const botName = $('#tg-bot-name');
        const groupId = $('#tg-group-id');
        if (botName) botName.textContent = `@${info.botUsername}`;
        if (groupId) groupId.textContent = info.groupId || 'Not set';
      }
    })();
  }

  // Reconnect button
  $('#btn-tg-reconnect')?.addEventListener('click', async () => {
    updateTelegramStatus('connecting', 'Reconnecting...');
    const result = await window.gli.telegram.reconnect();
    if (!result) {
      updateTelegramStatus('error', 'Reconnection failed');
    }
  });

  // Send to group button
  $('#btn-tg-send-group')?.addEventListener('click', () => {
    const text = prompt('Send a message to the Telegram group:');
    if (text?.trim()) {
      window.gli.telegram.sendToGroup(text.trim());
      addTelegramMessage({ from: { name: 'You' }, text: text.trim(), timestamp: Date.now() }, 'outgoing');
    }
  });

  // Compose input
  const tgComposeInput = $('#tg-compose-input');
  const tgComposeSend = $('#tg-compose-send');

  async function sendTelegramCompose() {
    const text = tgComposeInput?.value?.trim();
    if (!text) return;
    tgComposeInput.value = '';

    addTelegramMessage({ from: { name: 'You' }, text, timestamp: Date.now() }, 'outgoing');
    const result = await window.gli.telegram.sendToGroup(text);
    if (!result.success) {
      addTelegramMessage({ from: { name: 'System' }, text: `❌ Failed: ${result.error}`, timestamp: Date.now() }, 'incoming');
    }
  }

  tgComposeSend?.addEventListener('click', sendTelegramCompose);
  tgComposeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendTelegramCompose(); }
  });

  // Clear unread when switching to Telegram panel
  const originalSwitchPanel = switchPanel;
  // Wrap switchPanel isn't needed since we can observe
  // (We'll use a MutationObserver or just patch the panel switch click handlers)

  // ═══════════════════════════════════════════════════════════
  //  Background Agents System (UI)
  // ═══════════════════════════════════════════════════════════
  const agentsList = $('#agents-list');
  const agentCards = new Map();

  function renderAgentCard(agent) {
    const emptyState = agentsList?.querySelector('.agents-empty');
    if (emptyState) emptyState.remove();

    let card = agentCards.get(agent.id);
    const isNew = !card;

    if (isNew) {
      card = document.createElement('div');
      card.className = 'agent-card';
      card.dataset.agentId = agent.id;
      agentCards.set(agent.id, card);
    }

    const logsHtml = (agent.logs || [])
      .map(l => {
        const t = new Date(l.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `<div class="agent-log-entry"><span class="agent-log-time">${t}</span>${escapeHtml(l.msg)}</div>`;
      })
      .join('');

    card.innerHTML = `
      <div class="agent-card-header">
        <div class="agent-card-name">
          🤖 ${escapeHtml(agent.name)}
          <span class="agent-status-badge ${agent.status}">${agent.status}</span>
        </div>
      </div>
      <div class="agent-card-task">${escapeHtml(agent.task)}</div>
      <div class="agent-card-type">${escapeHtml(agent.options?.type || 'generic')}</div>
      <div class="agent-card-logs">${logsHtml || '<em>No logs yet</em>'}</div>
      <div class="agent-card-actions">
        ${agent.status === 'running' ? `<button class="btn-stop" data-agent="${agent.id}">⬛ Stop</button>` : ''}
      </div>`;

    // Attach stop handler
    const stopBtn = card.querySelector('.btn-stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', async () => {
        await window.gli.telegram.stopAgent(agent.id);
      });
    }

    if (isNew) {
      agentsList?.appendChild(card);
    }

    // Auto-scroll logs
    const logsEl = card.querySelector('.agent-card-logs');
    if (logsEl) logsEl.scrollTop = logsEl.scrollHeight;
  }

  // Listen for agent updates
  if (window.gli.telegram) {
    window.gli.telegram.onAgentUpdate((agent) => {
      renderAgentCard(agent);
    });
  }

  // New Agent modal
  $('#btn-new-agent')?.addEventListener('click', () => {
    $('#agent-modal-overlay').classList.remove('hidden');
    $('#agent-name').value = '';
    $('#agent-task').value = '';
    $('#agent-type').value = 'telegram-monitor';
    $('#agent-options').value = '';
    $('#agent-name').focus();
  });

  $('#agent-modal-close')?.addEventListener('click', () => $('#agent-modal-overlay').classList.add('hidden'));
  $('#agent-cancel')?.addEventListener('click', () => $('#agent-modal-overlay').classList.add('hidden'));

  $('#agent-create')?.addEventListener('click', async () => {
    const name = $('#agent-name').value.trim();
    const task = $('#agent-task').value.trim();
    const type = $('#agent-type').value;
    let options = {};

    try {
      const optStr = $('#agent-options').value.trim();
      options = optStr ? JSON.parse(optStr) : {};
    } catch {
      options = {};
    }

    if (!name || !task) return;

    options.type = type;

    const result = await window.gli.telegram.createAgent(name, task, options);
    $('#agent-modal-overlay').classList.add('hidden');

    addChatMessage('assistant', `🤖 Agent **${name}** created!\n\n• **Type:** \`${type}\`\n• **Task:** ${task}\n• **ID:** \`${result.id}\``);
  });

  // Clear unread when viewing Telegram
  $$('.sidebar-btn').forEach(btn => {
    const origHandler = btn.onclick;
    btn.addEventListener('click', () => {
      if (btn.dataset.panel === 'telegram') {
        tgUnread = 0;
        updateTelegramBadge();
      }
      if (btn.dataset.panel === 'system') {
        loadSystemInfo();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  System Control Panel
  // ═══════════════════════════════════════════════════════════

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

  function barColor(pct) {
    return pct > 80 ? 'red' : pct > 50 ? 'yellow' : 'green';
  }

  async function loadSystemInfo() {
    const grid = $('#sys-stats-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="sys-stat-card loading"><div class="sys-stat-label">Loading system info...</div></div>';

    try {
      const info = await window.gli.system.detailedInfo();

      const cards = [
        { icon: '💻', label: 'Computer', value: info.os.hostname, sub: `${info.os.distro} ${info.os.release}` },
        { icon: '⚙️', label: 'CPU', value: info.cpu.brand, sub: `${info.cpu.cores} cores @ ${info.cpu.speed}GHz` },
        { icon: '🧠', label: 'Memory', value: `${info.memory.percentUsed}%`, sub: `${formatBytes(info.memory.used)} / ${formatBytes(info.memory.total)}`, bar: info.memory.percentUsed },
        ...info.disks.slice(0, 3).map(d => ({
          icon: '💾', label: `Disk ${d.mount}`, value: `${Math.round(d.percentUsed)}%`,
          sub: `${formatBytes(d.used)} / ${formatBytes(d.size)}`, bar: d.percentUsed,
        })),
        ...info.gpu.map(g => ({ icon: '🎮', label: 'GPU', value: g.model, sub: `${g.vram}MB VRAM` })),
        { icon: '⏱️', label: 'Uptime', value: formatUptime(require ? 0 : 0), sub: '' },
        { icon: '🔋', label: 'Battery', value: info.battery.hasBattery ? `${info.battery.percent}%` : 'No battery', sub: info.battery.isCharging ? 'Charging' : '' },
        ...info.network.filter(n => n.ip4).slice(0, 2).map(n => ({
          icon: '🌐', label: n.iface, value: n.ip4, sub: n.mac,
        })),
      ];

      // Get uptime from quick info
      const quick = await window.gli.system.quickInfo();
      const uptimeCard = cards.find(c => c.label === 'Uptime');
      if (uptimeCard) { uptimeCard.value = formatUptime(quick.uptime); uptimeCard.sub = `User: ${quick.user}`; }

      grid.innerHTML = cards.map(c => `
        <div class="sys-stat-card">
          <div class="sys-stat-icon">${c.icon}</div>
          <div class="sys-stat-label">${c.label}</div>
          <div class="sys-stat-value">${escapeHtml(String(c.value))}</div>
          ${c.sub ? `<div class="sys-stat-sub">${escapeHtml(String(c.sub))}</div>` : ''}
          ${c.bar !== undefined ? `<div class="sys-stat-bar"><div class="sys-stat-bar-fill ${barColor(c.bar)}" style="width:${c.bar}%"></div></div>` : ''}
        </div>`).join('');

    } catch (err) {
      grid.innerHTML = `<div class="sys-stat-card"><div class="sys-stat-label">Error: ${escapeHtml(err.message)}</div></div>`;
    }
  }

  async function loadProcesses(filter = '') {
    const list = $('#sys-process-list');
    if (!list) return;

    list.innerHTML = '<div class="sys-process-loading">Loading processes...</div>';

    try {
      const procs = await window.gli.system.processes();
      const filtered = filter
        ? procs.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
        : procs;

      list.innerHTML = `
        <div class="sys-process-row header">
          <span>PID</span><span>Name</span><span>CPU %</span><span>MEM %</span><span></span>
        </div>
        ${filtered.slice(0, 60).map(p => `
          <div class="sys-process-row">
            <span>${p.pid}</span>
            <span title="${escapeHtml(p.command || p.name)}">${escapeHtml(p.name)}</span>
            <span>${p.cpu}%</span>
            <span>${p.mem}%</span>
            <span><button class="sys-process-kill" data-pid="${p.pid}" title="Kill process">✕</button></span>
          </div>`).join('')}`;

      list.querySelectorAll('.sys-process-kill').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pid = parseInt(btn.dataset.pid);
          const result = await window.gli.system.killProcess(pid);
          if (result.success) {
            btn.closest('.sys-process-row')?.remove();
            addChatMessage('assistant', `🔧 Process ${pid} killed.`);
          } else {
            addChatMessage('assistant', `❌ Failed to kill PID ${pid}: ${result.error}`);
          }
        });
      });
    } catch (err) {
      list.innerHTML = `<div class="sys-process-loading">Error: ${escapeHtml(err.message)}</div>`;
    }
  }

  // System event listeners
  $('#btn-sys-refresh')?.addEventListener('click', loadSystemInfo);
  $('#btn-refresh-procs')?.addEventListener('click', () => loadProcesses($('#process-filter')?.value || ''));

  let procFilterDebounce;
  $('#process-filter')?.addEventListener('input', (e) => {
    clearTimeout(procFilterDebounce);
    procFilterDebounce = setTimeout(() => loadProcesses(e.target.value), 300);
  });

  // Power actions
  $$('.sys-action-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const result = await window.gli.system.power(btn.dataset.action);
      if (result.success) {
        addChatMessage('assistant', `⚡ ${btn.dataset.action} initiated.`);
      }
    });
  });

  // Screenshot
  $('#btn-sys-screenshot')?.addEventListener('click', async () => {
    const result = await window.gli.system.screenshot();
    if (result.success) {
      const section = $('#sys-screenshot-section');
      const img = $('#sys-screenshot-img');
      if (section && img) {
        img.src = result.data;
        section.classList.remove('hidden');
      }
      addChatMessage('assistant', '📸 Desktop screenshot captured!');
    }
  });

  // Clipboard
  $('#btn-sys-clipboard')?.addEventListener('click', async () => {
    const clip = await window.gli.system.clipboard();
    addChatMessage('assistant', `📋 **Clipboard:**\n\n\`\`\`\n${clip.text || '(empty)'}\n\`\`\`\n\nHas image: ${clip.hasImage ? 'Yes' : 'No'}`);
  });

  // Installed Apps
  $('#btn-sys-apps')?.addEventListener('click', async () => {
    addChatMessage('assistant', '📦 Loading installed apps...');
    const apps = await window.gli.system.installedApps();
    addChatMessage('assistant', `📦 **Installed Apps (${apps.length}):**\n\n${apps.slice(0, 30).map(a => `• ${a.DisplayName} ${a.DisplayVersion || ''}`).join('\n')}${apps.length > 30 ? `\n\n...and ${apps.length - 30} more` : ''}`);
  });

  // WiFi
  $('#btn-sys-wifi')?.addEventListener('click', async () => {
    const networks = await window.gli.system.wifi();
    if (networks.length === 0) {
      addChatMessage('assistant', '📶 No WiFi networks found.');
    } else {
      addChatMessage('assistant', `📶 **WiFi Networks (${networks.length}):**\n\n${networks.map(n => `• **${n.ssid}** — ${n.signal}% signal (${n.auth})`).join('\n')}`);
    }
  });

  // Mute
  $('#btn-sys-mute')?.addEventListener('click', async () => {
    await window.gli.system.mute();
    addChatMessage('assistant', '🔇 Mute toggled.');
  });

  // Auto-load processes when system panel opens
  // (triggers via sidebar click handler above)

  // ═══════════════════════════════════════════════════════════
  //  Browser Control Panel
  // ═══════════════════════════════════════════════════════════

  function addBrowserOutput(text, type = 'info') {
    const output = $('#browser-output');
    if (!output) return;

    // Remove empty state
    const empty = output.querySelector('.browser-empty');
    if (empty) empty.remove();

    const entry = document.createElement('div');
    entry.className = `browser-output-entry ${type}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.innerHTML = `<div class="browser-output-label">${time}</div><div class="browser-output-data">${escapeHtml(typeof text === 'object' ? JSON.stringify(text, null, 2) : String(text))}</div>`;
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
  }

  async function refreshBrowserTabs() {
    const tabsEl = $('#browser-tabs');
    if (!tabsEl) return;

    const info = await window.gli.browser.info();
    if (!info.connected) {
      tabsEl.innerHTML = '<span class="browser-no-tabs">No browser running. Click "Launch" to start.</span>';
      return;
    }

    const tabs = await window.gli.browser.listTabs();
    tabsEl.innerHTML = tabs.map(t => `
      <div class="browser-tab ${t.isActive ? 'active' : ''}" data-page-id="${t.id}">
        <span title="${escapeHtml(t.url)}">${escapeHtml(t.title || t.url || 'New Tab')}</span>
        <button class="browser-tab-close" data-close-id="${t.id}">✕</button>
      </div>`).join('');

    tabsEl.querySelectorAll('.browser-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        if (e.target.classList.contains('browser-tab-close')) return;
        window.gli.browser.switchTab(tab.dataset.pageId);
        refreshBrowserTabs();
      });
    });

    tabsEl.querySelectorAll('.browser-tab-close').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.gli.browser.closeTab(btn.dataset.closeId);
        refreshBrowserTabs();
      });
    });

    // Update URL bar
    const activeTab = tabs.find(t => t.isActive);
    if (activeTab) {
      const urlInput = $('#browser-url-input');
      if (urlInput) urlInput.value = activeTab.url;
    }
  }

  // Launch
  $('#btn-browser-launch')?.addEventListener('click', async () => {
    addBrowserOutput('Launching browser...');
    const result = await window.gli.browser.launch();
    if (result.success) {
      addBrowserOutput(`✓ Browser launched: ${result.browser}`, 'success');
      refreshBrowserTabs();
    } else {
      addBrowserOutput(`✗ ${result.error}`, 'error');
    }
  });

  // Close
  $('#btn-browser-close')?.addEventListener('click', async () => {
    await window.gli.browser.close();
    addBrowserOutput('Browser closed.', 'info');
    refreshBrowserTabs();
  });

  // Navigate
  async function browserNavigate() {
    const url = $('#browser-url-input')?.value?.trim();
    if (!url) return;
    addBrowserOutput(`Navigating to: ${url}`);
    const result = await window.gli.browser.navigate(url);
    if (result.success) {
      addBrowserOutput(`✓ ${result.title} — ${result.url}`, 'success');
      refreshBrowserTabs();
    } else {
      addBrowserOutput(`✗ ${result.error}`, 'error');
    }
  }

  $('#btn-browser-go')?.addEventListener('click', browserNavigate);
  $('#browser-url-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') browserNavigate();
  });

  // Nav buttons
  $('#btn-browser-back')?.addEventListener('click', async () => {
    const r = await window.gli.browser.back();
    if (r.success) { addBrowserOutput(`◀ Back: ${r.url}`, 'success'); refreshBrowserTabs(); }
  });
  $('#btn-browser-forward')?.addEventListener('click', async () => {
    const r = await window.gli.browser.forward();
    if (r.success) { addBrowserOutput(`▶ Forward: ${r.url}`, 'success'); refreshBrowserTabs(); }
  });
  $('#btn-browser-reload')?.addEventListener('click', async () => {
    const r = await window.gli.browser.reload();
    if (r.success) { addBrowserOutput(`↻ Reloaded: ${r.url}`, 'success'); }
  });

  // New Tab
  $('#btn-browser-newtab')?.addEventListener('click', async () => {
    const r = await window.gli.browser.newTab();
    if (r.success) { addBrowserOutput(`+ New tab: ${r.pageId}`, 'success'); refreshBrowserTabs(); }
  });

  // Get Content
  $('#btn-browser-content')?.addEventListener('click', async () => {
    const r = await window.gli.browser.content();
    if (r.success) {
      addBrowserOutput(`📄 Page: ${r.title}\nURL: ${r.url}\nHTML length: ${r.htmlLength}\n\n${r.text.substring(0, 2000)}`, 'success');
    } else {
      addBrowserOutput(r.error, 'error');
    }
  });

  // Cookies
  $('#btn-browser-cookies')?.addEventListener('click', async () => {
    const r = await window.gli.browser.cookies();
    if (r.success) {
      addBrowserOutput(`🍪 Cookies (${r.cookies.length}):\n${r.cookies.map(c => `${c.name}=${c.value?.substring(0, 40)}`).join('\n')}`, 'success');
    }
  });

  // Screenshot
  $('#btn-browser-screenshot')?.addEventListener('click', async () => {
    const r = await window.gli.browser.screenshot();
    if (r.success) {
      const preview = $('#browser-screenshot-preview');
      const img = $('#browser-screenshot-img');
      if (preview && img) {
        img.src = r.data;
        preview.classList.remove('hidden');
      }
      addBrowserOutput('📸 Screenshot captured', 'success');
    } else {
      addBrowserOutput(r.error, 'error');
    }
  });

  // Execute interaction
  $('#btn-browser-execute')?.addEventListener('click', async () => {
    const action = $('#browser-interact-action')?.value;
    const selector = $('#browser-interact-selector')?.value?.trim();
    const value = $('#browser-interact-value')?.value?.trim();

    if (!selector && action !== 'scroll') return;

    let result;
    switch (action) {
      case 'click':
        result = await window.gli.browser.click(selector);
        break;
      case 'type':
        result = await window.gli.browser.type(selector, value || '', { clear: true });
        break;
      case 'extract':
        result = await window.gli.browser.extract(selector, value || 'textContent');
        break;
      case 'evaluate':
        result = await window.gli.browser.evaluate(selector); // selector field has JS code
        break;
      case 'scroll':
        result = await window.gli.browser.scroll(selector || 'down', parseInt(value) || 500);
        break;
      case 'waitFor':
        result = await window.gli.browser.waitFor(selector, parseInt(value) || 10000);
        break;
    }

    if (result?.success) {
      const display = result.data || result.result || result.selector || JSON.stringify(result);
      addBrowserOutput(`✓ ${action}: ${typeof display === 'object' ? JSON.stringify(display, null, 2) : display}`, 'success');
    } else {
      addBrowserOutput(`✗ ${action}: ${result?.error || 'Unknown error'}`, 'error');
    }
  });

  // Browser status listener
  if (window.gli.browser) {
    window.gli.browser.onStatus?.((data) => {
      if (data.status === 'disconnected') {
        addBrowserOutput('Browser disconnected.', 'info');
        refreshBrowserTabs();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  Utilities
  // ═══════════════════════════════════════════════════════════
  function updateStatus(text) {
    const el = $('#status-text');
    if (el) el.textContent = text;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Focus chat input on start
  chatInput?.focus();
});
