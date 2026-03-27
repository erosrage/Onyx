import React, { useState, useCallback, useEffect } from 'react'
import VaultPicker from './components/VaultPicker'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import GraphView from './components/GraphView'
import AIHarness from './components/AIHarness'
import Whiteboard from './components/Whiteboard'
import KanbanBoard from './components/KanbanBoard'

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('onyx-theme') || 'dark')
  const [vaultPath, setVaultPath] = useState(() => sessionStorage.getItem('vaultPath') || null)
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [activeFile, setActiveFile] = useState(null)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [isResizing, setIsResizing] = useState(false)
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

  const loadVault = useCallback(async () => {
    if (!vaultPath) return
    try {
      const result = await window.electronAPI.readVault(vaultPath)
      if (result.success) {
        setFiles(result.files)
        setFolders(result.folders || [])
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

  const handleSelectVault = async () => {
    const path = await window.electronAPI.selectVault()
    if (path) {
      sessionStorage.setItem('vaultPath', path)
      setVaultPath(path)
      setActiveFile(null)
    }
  }

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

  const handleMoveFile = useCallback(async (file, targetFolder) => {
    const folderParts = file.folder.split('/')
    const topLevelFolder = folderParts[0]
    if (topLevelFolder === targetFolder) return
    if (folderParts.length > 1) {
      // Sub-folder note: move entire directory (e.g., Work/NoteName → Personal/NoteName)
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
      // Flat file: read, create at new location, delete old
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
      className="flex h-screen w-screen overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--bg-primary), var(--bg-secondary), var(--bg-primary))',
        color: 'var(--text-primary)',
      }}
    >
      {!vaultPath ? (
        <VaultPicker onSelectVault={handleSelectVault} theme={theme} onSetTheme={applyTheme} />
      ) : (
        <>
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
              onChangeVault={handleSelectVault}
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
        </>
      )}
    </div>
  )
}
