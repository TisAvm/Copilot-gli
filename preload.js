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
    onStatus: (callback) => {
      ipcRenderer.on('telegram:status', (_, data) => callback(data));
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
});
