import React, { useState } from 'react'

const IcSun     = () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
const IcMoon    = () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
const IcPalette = () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="12" cy="9" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/></svg>
const IcSpace   = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.35"/></svg>
const IcFolder  = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
const IcPlus    = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IcBack    = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>

const CUSTOM_THEMES = [
  { id: 'forest',  label: 'Forest',  bg: '#060e08', accent: '#22c55e' },
  { id: 'ocean',   label: 'Ocean',   bg: '#010b18', accent: '#0ea5e9' },
  { id: 'rose',    label: 'Rose',    bg: '#180610', accent: '#f43f5e' },
  { id: 'amber',   label: 'Amber',   bg: '#14100a', accent: '#f59e0b' },
  { id: 'nord',    label: 'Nord',    bg: '#242933', accent: '#88c0d0' },
  { id: 'sage',    label: 'Sage',    bg: '#f0f4f1', accent: '#16a34a' },
  { id: 'rosebud', label: 'Rosebud', bg: '#fdf2f4', accent: '#e11d48' },
  { id: 'sand',    label: 'Sand',    bg: '#faf5ec', accent: '#b45309' },
]
const CUSTOM_THEME_IDS = new Set(CUSTOM_THEMES.map(t => t.id))

const OnyxMark = () => (
  <svg viewBox="0 0 56 56" width="48" height="48" fill="none">
    <polygon points="28,4 52,18 52,38 28,52 4,38 4,18"
      fill="rgba(124,58,237,0.10)" stroke="rgba(124,58,237,0.40)" strokeWidth="1.5"/>
    <polygon points="28,13 44,22 44,34 28,43 12,34 12,22"
      fill="rgba(124,58,237,0.18)" stroke="rgba(124,58,237,0.55)" strokeWidth="1.5"/>
    <circle cx="28" cy="28" r="7" fill="var(--accent)" opacity="0.9"/>
    <circle cx="28" cy="28" r="3.5" fill="var(--accent-text)"/>
  </svg>
)

