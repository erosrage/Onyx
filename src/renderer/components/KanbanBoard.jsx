import React, { useMemo, useState, useEffect } from 'react'
import KanbanColumn from './KanbanColumn'
import KanbanSettings from './KanbanSettings'
import useKanbanData, { DEFAULT_COLUMNS, buildColumnsMap } from '../hooks/useKanbanData'

const IcSettings = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>

export default function KanbanBoard({ files, activeFile, onOpenFile, showKanban }) {
  // ── Persistent: columns ────────────────────────────────────────────────────
  const [columns, setColumns] = useState(() => {
    try { return JSON.parse(localStorage.getItem('onyx-kanban-columns')) || DEFAULT_COLUMNS }
    catch { return DEFAULT_COLUMNS }
  })
  useEffect(() => {
    localStorage.setItem('onyx-kanban-columns', JSON.stringify(columns))
  }, [columns])

  // ── Persistent: filter phrases ─────────────────────────────────────────────
  const [phrases, setPhrases] = useState(() => {
    try { return JSON.parse(localStorage.getItem('onyx-kanban-phrases')) || [] }
    catch { return [] }
  })
  useEffect(() => {
    localStorage.setItem('onyx-kanban-phrases', JSON.stringify(phrases))
  }, [phrases])

  // ── Persistent: include journal ────────────────────────────────────────────
  const [includeJournal, setIncludeJournal] = useState(
    () => localStorage.getItem('onyx-kanban-journal') === '1'
  )
  useEffect(() => {
    localStorage.setItem('onyx-kanban-journal', includeJournal ? '1' : '0')
  }, [includeJournal])

  // ── UI state ───────────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false)
  // null = auto-follow active file | '' = all notes | 'Topic' = specific topic
  const [userTopicChoice, setUserTopicChoice] = useState(null)

  // ── Derive topic list ──────────────────────────────────────────────────────
  const topicNames = useMemo(() => {
    const set = new Set()
    for (const f of files) {
      const top = f.folder?.split('/')[0]
      if (!top) continue
      if (top === 'Journal' && !includeJournal) continue
      set.add(top)
    }
    return [...set].sort()
  }, [files, includeJournal])

  // ── Active topic from current note ─────────────────────────────────────────
  const activeTopic = useMemo(() => {
    if (!activeFile?.folder) return ''
    const top = activeFile.folder.split('/')[0]
    return (top === 'Journal' && !includeJournal) ? '' : top
  }, [activeFile, includeJournal])

  // ── Effective topic: user choice takes priority over auto ──────────────────
  // null = follow activeTopic | '' = all | 'Name' = specific
  const effectiveTopic = userTopicChoice !== null ? userTopicChoice : activeTopic

  // ── Scoped files (topic filter) ────────────────────────────────────────────
  const scopedFiles = useMemo(() => {
    return files.filter(f => {
      const top = f.folder?.split('/')[0] || ''
      if (top === 'Journal' && !includeJournal) return false
      if (!effectiveTopic) return true
      return top === effectiveTopic
    })
  }, [files, effectiveTopic, includeJournal])

  // ── Load card data ─────────────────────────────────────────────────────────
  const { cardData, loading, moveCard } = useKanbanData(scopedFiles, showKanban)

  // ── Phrase filter (applied after content loads) ────────────────────────────
  const displayFiles = useMemo(() => {
    if (!phrases.length) return scopedFiles
    return scopedFiles.filter(f => {
      const data = cardData[f.path]
      if (!data) return true // still loading — show optimistically
      const haystack = (data.content + ' ' + f.name).toLowerCase()
      return phrases.some(p => haystack.includes(p.toLowerCase().trim()))
    })
  }, [scopedFiles, phrases, cardData])

  // ── Build columns map ──────────────────────────────────────────────────────
  const columnsMap = useMemo(
    () => buildColumnsMap(columns, displayFiles, cardData),
    [columns, displayFiles, cardData]
  )

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'transparent' }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--glass-border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Kanban
          </span>
          {effectiveTopic && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent-text)' }}>
              {effectiveTopic}
            </span>
          )}
          {phrases.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>
              {phrases.length} keyword{phrases.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Topic:</span>
          <select
            value={userTopicChoice === null ? '__auto__' : userTopicChoice}
            onChange={e => {
              const v = e.target.value
              setUserTopicChoice(v === '__auto__' ? null : v)
            }}
            className="text-xs px-2 py-1 rounded-md focus:outline-none"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <option value="__auto__" style={{ background: 'var(--option-bg)' }}>
              Auto{activeTopic ? ` (${activeTopic})` : ''}
            </option>
            <option value="" style={{ background: 'var(--option-bg)' }}>All notes</option>
            {topicNames.map(t => (
              <option key={t} value={t} style={{ background: 'var(--option-bg)' }}>{t}</option>
            ))}
          </select>

          <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
            {displayFiles.length} note{displayFiles.length !== 1 ? 's' : ''}
          </span>

          <button
            onClick={() => setShowSettings(s => !s)}
            title="Board settings"
            className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
            style={showSettings
              ? { background: 'var(--accent-light)', color: 'var(--accent-text)', border: '1px solid var(--accent-glow)' }
              : { color: 'var(--text-muted)', border: '1px solid transparent' }
            }
            onMouseEnter={e => { if (!showSettings) e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { if (!showSettings) e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <IcSettings />
          </button>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex-1 overflow-auto" style={{ paddingRight: showSettings ? 296 : 0, transition: 'padding-right 0.2s' }}>
        {loading ? (
          <div className="flex gap-4 p-5">
            {columns.map(col => (
              <div
                key={col.id}
                className="rounded-xl flex-shrink-0"
                style={{ width: 240, height: 200, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', opacity: 0.5 }}
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 p-5 h-full items-start">
            {columns.map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                files={columnsMap[col.id] ?? []}
                cardData={cardData}
                onOpenFile={onOpenFile}
                onMoveCard={moveCard}
                onReorderColumn={(draggedId, targetId) => {
                  if (draggedId === targetId) return
                  setColumns(prev => {
                    const cols = [...prev]
                    const fromIdx = cols.findIndex(c => c.id === draggedId)
                    const toIdx = cols.findIndex(c => c.id === targetId)
                    if (fromIdx === -1 || toIdx === -1) return prev
                    const [moved] = cols.splice(fromIdx, 1)
                    cols.splice(toIdx, 0, moved)
                    return cols
                  })
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <KanbanSettings
          columns={columns}
          onColumnsChange={setColumns}
          phrases={phrases}
          onPhrasesChange={setPhrases}
          includeJournal={includeJournal}
          onIncludeJournalChange={setIncludeJournal}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
