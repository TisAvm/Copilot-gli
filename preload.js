const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gli', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // File system
  fs: {
    readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    getHome: () => ipcRenderer.invoke('fs:getHome'),
  },

  // Terminal
  terminal: {
    execute: (command) => ipcRenderer.invoke('terminal:execute', command),
    spawn: (opts) => ipcRenderer.invoke('terminal:spawn', opts),
    kill: (id) => ipcRenderer.invoke('terminal:kill', id),
    onData: (callback) => {
      ipcRenderer.on('terminal:data', (_, data) => callback(data));
    },
    onExit: (callback) => {
      ipcRenderer.on('terminal:exit', (_, data) => callback(data));
    },
  },

  // Shell
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },

  // Telegram
  telegram: {
    getInfo: () => ipcRenderer.invoke('telegram:getInfo'),
    sendReply: (chatId, text, replyToMessageId) =>
      ipcRenderer.invoke('telegram:sendReply', { chatId, text, replyToMessageId }),
    sendToGroup: (text) => ipcRenderer.invoke('telegram:sendToGroup', text),
    reconnect: () => ipcRenderer.invoke('telegram:reconnect'),
    onMessage: (callback) => {
      ipcRenderer.on('telegram:message', (_, data) => callback(data));
    },
    onAIResponse: (callback) => {
      ipcRenderer.on('telegram:ai-response', (_, data) => callback(data));
    },
    onStatus: (callback) => {
      ipcRenderer.on('telegram:status', (_, data) => callback(data));
    },
    onCommand: (callback) => {
      ipcRenderer.on('telegram:command', (_, data) => callback(data));
    },
    // Background Agents
    createAgent: (name, task, options) =>
      ipcRenderer.invoke('telegram:createAgent', { name, task, options }),
    stopAgent: (agentId) => ipcRenderer.invoke('telegram:stopAgent', agentId),
    listAgents: () => ipcRenderer.invoke('telegram:listAgents'),
    onAgentUpdate: (callback) => {
      ipcRenderer.on('telegram:agentUpdate', (_, data) => callback(data));
    },
  },

  // System Control
  system: {
    quickInfo: () => ipcRenderer.invoke('system:quickInfo'),
    detailedInfo: () => ipcRenderer.invoke('system:detailedInfo'),
    processes: () => ipcRenderer.invoke('system:processes'),
    killProcess: (pid) => ipcRenderer.invoke('system:killProcess', pid),
    launchApp: (appPath, args) => ipcRenderer.invoke('system:launchApp', { appPath, args }),
    openUrl: (url) => ipcRenderer.invoke('system:openUrl', url),
    openPath: (p) => ipcRenderer.invoke('system:openPath', p),
    showInFolder: (p) => ipcRenderer.invoke('system:showInFolder', p),
    installedApps: () => ipcRenderer.invoke('system:installedApps'),
    clipboard: () => ipcRenderer.invoke('system:clipboard'),
    clipboardWrite: (text) => ipcRenderer.invoke('system:clipboardWrite', text),
    clipboardClear: () => ipcRenderer.invoke('system:clipboardClear'),
    screenshot: () => ipcRenderer.invoke('system:screenshot'),
    windowScreenshot: () => ipcRenderer.invoke('system:windowScreenshot'),
    power: (action) => ipcRenderer.invoke('system:power', action),
    cancelShutdown: () => ipcRenderer.invoke('system:cancelShutdown'),
    fileCreate: (path, content) => ipcRenderer.invoke('system:fileCreate', { path, content }),
    fileDelete: (p) => ipcRenderer.invoke('system:fileDelete', p),
    fileRename: (oldPath, newPath) => ipcRenderer.invoke('system:fileRename', { oldPath, newPath }),
    fileCopy: (src, dest) => ipcRenderer.invoke('system:fileCopy', { src, dest }),
    fileInfo: (p) => ipcRenderer.invoke('system:fileInfo', p),
    volume: (level) => ipcRenderer.invoke('system:volume', level),
    mute: () => ipcRenderer.invoke('system:mute'),
    displays: () => ipcRenderer.invoke('system:displays'),
    wifi: () => ipcRenderer.invoke('system:wifi'),
    runElevated: (cmd) => ipcRenderer.invoke('system:runElevated', cmd),
    onNotification: (callback) => {
      ipcRenderer.on('system:notification', (_, data) => callback(data));
    },
  },

  // Browser Control
  browser: {
    launch: (opts) => ipcRenderer.invoke('browser:launch', opts),
    close: () => ipcRenderer.invoke('browser:close'),
    navigate: (url, pageId) => ipcRenderer.invoke('browser:navigate', { url, pageId }),
    click: (selector, pageId) => ipcRenderer.invoke('browser:click', { selector, pageId }),
    type: (selector, text, options, pageId) => ipcRenderer.invoke('browser:type', { selector, text, options, pageId }),
    pressKey: (key, pageId) => ipcRenderer.invoke('browser:pressKey', { key, pageId }),
    screenshot: (options, pageId) => ipcRenderer.invoke('browser:screenshot', { options, pageId }),
    content: (pageId) => ipcRenderer.invoke('browser:content', pageId),
    extract: (selector, attribute, pageId) => ipcRenderer.invoke('browser:extract', { selector, attribute, pageId }),
    evaluate: (code, pageId) => ipcRenderer.invoke('browser:evaluate', { code, pageId }),
    waitFor: (selector, timeout, pageId) => ipcRenderer.invoke('browser:waitFor', { selector, timeout, pageId }),
    scroll: (direction, amount, pageId) => ipcRenderer.invoke('browser:scroll', { direction, amount, pageId }),
    fillForm: (fields, pageId) => ipcRenderer.invoke('browser:fillForm', { fields, pageId }),
    select: (selector, value, pageId) => ipcRenderer.invoke('browser:select', { selector, value, pageId }),
    back: (pageId) => ipcRenderer.invoke('browser:back', pageId),
    forward: (pageId) => ipcRenderer.invoke('browser:forward', pageId),
    reload: (pageId) => ipcRenderer.invoke('browser:reload', pageId),
    newTab: (url) => ipcRenderer.invoke('browser:newTab', url),
    closeTab: (pageId) => ipcRenderer.invoke('browser:closeTab', pageId),
    listTabs: () => ipcRenderer.invoke('browser:listTabs'),
    switchTab: (pageId) => ipcRenderer.invoke('browser:switchTab', pageId),
    cookies: (pageId) => ipcRenderer.invoke('browser:cookies', pageId),
    info: () => ipcRenderer.invoke('browser:info'),
    onStatus: (callback) => {
      ipcRenderer.on('browser:status', (_, data) => callback(data));
    },
  },

  // Obsidian Vault
  obsidian: {
    getInfo: () => ipcRenderer.invoke('obsidian:getInfo'),
    setVaultPath: (vaultPath) => ipcRenderer.invoke('obsidian:setVaultPath', vaultPath),
    recordMessage: (role, content, metadata) =>
      ipcRenderer.invoke('obsidian:recordMessage', { role, content, metadata }),
    recordProjectChange: (project, change) =>
      ipcRenderer.invoke('obsidian:recordProjectChange', { project, change }),
    recordAction: (action, details) =>
      ipcRenderer.invoke('obsidian:recordAction', { action, details }),
    flush: () => ipcRenderer.invoke('obsidian:flush'),
    search: (query) => ipcRenderer.invoke('obsidian:search', query),
    listNotes: (subdir) => ipcRenderer.invoke('obsidian:listNotes', subdir),
    readNote: (notePath) => ipcRenderer.invoke('obsidian:readNote', notePath),
    createNote: (notePath, content) =>
      ipcRenderer.invoke('obsidian:createNote', { path: notePath, content }),
    onStatus: (callback) => {
      ipcRenderer.on('obsidian:status', (_, data) => callback(data));
    },
  },

  // OpenRouter AI
  openrouter: {
    getInfo: () => ipcRenderer.invoke('openrouter:getInfo'),
    getModels: (forceRefresh) => ipcRenderer.invoke('openrouter:getModels', forceRefresh),
    getCuratedModels: () => ipcRenderer.invoke('openrouter:getCuratedModels'),
    chat: (messages, options) => ipcRenderer.invoke('openrouter:chat', { messages, options }),
    chatStream: (messages, options) => ipcRenderer.invoke('openrouter:chatStream', { messages, options }),
    onChunk: (callback) => {
      ipcRenderer.on('openrouter:chunk', (_, data) => callback(data));
    },
  },
});
