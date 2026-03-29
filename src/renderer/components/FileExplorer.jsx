import React, { useState, useMemo, useRef, useCallback } from 'react'

const IcFolder   = ({ size = 16 }) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
const IcFile     = ({ size = 16 }) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
const IcChevronR = () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
const IcHome     = () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const IcNewFolder= () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
const IcRefresh  = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
const IcNewFile  = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="9" y1="16" x2="15" y2="16"/></svg>

export default function FileExplorer({
  vaultPath, files, folders, activeFile,
  onOpenFile, onCreateFile, onDeleteFile, onDeleteTopic, onRefresh,
}) {
  const [currentPath, setCurrentPath] = useState('')
  const [selected, setSelected]       = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [renaming, setRenaming]       = useState(null) // { type, item }
  const [renameValue, setRenameValue] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName]   = useState('')
  const [creatingFile, setCreatingFile]   = useState(false)
  const [newFileName, setNewFileName]     = useState('')

  const renameRef    = useRef(null)
  const folderRef    = useRef(null)
  const newFileRef   = useRef(null)

  // ── Derived items in currentPath ────────────────────────────────────────────
  const subFolders = useMemo(() => {
    const prefix = currentPath ? currentPath + '/' : ''
    const seen = new Set()
    const push = (name) => { if (name && !seen.has(name)) { seen.add(name); } }

    for (const f of folders) {
      if (prefix && !f.startsWith(prefix)) continue
      const rest = prefix ? f.slice(prefix.length) : f
      const seg = rest.split('/')[0]
      if (seg) push(seg)
    }
    for (const f of files) {
      if (!f.folder) continue
      if (prefix && !f.folder.startsWith(prefix)) continue
      const rest = prefix ? f.folder.slice(prefix.length) : f.folder
      const seg = rest.split('/')[0]
      if (seg) push(seg)
    }
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [currentPath, folders, files])

  const localFiles = useMemo(() =>
    files
      .filter(f => (f.folder || '') === currentPath)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [currentPath, files]
  )

  const breadcrumbs = useMemo(() =>
    currentPath ? currentPath.split('/') : [],
    [currentPath]
  )

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigateTo = useCallback((path) => {
    setCurrentPath(path)
    setSelected(null)
    setContextMenu(null)
    setRenaming(null)
    setCreatingFolder(false)
    setCreatingFile(false)
  }, [])

  // ── Rename ──────────────────────────────────────────────────────────────────
  const startRename = useCallback((type, item) => {
    setContextMenu(null)
    setRenaming({ type, item })
    setRenameValue(type === 'folder' ? item : item.name)
    setTimeout(() => renameRef.current?.select(), 30)
  }, [])

  const commitRename = useCallback(async () => {
    if (!renaming) return
    const trimmed = renameValue.trim()
    setRenaming(null)
    if (!trimmed) return

    if (renaming.type === 'folder') {
      const oldRel = currentPath ? `${currentPath}/${renaming.item}` : renaming.item
      const newRel = currentPath ? `${currentPath}/${trimmed}` : trimmed
      if (oldRel !== newRel) {
        await window.electronAPI.renameFile(`${vaultPath}/${oldRel}`, `${vaultPath}/${newRel}`)
        await onRefresh()
      }
    } else {
      if (trimmed !== renaming.item.name) {
        const dir = renaming.item.folder ? `${vaultPath}/${renaming.item.folder}` : vaultPath
        const newPath = `${dir}/${trimmed}.md`
        await window.electronAPI.renameFile(renaming.item.path, newPath)
        await onRefresh()
      }
    }
  }, [renaming, renameValue, currentPath, vaultPath, onRefresh])

  // ── Create folder ────────────────────────────────────────────────────────────
  const commitNewFolder = useCallback(async () => {
    const trimmed = newFolderName.trim()
    setCreatingFolder(false)
    setNewFolderName('')
    if (!trimmed) return
    const rel = currentPath ? `${currentPath}/${trimmed}` : trimmed
    await window.electronAPI.ensureFolder(`${vaultPath}/${rel}`)
    await onRefresh()
  }, [newFolderName, currentPath, vaultPath, onRefresh])

  // ── Create file ──────────────────────────────────────────────────────────────
  const commitNewFile = useCallback(async () => {
    const trimmed = newFileName.trim()
    setCreatingFile(false)
    setNewFileName('')
    if (!trimmed) return
    const name = currentPath ? `${currentPath}/${trimmed}` : trimmed
    await onCreateFile(name)
  }, [newFileName, currentPath, onCreateFile])

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!contextMenu) return
    const { type, item } = contextMenu
    setContextMenu(null)
    if (type === 'folder') {
      const rel = currentPath ? `${currentPath}/${item}` : item
      await onDeleteTopic(rel)
    } else {
      await onDeleteFile(item)
    }
  }, [contextMenu, currentPath, onDeleteTopic, onDeleteFile])

  const vaultName = vaultPath ? vaultPath.split(/[\\/]/).pop() : 'Vault'

  const toolbarBtnStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent',
    cursor: 'pointer', color: 'var(--text-muted)', transition: 'color 0.15s',
  }

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      onClick={() => { setContextMenu(null); setSelected(null) }}
    >
      {/* ── Toolbar ── */}
      <div
        className="flex items-center gap-1 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => navigateTo('')}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0"
            style={{ color: currentPath ? 'var(--text-muted)' : 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            title={vaultName}
          >
            <IcHome /> <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vaultName}</span>
          </button>
          {breadcrumbs.map((crumb, i) => {
            const pathTo = breadcrumbs.slice(0, i + 1).join('/')
            const isLast = i === breadcrumbs.length - 1
            return (
              <React.Fragment key={pathTo}>
                <span style={{ color: 'var(--text-dim)', flexShrink: 0, opacity: 0.5 }}><IcChevronR /></span>
                <button
                  onClick={() => navigateTo(pathTo)}
                  className="px-1 py-0.5 rounded text-xs flex-shrink-0"
                  style={{
                    color: isLast ? 'var(--text-primary)' : 'var(--text-muted)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {crumb}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        {/* Action buttons */}
        <button
          style={toolbarBtnStyle} title="New File"
          onClick={e => { e.stopPropagation(); setCreatingFile(true); setNewFileName(''); setTimeout(() => newFileRef.current?.focus(), 30) }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        ><IcNewFile /></button>
        <button
          style={toolbarBtnStyle} title="New Folder"
          onClick={e => { e.stopPropagation(); setCreatingFolder(true); setNewFolderName(''); setTimeout(() => folderRef.current?.focus(), 30) }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        ><IcNewFolder /></button>
        <button
          style={toolbarBtnStyle} title="Refresh"
          onClick={e => { e.stopPropagation(); onRefresh() }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        ><IcRefresh /></button>
      </div>

      {/* ── File list ── */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5">

        {/* Inline: new folder */}
        {creatingFolder && (
          <InlineCreate
            icon={<IcFolder size={14} />}
            iconColor="var(--accent)"
            ref={folderRef}
            value={newFolderName}
            placeholder="Folder name"
            onChange={setNewFolderName}
            onCommit={commitNewFolder}
            onCancel={() => { setCreatingFolder(false); setNewFolderName('') }}
          />
        )}

        {/* Inline: new file */}
        {creatingFile && (
          <InlineCreate
            icon={<IcFile size={14} />}
            iconColor="var(--text-dim)"
            ref={newFileRef}
            value={newFileName}
            placeholder="Note name"
            onChange={setNewFileName}
            onCommit={commitNewFile}
            onCancel={() => { setCreatingFile(false); setNewFileName('') }}
          />
        )}

        {/* Folders */}
        {subFolders.map(name => {
          const isSelected = selected?.type === 'folder' && selected?.name === name
          const isRenaming = renaming?.type === 'folder' && renaming?.item === name
          return (
            <ExplorerRow
              key={name}
              icon={<IcFolder size={14} />}
              iconColor="var(--accent)"
              label={name}
              isSelected={isSelected}
              isActive={false}
              isRenaming={isRenaming}
              renameRef={isRenaming ? renameRef : null}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onRenameCommit={commitRename}
              onRenameCancel={() => setRenaming(null)}
              trailIcon={<IcChevronR />}
              onClick={e => { e.stopPropagation(); setSelected({ type: 'folder', name }) }}
              onDoubleClick={() => navigateTo(currentPath ? `${currentPath}/${name}` : name)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', item: name }) }}
            />
          )
        })}

        {/* Files */}
        {localFiles.map(file => {
          const isActive   = activeFile?.path === file.path
          const isSelected = selected?.type === 'file' && selected?.path === file.path
          const isRenaming = renaming?.type === 'file' && renaming?.item?.path === file.path
          return (
            <ExplorerRow
              key={file.path}
              icon={<IcFile size={14} />}
              iconColor="var(--text-dim)"
              label={file.name}
              isSelected={isSelected}
              isActive={isActive}
              isRenaming={isRenaming}
              renameRef={isRenaming ? renameRef : null}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onRenameCommit={commitRename}
              onRenameCancel={() => setRenaming(null)}
              trailIcon={null}
              onClick={e => { e.stopPropagation(); setSelected({ type: 'file', path: file.path }) }}
              onDoubleClick={() => onOpenFile(file)}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'file', item: file }) }}
            />
          )
        })}

        {/* Empty state */}
        {subFolders.length === 0 && localFiles.length === 0 && !creatingFolder && !creatingFile && (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--text-dim)' }}>
            <IcFolder size={32} />
            <p className="text-xs" style={{ opacity: 0.4 }}>Empty folder</p>
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div
        className="flex items-center px-3 py-1 flex-shrink-0 text-xs gap-3"
        style={{ borderTop: '1px solid var(--glass-border)', color: 'var(--text-dim)', background: 'var(--glass-bg)' }}
      >
        <span>{subFolders.length} folder{subFolders.length !== 1 ? 's' : ''}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{localFiles.length} file{localFiles.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Context menu ── */}
      {contextMenu && (
        <div
          className="fixed z-50 py-1 rounded-lg"
          style={{
            top: contextMenu.y, left: contextMenu.x, minWidth: 130,
            background: 'var(--context-menu-bg)', backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-border-strong)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <CtxButton label="Rename" onClick={() => startRename(contextMenu.type, contextMenu.item)} />
          <CtxButton label="Delete" danger onClick={handleDelete} />
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const InlineCreate = React.forwardRef(function InlineCreate({ icon, iconColor, value, placeholder, onChange, onCommit, onCancel }, ref) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1 mb-0.5 rounded-md"
      style={{ background: 'var(--glass-bg-strong)' }}
      onClick={e => e.stopPropagation()}
    >
      <span style={{ color: iconColor, opacity: 0.8, flexShrink: 0 }}>{icon}</span>
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
        onBlur={onCommit}
        placeholder={placeholder}
        className="flex-1 text-xs bg-transparent focus:outline-none"
        style={{ color: 'var(--text-primary)' }}
      />
    </div>
  )
})

function ExplorerRow({
  icon, iconColor, label, isSelected, isActive, isRenaming,
  renameRef, renameValue, onRenameChange, onRenameCommit, onRenameCancel,
  trailIcon, onClick, onDoubleClick, onContextMenu,
}) {
  const baseStyle = {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
    marginBottom: 1,
    background: isActive ? 'var(--accent-light)' : isSelected ? 'var(--glass-bg-strong)' : 'transparent',
    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
    color: isActive ? 'var(--accent-text)' : 'var(--text-primary)',
    transition: 'background 0.1s',
  }
  return (
    <div
      style={baseStyle}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'var(--glass-bg-strong)' }}
      onMouseLeave={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ color: iconColor, opacity: 0.85, flexShrink: 0 }}>{icon}</span>
      {isRenaming ? (
        <input
          ref={renameRef}
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onRenameCancel() }}
          onBlur={onRenameCommit}
          className="flex-1 text-xs bg-transparent focus:outline-none"
          style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--accent)' }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 text-xs truncate">{label}</span>
      )}
      {trailIcon && !isRenaming && (
        <span style={{ color: 'var(--text-dim)', opacity: 0.4, flexShrink: 0 }}>{trailIcon}</span>
      )}
    </div>
  )
}

function CtxButton({ label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-xs"
      style={{ color: danger ? '#f87171' : 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'block' }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(248,113,113,0.1)' : 'var(--glass-bg-strong)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >{label}</button>
  )
}
