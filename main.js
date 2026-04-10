require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const TelegramService = require('./telegram');

let mainWindow;
let telegram;

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

  // Initialize Telegram bot
  telegram = new TelegramService(mainWindow);
  await telegram.start();
});

app.on('window-all-closed', () => {
  if (telegram) telegram.destroy();
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
