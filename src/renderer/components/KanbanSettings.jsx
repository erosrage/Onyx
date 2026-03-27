import React, { useState, useRef } from 'react'
import { DEFAULT_COLUMNS } from '../hooks/useKanbanData'

function slugify(s) {
  return (s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'col') + '-' + Date.now()
}

const IcClose = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcEdit  = () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>

export default function KanbanSettings({
  columns, onColumnsChange,
  phrases, onPhrasesChange,
  includeJournal, onIncludeJournalChange,
  onClose,
}) {
  const [newColLabel, setNewColLabel] = useState('')
  const [newPhrase, setNewPhrase] = useState('')
  const [editingColId, setEditingColId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const dragIdRef = useRef(null)

  const addColumn = () => {
    const label = newColLabel.trim()
    if (!label) return
    onColumnsChange(prev => [...prev, { id: slugify(label), label }])
    setNewColLabel('')
  }

  const removeColumn = (id) => {
    if (columns.length <= 1) return
    onColumnsChange(prev => prev.filter(c => c.id !== id))
  }

  const renameColumn = (id, rawLabel) => {
    const label = rawLabel.trim()
    if (label) onColumnsChange(prev => prev.map(c => c.id === id ? { ...c, label } : c))
    setEditingColId(null)
  }

  const addPhrase = () => {
    const p = newPhrase.trim()
    if (!p || phrases.includes(p)) return
    onPhrasesChange(prev => [...prev, p])
    setNewPhrase('')
  }

  const removePhrase = (p) => onPhrasesChange(prev => prev.filter(x => x !== p))

  const inputStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--glass-border)',
    color: 'var(--text-primary)',
  }

  return (
    <div
      className="absolute inset-y-0 right-0 flex flex-col"
      style={{ width: 296, background: 'var(--glass-bg-strong)', borderLeft: '1px solid var(--glass-border)', zIndex: 10, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Board Settings</span>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded-md transition-all duration-150"
          style={{ color: 'var(--text-muted)', border: '1px solid transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-bg-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <IcClose />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {/* ── Columns ── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-dim)' }}>Columns</span>
            <button
              onClick={() => onColumnsChange(DEFAULT_COLUMNS)}
              className="text-[10px] transition-colors duration-150"
              style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
            >
              Reset defaults
            </button>
          </div>

          <div className="flex flex-col gap-1 mb-2">
            {columns.map((col, i) => (
              <div
                key={col.id}
                draggable
                onDragStart={() => { dragIdRef.current = col.id }}
                onDragOver={e => { e.preventDefault(); setDragOverId(col.id) }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOverId(null)
                  const fromId = dragIdRef.current
                  if (!fromId || fromId === col.id) return
                  onColumnsChange(prev => {
                    const cols = [...prev]
                    const fromIdx = cols.findIndex(c => c.id === fromId)
                    const toIdx = cols.findIndex(c => c.id === col.id)
                    if (fromIdx === -1 || toIdx === -1) return prev
                    const [moved] = cols.splice(fromIdx, 1)
                    cols.splice(toIdx, 0, moved)
                    return cols
                  })
                }}
                onDragEnd={() => { dragIdRef.current = null; setDragOverId(null) }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md"
                style={{
                  background: 'var(--glass-bg)',
                  border: dragOverId === col.id ? '1px dashed var(--accent-light)' : '1px solid var(--glass-border)',
                  cursor: 'grab',
                  opacity: dragIdRef.current === col.id ? 0.4 : 1,
                }}
              >
                <span className="text-[10px] w-4 text-center flex-shrink-0" style={{ color: 'var(--text-dim)' }}>{i + 1}</span>
                {editingColId === col.id ? (
                  <input
                    autoFocus
                    defaultValue={col.label}
                    className="flex-1 text-sm bg-transparent outline-none"
                    style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--accent-light)', minWidth: 0 }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); renameColumn(col.id, e.target.value) }
                      if (e.key === 'Escape') setEditingColId(null)
                    }}
                    onBlur={e => renameColumn(col.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{col.label}</span>
                )}
                <span
                  className="text-[9px] px-1 rounded flex-shrink-0 font-mono"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={col.id}
                >
                  {col.id}
                </span>
                <button
                  onClick={() => setEditingColId(col.id)}
                  className="flex-shrink-0 transition-colors duration-150"
                  style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-text)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                  title="Rename"
                >
                  <IcEdit />
                </button>
                {columns.length > 1 && (
                  <button
                    onClick={() => removeColumn(col.id)}
                    className="flex-shrink-0 transition-colors duration-150"
                    style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                    title="Remove column"
                  >
                    <IcClose />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            <input
              type="text"
              placeholder="New column name…"
              value={newColLabel}
              onChange={e => setNewColLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addColumn()}
              className="flex-1 text-xs px-2 py-1.5 rounded-md focus:outline-none"
              style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-light)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
            />
            <button
              onClick={addColumn}
              className="px-2.5 py-1 text-xs text-white rounded-md flex-shrink-0"
              style={{ background: 'var(--accent-gradient)' }}
            >
              Add
            </button>
          </div>
        </section>

        {/* ── Filter Keywords ── */}
        <section>
          <span className="text-[10px] uppercase tracking-widest font-semibold block mb-1" style={{ color: 'var(--text-dim)' }}>Filter Keywords</span>
          <p className="text-[11px] mb-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Only show notes that contain any of these keywords. Leave empty to show all.
          </p>

          {phrases.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {phrases.map(p => (
                <span
                  key={p}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent-text)', border: '1px solid var(--accent-glow)' }}
                >
                  {p}
                  <button
                    onClick={() => removePhrase(p)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-text)', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <IcClose />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-1">
            <input
              type="text"
              placeholder="Add keyword or phrase…"
              value={newPhrase}
              onChange={e => setNewPhrase(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPhrase()}
              className="flex-1 text-xs px-2 py-1.5 rounded-md focus:outline-none"
              style={inputStyle}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-light)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
            />
            <button
              onClick={addPhrase}
              className="px-2.5 py-1 text-xs text-white rounded-md flex-shrink-0"
              style={{ background: 'var(--accent-gradient)' }}
            >
              Add
            </button>
          </div>
        </section>

        {/* ── Include Journal ── */}
        <section>
          <span className="text-[10px] uppercase tracking-widest font-semibold block mb-2" style={{ color: 'var(--text-dim)' }}>Options</span>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeJournal}
              onChange={e => onIncludeJournalChange(e.target.checked)}
              className="rounded"
              style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
            />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Include Journal entries</span>
          </label>
        </section>
      </div>
    </div>
  )
}
