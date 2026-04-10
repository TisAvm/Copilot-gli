require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const TelegramService = require('./telegram');
const SystemControl = require('./system-control');
const BrowserControl = require('./browser-control');
const ObsidianService = require('./obsidian');
const OpenRouterService = require('./openrouter');

let mainWindow;
let telegram;
let systemCtl;
let browserCtl;
let obsidian;
let openrouter;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0d1117',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.svg'),
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createWindow();

  // Initialize services
  systemCtl = new SystemControl(mainWindow);
  browserCtl = new BrowserControl(mainWindow);
  obsidian = new ObsidianService(mainWindow);
  openrouter = new OpenRouterService();

  telegram = new TelegramService(mainWindow);
  telegram.setControllers(systemCtl, browserCtl);
  telegram._startTime = Date.now();
  await telegram.start();
  await obsidian.init();
});

app.on('window-all-closed', () => {
  if (telegram) telegram.destroy();
  if (browserCtl) browserCtl.destroy();
  if (obsidian) obsidian.destroy();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC Handlers ──────────────────────────────────────────

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
  return mainWindow?.isMaximized();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

// File system operations
ipcMain.handle('fs:readDirectory', async (_, dirPath) => {
  try {
    const resolvedPath = dirPath || process.cwd();
    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    return entries
      .filter(e => !e.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        path: path.join(resolvedPath, entry.name),
        isDirectory: entry.isDirectory(),
        extension: entry.isDirectory() ? null : path.extname(entry.name).slice(1),
      }))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, path: filePath, name: path.basename(filePath) };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('fs:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('fs:getHome', () => {
  return app.getPath('home');
});

// Terminal / shell execution
const activeTerminals = new Map();

ipcMain.handle('terminal:execute', async (_, command) => {
  return new Promise((resolve) => {
    exec(command, { cwd: process.cwd(), timeout: 30000 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: error ? error.code || 1 : 0,
      });
    });
  });
});

ipcMain.handle('terminal:spawn', async (event, { id, command, cwd }) => {
  const isWindows = process.platform === 'win32';
  const shellCmd = isWindows ? 'powershell.exe' : '/bin/bash';
  const shellArgs = isWindows ? ['-NoLogo', '-NoProfile', '-Command', command] : ['-c', command];

  const proc = spawn(shellCmd, shellArgs, {
    cwd: cwd || process.cwd(),
    env: process.env,
  });

  activeTerminals.set(id, proc);

  proc.stdout.on('data', (data) => {
    mainWindow?.webContents.send('terminal:data', { id, data: data.toString() });
  });

  proc.stderr.on('data', (data) => {
    mainWindow?.webContents.send('terminal:data', { id, data: data.toString() });
  });

  proc.on('close', (code) => {
    mainWindow?.webContents.send('terminal:exit', { id, code });
    activeTerminals.delete(id);
  });

  return { id, pid: proc.pid };
});

ipcMain.handle('terminal:kill', async (_, id) => {
  const proc = activeTerminals.get(id);
  if (proc) {
    proc.kill();
    activeTerminals.delete(id);
    return true;
  }
  return false;
});

// Open external links
ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url));

// ── Telegram IPC Handlers ─────────────────────────────────

ipcMain.handle('telegram:getInfo', () => {
  return telegram ? telegram.getInfo() : { connected: false };
});

ipcMain.handle('telegram:sendReply', async (_, { chatId, text, replyToMessageId }) => {
  if (!telegram) return { success: false, error: 'Telegram not initialized' };
  return telegram.sendReply(chatId, text, replyToMessageId);
});

ipcMain.handle('telegram:sendToGroup', async (_, text) => {
  if (!telegram) return { success: false, error: 'Telegram not initialized' };
  return telegram.sendToGroup(text);
});

ipcMain.handle('telegram:reconnect', async () => {
  if (telegram) {
    telegram.destroy();
    telegram = new TelegramService(mainWindow);
    return telegram.start();
  }
  return false;
});

