import React from 'react'

const IcSun  = () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
const IcMoon = () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>

const OnyxMark = () => (
  <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
    <polygon points="28,4 52,18 52,38 28,52 4,38 4,18"
      fill="rgba(124,58,237,0.10)" stroke="rgba(124,58,237,0.40)" strokeWidth="1.5"/>
    <polygon points="28,13 44,22 44,34 28,43 12,34 12,22"
      fill="rgba(124,58,237,0.18)" stroke="rgba(124,58,237,0.55)" strokeWidth="1.5"/>
    <circle cx="28" cy="28" r="7" fill="#7c3aed" opacity="0.9"/>
    <circle cx="28" cy="28" r="3.5" fill="#c4b5fd"/>
  </svg>
)

export default function VaultPicker({ onSelectVault, theme, onSetTheme }) {
  return (
    <div className="flex h-full w-full items-center justify-center relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'var(--orb-primary)' }}/>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] pointer-events-none"
        style={{ background: 'var(--orb-secondary)' }}/>

      {/* Theme toggle — top right */}
      <div className="absolute top-4 right-4 flex p-0.5 rounded-lg"
        style={{ background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(8px)' }}
      >
        {[{t:'dark',ic:<IcMoon/>},{t:'light',ic:<IcSun/>}].map(({t,ic})=>(
          <button key={t} onClick={() => onSetTheme(t)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium tracking-wide transition-all duration-150 capitalize"
            style={theme===t
              ? {background:'linear-gradient(135deg,#7c3aed,#6d28d9)',color:'#fff',boxShadow:'0 1px 4px rgba(124,58,237,0.3)'}
              : {color:'var(--text-muted)'}}
            onMouseEnter={e=>{if(theme!==t)e.currentTarget.style.color='var(--text-primary)'}}
            onMouseLeave={e=>{if(theme!==t)e.currentTarget.style.color='var(--text-muted)'}}
          >{ic}{t}</button>
        ))}
      </div>

      {/* Glass card */}
      <div className="flex flex-col items-center gap-8 p-12 rounded-2xl max-w-md w-full mx-4 relative"
        style={{
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--glass-border-strong)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="text-center">
          <div className="flex justify-center mb-5"><OnyxMark/></div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Onyx
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            A local-first personal knowledge base.<br/>
            All your notes stay on your machine.
          </p>
        </div>

        <div className="w-full h-px" style={{ background: 'var(--glass-border)' }}/>

        <div className="text-center w-full">
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            Select a folder to use as your vault
          </p>
          <button onClick={onSelectVault}
            className="w-full px-6 py-3 rounded-lg font-semibold text-sm text-white transition-all duration-200 focus:outline-none"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 4px 16px rgba(124, 58, 237, 0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(124, 58, 237, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.35), inset 0 1px 0 rgba(255,255,255,0.1)'}
          >
            Open Vault Folder
          </button>
        </div>

        <p className="text-xs text-center" style={{ color: 'var(--text-dim)' }}>
          Choose any folder containing your Markdown files
        </p>
      </div>
    </div>
  )
}
