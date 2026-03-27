import React, { useState, useMemo, useCallback } from 'react'

const fmtMonth = (key) => {
  const [y, m] = key.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
const fmtDate = (str) => {
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
const rowStyle = (active) => ({
  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
  background: active ? 'var(--accent-light)' : 'transparent',
  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
})

export default function JournalSection({ journalFiles, activeFile, onOpenFile, onCreateFile, collapsed, toggleCollapse, search, onContextMenu }) {
  const [subEntry, setSubEntry] = useState(null) // { dateStr, value }

  const { tree, miscFiles } = useMemo(() => {
    const months = {}
    const misc = []
    journalFiles.forEach(f => {
      if (f.name === 'Journal' && f.folder === 'Journal') return  // skip root index
      const m = f.name.match(/^(\d{4}-\d{2}-\d{2})(?:\s+-\s+(.+))?$/)
      if (!m) {
        misc.push(f)  // freeform name — show in flat list
        return
      }
      const [, date, sub] = m
      const mk = date.slice(0, 7)
      if (!months[mk]) months[mk] = {}
      if (!months[mk][date]) months[mk][date] = { dateFile: null, subCats: [] }
      if (!sub) months[mk][date].dateFile = f
      else months[mk][date].subCats.push({ file: f, name: sub })
    })
    return { tree: months, miscFiles: misc }
  }, [journalFiles])

  const createSub = useCallback(async (dateStr, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    // Creates Journal/YYYY-MM-DD - SubName.md inside the Journal folder
    await onCreateFile(`Journal/${dateStr} - ${trimmed}`, `# ${trimmed}\n\n*${fmtDate(dateStr)}*\n\n[[${dateStr}]]\n\n`)
    setSubEntry(null)
  }, [onCreateFile])

  const monthKeys = Object.keys(tree).sort((a, b) => b.localeCompare(a))
  const hasEntries = monthKeys.length > 0 || miscFiles.length > 0
  const q = search.toLowerCase()
  const visibleMisc = q
    ? miscFiles.filter(f => f.name.toLowerCase().includes(q))
    : miscFiles

  return (
    <div style={{ borderBottom: '1px solid var(--glass-border)' }}>
      {/* Journal root row */}
      <div
        className="flex items-center gap-1 mx-1 px-1.5 py-1.5 rounded-md my-px cursor-pointer transition-all duration-150"
        onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <button
          onClick={() => toggleCollapse('__journal')}
          className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-[10px]"
          style={{ color: 'var(--text-dim)' }}
        >{hasEntries ? (collapsed['__journal'] ? '▶' : '▼') : '·'}</button>
        <span
          className="flex-1 text-sm font-semibold"
          style={{ color: 'var(--accent-text)' }}
          onClick={() => { const jf = journalFiles.find(f => f.name === 'Journal' && f.folder === 'Journal'); if (jf) onOpenFile(jf) }}
        >Journal</span>
        {hasEntries && (
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
            {Object.values(tree).reduce((n, d) => n + Object.keys(d).length, 0)}
          </span>
        )}
      </div>

      {/* Month → Date → Sub tree */}
      {!collapsed['__journal'] && monthKeys.map(mk => {
        const dates = tree[mk]
        const dateKeys = Object.keys(dates)
          .filter(d => !q || fmtDate(d).toLowerCase().includes(q) || d.includes(q) ||
            dates[d].subCats.some(s => s.name.toLowerCase().includes(q)))
          .sort((a, b) => b.localeCompare(a))
        if (!dateKeys.length && q) return null
        const mCol = collapsed[`__m_${mk}`]
        return (
          <div key={mk}>
            {/* Month row */}
            <div
              className="flex items-center gap-1 mx-1 rounded-md my-px cursor-pointer transition-all duration-150"
              style={{ paddingLeft: 20, paddingTop: 4, paddingBottom: 4, paddingRight: 6 }}
              onClick={() => toggleCollapse(`__m_${mk}`)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{mCol ? '▶' : '▼'}</span>
              <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-muted)' }}>{fmtMonth(mk)}</span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>{dateKeys.length}</span>
            </div>

            {/* Date rows */}
            {!mCol && dateKeys.map(date => {
              const { dateFile, subCats } = dates[date]
              const isActive = activeFile?.path === dateFile?.path
              const dCol = collapsed[`__d_${date}`]
              const filteredSubs = q ? subCats.filter(s => s.name.toLowerCase().includes(q)) : subCats
              const hasChildren = filteredSubs.length > 0 || subEntry?.dateStr === date
              return (
                <div key={date}>
                  <div
                    className="flex items-center gap-1 mx-1 rounded-md my-px transition-all duration-150"
                    style={{ ...rowStyle(isActive), paddingLeft: 34, paddingRight: 4, paddingTop: 4, paddingBottom: 4 }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--glass-bg-strong)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    onContextMenu={dateFile ? e => onContextMenu(e, dateFile) : undefined}
                  >
                    <button
                      onClick={() => toggleCollapse(`__d_${date}`)}
                      className="w-3 h-3 flex items-center justify-center flex-shrink-0 text-[9px]"
                      style={{ color: 'var(--text-dim)' }}
                    >{hasChildren ? (dCol ? '▶' : '▼') : '·'}</button>
                    <span
                      className="flex-1 text-xs truncate cursor-pointer"
                      onClick={() => dateFile && onOpenFile(dateFile)}
                    >{fmtDate(date)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setSubEntry({ dateStr: date, value: '' }) }}
                      className="text-[11px] px-1 rounded transition-opacity opacity-30 hover:opacity-90 flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      title="Add sub-entry"
                    >+</button>
                  </div>

                  {/* Sub-categories */}
                  {!dCol && filteredSubs.map(({ file, name }) => {
                    const isSub = activeFile?.path === file.path
                    return (
                      <div key={file.path}
                        onClick={() => onOpenFile(file)}
                        onContextMenu={e => onContextMenu(e, file)}
                        className="flex items-center gap-1 mx-1 rounded-md my-px cursor-pointer transition-all duration-150"
                        style={{ ...rowStyle(isSub), paddingLeft: 50, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}
                        onMouseEnter={e => { if (!isSub) e.currentTarget.style.background = 'var(--glass-bg-strong)' }}
                        onMouseLeave={e => { if (!isSub) e.currentTarget.style.background = 'transparent' }}
                      >
                        <span className="text-[10px] opacity-40">◦</span>
                        <span className="text-xs truncate">{name}</span>
                      </div>
                    )
                  })}

                  {/* Inline sub-entry form */}
                  {subEntry?.dateStr === date && (
                    <form
                      onSubmit={e => { e.preventDefault(); createSub(date, subEntry.value) }}
                      className="flex gap-1 mx-1 my-px"
                      style={{ paddingLeft: 50, paddingRight: 4, paddingBottom: 4 }}
                    >
                      <input
                        autoFocus
                        value={subEntry.value}
                        onChange={e => setSubEntry(p => ({ ...p, value: e.target.value }))}
                        onKeyDown={e => e.key === 'Escape' && setSubEntry(null)}
                        placeholder="Sub-category name..."
                        className="flex-1 text-xs px-2 py-0.5 rounded focus:outline-none"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--accent-light)', color: 'var(--text-primary)' }}
                      />
                      <button type="submit" className="px-1.5 text-xs text-white rounded" style={{ background: 'var(--accent)' }}>✓</button>
                      <button type="button" onClick={() => setSubEntry(null)} className="px-1.5 text-xs rounded" style={{ background: 'var(--glass-bg-strong)', color: 'var(--text-muted)' }}>✕</button>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Freeform / non-date journal files */}
      {visibleMisc.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mx-1 rounded-md my-px"
            style={{ paddingLeft: 20, paddingTop: 4, paddingBottom: 2, paddingRight: 6 }}>
            <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-dim)' }}>Notes</span>
          </div>
          {visibleMisc.map(f => {
            const isActive = activeFile?.path === f.path
            // Show sub-folder prefix for clarity when file isn't directly in Journal/
            const label = f.folder !== 'Journal'
              ? `${f.folder.slice('Journal/'.length)} / ${f.name}`
              : f.name
            return (
              <div key={f.path}
                onClick={() => onOpenFile(f)}
                onContextMenu={e => onContextMenu(e, f)}
                className="flex items-center gap-1 mx-1 rounded-md my-px cursor-pointer transition-all duration-150"
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  paddingLeft: 34, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--glass-bg-strong)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="text-[10px] opacity-40">◦</span>
                <span className="text-xs truncate">{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