// Background Agents
ipcMain.handle('telegram:createAgent', async (_, { name, task, options }) => {
  if (!telegram) return { success: false, error: 'Telegram not initialized' };
  return telegram.createAgent(name, task, options);
});

ipcMain.handle('telegram:stopAgent', async (_, agentId) => {
  if (!telegram) return { success: false, error: 'Telegram not initialized' };
  return telegram.stopAgent(agentId);
});

ipcMain.handle('telegram:listAgents', async () => {
  if (!telegram) return [];
  return telegram.listAgents();
});

// ── System Control IPC Handlers ───────────────────────────

ipcMain.handle('system:quickInfo', () => systemCtl?.getQuickInfo());
ipcMain.handle('system:detailedInfo', async () => systemCtl?.getDetailedInfo());
ipcMain.handle('system:processes', async () => systemCtl?.listProcesses());
ipcMain.handle('system:killProcess', (_, pid) => systemCtl?.killProcess(pid));
ipcMain.handle('system:launchApp', (_, { appPath, args }) => systemCtl?.launchApp(appPath, args));
ipcMain.handle('system:openUrl', (_, url) => systemCtl?.openUrl(url));
ipcMain.handle('system:openPath', (_, p) => systemCtl?.openPath(p));
ipcMain.handle('system:showInFolder', (_, p) => systemCtl?.showInFolder(p));
ipcMain.handle('system:installedApps', async () => systemCtl?.getInstalledApps());
ipcMain.handle('system:clipboard', () => systemCtl?.clipboardRead());
ipcMain.handle('system:clipboardWrite', (_, text) => systemCtl?.clipboardWrite(text));
ipcMain.handle('system:clipboardClear', () => systemCtl?.clipboardClear());
ipcMain.handle('system:screenshot', async () => systemCtl?.takeScreenshot());
ipcMain.handle('system:windowScreenshot', async () => systemCtl?.takeWindowScreenshot());
ipcMain.handle('system:power', async (_, action) => systemCtl?.powerAction(action));
ipcMain.handle('system:cancelShutdown', () => systemCtl?.cancelShutdown());
ipcMain.handle('system:fileCreate', (_, { path, content }) => systemCtl?.fileCreate(path, content));
ipcMain.handle('system:fileDelete', (_, p) => systemCtl?.fileDelete(p));
ipcMain.handle('system:fileRename', (_, { oldPath, newPath }) => systemCtl?.fileRename(oldPath, newPath));
ipcMain.handle('system:fileCopy', (_, { src, dest }) => systemCtl?.fileCopy(src, dest));
ipcMain.handle('system:fileInfo', (_, p) => systemCtl?.fileInfo(p));
ipcMain.handle('system:volume', (_, level) => systemCtl?.setVolume(level));
ipcMain.handle('system:mute', () => systemCtl?.muteToggle());
ipcMain.handle('system:displays', () => systemCtl?.getDisplays());
ipcMain.handle('system:wifi', async () => systemCtl?.getWifiNetworks());
ipcMain.handle('system:runElevated', async (_, cmd) => systemCtl?.runElevated(cmd));

// ── Browser Control IPC Handlers ──────────────────────────

