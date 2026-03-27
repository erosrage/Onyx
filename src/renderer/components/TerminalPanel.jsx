import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'

const GLASS_BORDER = 'var(--glass-border)'

const XTERM_THEME = {
  background: '#00000000',
  foreground: '#e2e4f0',
  cursor: '#7c3aed',
  cursorAccent: '#0d0820',
  selectionBackground: 'rgba(124, 58, 237, 0.3)',
  black: '#1e1e2e', red: '#f38ba8', green: '#a6e3a1',
  yellow: '#f9e2af', blue: '#89b4fa', magenta: '#cba6f7',
  cyan: '#89dceb', white: '#cdd6f4',
  brightBlack: '#45475a', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#cba6f7',
  brightCyan: '#89dceb', brightWhite: '#ffffff',
}

// Individual terminal instance — stays mounted even when tab is hidden
const TerminalTab = forwardRef(function TerminalTab({ shell }, ref) {
  const containerRef = useRef(null)
  const fitAddonRef = useRef(null)
  const termRef = useRef(null)
  const termIdRef = useRef(null)
  const cleanupRef = useRef([])
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState(null)

  // Expose fit() so the parent can call it after making the tab visible
  useImperativeHandle(ref, () => ({
    fit: () => { try { fitAddonRef.current?.fit() } catch (e) {} }
  }))

  useEffect(() => {
    let cancelled = false

    async function initTerminal() {
      if (!window.terminalAPI) { setError('Terminal API not available'); setStatus('error'); return }
      try {
        const { Terminal } = await import('@xterm/xterm')
        const { FitAddon } = await import('@xterm/addon-fit')
        await import('@xterm/xterm/css/xterm.css')
        if (cancelled) return

        const term = new Terminal({
          theme: XTERM_THEME,
          fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
          fontSize: 13, lineHeight: 1.4, cursorBlink: true, allowTransparency: true, scrollback: 5000,
        })
        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(containerRef.current)
        fitAddon.fit()
        termRef.current = term
        fitAddonRef.current = fitAddon

        const result = await window.terminalAPI.create({ shell, cols: term.cols, rows: term.rows })
        if (cancelled) return
        if (result.error) { setError(result.error); setStatus('error'); return }

        termIdRef.current = result.id
        setStatus('connected')

        term.onData(data => window.terminalAPI.write(result.id, data))
        cleanupRef.current.push(
          window.terminalAPI.onData(result.id, data => term.write(data)),
          window.terminalAPI.onExit(result.id, () => {
            setStatus('exited')
            term.write('\r\n\x1b[33m[Process exited]\x1b[0m\r\n')
          })
        )

        const ro = new ResizeObserver(() => {
          try {
            fitAddon.fit()
            window.terminalAPI.resize(result.id, term.cols, term.rows)
          } catch (e) {}
        })
        ro.observe(containerRef.current)
        cleanupRef.current.push(() => ro.disconnect())
      } catch (e) {
        if (!cancelled) { setError(e.message); setStatus('error') }
      }
    }

    initTerminal()

    return () => {
      cancelled = true
      cleanupRef.current.forEach(fn => { try { fn() } catch (e) {} })
      cleanupRef.current = []
      if (termIdRef.current != null) { window.terminalAPI?.close(termIdRef.current); termIdRef.current = null }
      termRef.current?.dispose(); termRef.current = null
    }
  }, [shell])

  const handleKill = () => {
    if (termIdRef.current != null) { window.terminalAPI?.close(termIdRef.current); termIdRef.current = null }
    setStatus('exited')
  }

  const statusColor = { connected: '#a6e3a1', error: '#f38ba8', exited: '#f9e2af', connecting: '#89b4fa' }[status] || '#89b4fa'

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(0,0,0,0.15)' }}>
      {/* Per-tab status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0" style={{ borderBottom: `1px solid ${GLASS_BORDER}` }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#6b7280]">
            {shell || (typeof process !== 'undefined' && process.platform === 'win32' ? 'powershell' : 'shell')}
          </span>
          <span className="flex items-center gap-1 text-xs">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusColor }} />
            <span style={{ color: statusColor }}>{status}</span>
          </span>
        </div>
        {status !== 'exited' && (
          <button onClick={handleKill}
            className="text-xs text-[#6b7280] hover:text-[#f38ba8] transition-colors px-1.5 py-0.5 rounded"
            style={{ border: `1px solid ${GLASS_BORDER}` }} title="Kill terminal">Kill</button>
        )}
      </div>

      {/* xterm container */}
      <div className="flex-1 overflow-hidden relative">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 z-10">
            <span className="text-[#f38ba8] text-sm font-mono">{error}</span>
            <span className="text-[#6b7280] text-xs">node-pty may need to be rebuilt for this Electron version</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" style={{ padding: '8px 4px' }} />
      </div>
    </div>
  )
})

