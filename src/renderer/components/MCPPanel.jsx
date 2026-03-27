import React, { useState, useEffect } from 'react'

const GLASS_BORDER = 'rgba(255, 255, 255, 0.07)'

function ServerRow({ server, onConnect, onDisconnect, onCallTool }) {
  const [expanded, setExpanded] = useState(false)
  const [toolInput, setToolInput] = useState({})
  const [toolResult, setToolResult] = useState({})
  const [calling, setCalling] = useState({})

  const statusColor = server.status === 'connected' ? '#a6e3a1' : server.status === 'connecting' ? '#89b4fa' : server.status === 'error' ? '#f38ba8' : '#6b7280'

  const handleCallTool = async (toolName) => {
    let args = {}
    const raw = toolInput[toolName] || '{}'
    try { args = JSON.parse(raw) } catch (e) {
      setToolResult(prev => ({ ...prev, [toolName]: { error: 'Invalid JSON: ' + e.message } }))
      return
    }
    setCalling(prev => ({ ...prev, [toolName]: true }))
    try {
      const result = await onCallTool(server.id, toolName, args)
      setToolResult(prev => ({ ...prev, [toolName]: result }))
    } catch (e) {
      setToolResult(prev => ({ ...prev, [toolName]: { error: e.message } }))
    } finally {
      setCalling(prev => ({ ...prev, [toolName]: false }))
    }
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${GLASS_BORDER}`, background: 'rgba(0,0,0,0.15)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer"
        onClick={() => server.status === 'connected' && setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} />
          <span className="text-sm text-[#e2e4f0] truncate font-medium">{server.name}</span>
          <span className="text-xs text-[#6b7280] truncate hidden sm:block">{server.command}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs" style={{ color: statusColor }}>{server.status}</span>
          {server.status === 'connected' ? (
            <button
              onClick={e => { e.stopPropagation(); onDisconnect(server.id) }}
              className="text-xs px-2 py-0.5 rounded text-[#f38ba8] transition-colors"
              style={{ border: '1px solid rgba(243,139,168,0.2)' }}
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onConnect(server) }}
              disabled={server.status === 'connecting'}
              className="text-xs px-2 py-0.5 rounded transition-all disabled:opacity-50"
              style={{ background: 'var(--accent-light)', color: 'var(--accent-text)', border: '1px solid var(--accent-glow)' }}
            >
              {server.status === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {expanded && server.status === 'connected' && server.tools && server.tools.length > 0 && (
        <div style={{ borderTop: `1px solid ${GLASS_BORDER}` }}>
          {server.tools.map(tool => (
            <div key={tool.name} className="px-3 py-2" style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <span className="text-xs font-mono" style={{ color: 'var(--accent-text)' }}>{tool.name}</span>
                  {tool.description && (
                    <p className="text-xs text-[#6b7280] mt-0.5">{tool.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleCallTool(tool.name)}
                  disabled={calling[tool.name]}
                  className="flex-shrink-0 text-xs px-2 py-0.5 rounded transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent-text)', border: '1px solid var(--accent-subtle)' }}
                >
                  {calling[tool.name] ? '...' : 'Call'}
                </button>
              </div>
              <textarea
                value={toolInput[tool.name] || '{}'}
                onChange={e => setToolInput(prev => ({ ...prev, [tool.name]: e.target.value }))}
                placeholder='{"key": "value"}'
                rows={2}
                className="w-full text-xs font-mono text-[#e2e4f0] bg-transparent resize-none focus:outline-none rounded px-2 py-1"
                style={{ border: `1px solid ${GLASS_BORDER}` }}
              />
              {toolResult[tool.name] && (
                <pre
                  className="text-xs font-mono mt-1 px-2 py-1.5 rounded overflow-x-auto whitespace-pre-wrap break-all"
                  style={{
                    background: toolResult[tool.name]?.error ? 'rgba(243,139,168,0.08)' : 'rgba(166,227,161,0.08)',
                    color: toolResult[tool.name]?.error ? '#f38ba8' : '#a6e3a1',
                    border: `1px solid ${toolResult[tool.name]?.error ? 'rgba(243,139,168,0.15)' : 'rgba(166,227,161,0.15)'}`,
                  }}
                >
                  {JSON.stringify(toolResult[tool.name], null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MCPPanel({ servers, onServersChange }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', command: '', args: '', env: '' })
  const [serverStatuses, setServerStatuses] = useState({})

  const mergedServers = (servers || []).map(s => ({
    ...s,
    status: serverStatuses[s.id]?.status || 'disconnected',
    tools: serverStatuses[s.id]?.tools || [],
  }))

  const handleConnect = async (server) => {
    setServerStatuses(prev => ({ ...prev, [server.id]: { status: 'connecting', tools: [] } }))

    const argsArr = server.args ? server.args.split(',').map(a => a.trim()).filter(Boolean) : []
    const envObj = {}
    if (server.env) {
      server.env.split('\n').forEach(line => {
        const idx = line.indexOf('=')
        if (idx > 0) envObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      })
    }

    const result = await window.mcpAPI.connect({
      id: server.id,
      command: server.command,
      args: argsArr,
      env: envObj,
    })

    if (result.error) {
      setServerStatuses(prev => ({ ...prev, [server.id]: { status: 'error', tools: [], error: result.error } }))
    } else {
      setServerStatuses(prev => ({ ...prev, [server.id]: { status: 'connected', tools: result.tools || [] } }))

      const removeExit = window.mcpAPI.onExit(server.id, () => {
        setServerStatuses(prev => ({ ...prev, [server.id]: { status: 'disconnected', tools: [] } }))
        removeExit()
      })
    }
  }

  const handleDisconnect = async (id) => {
    await window.mcpAPI.disconnect(id)
    setServerStatuses(prev => ({ ...prev, [id]: { status: 'disconnected', tools: [] } }))
  }

  const handleCallTool = async (serverId, toolName, args) => {
    return await window.mcpAPI.callTool({ id: serverId, name: toolName, arguments: args })
  }

  const handleAddServer = () => {
    if (!form.name.trim() || !form.command.trim()) return
    const newServer = {
      id: `mcp-${Date.now()}`,
      name: form.name.trim(),
      command: form.command.trim(),
      args: form.args.trim(),
      env: form.env.trim(),
    }
    onServersChange([...(servers || []), newServer])
    setForm({ name: '', command: '', args: '', env: '' })
    setShowAdd(false)
  }

  const handleRemoveServer = (id) => {
    if (serverStatuses[id]?.status === 'connected') {
      window.mcpAPI.disconnect(id)
    }
    onServersChange((servers || []).filter(s => s.id !== id))
    setServerStatuses(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">MCP Servers</span>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="text-xs px-2 py-0.5 rounded transition-all"
          style={{ background: 'var(--accent-light)', color: 'var(--accent-text)', border: '1px solid var(--accent-glow)' }}
        >
          + Add
        </button>
      </div>

      {showAdd && (
        <div
          className="rounded-lg p-3 flex flex-col gap-2"
          style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${GLASS_BORDER}` }}
        >
          {[
            { key: 'name', label: 'Name', placeholder: 'filesystem' },
            { key: 'command', label: 'Command', placeholder: 'npx' },
            { key: 'args', label: 'Args (comma-separated)', placeholder: '-y @modelcontextprotocol/server-filesystem,/path' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-[#6b7280] block mb-0.5">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full text-xs text-[#e2e4f0] bg-transparent px-2 py-1 rounded focus:outline-none"
                style={{ border: `1px solid ${GLASS_BORDER}` }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-light)'}
                onBlur={e => e.currentTarget.style.borderColor = GLASS_BORDER}
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-[#6b7280] block mb-0.5">Env vars (KEY=VALUE, one per line)</label>
            <textarea
              value={form.env}
              onChange={e => setForm(prev => ({ ...prev, env: e.target.value }))}
              placeholder="MY_KEY=value"
              rows={2}
              className="w-full text-xs font-mono text-[#e2e4f0] bg-transparent px-2 py-1 rounded resize-none focus:outline-none"
              style={{ border: `1px solid ${GLASS_BORDER}` }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-light)'}
              onBlur={e => e.currentTarget.style.borderColor = GLASS_BORDER}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAdd(false)}
              className="text-xs px-3 py-1 rounded text-[#6b7280] transition-colors"
              style={{ border: `1px solid ${GLASS_BORDER}` }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddServer}
              className="text-xs px-3 py-1 rounded text-white"
              style={{ background: 'var(--accent-gradient)' }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {mergedServers.length === 0 && (
          <p className="text-xs text-[#6b7280]/60 text-center py-4">No servers configured</p>
        )}
        {mergedServers.map(server => (
          <div key={server.id} className="relative group">
            <ServerRow
              server={server}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onCallTool={handleCallTool}
            />
            <button
              onClick={() => handleRemoveServer(server.id)}
              className="absolute top-1.5 right-[6.5rem] text-xs text-[#6b7280]/40 hover:text-[#f38ba8] opacity-0 group-hover:opacity-100 transition-all"
              title="Remove server"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