ipcMain.handle('browser:launch', async (_, opts) => browserCtl?.launch(opts));
ipcMain.handle('browser:close', async () => browserCtl?.close());
ipcMain.handle('browser:navigate', async (_, { url, pageId }) => browserCtl?.navigate(url, pageId));
ipcMain.handle('browser:click', async (_, { selector, pageId }) => browserCtl?.click(selector, pageId));
ipcMain.handle('browser:type', async (_, { selector, text, options, pageId }) => browserCtl?.type(selector, text, options, pageId));
ipcMain.handle('browser:pressKey', async (_, { key, pageId }) => browserCtl?.pressKey(key, pageId));
ipcMain.handle('browser:screenshot', async (_, { options, pageId }) => browserCtl?.screenshot(options, pageId));
ipcMain.handle('browser:content', async (_, pageId) => browserCtl?.getContent(pageId));
ipcMain.handle('browser:extract', async (_, { selector, attribute, pageId }) => browserCtl?.extract(selector, attribute, pageId));
ipcMain.handle('browser:evaluate', async (_, { code, pageId }) => browserCtl?.evaluate(code, pageId));
ipcMain.handle('browser:waitFor', async (_, { selector, timeout, pageId }) => browserCtl?.waitFor(selector, timeout, pageId));
ipcMain.handle('browser:scroll', async (_, { direction, amount, pageId }) => browserCtl?.scroll(direction, amount, pageId));
ipcMain.handle('browser:fillForm', async (_, { fields, pageId }) => browserCtl?.fillForm(fields, pageId));
ipcMain.handle('browser:select', async (_, { selector, value, pageId }) => browserCtl?.select(selector, value, pageId));
ipcMain.handle('browser:back', async (_, pageId) => browserCtl?.goBack(pageId));
ipcMain.handle('browser:forward', async (_, pageId) => browserCtl?.goForward(pageId));
ipcMain.handle('browser:reload', async (_, pageId) => browserCtl?.reload(pageId));
ipcMain.handle('browser:newTab', async (_, url) => browserCtl?.newTab(url));
ipcMain.handle('browser:closeTab', async (_, pageId) => browserCtl?.closeTab(pageId));
ipcMain.handle('browser:listTabs', async () => browserCtl?.listTabs());
ipcMain.handle('browser:switchTab', (_, pageId) => browserCtl?.switchTab(pageId));
ipcMain.handle('browser:cookies', async (_, pageId) => browserCtl?.getCookies(pageId));
ipcMain.handle('browser:info', () => browserCtl?.getInfo());

// ── Obsidian IPC Handlers ───────────────────────────────

ipcMain.handle('obsidian:getInfo', () => obsidian?.getInfo());
ipcMain.handle('obsidian:setVaultPath', async (_, vaultPath) => obsidian?.setVaultPath(vaultPath));
ipcMain.handle('obsidian:recordMessage', (_, { role, content, metadata }) => obsidian?.recordMessage(role, content, metadata));
ipcMain.handle('obsidian:recordProjectChange', async (_, { project, change }) => obsidian?.recordProjectChange(project, change));
ipcMain.handle('obsidian:recordAction', async (_, { action, details }) => obsidian?.recordAction(action, details));
ipcMain.handle('obsidian:flush', async () => obsidian?.flushConversation());
ipcMain.handle('obsidian:search', async (_, query) => obsidian?.searchVault(query));
ipcMain.handle('obsidian:listNotes', async (_, subdir) => obsidian?.listNotes(subdir));
ipcMain.handle('obsidian:readNote', async (_, notePath) => obsidian?.readNote(notePath));
ipcMain.handle('obsidian:createNote', async (_, { path: p, content }) => obsidian?.createNote(p, content));

// ── OpenRouter IPC Handlers ─────────────────────────────

ipcMain.handle('openrouter:getInfo', () => openrouter?.getInfo());
ipcMain.handle('openrouter:getModels', async (_, forceRefresh) => openrouter?.getModels(forceRefresh));
ipcMain.handle('openrouter:getCuratedModels', () => openrouter?.getCuratedModels());
ipcMain.handle('openrouter:chat', async (_, { messages, options }) => openrouter?.chat(messages, options));
ipcMain.handle('openrouter:chatStream', async (_, { messages, options }) => {
  let fullContent = '';
  await openrouter?.chatStream(messages, (chunk) => {
    if (chunk.content) {
      fullContent += chunk.content;
      mainWindow?.webContents.send('openrouter:chunk', chunk);
    }
    if (chunk.done) {
      mainWindow?.webContents.send('openrouter:chunk', { done: true });
    }
  }, options);
  return fullContent;
});
