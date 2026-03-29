import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import JournalSection from './JournalSection'

// ── SVG Icons ────────────────────────────────────────────────────────────────
const IcFolder  = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
const IcSwap    = ({ color = '#2dd4bf' }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="ss-corona" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor={color} stopOpacity="0.45"/>
        <stop offset="55%"  stopColor={color} stopOpacity="0.10"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="ss-body" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor="#ffffff" stopOpacity="1"/>
        <stop offset="18%"  stopColor={color} stopOpacity="0.95"/>
        <stop offset="62%"  stopColor={color} stopOpacity="0.52"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="ss-core" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor="#ffffff" stopOpacity="1"/>
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
      </radialGradient>
      <filter id="ss-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.8" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <circle cx="8" cy="8" r="7.5" fill="url(#ss-corona)"/>
    <g stroke={color} strokeOpacity="0.55" strokeWidth="0.45" filter="url(#ss-glow)">
      <line x1="8" y1="1.5" x2="8" y2="14.5"/>
      <line x1="1.5" y1="8" x2="14.5" y2="8"/>
      <line x1="3.2" y1="3.2" x2="12.8" y2="12.8"/>
      <line x1="12.8" y1="3.2" x2="3.2" y2="12.8"/>
    </g>
    <circle cx="8" cy="8" r="3.2" fill="url(#ss-body)"/>
    <circle cx="8" cy="8" r="0.9" fill="url(#ss-core)"/>
  </svg>
)
const IcSun     = () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
const IcMoon    = () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
const IcFile    = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
const IcGraph   = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
const IcAI      = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
const IcCalendar= () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IcRefresh   = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
const IcWhiteboard= () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
const IcKanban   = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="9.5" y="3" width="5" height="12" rx="1"/><rect x="16" y="3" width="5" height="8" rx="1"/></svg>
const IcExplorer = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h4l2 3h12a1 1 0 011 1v11a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="12" y1="10" x2="12" y2="16"/></svg>
const IcPalette  = () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="12" cy="9" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/></svg>

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
const SYSTEM_FOLDERS = new Set(['Journal', 'Tags', 'assets', 'whiteboards', 'Archive'])

const SPACE_COLORS = [
  '#f472b6', '#c084fc', '#60a5fa', '#34d399', '#fbbf24',
  '#f87171', '#a78bfa', '#38bdf8', '#4ade80', '#fb923c',
  '#e879f9', '#22d3ee', '#86efac', '#facc15', '#ff6b9d',
]
function spaceColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return SPACE_COLORS[h % SPACE_COLORS.length]
}

// ── Build recursive tree from flat file list ──────────────────────────────────
// `allFolders` = the complete folder list from vault:read (includes empty dirs)
function buildFolderTree(folder, files, allFolders = []) {
  const folderName = folder.split('/').pop()
  const rootFile = files.find(f => f.folder === folder && f.name === folderName) || null
  const leafFiles = files.filter(f => f.folder === folder && f.name !== folderName)

  // Direct sub-folders: union of folders derived from files AND from vault directory scan
  const fromFiles = files
    .filter(f => {
      if (!f.folder.startsWith(folder + '/')) return false
      const segment = f.folder.slice(folder.length + 1)
      if (segment.includes('/')) return false
      return segment !== 'assets'
    })
    .map(f => f.folder)

  const fromDirs = allFolders
    .filter(d => {
      if (!d.startsWith(folder + '/')) return false
      const segment = d.slice(folder.length + 1)
      if (segment.includes('/')) return false
      return segment !== 'assets'
    })

  const directSubFolderPaths = [...new Set([...fromFiles, ...fromDirs])]
  const children = directSubFolderPaths.map(sf => buildFolderTree(sf, files, allFolders))
  return { folder, folderName, rootFile, leafFiles, children }
}

// ── Inline create form used inside TreeNode ───────────────────────────────────
function InlineCreateForm({ indent, placeholder, onSubmit, onCancel }) {
  const [value, setValue] = React.useState('')
  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(value) }}
      className="flex gap-1 mx-1 my-px"
      style={{ paddingLeft: indent, paddingRight: 4, paddingBottom: 4, paddingTop: 2 }}
    >
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onCancel()}
        placeholder={placeholder}
        className="flex-1 text-xs px-2 py-0.5 rounded focus:outline-none"
        style={{ background: 'var(--input-bg)', border: '1px solid var(--accent-light)', color: 'var(--text-primary)' }}
      />
      <button type="submit" className="px-1.5 text-xs text-white rounded flex-shrink-0" style={{ background: 'var(--accent)' }}>✓</button>
      <button type="button" onClick={onCancel} className="px-1.5 text-xs rounded flex-shrink-0" style={{ background: 'var(--glass-bg-strong)', color: 'var(--text-muted)' }}>✕</button>
    </form>
  )
}

