import React, { useState, useEffect, useCallback } from 'react'
import TerminalPanel from './TerminalPanel'
import AIChat from './AIChat'
import MCPPanel from './MCPPanel'
import MCPServerPanel from './MCPServerPanel'

const GLASS_BORDER = 'var(--glass-border)'

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
]

const MODELS = {
  anthropic: [
    { value: 'claude-opus-4-6', label: 'claude-opus-4-6' },
    { value: 'claude-sonnet-4-5', label: 'claude-sonnet-4-5' },
    { value: 'claude-haiku-3-5', label: 'claude-haiku-3-5' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    { value: 'o1', label: 'o1' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
    { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
    { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
  ],
}

export default function AIHarness({ currentFile }) {
  const [config, setConfig] = useState(null)
  const [showSettings, setShowSettings] = useState(true)
  const [activeTab, setActiveTab] = useState('chat')
  const [keyDraft, setKeyDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentNoteContent, setCurrentNoteContent] = useState(null)

  // Load config on mount
  useEffect(() => {
    window.harnessConfig?.get().then(cfg => {
      setConfig(cfg)
      setKeyDraft(cfg?.apiKeys?.[cfg?.provider || 'anthropic'] || '')
    })
  }, [])

  // Load current note content when file changes
  useEffect(() => {
    if (!currentFile?.path) { setCurrentNoteContent(null); return }
    window.electronAPI?.readFile(currentFile.path).then(r => {
      if (r.success) setCurrentNoteContent(r.content)
    })
  }, [currentFile])

  const saveConfig = useCallback(async (patch) => {
    const next = { ...config, ...patch }
    setConfig(next)
    setSaving(true)
    await window.harnessConfig?.set(next)
    setSaving(false)
  }, [config])

  const handleProviderChange = (provider) => {
    const next = { ...config, provider, model: MODELS[provider][0].value }
    setConfig(next)
    setKeyDraft(next.apiKeys?.[provider] || '')
    window.harnessConfig?.set(next)
  }

  const handleModelChange = (model) => {
    saveConfig({ model })
  }

  const handleSaveKey = () => {
    const provider = config?.provider || 'anthropic'
    const next = { ...config, apiKeys: { ...(config?.apiKeys || {}), [provider]: keyDraft } }
    setConfig(next)
    window.harnessConfig?.set(next)
  }

  const handleServersChange = (mcpServers) => {
    saveConfig({ mcpServers })
  }

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</span>
      </div>
    )
  }

  const provider = config.provider || 'anthropic'
  const models = MODELS[provider] || []

  return (
    <div className="flex h-full overflow-hidden" style={{ color: 'var(--text-primary)' }}>
      {/* Settings sidebar */}
      {showSettings && (
        <div
          className="flex-shrink-0 overflow-y-auto flex flex-col"
          style={{
            width: 240,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRight: `1px solid ${GLASS_BORDER}`,
          }}
        >
          {/* Provider + model */}
          <div className="p-3 flex flex-col gap-3" style={{ borderBottom: `1px solid ${GLASS_BORDER}` }}>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#6b7280] uppercase tracking-wider font-semibold">Provider</label>
              <select
                value={provider}
                onChange={e => handleProviderChange(e.target.value)}
                className="w-full text-sm text-[#e2e4f0] bg-transparent px-2 py-1 rounded focus:outline-none"
                style={{ border: `1px solid ${GLASS_BORDER}`, background: 'rgba(0,0,0,0.2)' }}
              >
                {PROVIDERS.map(p => <option key={p.value} value={p.value} style={{ background: 'var(--option-bg)' }}>{p.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#6b7280] uppercase tracking-wider font-semibold">Model</label>
              <select
                value={config.model || models[0]?.value}
                onChange={e => handleModelChange(e.target.value)}
                className="w-full text-sm text-[#e2e4f0] bg-transparent px-2 py-1 rounded focus:outline-none"
                style={{ border: `1px solid ${GLASS_BORDER}`, background: 'rgba(0,0,0,0.2)' }}
              >
                {models.map(m => <option key={m.value} value={m.value} style={{ background: 'var(--option-bg)' }}>{m.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#6b7280] uppercase tracking-wider font-semibold">API Key</label>
              <div className="flex gap-1">
                <input
                  type="password"
                  value={keyDraft}
                  onChange={e => setKeyDraft(e.target.value)}
                  placeholder="sk-..."
                  className="flex-1 min-w-0 text-xs text-[#e2e4f0] bg-transparent px-2 py-1 rounded focus:outline-none"
                  style={{ border: `1px solid ${GLASS_BORDER}` }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'}
                  onBlur={e => e.currentTarget.style.borderColor = GLASS_BORDER}
                  onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                />
                <button
                  onClick={handleSaveKey}
                  className="text-xs px-2 py-1 rounded text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                >
                  Save
                </button>
              </div>
              {config.apiKeys?.[provider] && (
                <span className="text-xs text-[#a6e3a1]/60">Key saved</span>
              )}
            </div>
          </div>

          {/* MCP panel */}
          <div className="flex-1 overflow-y-auto">
            <MCPPanel
              servers={config.mcpServers || []}
              onServersChange={handleServersChange}
            />
          </div>

          {saving && (
            <div className="px-3 py-1 text-xs text-[#6b7280]/50 text-center" style={{ borderTop: `1px solid ${GLASS_BORDER}` }}>
              Saving...
            </div>
          )}
        </div>
      )}

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab bar */}
        <div
          className="flex items-center gap-1 px-3 py-1.5 flex-shrink-0"
          style={{ borderBottom: `1px solid ${GLASS_BORDER}` }}
        >
          <button
            onClick={() => setShowSettings(v => !v)}
            className="text-xs px-2 py-1 rounded mr-2 transition-all"
            style={showSettings
              ? { background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)' }
              : { color: '#6b7280', border: `1px solid ${GLASS_BORDER}` }
            }
            title="Toggle settings"
          >
            Settings
          </button>

          {[
            { id: 'chat', label: 'Chat' },
            { id: 'terminal', label: 'Terminal' },
            { id: 'server', label: 'MCP Server' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="text-sm px-3 py-1 rounded transition-all"
              style={activeTab === tab.id
                ? { background: 'rgba(124,58,237,0.18)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }
                : { color: '#6b7280', border: '1px solid transparent' }
              }
            >
              {tab.label}
            </button>
          ))}

          {currentFile && (
            <span className="ml-auto text-xs text-[#6b7280]/50 truncate max-w-[200px]" title={currentFile.path}>
              {currentFile.name}
            </span>
          )}
        </div>

        {/* Active panel — all panels stay mounted to preserve state */}
        <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
          <div className="absolute inset-0" style={{ display: activeTab === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>
            <AIChat
              config={config}
              currentNote={currentNoteContent}
            />
          </div>
          <div className="absolute inset-0" style={{ display: activeTab === 'terminal' ? 'flex' : 'none', flexDirection: 'column' }}>
            <TerminalPanel shell={null} />
          </div>
          <div className="absolute inset-0" style={{ display: activeTab === 'server' ? 'flex' : 'none', flexDirection: 'column' }}>
            <MCPServerPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