let _nextId = 1

export default function TerminalPanel({ shell }) {
  const [tabs, setTabs] = useState(() => [{ id: _nextId++, label: 'Terminal 1' }])
  const [activeTab, setActiveTab] = useState(tabs[0].id)
  const tabRefs = useRef({})

  const switchTab = useCallback((id) => {
    setActiveTab(id)
    // Fit after paint so the container has real dimensions
    setTimeout(() => tabRefs.current[id]?.fit(), 50)
  }, [])

  const addTab = useCallback(() => {
    const id = _nextId++
    const label = `Terminal ${id}`
    setTabs(prev => [...prev, { id, label }])
    setTimeout(() => switchTab(id), 10)
  }, [switchTab])

  const closeTab = useCallback((id, e) => {
    e.stopPropagation()
    setTabs(prev => {
      if (prev.length === 1) return prev  // never close the last tab
      const idx = prev.findIndex(t => t.id === id)
      const next = prev.filter(t => t.id !== id)
      // If closing active tab, activate the nearest remaining one
      setActiveTab(cur => {
        if (cur !== id) return cur
        const newActive = next[Math.min(idx, next.length - 1)].id
        setTimeout(() => tabRefs.current[newActive]?.fit(), 50)
        return newActive
      })
      return next
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0 overflow-x-auto"
        style={{ borderBottom: `1px solid ${GLASS_BORDER}`, background: 'var(--glass-bg)', minHeight: 32 }}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTab
          return (
            <div key={tab.id}
              onClick={() => switchTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer flex-shrink-0 select-none transition-all duration-100"
              style={{
                color: isActive ? '#c4b5fd' : 'var(--text-muted)',
                borderRight: `1px solid ${GLASS_BORDER}`,
                background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
                borderBottom: isActive ? '1px solid #7c3aed' : '1px solid transparent',
                marginBottom: isActive ? -1 : 0,
              }}
            >
              <span className="font-mono">{tab.label}</span>
              {tabs.length > 1 && (
                <button
                  onClick={e => closeTab(tab.id, e)}
                  className="w-3.5 h-3.5 flex items-center justify-center rounded text-[10px] leading-none transition-all duration-100"
                  style={{ color: 'var(--text-dim)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f38ba8'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                  title="Close tab"
                >×</button>
              )}
            </div>
          )
        })}
        {/* New tab button */}
        <button onClick={addTab}
          className="px-2.5 py-1.5 text-xs flex-shrink-0 transition-all duration-100"
          style={{ color: 'var(--text-dim)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.color = '#c4b5fd'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
          title="New terminal"
        >＋</button>
      </div>

      {/* Terminal instances — all mounted, only active one visible */}
      {tabs.map(tab => (
        <div key={tab.id} className="flex-1 min-h-0"
          style={{ display: tab.id === activeTab ? 'flex' : 'none', flexDirection: 'column' }}>
          <TerminalTab
            ref={el => { tabRefs.current[tab.id] = el }}
            shell={shell}
          />
        </div>
      ))}
    </div>
  )
}
