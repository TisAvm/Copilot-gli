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
  //  Chat System
  // ═══════════════════════════════════════════════════════════
  const chatMessages = $('#chat-messages');
  const chatInput = $('#chat-input');
  const chatSend = $('#chat-send');

  // Welcome message
  addChatMessage('assistant', `👋 **Welcome to Copilot GLI!**

I'm your AI coding assistant with a visual twist. Here's what I can help with:

• **Code questions** — Ask me anything about programming
• **File explorer** — Browse your project files (Ctrl+2)
• **Terminal** — Run commands directly (Ctrl+4)
• **Search** — Find text across files (Ctrl+3)

Try asking me something, or explore the sidebar!`);

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  });

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // Clear chat
  $('#btn-clear-chat')?.addEventListener('click', () => {
    chatMessages.innerHTML = '';
    addChatMessage('assistant', 'Chat cleared. How can I help you?');
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
  //  Keyboard Shortcuts
  // ═══════════════════════════════════════════════════════════
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case '1': e.preventDefault(); switchPanel('chat'); break;
        case '2': e.preventDefault(); switchPanel('files'); break;
        case '3': e.preventDefault(); switchPanel('search'); break;
        case '4': e.preventDefault(); switchPanel('terminal'); break;
        case ',': e.preventDefault(); switchPanel('settings'); break;
      }
    }

    // Focus terminal input when in terminal panel
    if (App.currentPanel === 'terminal' && e.key !== 'Control' && e.key !== 'Meta' && !e.ctrlKey && !e.metaKey) {
      terminalInput?.focus();
    }
  });

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