export default function VaultPicker({ theme, onSetTheme, spaceGroups = [], onAddSpaceGroup, onSelectSpace, onCreateSpace }) {
  const [step, setStep] = useState('groups') // 'groups' | 'spaces'
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [spaces, setSpaces] = useState([])
  const [loadingSpaces, setLoadingSpaces] = useState(false)
  const [showNewSpace, setShowNewSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [showThemePicker, setShowThemePicker] = useState(false)
  const isCustom = CUSTOM_THEME_IDS.has(theme)

  const openGroup = async (group) => {
    setSelectedGroup(group)
    setLoadingSpaces(true)
    setStep('spaces')
    const result = await window.electronAPI.listSpaces(group.path)
    setSpaces(result.spaces || [])
    setLoadingSpaces(false)
  }

  const handleCreateSpace = async (e) => {
    e.preventDefault()
    const name = newSpaceName.trim()
    if (!name) return
    await onCreateSpace(selectedGroup.path, name)
    setNewSpaceName('')
    setShowNewSpace(false)
  }

  const goBack = () => {
    setStep('groups')
    setSpaces([])
    setShowNewSpace(false)
    setNewSpaceName('')
  }

  const hasGroups = spaceGroups.length > 0

  return (
    <div className="flex h-full w-full items-center justify-center relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'var(--orb-primary)' }}/>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] pointer-events-none"
        style={{ background: 'var(--orb-secondary)' }}/>

      {/* Theme toggle — top right */}
      <div className="absolute top-4 right-4" style={{ zIndex: 20 }}>
        <div className="flex p-0.5 rounded-lg"
          style={{ background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(8px)' }}
        >
          {[{t:'dark',ic:<IcMoon/>},{t:'light',ic:<IcSun/>}].map(({t,ic})=>(
            <button key={t} onClick={() => { onSetTheme(t); setShowThemePicker(false) }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium tracking-wide transition-all duration-150 capitalize"
              style={theme===t
                ? {background:'var(--accent-gradient)',color:'#fff',boxShadow:'0 1px 4px var(--accent-glow)'}
                : {color:'var(--text-muted)'}}
              onMouseEnter={e=>{if(theme!==t)e.currentTarget.style.color='var(--text-primary)'}}
              onMouseLeave={e=>{if(theme!==t)e.currentTarget.style.color='var(--text-muted)'}}
            >{ic}{t}</button>
          ))}
          <button
            onClick={() => setShowThemePicker(s => !s)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium tracking-wide transition-all duration-150"
            style={isCustom || showThemePicker
              ? {background:'var(--accent-gradient)',color:'#fff',boxShadow:'0 1px 4px var(--accent-glow)'}
              : {color:'var(--text-muted)'}}
            onMouseEnter={e=>{if(!isCustom && !showThemePicker)e.currentTarget.style.color='var(--text-primary)'}}
            onMouseLeave={e=>{if(!isCustom && !showThemePicker)e.currentTarget.style.color='var(--text-muted)'}}
            title="Custom themes"
          ><IcPalette/>custom</button>
        </div>

        {showThemePicker && (
          <div className="absolute right-0 mt-1.5 p-2 rounded-xl"
            style={{ background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(16px)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', width: 216 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {CUSTOM_THEMES.map(ct => (
                <button key={ct.id} onClick={() => { onSetTheme(ct.id); setShowThemePicker(false) }}
                  title={ct.label}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all duration-150"
                  style={{ background: theme===ct.id ? 'var(--accent-light)' : 'transparent', border: theme===ct.id ? '1px solid var(--accent-glow)' : '1px solid transparent' }}
                  onMouseEnter={e => { if(theme!==ct.id) e.currentTarget.style.background='var(--glass-bg)' }}
                  onMouseLeave={e => { if(theme!==ct.id) e.currentTarget.style.background='transparent' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <div style={{ background: ct.bg, width: '100%', height: '57%' }} />
                    <div style={{ background: ct.accent, width: '100%', height: '43%' }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.2, textAlign: 'center' }}>{ct.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Glass card */}
      <div className="flex flex-col items-center gap-6 p-10 rounded-2xl w-full mx-4 relative"
        style={{
          maxWidth: (step === 'spaces' && spaces.length > 2) ? 520 : 420,
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--glass-border-strong)',
          boxShadow: 'var(--shadow-card)',
          transition: 'max-width 0.2s ease',
        }}
      >
        {/* Header */}
        <div className="text-center w-full">
          <div className="flex justify-center mb-4"><OnyxMark/></div>
          <h1 className="text-2xl font-bold mb-1.5 tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Onyx
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {step === 'groups'
              ? (hasGroups ? 'Select a Space Group to continue' : 'A local-first personal knowledge base.')
              : selectedGroup?.name}
          </p>
          {step === 'spaces' && selectedGroup && (
            <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-dim)' }} title={selectedGroup.path}>
              {selectedGroup.path}
            </p>
          )}
        </div>

        <div className="w-full h-px" style={{ background: 'var(--glass-border)' }}/>

        {/* ── Step 1: Space Group picker ── */}
        {step === 'groups' && (
          <>
            {hasGroups && (
              <div className="w-full">
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-3 text-center"
                  style={{ color: 'var(--text-dim)' }}>Space Groups</p>
                <div className="grid gap-2"
                  style={{ gridTemplateColumns: spaceGroups.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                  {spaceGroups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => openGroup(group)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150"
                      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.borderColor = 'var(--accent-glow)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--glass-bg)'; e.currentTarget.style.borderColor = 'var(--glass-border)' }}
                    >
                      <span style={{ color: 'var(--accent)', flexShrink: 0 }}><IcFolder/></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {group.name}
                        </div>
                        <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-dim)' }} title={group.path}>
                          {group.path}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!hasGroups && (
              <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                Select a folder that contains your Space folders.
              </p>
            )}

            <div className="w-full text-center">
              {hasGroups && (
                <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>or open a different Space Group</p>
              )}
              <button onClick={onAddSpaceGroup}
                className="w-full px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 focus:outline-none flex items-center justify-center gap-2"
                style={{
                  background: hasGroups ? 'transparent' : 'var(--accent-gradient)',
                  border: hasGroups ? '1px solid var(--glass-border)' : 'none',
                  color: hasGroups ? 'var(--text-muted)' : '#fff',
                  boxShadow: hasGroups ? 'none' : '0 4px 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
                onMouseEnter={e => {
                  if (hasGroups) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--glass-bg-strong)' }
                  else e.currentTarget.style.boxShadow = '0 6px 24px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
                onMouseLeave={e => {
                  if (hasGroups) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }
                  else e.currentTarget.style.boxShadow = '0 4px 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
              >
                <IcPlus/>
                {hasGroups ? 'Add Space Group' : 'Open Space Group'}
              </button>
            </div>

            {!hasGroups && (
              <p className="text-xs text-center" style={{ color: 'var(--text-dim)' }}>
                Choose a folder whose subfolders are your Spaces
              </p>
            )}
          </>
        )}

        {/* ── Step 2: Spaces within a Group ── */}
        {step === 'spaces' && (
          <>
            {loadingSpaces ? (
              <div className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>Loading spaces…</div>
            ) : spaces.length > 0 ? (
              <div className="w-full">
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-3 text-center"
                  style={{ color: 'var(--text-dim)' }}>Your Spaces</p>
                <div className="grid gap-2"
                  style={{ gridTemplateColumns: spaces.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                  {spaces.map(space => (
                    <button
                      key={space.path}
                      onClick={() => onSelectSpace(space.path)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150"
                      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.borderColor = 'var(--accent-glow)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--glass-bg)'; e.currentTarget.style.borderColor = 'var(--glass-border)' }}
                    >
                      <span style={{ color: 'var(--accent)', flexShrink: 0 }}><IcSpace/></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {space.name}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                No spaces found. Create one below.
              </p>
            )}

            {/* Create new Space */}
            <div className="w-full">
              {showNewSpace ? (
                <form onSubmit={handleCreateSpace} className="flex gap-2">
                  <input
                    autoFocus
                    value={newSpaceName}
                    onChange={e => setNewSpaceName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') { setShowNewSpace(false); setNewSpaceName('') } }}
                    placeholder="Space name…"
                    className="flex-1 text-sm px-3 py-2 rounded-lg focus:outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--accent-light)', color: 'var(--text-primary)' }}
                  />
                  <button type="submit" className="px-3 py-2 rounded-lg text-sm font-semibold text-white flex-shrink-0"
                    style={{ background: 'var(--accent-gradient)', boxShadow: '0 2px 8px var(--accent-glow)' }}>
                    Create
                  </button>
                  <button type="button" onClick={() => { setShowNewSpace(false); setNewSpaceName('') }}
                    className="px-3 py-2 rounded-lg text-sm flex-shrink-0"
                    style={{ background: 'var(--glass-bg-strong)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}>
                    Cancel
                  </button>
                </form>
              ) : (
                <button onClick={() => setShowNewSpace(true)}
                  className="w-full px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2"
                  style={{ background: 'var(--accent-gradient)', color: '#fff', boxShadow: '0 4px 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.1)'}
                >
                  <IcPlus/> New Space
                </button>
              )}
            </div>

            {/* Back to groups */}
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-xs transition-all"
              style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-muted)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
            >
              <IcBack/> Back to Space Groups
            </button>
          </>
        )}
      </div>
    </div>
  )
}
