import React, { useState, useCallback, useEffect } from 'react'
import VaultPicker from './components/VaultPicker'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import GraphView from './components/GraphView'
import GalaxyView from './components/GalaxyView'
import AIHarness from './components/AIHarness'
import Whiteboard from './components/Whiteboard'
import KanbanBoard from './components/KanbanBoard'

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('onyx-theme') || 'dark')
  const [vaultPath, setVaultPath] = useState(() => sessionStorage.getItem('vaultPath') || null)
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [nodes, setNodes] = useState([])
  const [activeFile, setActiveFile] = useState(null)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [isResizing, setIsResizing] = useState(false)
  // Space Groups (parent folders containing Spaces)
  const [spaceGroups, setSpaceGroups] = useState([])
  const [showGraph, setShowGraph] = useState(true)
  const [showAI, setShowAI] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [showKanban, setShowKanban] = useState(false)
  // Track which panels have been opened at least once so they stay mounted (preserve state)
  const [everOpened, setEverOpened] = useState({ graph: true, ai: false, whiteboard: false, kanban: false })

  useEffect(() => {
    setEverOpened(prev => ({
      graph: prev.graph || showGraph,
      ai: prev.ai || showAI,
      whiteboard: prev.whiteboard || showWhiteboard,
      kanban: prev.kanban || showKanban,
    }))
  }, [showGraph, showAI, showWhiteboard, showKanban])

  const applyTheme = useCallback((id) => {
    localStorage.setItem('onyx-theme', id)
    setTheme(id)
  }, [])

  // Load saved Space Groups on startup. vaultPath is NOT auto-loaded — user picks each session.
  useEffect(() => {
    window.electronAPI.readWorkspaces().then(ws => {
      if (ws.spaceGroups && ws.spaceGroups.length > 0) {
        setSpaceGroups(ws.spaceGroups)
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadVault = useCallback(async () => {
    if (!vaultPath) return
    try {
      const result = await window.electronAPI.readVault(vaultPath)
      if (result.success) {
        setFiles(result.files)
        setFolders(result.folders || [])
        setNodes(result.nodes || [])
      } else {
        console.error('loadVault: vault:read failed —', result.error)
      }
    } catch (err) {
      console.error('loadVault failed:', err)
    }
  }, [vaultPath])

  useEffect(() => {
    if (!vaultPath) return
    loadVault()
    window.electronAPI.watchVault(vaultPath)
    const cleanup = window.electronAPI.onVaultChanged(() => loadVault())
    return cleanup
  }, [vaultPath, loadVault])

  const saveSpaceGroups = useCallback(async (groups) => {
    await window.electronAPI.saveWorkspaces({ spaceGroups: groups })
  }, [])

  // Add a new Space Group via OS folder picker
  const handleAddSpaceGroup = useCallback(async () => {
    const selectedPath = await window.electronAPI.selectVault()
    if (!selectedPath) return
    const name = selectedPath.split(/[\\/]/).pop()
    if (spaceGroups.find(g => g.path === selectedPath)) return
    const group = { id: `group-${Date.now()}`, name, path: selectedPath }
    const updated = [...spaceGroups, group]
    setSpaceGroups(updated)
    await saveSpaceGroups(updated)
  }, [spaceGroups, saveSpaceGroups])

  // Open a specific Space (subfolder) as the active vault
  const handleSelectSpace = useCallback((spacePath) => {
    sessionStorage.setItem('vaultPath', spacePath)
    setVaultPath(spacePath)
    setActiveFile(null)
  }, [])

  // Create a new Space folder then open it
  const handleCreateSpace = useCallback(async (groupPath, name) => {
    const result = await window.electronAPI.createSpace(groupPath, name)
    if (result.success) {
      sessionStorage.setItem('vaultPath', result.path)
      setVaultPath(result.path)
      setActiveFile(null)
    }
  }, [])

  // Log out — return to VaultPicker
  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('vaultPath')
    setVaultPath(null)
    setActiveFile(null)
    setFiles([])
    setFolders([])
    setNodes([])
    setShowGalaxy(false)
  }, [])

  // Galaxy view — overlay showing all spaces as stars
  const [showGalaxy, setShowGalaxy] = useState(false)
  const [graphRecenterToken, setGraphRecenterToken] = useState(0)
  const [graphCenterOnStarToken, setGraphCenterOnStarToken] = useState(0)

  // Always recenter graph view whenever it becomes visible, regardless of how it was triggered
  useEffect(() => {
    if (showGraph) setGraphRecenterToken(t => t + 1)
  }, [showGraph])

  const handleOpenGalaxy  = useCallback(() => setShowGalaxy(true), [])
  const handleCloseGalaxy = useCallback(() => {
    setShowGalaxy(false)
    setShowGraph(true)
    setShowAI(false)
    setShowWhiteboard(false)
    setShowKanban(false)
    setGraphCenterOnStarToken(t => t + 1)
  }, [])
  const handleSelectFromGalaxy = useCallback((path) => {
    setShowGalaxy(false)
    setShowGraph(true)
    setShowAI(false)
    setShowWhiteboard(false)
    setShowKanban(false)
    setActiveFile(null)
    setGraphCenterOnStarToken(t => t + 1)
    handleSelectSpace(path)
  }, [handleSelectSpace])

  const handleOpenFile = useCallback((file) => {
    setActiveFile(file)
    setShowGraph(false)
    setShowAI(false)
    setShowWhiteboard(false)
    setShowKanban(false)
  }, [])

  const handleCreateFile = useCallback(async (name, content = '') => {
    if (!vaultPath || !name) return
    const cleanName = name.replace(/\.md$/, '')
    const filePath = `${vaultPath}/${cleanName}.md`
    const result = await window.electronAPI.createFile(filePath)
    if (result.success) {
      if (content) await window.electronAPI.writeFile(filePath, content)
      const vaultResult = await window.electronAPI.readVault(vaultPath)
      if (vaultResult.success) {
        setFiles(vaultResult.files)
        setFolders(vaultResult.folders || [])
        const norm = p => p.replace(/\\/g, '/')
        const newFile = vaultResult.files.find(f => norm(f.path) === norm(filePath))
        if (newFile) setActiveFile({ ...newFile, isNew: true })
      }
      setShowGraph(false)
      setShowAI(false)
      setShowWhiteboard(false)
      setShowKanban(false)
    }
  }, [vaultPath])

  // Like handleCreateFile but stays in the current note — used when tagging words inline
  const handleCreateFileSilent = useCallback(async (name, content = '') => {
    if (!vaultPath || !name) return
    const cleanName = name.replace(/\.md$/, '')
    const filePath = `${vaultPath}/${cleanName}.md`
    const result = await window.electronAPI.createFile(filePath)
    if (result.success) {
      if (content) await window.electronAPI.writeFile(filePath, content)
      await loadVault()  // refresh sidebar without navigating away
    }
  }, [vaultPath, loadVault])

  const handleDeleteFile = useCallback(async (file) => {
    const result = await window.electronAPI.deleteFile(file.path)
    if (result.success) {
      await loadVault()
      if (activeFile?.path === file.path) setActiveFile(null)
    }
  }, [activeFile, loadVault])

  const handleArchiveTopic = useCallback(async (folderRelPath) => {
    const src = `${vaultPath}/${folderRelPath}`
    const dst = `${vaultPath}/Archive/${folderRelPath}`
    await window.electronAPI.ensureFolder(`${vaultPath}/Archive`)
    const result = await window.electronAPI.renameFile(src, dst)
    if (result.success) {
      await loadVault()
      if (activeFile?.folder === folderRelPath || activeFile?.folder?.startsWith(folderRelPath + '/')) {
        setActiveFile(null)
      }
    }
  }, [vaultPath, loadVault, activeFile])

  const handleUnarchiveTopic = useCallback(async (archivedFolderRelPath) => {
    // archivedFolderRelPath is e.g. 'Archive/Work' → restore to 'Work'
    const topicName = archivedFolderRelPath.replace(/^Archive\//, '')
    const src = `${vaultPath}/${archivedFolderRelPath}`
    const dst = `${vaultPath}/${topicName}`
    const result = await window.electronAPI.renameFile(src, dst)
    if (result.success) await loadVault()
  }, [vaultPath, loadVault])

  const handleDeleteTopic = useCallback(async (folderRelPath) => {
    const folderPath = `${vaultPath}/${folderRelPath}`
    const result = await window.electronAPI.deleteFolder(folderPath)
    if (result.success) {
      await loadVault()
      if (activeFile?.folder === folderRelPath || activeFile?.folder?.startsWith(folderRelPath + '/')) {
        setActiveFile(null)
      }
    }
  }, [vaultPath, loadVault, activeFile])

  // Move a file/node to a new parent folder (targetFolder is a relative vault path).
  // Works via parentId semantics: reassigns the file's parent without changing its type.
  const handleMoveFile = useCallback(async (file, targetFolder) => {
    if (!file || !targetFolder) return
    // No-op if already in targetFolder
    if (file.folder === targetFolder) return
    // Also no-op if only the top-level differs but node is nested under same branch
    const folderParts = file.folder ? file.folder.split('/') : []
    if (folderParts[0] === targetFolder && folderParts.length === 1) return

    if (folderParts.length > 1) {
      // Nested directory note: move entire directory to new parent
      const noteFolderName = folderParts[folderParts.length - 1]
      const oldDirPath = `${vaultPath}/${file.folder}`
      const newDirPath = `${vaultPath}/${targetFolder}/${noteFolderName}`
      const result = await window.electronAPI.renameFile(oldDirPath, newDirPath)
      if (!result.success) return
      await loadVault()
      if (activeFile?.path === file.path) {
        setActiveFile(prev => prev ? { ...prev, path: `${newDirPath}/${file.name}.md`, folder: `${targetFolder}/${noteFolderName}` } : null)
      }
    } else {
      // Flat file: read, create at new parent location, delete old
      const newPath = `${vaultPath}/${targetFolder}/${file.name}.md`
      const readResult = await window.electronAPI.readFile(file.path)
      if (!readResult.success) return
      const createResult = await window.electronAPI.createFile(newPath)
      if (!createResult.success) return
      await window.electronAPI.writeFile(newPath, readResult.content)
      await window.electronAPI.deleteFile(file.path)
      await loadVault()
      if (activeFile?.path === file.path) setActiveFile(prev => prev ? { ...prev, path: newPath } : null)
    }
  }, [vaultPath, loadVault, activeFile])

  const handleWikiLinkClick = useCallback(async (noteName) => {
    const existing = files.find(f => f.name.toLowerCase() === noteName.toLowerCase())
    if (existing) { setActiveFile(existing); setShowGraph(false); setShowAI(false); setShowKanban(false); return }
    const confirmed = await window.electronAPI.confirmDialog(
      `Create note "${noteName}"?`,
      `The note "${noteName}.md" does not exist. Would you like to create it?`
    )
    if (confirmed) await handleCreateFile(noteName)
  }, [files, handleCreateFile])

  const startResize = useCallback((e) => {
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = sidebarWidth
    const onMouseMove = (e) => setSidebarWidth(Math.max(180, Math.min(500, startWidth + e.clientX - startX)))
    const onMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth])

  // ── Theme wrapper (always wraps everything so CSS vars propagate) ──────────
  return (
    <div
      data-theme={theme}
      className="h-screen w-screen overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--bg-primary), var(--bg-secondary), var(--bg-primary))',
        color: 'var(--text-primary)',
        position: 'relative',
      }}
    >
      {!vaultPath ? (
        <VaultPicker
          theme={theme}
          onSetTheme={applyTheme}
          spaceGroups={spaceGroups}
          onAddSpaceGroup={handleAddSpaceGroup}
          onSelectSpace={handleSelectSpace}
          onCreateSpace={handleCreateSpace}
        />
      ) : (
        <>
          {/* Workspace content — zooms out when galaxy opens */}
          <div
            className="flex w-full h-full overflow-hidden"
            style={{
              transform:  showGalaxy ? 'scale(0.5)'  : 'scale(1)',
              filter:     showGalaxy ? 'blur(10px)'  : 'none',
              opacity:    showGalaxy ? 0             : 1,
              transition: 'transform 0.45s cubic-bezier(0.4,0,1,1), filter 0.4s ease, opacity 0.35s ease',
              transformOrigin: '50% 50%',
              willChange: 'transform, filter, opacity',
            }}
          >
          {/* Sidebar */}
          <div className="flex-shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
            <Sidebar
              vaultPath={vaultPath}
              files={files}
              folders={folders}
              activeFile={activeFile}
              onOpenFile={handleOpenFile}
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
              onDeleteTopic={handleDeleteTopic}
              onChangeVault={handleOpenGalaxy}
              onRefresh={loadVault}
              showGraph={showGraph}
              onToggleGraph={() => { setShowGraph(g => !g); setShowAI(false); setShowWhiteboard(false) }}
              showAI={showAI}
              onToggleAI={() => { setShowAI(a => !a); setShowGraph(false); setShowWhiteboard(false) }}
              showWhiteboard={showWhiteboard}
              onToggleWhiteboard={() => { setShowWhiteboard(w => !w); setShowGraph(false); setShowAI(false); setShowKanban(false) }}
              showKanban={showKanban}
              onToggleKanban={() => { setShowKanban(k => !k); setShowGraph(false); setShowAI(false); setShowWhiteboard(false) }}
              showNotes={!showGraph && !showAI && !showWhiteboard && !showKanban}
              onShowNotes={() => { setShowGraph(false); setShowAI(false); setShowWhiteboard(false); setShowKanban(false) }}
              theme={theme}
              onSetTheme={applyTheme}
              onMoveFile={handleMoveFile}
              onArchiveTopic={handleArchiveTopic}
              onUnarchiveTopic={handleUnarchiveTopic}
            />
          </div>

          {/* Resize handle */}
          <div
            className={`w-px flex-shrink-0 cursor-col-resize transition-all duration-200 ${
              isResizing ? 'shadow-[0_0_8px_rgba(124,58,237,0.5)]' : ''
            }`}
            style={{
              background: isResizing ? 'var(--accent)' : 'var(--glass-border-strong)',
            }}
            onMouseDown={startResize}
          />

          {/* Main content — all panels stay mounted once opened; CSS hides inactive ones */}
          <div className="flex-1 overflow-hidden relative">
            {/* Empty state — only when no file is open and no panel is active */}
            {!activeFile && !showGraph && !showAI && !showWhiteboard && !showKanban && (
              <div className="flex h-full items-center justify-center flex-col gap-3">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.10 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <p className="text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>Select a note to start editing</p>
                <p className="text-sm" style={{ color: 'var(--text-dim)' }}>or create a new one from the sidebar</p>
              </div>
            )}

            {/* Editor — visible when a file is open and no overlay panel is active */}
            {activeFile && (
              <div className="absolute inset-0 flex flex-col" style={{ display: (!showGraph && !showAI && !showWhiteboard && !showKanban) ? 'flex' : 'none' }}>
                <Editor key={activeFile.path} file={activeFile} files={files} vaultPath={vaultPath} onWikiLinkClick={handleWikiLinkClick} onCreateFile={handleCreateFile} onCreateFileSilent={handleCreateFileSilent} />
              </div>
            )}

            {/* Graph — stays mounted after first open */}
            {everOpened.graph && (
              <div className="absolute inset-0" style={{ display: showGraph ? 'block' : 'none' }}>
                <GraphView files={files} activeFile={activeFile} onOpenFile={handleOpenFile} onCreateFile={handleCreateFile} theme={theme} onArchiveTopic={handleArchiveTopic}
                  vaultPath={vaultPath} onSwitchSpace={handleOpenGalaxy} isVisible={showGraph} recenterToken={graphRecenterToken} centerOnStarToken={graphCenterOnStarToken}
                  onDeleteFiles={async (paths) => {
                    for (const p of paths) await window.electronAPI.deleteFile(p)
                    await loadVault()
                    if (paths.includes(activeFile?.path)) setActiveFile(null)
                  }}
                  onMoveFile={handleMoveFile}
                />
              </div>
            )}

            {/* AI Harness — stays mounted after first open, preserving terminal session */}
            {everOpened.ai && (
              <div className="absolute inset-0 flex flex-col" style={{ display: showAI ? 'flex' : 'none' }}>
                <AIHarness currentFile={activeFile} />
              </div>
            )}

            {/* Whiteboard — stays mounted after first open */}
            {everOpened.whiteboard && (
              <div className="absolute inset-0" style={{ display: showWhiteboard ? 'block' : 'none' }}>
                <Whiteboard vaultPath={vaultPath} />
              </div>
            )}

            {/* Kanban — stays mounted after first open */}
            {everOpened.kanban && (
              <div className="absolute inset-0 flex flex-col" style={{ display: showKanban ? 'flex' : 'none' }}>
                <KanbanBoard files={files} activeFile={activeFile} onOpenFile={handleOpenFile} showKanban={showKanban} />
              </div>
            )}
          </div>
          </div>{/* end workspace zoom wrapper */}

          {/* Galaxy view overlay — sibling to workspace wrapper so it isn't affected by the zoom-out transform */}
          {showGalaxy && (
            <GalaxyView
              spaceGroups={spaceGroups}
              currentSpacePath={vaultPath}
              onSelectSpace={handleSelectFromGalaxy}
              onClose={handleCloseGalaxy}
              onLogout={() => { handleLogout() }}
            />
          )}
        </>
      )}
    </div>
  )
}
