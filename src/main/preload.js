const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Vault operations
  selectVault: () => ipcRenderer.invoke('vault:select'),
  readVault: (vaultPath) => ipcRenderer.invoke('vault:read', vaultPath),
  watchVault: (vaultPath) => ipcRenderer.invoke('vault:watch', vaultPath),
  unwatchVault: () => ipcRenderer.invoke('vault:unwatch'),
  onVaultChanged: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('vault:changed', handler)
    return () => ipcRenderer.removeListener('vault:changed', handler)
  },

  // File operations
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
  createFile: (filePath) => ipcRenderer.invoke('file:create', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('file:rename', oldPath, newPath),
  saveImage: (vaultPath, dataUrl, fileName) => ipcRenderer.invoke('file:save-image', { vaultPath, dataUrl, fileName }),
  readImageAsDataUrl: (filePath) => ipcRenderer.invoke('file:read-as-dataurl', filePath),

  // Dialog
  confirmDialog: (message, detail) => ipcRenderer.invoke('dialog:confirm', message, detail),
})

contextBridge.exposeInMainWorld('terminalAPI', {
  create: (opts) => ipcRenderer.invoke('terminal:create', opts),
  write: (id, data) => ipcRenderer.invoke('terminal:write', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
  close: (id) => ipcRenderer.invoke('terminal:close', { id }),
  onData: (id, cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on(`terminal:data:${id}`, h)
    return () => ipcRenderer.removeListener(`terminal:data:${id}`, h)
  },
  onExit: (id, cb) => {
    const h = (_, c) => cb(c)
    ipcRenderer.on(`terminal:exit:${id}`, h)
    return () => ipcRenderer.removeListener(`terminal:exit:${id}`, h)
  },
})

contextBridge.exposeInMainWorld('aiAPI', {
  send: (params) => ipcRenderer.invoke('ai:send', params),
})

contextBridge.exposeInMainWorld('harnessConfig', {
  get: () => ipcRenderer.invoke('harness:getConfig'),
  set: (cfg) => ipcRenderer.invoke('harness:setConfig', cfg),
})

contextBridge.exposeInMainWorld('onyxServerAPI', {
  start: (port) => ipcRenderer.invoke('onyx-server:start', { port }),
  stop: () => ipcRenderer.invoke('onyx-server:stop'),
  status: () => ipcRenderer.invoke('onyx-server:status'),
  onClientEvent: (cb) => {
    const h = (_, evt) => cb(evt)
    ipcRenderer.on('onyx-server:client-event', h)
    return () => ipcRenderer.removeListener('onyx-server:client-event', h)
  },
})

contextBridge.exposeInMainWorld('mcpAPI', {
  connect: (params) => ipcRenderer.invoke('mcp:connect', params),
  callTool: (params) => ipcRenderer.invoke('mcp:callTool', params),
  disconnect: (id) => ipcRenderer.invoke('mcp:disconnect', { id }),
  onNotification: (id, cb) => {
    const h = (_, msg) => cb(msg)
    ipcRenderer.on(`mcp:notification:${id}`, h)
    return () => ipcRenderer.removeListener(`mcp:notification:${id}`, h)
  },
  onStderr: (id, cb) => {
    const h = (_, d) => cb(d)
    ipcRenderer.on(`mcp:stderr:${id}`, h)
    return () => ipcRenderer.removeListener(`mcp:stderr:${id}`, h)
  },
  onExit: (id, cb) => {
    const h = (_, c) => cb(c)
    ipcRenderer.on(`mcp:exit:${id}`, h)
    return () => ipcRenderer.removeListener(`mcp:exit:${id}`, h)
  },
})