// ── Recursive tree node renderer ─────────────────────────────────────────────
function TreeNode({ node, depth, activeFile, onOpenFile, onContextMenu, onCreateFile, collapsed, toggleCollapse, isDraggable, dragging, dragOver, onDragStart, onDragOver, onDrop, onDragEnd, draggingFile, onFileDragStart, onFileDragEnd, renamingFolder, onFolderRenamed }) {
  const { folder, folderName, rootFile, leafFiles, children } = node
  const isActive = rootFile && activeFile?.path === rootFile.path
  const colKey = `__tree_${folder}`
  const isCollapsed = collapsed[colKey]
  const hasChildren = leafFiles.length > 0 || children.length > 0
  const indent = depth * 14
  // null | 'folder' | filePath (leaf file path creating sub-note)
  const [inlineTarget, setInlineTarget] = React.useState(null)

  const rowStyle = (active) => ({
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    background: active ? 'var(--accent-light)' : 'transparent',
    borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
    paddingLeft: indent + 8,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 6,
  })

  const handleFolderDoubleClick = (e) => {
    e.preventDefault()
    // Expand folder if collapsed
    if (isCollapsed) toggleCollapse(colKey)
    setInlineTarget('folder')
  }

  const submitFolderNote = async (name) => {
    const trimmed = name.trim()
    if (!trimmed) { setInlineTarget(null); return }
    await onCreateFile(`${folder}/${trimmed}/${trimmed}`, `# ${trimmed}\n\n[[${folderName}]]\n\n`)
    setInlineTarget(null)
  }

  const submitSubNote = async (parentFile, name) => {
    const trimmed = name.trim()
    if (!trimmed) { setInlineTarget(null); return }
    await onCreateFile(
      `${parentFile.folder}/${parentFile.name}/${trimmed}/${trimmed}`,
      `# ${trimmed}\n\n[[${parentFile.name}]]\n\n`
    )
    setInlineTarget(null)
  }

  return (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable ? e => onDragStart(e, folderName) : undefined}
      onDragOver={isDraggable ? e => onDragOver(e, folderName) : undefined}
      onDrop={isDraggable ? e => onDrop(e, folderName) : undefined}
      onDragEnd={isDraggable ? onDragEnd : undefined}
      style={{
        opacity: isDraggable && dragging === folderName ? 0.4 : 1,
        borderTop: isDraggable && dragOver === folderName ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      {/* Folder/note root row */}
      <div
        draggable={depth > 0 && !!rootFile && !!onFileDragStart}
        onDragStart={depth > 0 && rootFile && onFileDragStart ? e => { e.stopPropagation(); onFileDragStart(e, rootFile) } : undefined}
        onDragEnd={depth > 0 && onFileDragEnd ? onFileDragEnd : undefined}
        className="flex items-center gap-1 mx-1 rounded-md my-px cursor-pointer transition-all duration-150"
        style={{ ...rowStyle(isActive), opacity: depth > 0 && draggingFile?.path === rootFile?.path ? 0.4 : 1 }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--glass-bg-strong)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
        onContextMenu={e => onContextMenu(e, rootFile, folder, folderName)}
      >
        <button
          onClick={e => { e.stopPropagation(); if (hasChildren) toggleCollapse(colKey) }}
          className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-[10px]"
          style={{ color: 'var(--text-dim)' }}
        >
          {hasChildren ? (isCollapsed ? '▶' : '▼') : '·'}
        </button>
        {renamingFolder === folder ? (
          <input
            autoFocus
            defaultValue={folderName}
            className="flex-1 text-sm bg-transparent outline-none"
            style={{
              fontSize: '0.82rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              borderBottom: '1px solid var(--accent-light)',
              minWidth: 0,
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); onFolderRenamed(folder, folderName, e.target.value) }
              if (e.key === 'Escape') onFolderRenamed(folder, folderName, folderName)
            }}
            onBlur={e => onFolderRenamed(folder, folderName, e.target.value)}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 truncate"
            style={{
              fontSize: '0.82rem',
              fontWeight: 500,
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
            onClick={() => rootFile && onOpenFile(rootFile)}
            onDoubleClick={handleFolderDoubleClick}
            title="Double-click to add a note · Right-click to rename"
          >
            {folderName}
          </span>
        )}
        {hasChildren && (
          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
            {leafFiles.length + children.length}
          </span>
        )}
      </div>

      {/* Children (when expanded) */}
      {!isCollapsed && (
        <>
          {/* Inline form for new note inside this folder */}
          {inlineTarget === 'folder' && (
            <InlineCreateForm
              indent={indent + 22}
              placeholder="Note name…"
              onSubmit={submitFolderNote}
              onCancel={() => setInlineTarget(null)}
            />
          )}

          {/* Leaf files (non-root files directly in this folder) */}
          {leafFiles.map(file => {
            const isFileActive = activeFile?.path === file.path
            return (
              <React.Fragment key={file.path}>
                <div
                  draggable={!!onFileDragStart}
                  onDragStart={onFileDragStart ? e => { e.stopPropagation(); onFileDragStart(e, file) } : undefined}
                  onDragEnd={onFileDragEnd || undefined}
                  onClick={() => onOpenFile(file)}
                  onDoubleClick={e => { e.preventDefault(); setInlineTarget(file.path) }}
                  onContextMenu={e => onContextMenu(e, file)}
                  className="flex items-center gap-2 mx-1 rounded-md my-px cursor-pointer transition-all duration-150"
                  style={{
                    color: isFileActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    background: isFileActive ? 'var(--accent-light)' : 'transparent',
                    borderLeft: isFileActive ? '2px solid var(--accent)' : '2px solid transparent',
                    paddingLeft: indent + 22,
                    paddingRight: 8,
                    paddingTop: 5,
                    paddingBottom: 5,
                    opacity: draggingFile?.path === file.path ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { if (!isFileActive) e.currentTarget.style.background = 'var(--glass-bg-strong)' }}
                  onMouseLeave={e => { if (!isFileActive) e.currentTarget.style.background = 'transparent' }}
                  title="Double-click to add a child note"
                >
                  <span className="text-xs opacity-40 flex-shrink-0">◦</span>
                  <span className="truncate text-sm">{file.name}</span>
                </div>
                {/* Inline form for sub-note under this leaf file */}
                {inlineTarget === file.path && (
                  <InlineCreateForm
                    indent={indent + 36}
                    placeholder="Child note name…"
                    onSubmit={name => submitSubNote(file, name)}
                    onCancel={() => setInlineTarget(null)}
                  />
                )}
              </React.Fragment>
            )
          })}
          {/* Sub-folder nodes (recursive) */}
          {children.map(child => (
            <TreeNode
              key={child.folder}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
              onCreateFile={onCreateFile}
              collapsed={collapsed}
              toggleCollapse={toggleCollapse}
              isDraggable={false}
              draggingFile={draggingFile}
              onFileDragStart={onFileDragStart}
              onFileDragEnd={onFileDragEnd}
              renamingFolder={renamingFolder}
              onFolderRenamed={onFolderRenamed}
            />
          ))}
        </>
      )}
    </div>
  )
}

export default function Sidebar({
  vaultPath, files, folders = [], activeFile, onOpenFile, onCreateFile, onDeleteFile, onDeleteTopic,
  onChangeVault, onRefresh, showGraph, onToggleGraph, showAI, onToggleAI,
  showWhiteboard, onToggleWhiteboard, showKanban, onToggleKanban,
  showFileExplorer, onToggleFileExplorer,
  showNotes, onShowNotes, theme, onSetTheme, onMoveFile,
  onArchiveTopic, onUnarchiveTopic, onArchiveFile, revealFolder,
}) {
  const [createMode, setCreateMode] = useState(null)
  const [newThemeName, setNewThemeName] = useState('')
  const [newNoteName, setNewNoteName] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)
  const confirmResolveRef = useRef(null)
  const showConfirmRef = useRef(null)
  showConfirmRef.current = (title, message) => new Promise(resolve => {
    confirmResolveRef.current = resolve
    setConfirmModal({ title, message })
  })
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const [noteOrder, setNoteOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('onyx-note-order') || '[]') } catch { return [] }
  })
  const [dragOver, setDragOver] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [draggingFile, setDraggingFile] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [recentFiles, setRecentFiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem('onyx-recent-files') || '[]') } catch { return [] }
  })
  const [recentExpanded, setRecentExpanded] = useState(false)
  // Track recently opened files
  useEffect(() => {
    if (!activeFile) return
    setRecentFiles(prev => {
      const entry = { path: activeFile.path, name: activeFile.name, folder: activeFile.folder }
      const filtered = prev.filter(r => r.path !== activeFile.path)
      const next = [entry, ...filtered].slice(0, 8)
      localStorage.setItem('onyx-recent-files', JSON.stringify(next))
      return next
    })
  }, [activeFile])

  // Auto-expand ancestor folders when a file is opened (e.g. from Home View click)
  useEffect(() => {
    if (!activeFile?.folder || activeFile.folder === '' || activeFile.folder === 'Journal') return
    const parts = activeFile.folder.split('/')
    setCollapsed(prev => {
      const next = { ...prev }
      parts.forEach((_, i) => { next[`__tree_${parts.slice(0, i + 1).join('/')}`] = false })
      return next
    })
  }, [activeFile?.path])

  // Expand a folder by name (for topic nodes with no root file)
  useEffect(() => {
    if (!revealFolder?.folder) return
    setCollapsed(prev => ({ ...prev, [`__tree_${revealFolder.folder}`]: false }))
  }, [revealFolder])

  const vaultName = vaultPath ? vaultPath.split(/[\\/]/).pop() : 'Space'

  const isJournalFile = (f) => f.folder === 'Journal' || f.folder.startsWith('Journal/')
  const journalFiles = useMemo(() => files.filter(isJournalFile), [files])
  const regularFiles = useMemo(() => files.filter(f => !isJournalFile(f)), [files])

  // Top-level topic names — driven by vault folders, not derived from files.
  // This ensures any folder created externally shows up even if it has no root .md yet.
  const topicNames = useMemo(() => {
    // Folders from the vault:read response (authoritative)
    const fromVault = folders
      .filter(f => !f.includes('/') && !SYSTEM_FOLDERS.has(f))
    // Also include any top-level folder implied by a file's folder field (covers in-app creates before next full read)
    const fromFiles = regularFiles
      .filter(f => f.folder !== '' && !f.folder.includes('/') && !SYSTEM_FOLDERS.has(f.folder))
      .map(f => f.folder)
    return [...new Set([...fromVault, ...fromFiles])].sort()
  }, [folders, regularFiles])

  // Build recursive tree (no search filtering — we filter display separately)
  const fileTree = useMemo(() => {
    const nodes = topicNames.map(folder => buildFolderTree(folder, regularFiles, folders))
    const orphans = regularFiles.filter(f => f.folder === '')
    return { nodes, orphans }
  }, [topicNames, regularFiles, folders])

  // Sort top-level nodes by noteOrder
  const sortedNodes = useMemo(() => {
    if (!noteOrder.length) return fileTree.nodes
    return [...fileTree.nodes].sort((a, b) => {
      const ai = noteOrder.indexOf(a.folderName), bi = noteOrder.indexOf(b.folderName)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1; if (bi === -1) return -1
      return ai - bi
    })
  }, [fileTree.nodes, noteOrder])

  // Search filter: does a node or any descendant match?
  const nodeMatchesSearch = useCallback((node, q) => {
    if (!q) return true
    const lq = q.toLowerCase()
    if (node.folderName.toLowerCase().includes(lq)) return true
    if (node.leafFiles.some(f => f.name.toLowerCase().includes(lq))) return true
    return node.children.some(child => nodeMatchesSearch(child, lq))
  }, [])

  const q = search.toLowerCase()
  const visibleNodes = sortedNodes.filter(n => nodeMatchesSearch(n, q))
  const visibleOrphans = fileTree.orphans.filter(f => !q || f.name.toLowerCase().includes(q))

  const onDragStart = (e, name) => { e.dataTransfer.setData('text/plain', name); setDragging(name) }
  const onDragOver  = (e, name) => { e.preventDefault(); setDragOver(name) }
  const onDrop = (e, target) => {
    // File-to-folder move takes priority
    const fileJson = e.dataTransfer.getData('application/onyx-file')
    if (fileJson) {
      try {
        const file = JSON.parse(fileJson)
        const topLevel = file.folder.split('/')[0]
        if (file && topLevel !== target && onMoveFile) onMoveFile(file, target)
      } catch {}
      setDraggingFile(null); setDragOver(null); setDragging(null)
      return
    }
    // Folder reorder
    const src = e.dataTransfer.getData('text/plain')
    if (src === target) { setDragOver(null); setDragging(null); return }
    const names = sortedNodes.map(n => n.folderName)
    const fi = names.indexOf(src), ti = names.indexOf(target)
    if (fi === -1 || ti === -1) { setDragOver(null); setDragging(null); return }
    const next = [...names]; next.splice(fi, 1); next.splice(ti, 0, src)
    setNoteOrder(next); localStorage.setItem('onyx-note-order', JSON.stringify(next))
    setDragOver(null); setDragging(null)
  }
  const onDragEnd = () => { setDragOver(null); setDragging(null) }
  const onFileDragStart = (e, file) => { e.dataTransfer.setData('application/onyx-file', JSON.stringify(file)); setDraggingFile(file) }
  const onFileDragEnd = () => { setDraggingFile(null); setDragOver(null) }

  const cancelCreate = () => { setCreateMode(null); setNewThemeName(''); setNewNoteName('') }

  const handleCreateTheme = useCallback(async (e) => {
    e?.preventDefault()
    const name = newThemeName.trim()
    if (!name) return
    await onCreateFile(`${name}/${name}`, `# ${name}\n\n`)
    setNewThemeName('')
    setCreateMode(null)
  }, [newThemeName, onCreateFile])

  const handleCreateNote = useCallback(async (e) => {
    e?.preventDefault()
    const noteName = newNoteName.trim()
    if (!noteName) return

    // Use active file's folder as parent if it's a non-journal folder
    let parentFolder, backLink
    if (activeFile && activeFile.folder !== '' && activeFile.folder !== 'Journal') {
      parentFolder = activeFile.folder
      backLink = activeFile.name
    } else if (selectedTheme) {
      parentFolder = selectedTheme
      backLink = selectedTheme
    } else if (topicNames[0]) {
      parentFolder = topicNames[0]
      backLink = topicNames[0]
    } else {
      return
    }

    await onCreateFile(
      `${parentFolder}/${noteName}/${noteName}`,
      `# ${noteName}\n\n[[${backLink}]]\n\n`
    )
    setNewNoteName('')
    setCreateMode(null)
  }, [newNoteName, selectedTheme, activeFile, onCreateFile, topicNames])

  const handleCreateJournal = useCallback(async () => {
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    const displayDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const existing = files.find(f => f.folder === 'Journal' && f.name === dateStr)
    if (existing) { onOpenFile(existing); return }
    if (!files.some(f => f.folder === 'Journal' && f.name === 'Journal'))
      await onCreateFile('Journal/Journal', `# Journal\n\nMy daily journal entries.\n\n`)
    await onCreateFile(`Journal/${dateStr}`, `# ${displayDate}\n\n[[Journal]]\n\n---\n\n`)
  }, [files, onCreateFile, onOpenFile])

  const [renamingFolder, setRenamingFolder] = useState(null)

  const handleContextMenu = useCallback((e, file, folder = null, folderName = null) => {
    e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, file, folder, folderName })
  }, [])
  const handleDelete = useCallback(async () => {
    if (!contextMenu) return
    if (contextMenu.folder) {
      await onDeleteTopic(contextMenu.folder)
    } else if (contextMenu.file) {
      await onDeleteFile(contextMenu.file)
    }
    setContextMenu(null)
  }, [contextMenu, onDeleteFile, onDeleteTopic])

  const handleArchive = useCallback(async () => {
    if (!contextMenu) return
    if (contextMenu.folder && onArchiveTopic) {
      await onArchiveTopic(contextMenu.folder.split('/')[0])
    } else if (contextMenu.file && onArchiveFile) {
      await onArchiveFile(contextMenu.file)
    }
    setContextMenu(null)
  }, [contextMenu, onArchiveTopic, onArchiveFile])

  const handleRenameFolder = useCallback(async (folder, oldName, newName) => {
    setRenamingFolder(null)
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    const oldDirPath = `${vaultPath}/${folder}`
    const folderParent = folder.includes('/') ? folder.split('/').slice(0, -1).join('/') : ''
    const newDirPath = folderParent ? `${vaultPath}/${folderParent}/${trimmed}` : `${vaultPath}/${trimmed}`
    const result = await window.electronAPI.renameFile(oldDirPath, newDirPath)
    if (!result.success) return
    // Rename root file if it exists (e.g. Work/Work.md → Work/NewName.md)
    await window.electronAPI.renameFile(`${newDirPath}/${oldName}.md`, `${newDirPath}/${trimmed}.md`)
    await onRefresh()
  }, [vaultPath, onRefresh])

  const toggleCollapse = (name) => setCollapsed(p => ({ ...p, [name]: !p[name] }))

  // Gather all colKeys recursively from a tree node
  const gatherColKeys = (node) => {
    const keys = [`__tree_${node.folder}`]
    for (const child of node.children) keys.push(...gatherColKeys(child))
    return keys
  }

  const allCollapsed = sortedNodes.length > 0 && sortedNodes.every(n => collapsed[`__tree_${n.folder}`])

  const toggleAllCollapse = () => {
    const allKeys = sortedNodes.flatMap(gatherColKeys)
    if (allCollapsed) {
      // Expand all
      setCollapsed(p => {
        const next = { ...p }
        for (const k of allKeys) delete next[k]
        return next
      })
    } else {
      // Collapse all
      setCollapsed(p => {
        const next = { ...p }
        for (const k of allKeys) next[k] = true
        return next
      })
    }
  }

  // Determine note creation context label
  const noteContext = activeFile && activeFile.folder !== '' && activeFile.folder !== 'Journal'
    ? activeFile.name
    : selectedTheme || topicNames[0] || null

  return (
    <div className="flex flex-col h-full select-none"
      style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: '1px solid var(--glass-border)' }}
      onClick={() => setContextMenu(null)}
    >
      {/* Vault header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <span className="text-sm font-semibold truncate tracking-tight" style={{ color: 'var(--text-primary)' }} title={vaultPath}>
            {vaultName}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={async () => { setRefreshing(true); await onRefresh(); setRefreshing(false) }}
            title="Refresh file list"
            className="flex items-center justify-center w-6 h-6 rounded-md transition-all duration-150"
            style={{ color: 'var(--text-muted)', border: '1px solid transparent' }}
            onMouseEnter={e => { e.currentTarget.style.color='var(--text-primary)'; e.currentTarget.style.background='var(--glass-bg-strong)' }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--text-muted)'; e.currentTarget.style.background='transparent' }}
          >
            <span style={{ display:'flex', animation: refreshing ? 'spin 0.7s linear infinite' : undefined }}>
              <IcRefresh/>
            </span>
          </button>
          <button onClick={onChangeVault} title="Switch Space"
            className="flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200"
            style={{ background: 'transparent', border: 'none', opacity: 0.75 }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.filter = `drop-shadow(0 0 4px ${spaceColor(vaultName)}cc)` }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.filter = 'none' }}
          ><IcSwap color={spaceColor(vaultName)}/></button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-2" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <input type="text" placeholder="Search notes..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-sm px-2.5 py-1.5 rounded-md focus:outline-none transition-all duration-150"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-light)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
        />
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm" style={{ color:'var(--text-dim)' }}>No notes yet — create a topic to get started</p>
          </div>
        ) : (
          <>
            {/* Journal */}
            {journalFiles.length > 0 && (
              <JournalSection journalFiles={journalFiles} activeFile={activeFile} onOpenFile={onOpenFile}
                onCreateFile={onCreateFile} collapsed={collapsed} toggleCollapse={toggleCollapse} search={search}
                onContextMenu={handleContextMenu} onTodayJournal={handleCreateJournal}
              />
            )}

            {/* Create bar — forms only */}
            {createMode !== null && (
            <div className="px-2 py-2 flex flex-col gap-1.5" style={{ borderBottom: '1px solid var(--glass-border)' }}>
              {createMode === 'theme' && (
                <form onSubmit={handleCreateTheme} className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color:'var(--text-muted)' }}>New Topic</span>
                  <div className="flex gap-1">
                    <input autoFocus type="text" placeholder="Topic name..."
                      value={newThemeName} onChange={e=>setNewThemeName(e.target.value)}
                      onKeyDown={e=>e.key==='Escape'&&cancelCreate()}
                      className="flex-1 text-sm px-2 py-1 rounded-md focus:outline-none"
                      style={{ background:'var(--input-bg)', border:'1px solid var(--accent-light)', color:'var(--text-primary)' }}
                    />
                    <button type="submit" className="px-2 py-1 text-white text-sm rounded-md" style={{ background:'var(--accent-gradient)' }}>✓</button>
                    <button type="button" onClick={cancelCreate} className="px-2 py-1 text-sm rounded-md" style={{ background:'var(--glass-bg-strong)', color:'var(--text-muted)' }}>✕</button>
                  </div>
                </form>
              )}
              {createMode === 'note' && (
                <form onSubmit={handleCreateNote} className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color:'var(--text-muted)' }}>
                    New Note{noteContext ? <span style={{ color:'var(--accent-text)', fontWeight:400, textTransform:'none' }}> inside <em>{noteContext}</em></span> : ''}
                  </span>
                  {/* If no active file context, show folder dropdown */}
                  {!(activeFile && activeFile.folder !== '' && activeFile.folder !== 'Journal') && (
                    topicNames.length > 0 ? (
                      <select value={selectedTheme} onChange={e=>setSelectedTheme(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-md focus:outline-none"
                        style={{ background:'var(--input-bg)', border:'1px solid var(--glass-border)', color:'var(--text-primary)' }}
                      >
                        {topicNames.map(t=><option key={t} value={t} style={{ background:'var(--option-bg)' }}>{t}</option>)}
                      </select>
                    ) : <span className="text-xs" style={{ color:'var(--text-muted)' }}>Create a Topic first</span>
                  )}
                  <div className="flex gap-1">
                    <input autoFocus type="text" placeholder="Note name..."
                      value={newNoteName} onChange={e=>setNewNoteName(e.target.value)}
                      onKeyDown={e=>e.key==='Escape'&&cancelCreate()}
                      disabled={!noteContext}
                      className="flex-1 text-sm px-2 py-1 rounded-md focus:outline-none"
                      style={{ background:'var(--input-bg)', border:'1px solid var(--accent-light)', color:'var(--text-primary)' }}
                    />
                    <button type="submit" disabled={!noteContext} className="px-2 py-1 text-white text-sm rounded-md" style={{ background:'var(--accent-gradient)' }}>✓</button>
                    <button type="button" onClick={cancelCreate} className="px-2 py-1 text-sm rounded-md" style={{ background:'var(--glass-bg-strong)', color:'var(--text-muted)' }}>✕</button>
                  </div>
                </form>
              )}
            </div>
            )}

            {/* Notes section header */}
            <div className="px-3 pt-2 pb-1 flex items-center gap-2">
              <button
                onClick={toggleAllCollapse}
                title={allCollapsed ? 'Expand all' : 'Collapse all'}
                className="text-[10px] uppercase tracking-widest font-semibold transition-colors duration-150"
                style={{ color: 'var(--accent-text)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = '#c4b5fd'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--accent-text)'}
              >
                Topics
              </button>

              <div className="ml-auto flex gap-1">
                {[{label:'+ Topic',mode:'theme',title:'New topic'},{label:'+ Note',mode:'note',title:'New note'}].map(btn=>(
                  <button key={btn.mode}
                    onClick={() => { setCreateMode(btn.mode); if(btn.mode==='note' && !activeFile) setSelectedTheme(topicNames[0]||'') }}
                    title={btn.title}
                    className="text-[10px] px-1.5 py-0.5 rounded transition-all duration-150"
                    style={{ color:'var(--text-muted)', border:'1px solid var(--glass-border)', background:'transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.background='var(--glass-bg-strong)'; e.currentTarget.style.color='var(--text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-muted)' }}
                  >{btn.label}</button>
                ))}
              </div>
            </div>

            {visibleNodes.length === 0 && visibleOrphans.length === 0 && journalFiles.length === 0 && q ? (
              <div className="px-4 py-4 text-center">
                <p className="text-sm" style={{ color:'var(--text-dim)' }}>No notes match your search</p>
              </div>
            ) : (
              <>
                {visibleNodes.map(node => (
                  <TreeNode
                    key={node.folder}
                    node={node}
                    depth={0}
                    activeFile={activeFile}
                    onOpenFile={onOpenFile}
                    onContextMenu={handleContextMenu}
                    onCreateFile={onCreateFile}
                    collapsed={collapsed}
                    toggleCollapse={toggleCollapse}
                    isDraggable={true}
                    dragging={dragging}
                    dragOver={dragOver}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onDragEnd={onDragEnd}
                    draggingFile={draggingFile}
                    onFileDragStart={onFileDragStart}
                    onFileDragEnd={onFileDragEnd}
                    renamingFolder={renamingFolder}
                    onFolderRenamed={handleRenameFolder}
                  />
                ))}
                {visibleOrphans.map(file => {
                  const isActive = activeFile?.path === file.path
                  return (
                    <div key={file.path} onClick={() => onOpenFile(file)} onContextMenu={e => handleContextMenu(e, file)}
                      className="flex items-center gap-2 mx-1 px-2 py-1.5 cursor-pointer text-sm transition-all duration-150 rounded-md my-px"
                      style={{
                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                        background: isActive ? 'var(--accent-light)' : 'transparent',
                        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--glass-bg-strong)' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span className="text-xs opacity-40">◦</span>
                      <span className="truncate">{file.name}</span>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* Archive section */}
      {(() => {
        const archiveFiles = files.filter(f => f.folder && f.folder.split('/')[0] === 'Archive')
        if (!archiveFiles.length) return null
        // Group by top-level archived folder name (strip 'Archive/' prefix)
        const archivedTopics = [...new Set(
          archiveFiles.map(f => f.folder.slice('Archive/'.length).split('/')[0])
        )].filter(Boolean)
        if (!archivedTopics.length) return null
        return (
          <div style={{ borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
            <button
              onClick={() => setArchiveOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 pt-2 pb-1 text-left"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--accent-text)' }}>
                {archiveOpen ? '▾' : '▸'} Archived ({archivedTopics.length} topic{archivedTopics.length !== 1 ? 's' : ''} · {archiveFiles.length} note{archiveFiles.length !== 1 ? 's' : ''})
              </span>
            </button>
            {archiveOpen && archivedTopics.map(topicName => {
              const topicFiles = archiveFiles.filter(f => f.folder.slice('Archive/'.length).split('/')[0] === topicName)
              const rootFile = topicFiles.find(f => f.name === topicName)
              return (
                <div key={topicName} className="mx-1 mb-px">
                  <div
                    className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all duration-150"
                    style={{ color: 'var(--text-dim)', opacity: 0.65 }}
                    onContextMenu={e => {
                      e.preventDefault(); e.stopPropagation()
                      if (onUnarchiveTopic) {
                        onUnarchiveTopic(`Archive/${topicName}`)
                      }
                    }}
                    onClick={() => rootFile && onOpenFile(rootFile)}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.65' }}
                    title={onUnarchiveTopic ? 'Right-click to restore' : topicName}
                  >
                    <span className="text-xs opacity-50">⊘</span>
                    <span className="text-xs truncate flex-1">{topicName}</span>
                    {onUnarchiveTopic && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          onUnarchiveTopic(`Archive/${topicName}`)
                        }}
                        className="text-[9px] px-1.5 py-0.5 rounded transition-all duration-150 flex-shrink-0"
                        style={{ color: 'var(--accent-text)', background: 'var(--accent-light)', border: '1px solid var(--glass-border)' }}
                        title="Restore to space"
                      >↩ restore</button>
                    )}
                  </div>
                </div>
              )
            })}
            <div style={{ height: 4 }} />
          </div>
        )
      })()}

      {/* Recent Files */}
      {recentFiles.length > 0 && (
        <div style={{ borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
          <div className="px-3 pt-2 pb-1 flex items-center gap-2">
            <button
              onClick={() => setRecentExpanded(v => !v)}
              className="text-[10px] uppercase tracking-widest font-semibold transition-colors duration-150"
              style={{ color: 'var(--accent-text)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.color = '#c4b5fd'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--accent-text)'}
            >
              Recent
            </button>
            <span className="text-[9px] font-mono ml-auto" style={{ color: 'var(--text-dim)' }}>
              {recentFiles.filter(r => files.find(f => f.path === r.path)).length}
            </span>
          </div>
          {recentExpanded && recentFiles.map(r => {
            const isActive = activeFile?.path === r.path
            const liveFile = files.find(f => f.path === r.path)
            if (!liveFile) return null  // file deleted from vault
            const label = r.folder ? `${r.folder.split('/')[0]} / ${r.name}` : r.name
            return (
              <div
                key={r.path}
                onClick={() => onOpenFile(liveFile)}
                className="flex items-center gap-2 mx-1 px-2 py-1 rounded-md my-px cursor-pointer transition-all duration-150"
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--glass-bg-strong)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="text-[10px] opacity-30 flex-shrink-0">◷</span>
                <span className="text-xs truncate">{label}</span>
              </div>
            )
          })}
          <div style={{ height: 4 }} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderTop:'1px solid var(--glass-border)' }}>
        <span className="text-xs font-mono" style={{ color:'var(--text-dim)' }}>
          {files.length} note{files.length!==1?'s':''}
        </span>
        <div className="flex items-center gap-1">
          {[
            {ic:<IcGraph/>,       act:showGraph,       fn:onToggleGraph,      t:'Home Panel'},
            {ic:<IcFile/>,        act:showNotes,       fn:onShowNotes,        t:'Notes Panel'},
            {ic:<IcAI/>,          act:showAI,          fn:onToggleAI,         t:'Context Panel'},
            {ic:<IcWhiteboard/>,  act:showWhiteboard,  fn:onToggleWhiteboard, t:'Whiteboard Panel'},
            {ic:<IcKanban/>,      act:showKanban,      fn:onToggleKanban,     t:'Kanban Panel'},
            {ic:<IcExplorer/>,    act:showFileExplorer,fn:onToggleFileExplorer,t:'File Explorer'},
          ].map(({ic,act,fn,t})=>(
            <button key={t} onClick={fn} title={t}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
              style={act
                ? {background:'var(--accent-light)',color:'var(--accent-text)',border:'1px solid var(--accent-glow)'}
                : {color:'var(--text-muted)',border:'1px solid transparent'}}
              onMouseEnter={e=>{if(!act)e.currentTarget.style.color='var(--text-primary)'}}
              onMouseLeave={e=>{if(!act)e.currentTarget.style.color='var(--text-muted)'}}
            >{ic}</button>
          ))}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div className="fixed z-50 py-1 rounded-lg min-w-[140px]"
          style={{ top:contextMenu.y, left:contextMenu.x, background:'var(--context-menu-bg)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:'1px solid var(--glass-border-strong)', boxShadow:'0 16px 40px rgba(0,0,0,0.3)' }}
        >
          {contextMenu.folder && (
            <button
              onClick={() => { setRenamingFolder(contextMenu.folder); setContextMenu(null) }}
              className="w-full text-left px-3 py-1.5 text-sm transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Rename
            </button>
          )}
          {contextMenu.folder && onArchiveTopic && (
            <button onClick={handleArchive} className="w-full text-left px-3 py-1.5 text-sm transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Archive Topic</button>
          )}
          {!contextMenu.folder && contextMenu.file && onArchiveFile && (
            <button onClick={handleArchive} className="w-full text-left px-3 py-1.5 text-sm transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Archive Note</button>
          )}
          {contextMenu.folder && (
            <button onClick={handleDelete} className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
              Delete Topic
            </button>
          )}
          {!contextMenu.folder && contextMenu.file && (
            <button onClick={handleDelete} className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
              Delete note
            </button>
          )}
          <button onClick={() => setContextMenu(null)} className="w-full text-left px-3 py-1.5 text-sm transition-colors"
            style={{ color:'var(--text-muted)' }} onMouseEnter={e=>e.currentTarget.style.background='var(--glass-bg-strong)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >Cancel</button>
        </div>
      )}

      {/* In-app confirm modal */}
      {confirmModal && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 200, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="flex flex-col gap-4 rounded-xl px-6 py-5 mx-3"
            style={{
              background: 'var(--glass-bg-strong)',
              border: '1px solid var(--glass-border-strong)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {confirmModal.title}
              </span>
              <span className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {confirmModal.message}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setConfirmModal(null); confirmResolveRef.current?.(false) }}
                className="px-3 py-1.5 rounded-md text-xs transition-all duration-150"
                style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--glass-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
              >Cancel</button>
              <button
                onClick={() => { setConfirmModal(null); confirmResolveRef.current?.(true) }}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
                style={{ background: 'var(--accent-gradient)', color: '#fff', border: '1px solid transparent', boxShadow: '0 1px 6px var(--accent-glow)' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
