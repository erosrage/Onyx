const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron')

// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
])
const path = require('path')
const fs = require('fs')
const fsPromises = require('fs').promises
const http = require('http')
const { randomUUID } = require('crypto')

const isDev = process.env.NODE_ENV === 'development'

let mainWindow
let activeVaultPath = null  // tracked for MCP server

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,   // allow file:// image URLs from renderer
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Serve local files via custom scheme to bypass cross-origin restrictions.
  // Decodes percent-encoded paths (e.g. spaces → %20) and reads directly via fs
  // so paths with spaces (OneDrive, etc.) work reliably on Windows.
  protocol.handle('local-file', async (request) => {
    let filePath = decodeURIComponent(request.url.slice('local-file://'.length))
    // Strip leading slash before Windows drive letter: /C:/path → C:/path
    if (/^\/[A-Za-z]:\//.test(filePath)) filePath = filePath.slice(1)
    try {
      const data = await fsPromises.readFile(filePath)
      const ext = path.extname(filePath).slice(1).toLowerCase().replace('jpg', 'jpeg')
      const mime = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext] || 'application/octet-stream'
      return new Response(data, { headers: { 'Content-Type': mime } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC Handlers ────────────────────────────────────────────────────────────

// Select vault directory
ipcMain.handle('vault:select', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Vault Folder',
    buttonLabel: 'Select Vault',
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// Read all .md files in vault (recursive)
ipcMain.handle('vault:read', async (_, vaultPath) => {
  activeVaultPath = vaultPath  // keep track for MCP server
  try {
    const files = []
    const folderSet = new Set()   // every subdirectory relative path

    function walk(dir, baseDir) {
      let entries
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
      catch (e) { return }  // skip unreadable dirs (permissions, etc.)
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          const relDir = path.relative(baseDir, fullPath).replace(/\\/g, '/')
          folderSet.add(relDir)
          walk(fullPath, baseDir)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const relDir = path.relative(baseDir, dir)
          const folder = (!relDir || relDir === '.') ? '' : relDir.replace(/\\/g, '/')
          files.push({
            name: entry.name.replace(/\.md$/, ''),
            fileName: entry.name,
            path: fullPath,
            relativePath: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
            folder,
          })
        }
      }
    }

    walk(vaultPath, vaultPath)
    files.sort((a, b) => a.name.localeCompare(b.name))
    return { success: true, files, folders: [...folderSet].sort() }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Read file content
ipcMain.handle('file:read', async (_, filePath) => {
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Write file content
ipcMain.handle('file:write', async (_, filePath, content) => {
  try {
    await fsPromises.writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Create new file
ipcMain.handle('file:create', async (_, filePath) => {
  try {
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true })
    await fsPromises.writeFile(filePath, '', { flag: 'wx' })
    return { success: true }
  } catch (err) {
    if (err.code === 'EEXIST') return { success: true }
    return { success: false, error: err.message }
  }
})

// Delete file
ipcMain.handle('file:delete', async (_, filePath) => {
  try {
    await fsPromises.unlink(filePath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Ensure folder exists (creates it if missing)
ipcMain.handle('folder:ensure', async (_, folderPath) => {
  try {
    await fsPromises.mkdir(folderPath, { recursive: true })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Delete folder recursively
ipcMain.handle('folder:delete', async (_, folderPath) => {
  try {
    await fsPromises.rm(folderPath, { recursive: true, force: true })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Rename/move file
ipcMain.handle('file:rename', async (_, oldPath, newPath) => {
  try {
    await fsPromises.rename(oldPath, newPath)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Save pasted image to vault assets folder
ipcMain.handle('file:save-image', async (_, { vaultPath, dataUrl, fileName }) => {
  try {
    const assetsDir = path.join(vaultPath, 'assets')
    await fsPromises.mkdir(assetsDir, { recursive: true })
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    const filePath = path.join(assetsDir, fileName)
    await fsPromises.writeFile(filePath, buffer)
    return { success: true, filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Read a local image file and return it as a base64 data URL (IPC avoids all browser cross-origin issues)
ipcMain.handle('file:read-as-dataurl', async (_, filePath) => {
  try {
    const data = await fsPromises.readFile(filePath)
    const ext = path.extname(filePath).slice(1).toLowerCase().replace('jpg', 'jpeg')
    const mime = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext] || 'image/png'
    return { success: true, dataUrl: `data:${mime};base64,${data.toString('base64')}` }
  } catch (err) {
    return { success: false }
  }
})

// Watch vault for changes
let watcher = null
ipcMain.handle('vault:watch', async (_, vaultPath) => {
  if (watcher) {
    watcher.close()
    watcher = null
  }
  try {
    watcher = fs.watch(vaultPath, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith('.md')) {
        mainWindow.webContents.send('vault:changed', { eventType, filename })
      }
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Stop watching
ipcMain.handle('vault:unwatch', async () => {
  if (watcher) {
    watcher.close()
    watcher = null
  }
  return { success: true }
})

// Show confirmation dialog
ipcMain.handle('dialog:confirm', async (_, message, detail) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Create', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    title: 'Create Note',
    message,
    detail,
  })
  return result.response === 0
})

// ─── Terminal (node-pty) ──────────────────────────────────────────────────────
let pty
try { pty = require('node-pty') } catch(e) { pty = null }

const terminals = new Map()
let termIdCounter = 0

ipcMain.handle('terminal:create', (_, opts = {}) => {
  if (!pty) return { error: 'node-pty not available' }
  const id = ++termIdCounter
  const shell = opts.shell || (process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash'))
  const term = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: opts.cols || 80,
    rows: opts.rows || 24,
    cwd: opts.cwd || process.env.USERPROFILE || process.env.HOME || process.cwd(),
    env: process.env,
  })
  term.onData(data => mainWindow.webContents.send(`terminal:data:${id}`, data))
  term.onExit(({ exitCode }) => mainWindow.webContents.send(`terminal:exit:${id}`, exitCode))
  terminals.set(id, term)
  return { id }
})

ipcMain.handle('terminal:write', (_, { id, data }) => {
  terminals.get(id)?.write(data)
  return { success: true }
})

ipcMain.handle('terminal:resize', (_, { id, cols, rows }) => {
  try { terminals.get(id)?.resize(cols, rows) } catch(e) {}
  return { success: true }
})

ipcMain.handle('terminal:close', (_, { id }) => {
  const t = terminals.get(id)
  if (t) { try { t.kill() } catch(e) {} terminals.delete(id) }
  return { success: true }
})

// ─── AI API (https) ───────────────────────────────────────────────────────────
const https = require('https')

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body)
    const req = https.request({ hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': buf.length }
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.write(buf)
    req.end()
  })
}

ipcMain.handle('ai:send', async (_, { provider, model, messages, apiKey, systemPrompt }) => {
  try {
    if (provider === 'anthropic') {
      const payload = { model: model || 'claude-opus-4-6', max_tokens: 8096, messages }
      if (systemPrompt) payload.system = systemPrompt
      const { status, body } = await httpsPost('api.anthropic.com', '/v1/messages',
        { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        JSON.stringify(payload)
      )
      const parsed = JSON.parse(body)
      if (parsed.error) return { error: parsed.error.message }
      return { content: parsed.content?.[0]?.text || '', usage: parsed.usage }
    } else if (provider === 'openai') {
      const payload = { model: model || 'gpt-4o', messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages }
      const { status, body } = await httpsPost('api.openai.com', '/v1/chat/completions',
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        JSON.stringify(payload)
      )
      const parsed = JSON.parse(body)
      if (parsed.error) return { error: parsed.error.message }
      return { content: parsed.choices?.[0]?.message?.content || '', usage: parsed.usage }
    } else if (provider === 'gemini') {
      const geminiModel = model || 'gemini-2.0-flash'
      const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      const payload = { contents }
      if (systemPrompt) payload.systemInstruction = { parts: [{ text: systemPrompt }] }
      const { status, body } = await httpsPost('generativelanguage.googleapis.com',
        `/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        { 'Content-Type': 'application/json' },
        JSON.stringify(payload)
      )
      const parsed = JSON.parse(body)
      if (parsed.error) return { error: parsed.error.message }
      return { content: parsed.candidates?.[0]?.content?.parts?.[0]?.text || '' }
    }
    return { error: 'Unknown provider: ' + provider }
  } catch(e) {
    return { error: e.message }
  }
})

// ─── Harness Config ───────────────────────────────────────────────────────────
const configFilePath = path.join(app.getPath('userData'), 'harness-config.json')

function loadHarnessConfig() {
  try { return JSON.parse(fs.readFileSync(configFilePath, 'utf-8')) }
  catch { return { apiKeys: {}, mcpServers: [], provider: 'anthropic', model: 'claude-opus-4-6' } }
}

ipcMain.handle('harness:getConfig', () => loadHarnessConfig())
ipcMain.handle('harness:setConfig', (_, config) => {
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8')
  return { success: true }
})

// ─── MCP Servers (stdio JSON-RPC) ────────────────────────────────────────────
const { spawn: spawnChild } = require('child_process')
const mcpServers = new Map()

ipcMain.handle('mcp:connect', async (_, { id, command, args, env: extraEnv }) => {
  try {
    const proc = spawnChild(command, args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...extraEnv },
      shell: process.platform === 'win32',
    })

    let buf = ''
    const pending = new Map()
    let reqId = 0

    proc.stdout.on('data', chunk => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop()
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          if (msg.id != null && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id)
            pending.delete(msg.id)
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)))
            else resolve(msg.result)
          } else if (msg.method) {
            mainWindow.webContents.send(`mcp:notification:${id}`, msg)
          }
        } catch(e) {}
      }
    })

    proc.stderr.on('data', d => mainWindow.webContents.send(`mcp:stderr:${id}`, d.toString()))
    proc.on('exit', code => { mcpServers.delete(id); mainWindow.webContents.send(`mcp:exit:${id}`, code) })

    const rpc = (method, params) => new Promise((resolve, reject) => {
      const id_ = ++reqId
      pending.set(id_, { resolve, reject })
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: id_, method, params }) + '\n')
      setTimeout(() => {
        if (pending.has(id_)) { pending.delete(id_); reject(new Error('MCP timeout')) }
      }, 15000)
    })

    mcpServers.set(id, { proc, rpc })

    await rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'ObsidianClone', version: '1.0.0' }
    })
    const toolsResult = await rpc('tools/list', {})
    return { success: true, tools: toolsResult.tools || [] }
  } catch(e) {
    return { error: e.message }
  }
})

ipcMain.handle('mcp:callTool', async (_, { id, name, arguments: args }) => {
  const server = mcpServers.get(id)
  if (!server) return { error: 'Server not connected' }
  try {
    return await server.rpc('tools/call', { name, arguments: args || {} })
  } catch(e) {
    return { error: e.message }
  }
})

ipcMain.handle('mcp:disconnect', (_, { id }) => {
  const s = mcpServers.get(id)
  if (s) { try { s.proc.kill() } catch(e) {} mcpServers.delete(id) }
  return { success: true }
})

// ─── Onyx MCP Server (SSE transport) ─────────────────────────────────────────
//
// External LLMs connect to:  GET  http://localhost:PORT/sse
// They send messages to:     POST http://localhost:PORT/message?sessionId=<id>
//
// Tools exposed: list_notes, read_note, write_note, create_note,
//                delete_note, search_notes
// ─────────────────────────────────────────────────────────────────────────────

let onyxHttpServer = null
const onyxSessions = new Map()  // sessionId -> SSE response

const ONYX_TOOLS = [
  {
    name: 'list_notes',
    description: 'List all notes in the currently open Onyx vault. Returns name and relative path for each note.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'read_note',
    description: 'Read the full Markdown content of a note by name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Note name without .md extension' },
      },
      required: ['name'],
    },
  },
  {
    name: 'write_note',
    description: 'Overwrite a note with new Markdown content (creates the file if it does not exist).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Note name without .md extension' },
        content: { type: 'string', description: 'Full Markdown content to write' },
      },
      required: ['name', 'content'],
    },
  },
  {
    name: 'create_note',
    description: 'Create a new note. Fails if the note already exists.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Note name without .md extension' },
        content: { type: 'string', description: 'Initial Markdown content (optional)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_note',
    description: 'Permanently delete a note from the vault.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Note name without .md extension' },
      },
      required: ['name'],
    },
  },
  {
    name: 'search_notes',
    description: 'Full-text search across all notes. Returns matching note names and context snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search string (case-insensitive)' },
      },
      required: ['query'],
    },
  },
]

// Sanitize note name to prevent directory traversal
function sanitizeNoteName(name) {
  return path.basename(name.replace(/\.\./g, ''))
}

async function onyxToolCall(toolName, args) {
  if (!activeVaultPath) {
    return { content: [{ type: 'text', text: 'Error: No vault is open in Onyx.' }], isError: true }
  }

  try {
    switch (toolName) {

      case 'list_notes': {
        const files = []
        function walk(dir) {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) walk(full)
            else if (entry.name.endsWith('.md')) {
              files.push({
                name: entry.name.replace(/\.md$/, ''),
                path: path.relative(activeVaultPath, full).replace(/\\/g, '/'),
              })
            }
          }
        }
        walk(activeVaultPath)
        files.sort((a, b) => a.name.localeCompare(b.name))
        return { content: [{ type: 'text', text: JSON.stringify(files, null, 2) }] }
      }

      case 'read_note': {
        const name = sanitizeNoteName(args.name)
        const notePath = path.join(activeVaultPath, name + '.md')
        const content = await fsPromises.readFile(notePath, 'utf-8')
        return { content: [{ type: 'text', text: content }] }
      }

      case 'write_note': {
        const name = sanitizeNoteName(args.name)
        const notePath = path.join(activeVaultPath, name + '.md')
        await fsPromises.writeFile(notePath, args.content, 'utf-8')
        // Notify renderer that vault changed
        mainWindow?.webContents.send('vault:changed', { eventType: 'change', filename: name + '.md' })
        return { content: [{ type: 'text', text: `Note "${name}" written (${args.content.length} chars).` }] }
      }

      case 'create_note': {
        const name = sanitizeNoteName(args.name)
        const notePath = path.join(activeVaultPath, name + '.md')
        await fsPromises.writeFile(notePath, args.content || '', { flag: 'wx' })
        mainWindow?.webContents.send('vault:changed', { eventType: 'rename', filename: name + '.md' })
        return { content: [{ type: 'text', text: `Note "${name}" created.` }] }
      }

      case 'delete_note': {
        const name = sanitizeNoteName(args.name)
        const notePath = path.join(activeVaultPath, name + '.md')
        await fsPromises.unlink(notePath)
        mainWindow?.webContents.send('vault:changed', { eventType: 'rename', filename: name + '.md' })
        return { content: [{ type: 'text', text: `Note "${name}" deleted.` }] }
      }

      case 'search_notes': {
        const query = (args.query || '').toLowerCase()
        const results = []
        function walkSearch(dir) {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) walkSearch(full)
            else if (entry.name.endsWith('.md')) {
              const name = entry.name.replace(/\.md$/, '')
              const text = fs.readFileSync(full, 'utf-8')
              if (name.toLowerCase().includes(query) || text.toLowerCase().includes(query)) {
                const idx = text.toLowerCase().indexOf(query)
                const snippet = idx >= 0
                  ? '…' + text.slice(Math.max(0, idx - 60), idx + 120).replace(/\s+/g, ' ').trim() + '…'
                  : ''
                results.push({ name, snippet })
              }
            }
          }
        }
        walkSearch(activeVaultPath)
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true }
    }
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }
  }
}

function sseSend(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) } catch(e) {}
}

async function handleOnyxMcpRequest(req, res) {
  // CORS — allow any LLM client
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://localhost`)

  // ── Health / discovery ──────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      name: 'Onyx',
      version: '1.0.0',
      description: 'Onyx local knowledge base MCP server',
      vault: activeVaultPath || null,
    }))
    return
  }

  // ── SSE endpoint (client connects here) ────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/sse') {
    const sessionId = randomUUID()
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    // Tell client where to POST messages
    res.write(`event: endpoint\ndata: "/message?sessionId=${sessionId}"\n\n`)

    onyxSessions.set(sessionId, res)
    mainWindow?.webContents.send('onyx-server:client-event', {
      type: 'connect', sessionId, count: onyxSessions.size,
    })

    req.on('close', () => {
      onyxSessions.delete(sessionId)
      mainWindow?.webContents.send('onyx-server:client-event', {
        type: 'disconnect', sessionId, count: onyxSessions.size,
      })
    })
    return
  }

  // ── Message endpoint (client sends JSON-RPC here) ───────────────────────
  if (req.method === 'POST' && url.pathname === '/message') {
    const sessionId = url.searchParams.get('sessionId')
    const sseRes = onyxSessions.get(sessionId)
    if (!sseRes) { res.writeHead(404); res.end('Session not found'); return }

    let body = ''
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy() })
    req.on('end', async () => {
      try {
        const msg = JSON.parse(body)
        const reply = await handleMcpJsonRpc(msg)
        if (reply !== null) sseSend(sseRes, 'message', reply)
        res.writeHead(202); res.end()
      } catch(e) {
        res.writeHead(400); res.end(e.message)
      }
    })
    return
  }

  res.writeHead(404); res.end('Not found')
}

async function handleMcpJsonRpc(msg) {
  const { jsonrpc, id, method, params } = msg

  if (method === 'initialize') {
    return { jsonrpc: '2.0', id, result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'Onyx', version: '1.0.0' },
    }}
  }
  if (method === 'notifications/initialized') return null
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: ONYX_TOOLS } }
  }

  if (method === 'tools/call') {
    const result = await onyxToolCall(params?.name, params?.arguments || {})
    return { jsonrpc: '2.0', id, result }
  }

  return { jsonrpc: '2.0', id,
    error: { code: -32601, message: `Method not found: ${method}` } }
}

ipcMain.handle('onyx-server:start', (_, { port }) => {
  if (onyxHttpServer?.listening) return { error: 'Server already running' }
  return new Promise(resolve => {
    onyxHttpServer = http.createServer(handleOnyxMcpRequest)
    onyxHttpServer.listen(port, '127.0.0.1', () =>
      resolve({ success: true, port: onyxHttpServer.address().port })
    )
    onyxHttpServer.on('error', err => resolve({ error: err.message }))
  })
})

ipcMain.handle('onyx-server:stop', () => {
  return new Promise(resolve => {
    if (!onyxHttpServer?.listening) { resolve({ success: true }); return }
    onyxSessions.forEach(r => { try { r.end() } catch(e) {} })
    onyxSessions.clear()
    onyxHttpServer.close(() => { onyxHttpServer = null; resolve({ success: true }) })
  })
})

ipcMain.handle('onyx-server:status', () => ({
  running: !!onyxHttpServer?.listening,
  port: onyxHttpServer?.address()?.port ?? null,
  clients: onyxSessions.size,
  vault: activeVaultPath,
}))
