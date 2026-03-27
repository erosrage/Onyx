import React, { useState, useEffect, useCallback, useRef } from 'react'

const TOOLS = [
  { name: 'list_notes',   desc: 'List all notes in the vault' },
  { name: 'read_note',    desc: 'Read a note by name' },
  { name: 'write_note',   desc: 'Write/overwrite a note' },
  { name: 'create_note',  desc: 'Create a new note (fails if exists)' },
  { name: 'delete_note',  desc: 'Delete a note permanently' },
  { name: 'search_notes', desc: 'Full-text search across all notes' },
]

const DEFAULT_PORT = 3282

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      className="text-xs px-2 py-0.5 rounded transition-all flex-shrink-0"
      style={{
        background: copied ? 'var(--accent-glow)' : 'var(--glass-bg-strong)',
        color: copied ? 'var(--accent-text)' : 'var(--text-muted)',
        border: '1px solid var(--glass-border)',
      }}
    >
      {copied ? '✓' : label || 'Copy'}
    </button>
  )
}

function CodeLine({ children }) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-md font-mono text-xs"
      style={{ background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)' }}
    >
      <span className="truncate" style={{ color: 'var(--text-primary)' }}>{children}</span>
      <CopyButton text={String(children)} />
    </div>
  )
}

export default function MCPServerPanel() {
  const [port, setPort] = useState(DEFAULT_PORT)
  const [portInput, setPortInput] = useState(String(DEFAULT_PORT))
  const [running, setRunning] = useState(false)
  const [clients, setClients] = useState(0)
  const [vault, setVault] = useState(null)
  const [log, setLog] = useState([])
  const [starting, setStarting] = useState(false)
  const logRef = useRef(null)

  const addLog = useCallback((msg, type = 'info') => {
    setLog(l => [...l.slice(-49), { msg, type, ts: new Date().toLocaleTimeString() }])
  }, [])

  // Poll status every 2s
  useEffect(() => {
    const tick = async () => {
      if (!window.onyxServerAPI) return
      const s = await window.onyxServerAPI.status()
      setRunning(s.running)
      setClients(s.clients)
      setVault(s.vault)
      if (s.running && s.port) setPort(s.port)
    }
    tick()
    const iv = setInterval(tick, 2000)
    return () => clearInterval(iv)
  }, [])

  // Listen for client connect/disconnect events
  useEffect(() => {
    if (!window.onyxServerAPI) return
    const off = window.onyxServerAPI.onClientEvent(evt => {
      if (evt.type === 'connect') {
        addLog(`Client connected (${evt.count} total)`, 'success')
        setClients(evt.count)
      } else {
        addLog(`Client disconnected (${evt.count} remaining)`, 'warn')
        setClients(evt.count)
      }
    })
    return off
  }, [addLog])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const handleStart = async () => {
    const p = parseInt(portInput, 10)
    if (!p || p < 1024 || p > 65535) {
      addLog('Invalid port (must be 1024–65535)', 'error')
      return
    }
    setStarting(true)
    const result = await window.onyxServerAPI.start(p)
    setStarting(false)
    if (result.error) {
      addLog(`Failed to start: ${result.error}`, 'error')
    } else {
      setRunning(true)
      setPort(result.port)
      addLog(`MCP server started on port ${result.port}`, 'success')
    }
  }

  const handleStop = async () => {
    await window.onyxServerAPI.stop()
    setRunning(false)
    setClients(0)
    addLog('MCP server stopped', 'warn')
  }

  const sseUrl = `http://127.0.0.1:${port}/sse`
  const claudeCmd = `claude mcp add onyx --sse ${sseUrl}`
  const cursorJson = JSON.stringify({ mcpServers: { onyx: { url: sseUrl } } }, null, 2)
  const configJson = JSON.stringify({ mcpServers: { onyx: { type: 'sse', url: sseUrl } } }, null, 2)

  const logColor = { info: 'var(--text-muted)', success: '#4ade80', warn: '#fbbf24', error: '#f87171' }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">Onyx MCP Server</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-mono"
            style={{
              background: running ? 'rgba(74,222,128,0.12)' : 'var(--glass-bg-strong)',
              color: running ? '#4ade80' : 'var(--text-muted)',
              border: `1px solid ${running ? 'rgba(74,222,128,0.25)' : 'var(--glass-border)'}`,
            }}
          >
            {running ? `● running :${port}` : '○ stopped'}
          </span>
          {running && clients > 0 && (
            <span className="text-[10px] font-mono" style={{ color: 'var(--accent-text)' }}>
              {clients} client{clients !== 1 ? 's' : ''} connected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!running && (
            <input
              type="number"
              value={portInput}
              onChange={e => setPortInput(e.target.value)}
              className="w-20 text-xs text-center px-2 py-1 rounded-md font-mono focus:outline-none"
              style={{
                background: 'var(--input-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-light)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
              min={1024} max={65535}
              disabled={running}
            />
          )}
          <button
            onClick={running ? handleStop : handleStart}
            disabled={starting}
            className="text-xs px-3 py-1.5 rounded-md font-medium text-white transition-all"
            style={{
              background: running
                ? 'rgba(248,113,113,0.15)'
                : starting
                  ? 'var(--accent-glow)'
                  : 'var(--accent-gradient)',
              border: running ? '1px solid rgba(248,113,113,0.3)' : 'none',
              color: running ? '#f87171' : '#fff',
              boxShadow: running ? 'none' : '0 2px 8px var(--accent-glow)',
            }}
          >
            {starting ? 'Starting…' : running ? 'Stop Server' : 'Start Server'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {/* Vault status */}
        {!vault && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
          >
            ⚠ No vault open — open a vault in Onyx first so the server can access notes
          </div>
        )}

        {/* Connection info */}
        {running && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              Connect your LLM
            </p>
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Claude Code</p>
                <CodeLine>{claudeCmd}</CodeLine>
              </div>
              <div>
                <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>SSE endpoint (Cursor / generic)</p>
                <CodeLine>{sseUrl}</CodeLine>
              </div>
              <div>
                <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>mcp.json / claude_desktop_config.json</p>
                <div
                  className="relative rounded-md p-3 font-mono text-xs leading-relaxed"
                  style={{ background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                >
                  <pre className="whitespace-pre-wrap break-all">{configJson}</pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={configJson} label="Copy JSON" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Exposed tools */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
            Exposed Tools ({TOOLS.length})
          </p>
          <div className="flex flex-col gap-1">
            {TOOLS.map(t => (
              <div
                key={t.name}
                className="flex items-start gap-3 px-3 py-2 rounded-md"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
              >
                <span className="font-mono text-xs pt-px flex-shrink-0" style={{ color: 'var(--accent-text)' }}>{t.name}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Activity log */}
        <section className="flex flex-col gap-1 flex-1 min-h-0">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
            Activity Log
          </p>
          <div
            ref={logRef}
            className="rounded-md p-2 overflow-y-auto font-mono text-[11px] leading-relaxed flex-1"
            style={{
              background: 'var(--glass-bg-strong)',
              border: '1px solid var(--glass-border)',
              minHeight: 80,
              maxHeight: 160,
            }}
          >
            {log.length === 0 ? (
              <span style={{ color: 'var(--text-dim)' }}>No activity yet…</span>
            ) : (
              log.map((entry, i) => (
                <div key={i} style={{ color: logColor[entry.type] || logColor.info }}>
                  <span style={{ color: 'var(--text-dim)', marginRight: 8 }}>{entry.ts}</span>
                  {entry.msg}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
