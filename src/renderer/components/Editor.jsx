import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import 'katex/dist/katex.min.css'

const AUTOSAVE_DELAY = 1000
const GLASS_BORDER = 'var(--glass-border)'

// Renders both [[wiki links]] and #tags as clickable spans
function InlineRenderer({ children, files, onWikiLinkClick }) {
  const text = String(children)
  const parts = text.split(/(\[\[[^\]]+\]\]|#[a-zA-Z][a-zA-Z0-9_-]*)/g)
  if (parts.length === 1) return <>{children}</>
  return (
    <>
      {parts.map((part, i) => {
        const wikiMatch = part.match(/^\[\[(.+)\]\]$/)
        const tagMatch  = part.match(/^#([a-zA-Z][a-zA-Z0-9_-]*)$/)
        if (wikiMatch) {
          const noteName = wikiMatch[1]
          const exists = files.some(f => f.name.toLowerCase() === noteName.toLowerCase())
          return (
            <span key={i} className={exists ? 'wiki-link' : 'wiki-link-missing'}
              onClick={() => onWikiLinkClick(noteName)}
              title={exists ? `Open "${noteName}"` : `Create "${noteName}"`}
            >{noteName}</span>
          )
        }
        if (tagMatch) {
          const tagName = tagMatch[1]
          const exists = files.some(f => f.name.toLowerCase() === tagName.toLowerCase())
          return (
            <span key={i}
              onClick={() => onWikiLinkClick(tagName)}
              title={exists ? `Open "${tagName}"` : `Create note "${tagName}"`}
              style={{ color: 'var(--accent-text)', cursor: 'pointer', fontWeight: 500, borderRadius: 3, padding: '0 2px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >#{tagName}</span>
          )
        }
        return <React.Fragment key={i}>{part}</React.Fragment>
      })}
    </>
  )
}

// Encode path segments (spaces → %20) but preserve slashes and Windows drive colon
function encodeFilePath(normalizedPath) {
  return normalizedPath.split('/').map(seg => encodeURIComponent(seg)).join('/')
}

function resolveImgSrc(src, filePath) {
  if (!src || src.startsWith('http') || src.startsWith('file://') || src.startsWith('data:')) return src
  const p = src.replace(/\\/g, '/')
  // Absolute Windows path: C:/path/...
  if (/^[A-Za-z]:\//.test(p)) {
    const drive = p.slice(0, 2)                          // "C:"
    const rest  = encodeFilePath(p.slice(2))             // "/Users/tran/OneDrive%20..."
    return `file:///${drive}${rest}`
  }
  // Absolute Unix path
  if (p.startsWith('/')) return `file://${encodeFilePath(p)}`
  // Relative path — resolve against the note's directory
  if (filePath) {
    const dir  = filePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
    const full = `${dir}/${p}`
    if (/^[A-Za-z]:\//.test(full)) {
      return `file:///${full.slice(0, 2)}${encodeFilePath(full.slice(2))}`
    }
    return `file://${encodeFilePath(full)}`
  }
  return src
}

// Loads local images: tries IPC first (reliable, handles spaces), falls back to fetch+file://
function LocalImage({ src, alt, noteFilePath, onImageClick }) {
  const [dataSrc, setDataSrc] = useState(null)
  useEffect(() => {
    if (!src) return
    if (src.startsWith('http') || src.startsWith('data:')) { setDataSrc(src); return }

    // Resolve relative path to absolute
    let p = src.replace(/\\/g, '/')
    if (!/^[A-Za-z]:\//.test(p) && !p.startsWith('/') && noteFilePath) {
      const dir = noteFilePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
      p = `${dir}/${p}`
    }

    // Method 1: IPC (requires Electron restart after preload change)
    const viaIpc = () => {
      if (!window.electronAPI?.readImageAsDataUrl) return Promise.reject(new Error('no IPC'))
      return window.electronAPI.readImageAsDataUrl(p).then(r => {
        if (!r?.success) throw new Error('IPC success:false')
        return r.dataUrl
      })
    }

    // Method 2: fetch via local-file:// custom protocol (registered in main.js, bypassCSP:true)
    const viaFetch = () => {
      const driveMatch = p.match(/^([A-Za-z]:)(.+)$/)
      const encodedPath = driveMatch
        ? `/${driveMatch[1]}${driveMatch[2].split('/').map(encodeURIComponent).join('/')}`
        : p.split('/').map(encodeURIComponent).join('/')
      const localUrl = `local-file://${encodedPath}`
      return fetch(localUrl)
        .then(r => { if (!r.ok) throw new Error(`fetch ${r.status}`); return r.blob() })
        .then(blob => new Promise((res, rej) => {
          const reader = new FileReader()
          reader.onload = e => res(e.target.result)
          reader.onerror = rej
          reader.readAsDataURL(blob)
        }))
    }

    viaIpc()
      .catch(() => viaFetch())
      .then(url => setDataSrc(url))
      .catch(e => console.error('[LocalImage] failed:', e.message, p))
  }, [src, noteFilePath])

  if (!dataSrc) return null
  return (
    <img
      src={dataSrc}
      alt={alt || ''}
      onClick={() => onImageClick && onImageClick(dataSrc, alt)}
      style={{ maxWidth: '100%', borderRadius: 6, marginTop: 8, marginBottom: 8, cursor: 'zoom-in' }}
    />
  )
}

function createComponents(files, onWikiLinkClick, filePath, onLinkClick, onImageClick) {
  return {
    p:  ({ children }) => <p>{processChildren(children, files, onWikiLinkClick)}</p>,
    li: ({ children }) => <li>{processChildren(children, files, onWikiLinkClick)}</li>,
    td: ({ children }) => <td>{processChildren(children, files, onWikiLinkClick)}</td>,
    img: ({ src, alt }) => <LocalImage src={src} alt={alt} noteFilePath={filePath} onImageClick={onImageClick} />,
    a: ({ href, children }) => (
      <a
        href={href}
        onClick={e => { e.preventDefault(); onLinkClick && onLinkClick(href, e.clientX, e.clientY) }}
        style={{ color: 'var(--accent-text)', textDecoration: 'underline', cursor: 'pointer' }}
      >{children}</a>
    ),
  }
}

function processChildren(children, files, onWikiLinkClick) {
  if (typeof children === 'string')
    return <InlineRenderer files={files} onWikiLinkClick={onWikiLinkClick}>{children}</InlineRenderer>
  if (Array.isArray(children))
    return children.map((child, i) =>
      typeof child === 'string'
        ? <InlineRenderer key={i} files={files} onWikiLinkClick={onWikiLinkClick}>{child}</InlineRenderer>
        : <React.Fragment key={i}>{child}</React.Fragment>
    )
  return children
}

export default function Editor({ file, files, vaultPath, onWikiLinkClick, onCreateFile, onCreateFileSilent }) {
  const [content, setContent] = useState('')
  const [mode, setMode] = useState(file.isNew ? 'edit' : 'preview')
  const [saveStatus, setSaveStatus] = useState('saved')
  const [isLoading, setIsLoading] = useState(true)
  const [linkPopup, setLinkPopup] = useState(null)     // { href, x, y }
  const [previewPane, setPreviewPane] = useState(null)  // { title, content, type }
  const [lightbox, setLightbox] = useState(null)        // { src, alt }
  const autosaveTimer = useRef(null)
  const lastSavedContent = useRef('')
  const textareaRef = useRef(null)
  const previewRef = useRef(null)
  const searchInputRef = useRef(null)
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIdx,   setSearchIdx]   = useState(0)
  const [matchCount,  setMatchCount]  = useState(0)
  // Undo / redo — refs hold the stack to avoid re-renders on every keystroke
  const undoStack    = useRef([])
  const undoPointer  = useRef(-1)
  const undoTimerRef = useRef(null)
  const [undoVersion, setUndoVersion] = useState(0) // bumped to re-render button states
  // Find & Replace
  const replaceInputRef = useRef(null)
  const [replaceOpen,  setReplaceOpen]  = useState(false)
  const [replaceQuery, setReplaceQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setSaveStatus('saved')
    window.electronAPI.readFile(file.path).then(result => {
      if (cancelled) return
      if (result.success) {
        setContent(result.content)
        lastSavedContent.current = result.content
        undoStack.current = [result.content]
        undoPointer.current = 0
        setUndoVersion(0)
      }
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [file.path])

  useEffect(() => {
    if (isLoading) return
    if (content === lastSavedContent.current) { setSaveStatus('saved'); return }
    setSaveStatus('unsaved')
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      setSaveStatus('saving')
      const result = await window.electronAPI.writeFile(file.path, content)
      if (result.success) { lastSavedContent.current = content; setSaveStatus('saved') }
    }, AUTOSAVE_DELAY)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
  }, [content, file.path, isLoading])

  // Push a snapshot to the undo stack; called on debounce and before explicit edits
  const commitUndo = useCallback((val) => {
    const stack = undoStack.current.slice(0, undoPointer.current + 1)
    if (stack.length > 0 && stack[stack.length - 1] === val) return
    stack.push(val)
    if (stack.length > 200) stack.splice(0, stack.length - 200)
    undoStack.current = stack
    undoPointer.current = stack.length - 1
    setUndoVersion(v => v + 1)
  }, [])

  const handleChange = useCallback((e) => {
    const val = e.target.value
    setContent(val)
    // Debounce: commit a snapshot 400 ms after typing pauses
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => commitUndo(val), 400)
  }, [commitUndo])

  // Insert text at cursor (replaces selection if any)
  const insertAtCursor = useCallback((text) => {
    if (mode !== 'edit' || !textareaRef.current) return
    const ta = textareaRef.current
    const start = ta.selectionStart, end = ta.selectionEnd
    commitUndo(content)
    const newContent = content.substring(0, start) + text + content.substring(end)
    setContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + text.length
      ta.selectionEnd = start + text.length
    }, 0)
  }, [content, mode, commitUndo])

  // Wrap selected text with before/after markers, or insert with placeholder if nothing selected
  const wrapOrInsert = useCallback((before, after = '', placeholder = '') => {
    if (mode !== 'edit' || !textareaRef.current) return
    const ta = textareaRef.current
    const start = ta.selectionStart, end = ta.selectionEnd
    commitUndo(content)
    const sel = content.substring(start, end)
    const mid = sel || placeholder
    const newContent = content.substring(0, start) + before + mid + after + content.substring(end)
    setContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + before.length
      ta.selectionEnd = start + before.length + mid.length
    }, 0)
  }, [content, mode, commitUndo])

  // Indent every line that touches the selection; if no selection, insert 2 spaces at cursor
  const indentSelection = useCallback(() => {
    if (!textareaRef.current) return
    const ta = textareaRef.current
    const start = ta.selectionStart, end = ta.selectionEnd
    commitUndo(content)
    if (start === end) {
      const nc = content.substring(0, start) + '  ' + content.substring(end)
      setContent(nc)
      setTimeout(() => { ta.selectionStart = start + 2; ta.selectionEnd = start + 2 }, 0)
      return
    }
    const firstLineStart = content.lastIndexOf('\n', start - 1) + 1
    const block = content.slice(firstLineStart, end)
    const indented = block.split('\n').map(l => '  ' + l).join('\n')
    setContent(content.slice(0, firstLineStart) + indented + content.slice(end))
    setTimeout(() => { ta.selectionStart = firstLineStart; ta.selectionEnd = firstLineStart + indented.length }, 0)
  }, [content, commitUndo])

  // Outdent every line that touches the selection (remove up to 2 leading spaces)
  const outdentSelection = useCallback(() => {
    if (!textareaRef.current) return
    const ta = textareaRef.current
    const start = ta.selectionStart, end = ta.selectionEnd
    commitUndo(content)
    const firstLineStart = content.lastIndexOf('\n', start - 1) + 1
    const block = content.slice(firstLineStart, end)
    const outdented = block.split('\n').map(l =>
      l.startsWith('  ') ? l.slice(2) : l.startsWith(' ') ? l.slice(1) : l
    ).join('\n')
    setContent(content.slice(0, firstLineStart) + outdented + content.slice(end))
    setTimeout(() => { ta.selectionStart = firstLineStart; ta.selectionEnd = firstLineStart + outdented.length }, 0)
  }, [content, commitUndo])

  const handleKeyDown = useCallback((e) => {
    const ta = e.target
    const ctrl = e.ctrlKey || e.metaKey

    // ── Undo (Ctrl+Z) ────────────────────────────────────────────────────────
    if (ctrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (undoPointer.current > 0) {
        undoPointer.current--
        setContent(undoStack.current[undoPointer.current])
        setUndoVersion(v => v + 1)
      }
      return
    }
    // ── Redo (Ctrl+Y or Ctrl+Shift+Z) ────────────────────────────────────────
    if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey))) {
      e.preventDefault()
      if (undoPointer.current < undoStack.current.length - 1) {
        undoPointer.current++
        setContent(undoStack.current[undoPointer.current])
        setUndoVersion(v => v + 1)
      }
      return
    }
    // ── Save (Ctrl+S) ─────────────────────────────────────────────────────────
    if (ctrl && e.key === 's') {
      e.preventDefault()
      if (content !== lastSavedContent.current) {
        setSaveStatus('saving')
        window.electronAPI.writeFile(file.path, content).then(result => {
          if (result.success) { lastSavedContent.current = content; setSaveStatus('saved') }
        })
      }
      return
    }
    // ── Formatting shortcuts (edit mode only) ─────────────────────────────────
    if (ctrl && e.key === 'b') { e.preventDefault(); wrapOrInsert('**', '**', 'bold'); return }
    if (ctrl && e.key === 'i') { e.preventDefault(); wrapOrInsert('*', '*', 'italic'); return }
    if (ctrl && e.key === 'u') { e.preventDefault(); wrapOrInsert('<u>', '</u>', 'underline'); return }
    if (ctrl && (e.key === 'X' || (e.shiftKey && e.key.toLowerCase() === 'x'))) {
      e.preventDefault(); wrapOrInsert('~~', '~~', 'text'); return
    }
    // ── Duplicate line (Ctrl+D) ───────────────────────────────────────────────
    if (ctrl && e.key === 'd') {
      e.preventDefault()
      const start = ta.selectionStart
      const lines = content.split('\n')
      let pos = 0, lineIdx = 0, lineStart = 0
      for (let i = 0; i < lines.length; i++) {
        if (pos + lines[i].length >= start) { lineIdx = i; lineStart = pos; break }
        pos += lines[i].length + 1
      }
      const lineEnd = lineStart + lines[lineIdx].length
      commitUndo(content)
      const newContent = content.slice(0, lineEnd) + '\n' + lines[lineIdx] + content.slice(lineEnd)
      setContent(newContent)
      const offset = start - lineStart
      setTimeout(() => { ta.selectionStart = lineEnd + 1 + offset; ta.selectionEnd = lineEnd + 1 + offset }, 0)
      return
    }
    // ── Delete line (Ctrl+Shift+K) ────────────────────────────────────────────
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      const start = ta.selectionStart
      const lines = content.split('\n')
      let pos = 0, lineIdx = 0, lineStart = 0
      for (let i = 0; i < lines.length; i++) {
        if (pos + lines[i].length >= start) { lineIdx = i; lineStart = pos; break }
        pos += lines[i].length + 1
      }
      const lineEnd = lineStart + lines[lineIdx].length
      commitUndo(content)
      let newContent
      if (lineEnd < content.length)      newContent = content.slice(0, lineStart) + content.slice(lineEnd + 1)
      else if (lineStart > 0)            newContent = content.slice(0, lineStart - 1) + content.slice(lineEnd)
      else                               newContent = ''
      setContent(newContent)
      setTimeout(() => { const p = Math.min(lineStart, newContent.length); ta.selectionStart = p; ta.selectionEnd = p }, 0)
      return
    }
    // ── Move line up / down (Alt+Up / Alt+Down) ───────────────────────────────
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const start = ta.selectionStart
      const lines = content.split('\n')
      let pos = 0, lineIdx = 0, lineStart = 0
      for (let i = 0; i < lines.length; i++) {
        if (pos + lines[i].length >= start) { lineIdx = i; lineStart = pos; break }
        pos += lines[i].length + 1
      }
      const swapIdx = e.key === 'ArrowUp' ? lineIdx - 1 : lineIdx + 1
      if (swapIdx < 0 || swapIdx >= lines.length) return
      commitUndo(content)
      const newLines = [...lines];
      [newLines[lineIdx], newLines[swapIdx]] = [newLines[swapIdx], newLines[lineIdx]]
      const newContent = newLines.join('\n')
      setContent(newContent)
      let newPos = 0
      for (let i = 0; i < swapIdx; i++) newPos += newLines[i].length + 1
      newPos += (start - lineStart)
      setTimeout(() => { ta.selectionStart = newPos; ta.selectionEnd = newPos }, 0)
      return
    }
    // ── Tab / Shift+Tab — indent / outdent ────────────────────────────────────
    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) outdentSelection()
      else indentSelection()
    }
  }, [content, wrapOrInsert, commitUndo, indentSelection, outdentSelection, file.path])

  // Tag button: creates a topic folder+note for the selected word and inserts [[word]] link
  const insertTag = useCallback(async () => {
    if (mode !== 'edit' || !textareaRef.current) return
    const ta = textareaRef.current
    const start = ta.selectionStart, end = ta.selectionEnd
    if (start === end) return  // require a selection
    const raw = content.substring(start, end).trim()
    // Sanitise into a valid note name (keep spaces for readability)
    const noteName = raw.replace(/[^\w\s-]/g, '').trim()
    if (!noteName) return
    // Create the folder+note if it doesn't already exist — stays in current note
    const exists = files.some(f => f.name.toLowerCase() === noteName.toLowerCase())
    if (!exists && onCreateFileSilent) {
      await onCreateFileSilent(`${noteName}/${noteName}`, `# ${noteName}\n\n`)
    }
    // Insert [[noteName]] replacing the selection
    const insertion = `[[${noteName}]]`
    const newContent = content.substring(0, start) + insertion + content.substring(end)
    setContent(newContent)
    // Switch to preview so the link is immediately visible and clickable
    setMode('preview')
  }, [content, mode, files, onCreateFileSilent])

  // Paste handler — saves image to vault/assets/ and inserts ![image](path)
  const handlePaste = useCallback((e) => {
    if (!vaultPath) return
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) return
        const reader = new FileReader()
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result
          const ext = item.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
          const fileName = `image-${Date.now()}.${ext}`
          // Save to note's own directory so relative path `assets/img.png` always resolves correctly
          const noteDir = file.path.replace(/\\/g, '/').replace(/\/[^/]+$/, '')
          const result = await window.electronAPI.saveImage(noteDir, dataUrl, fileName)
          if (result.success) {
            insertAtCursor(`![image](assets/${fileName})`)
            setMode('preview')
          }
        }
        reader.readAsDataURL(blob)
        break
      }
    }
  }, [vaultPath, file.path, insertAtCursor])

  // ── Find (Ctrl+F) / Find & Replace (Ctrl+H) ──────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setReplaceOpen(false)
        setTimeout(() => { searchInputRef.current?.select() }, 0)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault()
        setSearchOpen(true)
        setReplaceOpen(true)
        setTimeout(() => { searchInputRef.current?.select() }, 0)
      }
      if (e.key === 'Escape') { setSearchOpen(false); setReplaceOpen(false); setLightbox(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Replace handlers ──────────────────────────────────────────────────────
  const handleReplaceOne = useCallback(() => {
    if (!searchQuery.trim()) return
    const q = searchQuery.toLowerCase()
    const idx = content.toLowerCase().indexOf(q)
    if (idx === -1) return
    commitUndo(content)
    setContent(content.slice(0, idx) + replaceQuery + content.slice(idx + searchQuery.length))
  }, [searchQuery, replaceQuery, content, commitUndo])

  const handleReplaceAll = useCallback(() => {
    if (!searchQuery.trim()) return
    commitUndo(content)
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    setContent(content.replace(new RegExp(escaped, 'gi'), replaceQuery))
  }, [searchQuery, replaceQuery, content, commitUndo])

  // Reset match index whenever the query or mode changes
  useEffect(() => { setSearchIdx(0) }, [searchQuery, mode])

  // Edit mode: select current match in textarea
  useEffect(() => {
    if (!searchOpen || mode !== 'edit') return
    const q = searchQuery.trim().toLowerCase()
    if (!q || !textareaRef.current) { setMatchCount(0); return }
    const lower = content.toLowerCase()
    const hits = []
    let i = 0
    while ((i = lower.indexOf(q, i)) !== -1) { hits.push(i); i += q.length }
    setMatchCount(hits.length)
    if (!hits.length) return
    const idx = ((searchIdx % hits.length) + hits.length) % hits.length
    textareaRef.current.focus()
    textareaRef.current.setSelectionRange(hits[idx], hits[idx] + q.length)
  }, [searchOpen, searchQuery, searchIdx, content, mode])

  // Preview mode: highlight matches directly in the rendered DOM
  useEffect(() => {
    if (mode !== 'preview' || !previewRef.current) return
    const root = previewRef.current
    root.querySelectorAll('mark[data-sh]').forEach(m => {
      m.replaceWith(document.createTextNode(m.textContent))
    })
    root.normalize()
    if (!searchOpen || !searchQuery.trim()) { setMatchCount(0); return }
    const q = searchQuery.trim().toLowerCase()
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const textNodes = []
    let n
    while ((n = walker.nextNode())) textNodes.push(n)
    let total = 0
    textNodes.forEach(tn => {
      const text = tn.textContent
      const lower = text.toLowerCase()
      if (!lower.includes(q)) return
      const frag = document.createDocumentFragment()
      let last = 0, pos = 0
      while ((pos = lower.indexOf(q, last)) !== -1) {
        if (pos > last) frag.appendChild(document.createTextNode(text.slice(last, pos)))
        const mark = document.createElement('mark')
        mark.setAttribute('data-sh', total)
        mark.textContent = text.slice(pos, pos + q.length)
        mark.style.cssText = 'background:rgba(255,200,0,0.32);border-radius:2px;color:inherit'
        frag.appendChild(mark)
        total++
        last = pos + q.length
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
      tn.parentNode.replaceChild(frag, tn)
    })
    setMatchCount(total)
    if (total > 0) {
      const safeIdx = ((searchIdx % total) + total) % total
      const cur = root.querySelector(`mark[data-sh="${safeIdx}"]`)
      if (cur) {
        cur.style.cssText = 'background:rgba(255,165,0,0.75);border-radius:2px;color:inherit;outline:2px solid rgba(255,165,0,0.9)'
        cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [mode, content, searchQuery, searchOpen, searchIdx])

  const handleLinkClick = useCallback((href, x, y) => {
    setLinkPopup({ href, x, y })
  }, [])

  const handleLinkPreview = useCallback(async (href) => {
    setLinkPopup(null)
    const nameOnly = href.replace(/\.md$/, '').split('/').pop()
    const linkedFile = files.find(f => f.name.toLowerCase() === nameOnly.toLowerCase())
    if (linkedFile) {
      const result = await window.electronAPI.readFile(linkedFile.path)
      if (result.success) setPreviewPane({ title: linkedFile.name, content: result.content, type: 'markdown' })
      return
    }
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(href)) {
      setPreviewPane({ title: href.split('/').pop(), content: resolveImgSrc(href, file.path), type: 'image' })
      return
    }
    window.open(href, '_blank')
  }, [files, file.path])

  // Undo/redo availability — recomputed whenever undoVersion bumps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canUndo = undoPointer.current > 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canRedo = undoPointer.current < undoStack.current.length - 1

  // Extract wiki links from content for display as chips
  const tags = [...new Set((content.match(/\[\[([^\]]+)\]\]/g) || []))]

  const components = createComponents(files, onWikiLinkClick, file.path, handleLinkClick, (src, alt) => setLightbox({ src, alt }))

  const saveIndicator = {
    saved:   { color: '#4ade80', dot: '●', label: 'Saved' },
    saving:  { color: '#fbbf24', dot: '●', label: 'Saving…' },
    unsaved: { color: '#f97316', dot: '●', label: 'Unsaved' },
  }[saveStatus]

  // Link popup derived values (computed at render time when popup is open)
  const popupHref = linkPopup?.href || ''
  const popupIsExternal = popupHref.startsWith('http') || popupHref.startsWith('//') || popupHref.startsWith('mailto:')
  const popupNameOnly = popupHref.replace(/\.md$/, '').split('/').pop()
  const popupLinkedFile = !popupIsExternal && files.find(f => f.name.toLowerCase() === popupNameOnly.toLowerCase())

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: `1px solid ${GLASS_BORDER}` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm truncate max-w-xs tracking-tight" style={{ color: 'var(--text-muted)' }} title={file.path}>
            {file.name}.md
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono flex-shrink-0"
            style={{ color: saveIndicator.color, background: `${saveIndicator.color}18`, border: `1px solid ${saveIndicator.color}30` }}
          >{saveIndicator.dot} {saveIndicator.label}</span>
          {/* Link chips — click to navigate to linked topic */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {tags.slice(0, 5).map(tag => {
                const noteName = tag.slice(2, -2)  // strip [[ and ]]
                return (
                  <span key={tag}
                    onClick={() => onWikiLinkClick(noteName)}
                    className="text-[10px] px-1.5 py-px rounded-full cursor-pointer transition-all duration-150"
                    style={{ background: 'var(--accent-light)', color: 'var(--accent-text)', border: '1px solid var(--accent-glow)' }}
                    title={`Open "${noteName}"`}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-light)'}
                  >{noteName}</span>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Tag button: select a word → creates topic folder+note, inserts [[link]], switches to preview */}
          <button
            onClick={insertTag}
            disabled={mode !== 'edit'}
            title="Select a word then click to create a linked topic note"
            className="text-xs px-2 py-1 rounded-md transition-all duration-150"
            style={{ color: mode === 'edit' ? 'var(--accent-text)' : 'var(--text-dim)', border: '1px solid var(--accent-glow)', background: 'var(--accent-subtle)' }}
            onMouseEnter={e => { if (mode === 'edit') e.currentTarget.style.background = 'var(--accent-light)' }}
            onMouseLeave={e => { if (mode === 'edit') e.currentTarget.style.background = 'var(--accent-subtle)' }}
          ># tag</button>

          {/* Mode toggle */}
          <div className="flex items-center p-0.5 rounded-lg" style={{ background: 'var(--input-bg)', border: `1px solid ${GLASS_BORDER}` }}>
            {['edit', 'preview'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 capitalize"
                style={mode === m
                  ? { background: 'var(--accent-gradient)', color: '#fff', boxShadow: '0 2px 8px var(--accent-glow)' }
                  : { color: 'var(--text-muted)' }}
                onMouseEnter={e => { if (mode !== m) e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { if (mode !== m) e.currentTarget.style.color = 'var(--text-muted)' }}
              >{m}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Formatting toolbar — visible in edit mode only */}
      {mode === 'edit' && (
        <div className="flex items-center gap-0.5 px-3 py-1 flex-shrink-0 flex-wrap"
          style={{ background: 'var(--glass-bg)', borderBottom: `1px solid ${GLASS_BORDER}` }}>
          {/* Undo / Redo */}
          {[
            { l: '↺', t: 'Undo  (Ctrl+Z)',  fn: () => { if (undoPointer.current > 0) { undoPointer.current--; setContent(undoStack.current[undoPointer.current]); setUndoVersion(v => v + 1) } }, disabled: !canUndo },
            { l: '↻', t: 'Redo  (Ctrl+Y)',  fn: () => { if (undoPointer.current < undoStack.current.length - 1) { undoPointer.current++; setContent(undoStack.current[undoPointer.current]); setUndoVersion(v => v + 1) } }, disabled: !canRedo },
          ].map((btn, i) => (
            <button key={`ur${i}`} onClick={btn.fn} title={btn.t} disabled={btn.disabled}
              className="px-1.5 py-0.5 rounded text-xs transition-all duration-100 font-mono"
              style={{ background: 'transparent', border: 'none', color: btn.disabled ? 'var(--text-dim)' : 'var(--text-muted)', cursor: btn.disabled ? 'default' : 'pointer', opacity: btn.disabled ? 0.4 : 1 }}
              onMouseEnter={e => { if (!btn.disabled) e.currentTarget.style.background = 'var(--accent-subtle)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >{btn.l}</button>
          ))}
          <span style={{ width: 1, height: 14, background: 'var(--glass-border)', margin: '0 3px', display: 'inline-block', alignSelf: 'center', flexShrink: 0 }} />
          {/* Formatting */}
          {[
            { l: 'B',    t: 'Bold  (Ctrl+B)',            fn: () => wrapOrInsert('**', '**', 'bold'),                s: { fontWeight: 700 } },
            { l: 'I',    t: 'Italic  (Ctrl+I)',           fn: () => wrapOrInsert('*', '*', 'italic'),                s: { fontStyle: 'italic' } },
            { l: 'U',    t: 'Underline  (Ctrl+U)',        fn: () => wrapOrInsert('<u>', '</u>', 'underline'),        s: { textDecoration: 'underline' } },
            { l: '~~',   t: 'Strikethrough  (Ctrl+⇧+X)', fn: () => wrapOrInsert('~~', '~~', 'text') },
            { l: '`',    t: 'Inline code',                fn: () => wrapOrInsert('`', '`', 'code') },
            null,
            { l: 'H1',   t: 'Heading 1',                  fn: () => wrapOrInsert('\n# ', '', 'Heading 1') },
            { l: 'H2',   t: 'Heading 2',                  fn: () => wrapOrInsert('\n## ', '', 'Heading 2') },
            { l: 'H3',   t: 'Heading 3',                  fn: () => wrapOrInsert('\n### ', '', 'Heading 3') },
            null,
            { l: '❝',    t: 'Blockquote',                 fn: () => wrapOrInsert('\n> ', '', 'Quote') },
            { l: '</>',  t: 'Code block',                 fn: () => wrapOrInsert('\n```\n', '\n```\n', 'code here') },
            { l: '∑',    t: 'Inline math  ($…$)',         fn: () => wrapOrInsert('$', '$', 'formula') },
            { l: '∑∑',   t: 'Math block  ($$…$$)',        fn: () => wrapOrInsert('\n$$\n', '\n$$\n', 'formula') },
            { l: '—',    t: 'Horizontal divider',         fn: () => insertAtCursor('\n\n---\n\n') },
            null,
            { l: '⊞',    t: 'Table',                      fn: () => insertAtCursor('\n| Col 1 | Col 2 | Col 3 |\n|-------|-------|-------|\n| Cell  | Cell  | Cell  |\n') },
            { l: '[↗]',  t: 'Link',                       fn: () => wrapOrInsert('[', '](url)', 'link text') },
            { l: '[⊡]',  t: 'Image',                      fn: () => wrapOrInsert('![', '](url)', 'alt text') },
            { l: '▸',    t: 'Collapsible section',        fn: () => wrapOrInsert('\n<details>\n<summary>', '</summary>\n\nContent here\n\n</details>\n', 'Title') },
            null,
            { l: '→|',   t: 'Indent  (Tab)',              fn: () => indentSelection() },
            { l: '|←',   t: 'Outdent  (Shift+Tab)',       fn: () => outdentSelection() },
            null,
            { l: '⧉',    t: 'Duplicate line  (Ctrl+D)',   fn: () => { if (!textareaRef.current) return; const ta = textareaRef.current; const start = ta.selectionStart; const lines = content.split('\n'); let pos = 0, lineIdx = 0, lineStart = 0; for (let i = 0; i < lines.length; i++) { if (pos + lines[i].length >= start) { lineIdx = i; lineStart = pos; break } pos += lines[i].length + 1 } const lineEnd = lineStart + lines[lineIdx].length; commitUndo(content); const nc = content.slice(0, lineEnd) + '\n' + lines[lineIdx] + content.slice(lineEnd); setContent(nc); setTimeout(() => { ta.selectionStart = lineEnd + 1 + (start - lineStart); ta.selectionEnd = lineEnd + 1 + (start - lineStart) }, 0) } },
            { l: '⌫ln',  t: 'Delete line  (Ctrl+⇧+K)',   fn: () => { if (!textareaRef.current) return; const ta = textareaRef.current; const start = ta.selectionStart; const lines = content.split('\n'); let pos = 0, lineIdx = 0, lineStart = 0; for (let i = 0; i < lines.length; i++) { if (pos + lines[i].length >= start) { lineIdx = i; lineStart = pos; break } pos += lines[i].length + 1 } const lineEnd = lineStart + lines[lineIdx].length; commitUndo(content); let nc; if (lineEnd < content.length) nc = content.slice(0, lineStart) + content.slice(lineEnd + 1); else if (lineStart > 0) nc = content.slice(0, lineStart - 1) + content.slice(lineEnd); else nc = ''; setContent(nc); setTimeout(() => { const p = Math.min(lineStart, nc.length); ta.selectionStart = p; ta.selectionEnd = p }, 0) } },
            { l: '⇡ln',  t: 'Move line up  (Alt+↑)',      fn: () => { if (!textareaRef.current) return; const ta = textareaRef.current; const start = ta.selectionStart; const lines = content.split('\n'); let pos = 0, lineIdx = 0, lineStart = 0; for (let i = 0; i < lines.length; i++) { if (pos + lines[i].length >= start) { lineIdx = i; lineStart = pos; break } pos += lines[i].length + 1 } if (lineIdx === 0) return; commitUndo(content); const nl = [...lines]; [nl[lineIdx], nl[lineIdx-1]] = [nl[lineIdx-1], nl[lineIdx]]; const nc = nl.join('\n'); setContent(nc); let np = 0; for (let i = 0; i < lineIdx-1; i++) np += nl[i].length + 1; np += (start - lineStart); setTimeout(() => { ta.selectionStart = np; ta.selectionEnd = np }, 0) } },
            { l: '⇣ln',  t: 'Move line down  (Alt+↓)',    fn: () => { if (!textareaRef.current) return; const ta = textareaRef.current; const start = ta.selectionStart; const lines = content.split('\n'); let pos = 0, lineIdx = 0, lineStart = 0; for (let i = 0; i < lines.length; i++) { if (pos + lines[i].length >= start) { lineIdx = i; lineStart = pos; break } pos += lines[i].length + 1 } if (lineIdx >= lines.length - 1) return; commitUndo(content); const nl = [...lines]; [nl[lineIdx], nl[lineIdx+1]] = [nl[lineIdx+1], nl[lineIdx]]; const nc = nl.join('\n'); setContent(nc); let np = 0; for (let i = 0; i < lineIdx+1; i++) np += nl[i].length + 1; np += (start - lineStart); setTimeout(() => { ta.selectionStart = np; ta.selectionEnd = np }, 0) } },
          ].map((btn, i) => btn ? (
            <button key={i} onClick={btn.fn} title={btn.t}
              className="px-1.5 py-0.5 rounded text-xs transition-all duration-100 font-mono"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', ...(btn.s || {}) }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{btn.l}</button>
          ) : (
            <span key={i} style={{ width: 1, height: 14, background: 'var(--glass-border)', margin: '0 3px', display: 'inline-block', alignSelf: 'center', flexShrink: 0 }} />
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        {/* Find / Find & Replace bar — Ctrl+F / Ctrl+H */}
        {searchOpen && (
          <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 10px', background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-border)', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
            {/* Find row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? setSearchIdx(i => i - 1) : setSearchIdx(i => i + 1) }
                  if (e.key === 'Escape') { e.preventDefault(); setSearchOpen(false); setReplaceOpen(false) }
                }}
                placeholder="Find…"
                style={{ width: 160, fontSize: 12, color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none' }}
              />
              <span style={{ fontSize: 11, color: searchQuery && matchCount === 0 ? '#f87171' : 'var(--text-dim)', minWidth: 44, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {matchCount > 0 ? `${((searchIdx % matchCount) + matchCount) % matchCount + 1} / ${matchCount}` : searchQuery.trim() ? '0 / 0' : ''}
              </span>
              {[['↑', -1, 'Previous (Shift+Enter)'], ['↓', 1, 'Next (Enter)']].map(([lbl, dir, hint]) => (
                <button key={lbl} onClick={() => setSearchIdx(i => i + dir)} title={hint}
                  style={{ fontSize: 14, lineHeight: 1, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 1px' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >{lbl}</button>
              ))}
              <button onClick={() => setReplaceOpen(r => !r)} title="Toggle Replace (Ctrl+H)"
                style={{ fontSize: 11, lineHeight: 1, background: replaceOpen ? 'var(--accent-subtle)' : 'transparent', border: '1px solid ' + (replaceOpen ? 'var(--accent-glow)' : 'transparent'), borderRadius: 4, color: replaceOpen ? 'var(--accent-text)' : 'var(--text-dim)', cursor: 'pointer', padding: '1px 5px' }}
              >⇄</button>
              <button onClick={() => { setSearchOpen(false); setReplaceOpen(false) }} title="Close (Esc)"
                style={{ fontSize: 16, lineHeight: 1, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 1px', marginLeft: 2 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >×</button>
            </div>
            {/* Replace row — shown when replaceOpen */}
            {replaceOpen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--glass-border)', paddingTop: 4 }}>
                <input
                  ref={replaceInputRef}
                  value={replaceQuery}
                  onChange={e => setReplaceQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setSearchOpen(false); setReplaceOpen(false) } }}
                  placeholder="Replace with…"
                  style={{ width: 160, fontSize: 12, color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none' }}
                />
                <button onClick={handleReplaceOne} title="Replace next" disabled={!searchQuery.trim() || mode !== 'edit'}
                  style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, border: '1px solid var(--glass-border)', background: 'var(--accent-subtle)', color: 'var(--accent-text)', cursor: 'pointer', opacity: (!searchQuery.trim() || mode !== 'edit') ? 0.4 : 1 }}
                >Replace</button>
                <button onClick={handleReplaceAll} title="Replace all" disabled={!searchQuery.trim() || mode !== 'edit'}
                  style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, border: '1px solid var(--glass-border)', background: 'var(--accent-subtle)', color: 'var(--accent-text)', cursor: 'pointer', opacity: (!searchQuery.trim() || mode !== 'edit') ? 0.4 : 1 }}
                >All</button>
              </div>
            )}
          </div>
        )}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>Loading…</span>
          </div>
        ) : mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            spellCheck={false}
            className="flex-1 w-full font-mono text-sm leading-relaxed p-6 resize-none border-none outline-none"
            style={{ background: 'transparent', color: 'var(--text-primary)', caretColor: 'var(--accent)' }}
            placeholder="Start writing in Markdown…&#10;&#10;Use [[Note Name]] to link to other notes.&#10;Use #tag to add tags."
          />
        ) : (
          <div
            className="flex-1 overflow-y-auto p-6 md:p-8"
            onClick={e => {
              const tag = e.target.tagName.toLowerCase()
              if (tag !== 'a' && tag !== 'span' && tag !== 'button' && tag !== 'img') setMode('edit')
            }}
            style={{ cursor: 'text' }}
            title="Click to edit"
          >
            <div ref={previewRef} className="markdown-body max-w-3xl mx-auto">
              {content.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]} components={components}>{content}</ReactMarkdown>
              ) : (
                <p className="text-[#6b7280]/60 italic text-sm">Nothing to preview yet. Switch to Edit mode to start writing.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Link click popup */}
      {linkPopup && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setLinkPopup(null)} />
          <div
            style={{
              position: 'fixed', left: Math.min(linkPopup.x, window.innerWidth - 210), top: linkPopup.y + 6,
              zIndex: 300, minWidth: 190, background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--glass-border)', borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.35)', overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '7px 12px 6px', borderBottom: '1px solid var(--glass-border)', fontSize: 10, color: 'var(--text-dim)', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {popupHref}
            </div>
            {popupIsExternal ? (
              <button
                onClick={() => { window.open(popupHref, '_blank'); setLinkPopup(null) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >Open in browser ↗</button>
            ) : (
              <>
                {popupLinkedFile && (
                  <button
                    onClick={() => { onWikiLinkClick(popupLinkedFile.name); setLinkPopup(null) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >Open note</button>
                )}
                <button
                  onClick={() => handleLinkPreview(popupHref)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, background: 'transparent', border: 'none', color: 'var(--accent-text)', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-subtle)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >Preview in pane</button>
              </>
            )}
          </div>
        </>
      )}

      {/* Image lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', cursor: 'zoom-out' }}
        >
          <img
            src={lightbox.src}
            alt={lightbox.alt || ''}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 8, boxShadow: '0 32px 96px rgba(0,0,0,0.7)', objectFit: 'contain', cursor: 'default' }}
          />
          {lightbox.alt && (
            <p style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: '60vw', pointerEvents: 'none' }}>{lightbox.alt}</p>
          )}
          <button
            onClick={() => setLightbox(null)}
            title="Close (Esc)"
            style={{ position: 'fixed', top: 16, right: 20, fontSize: 22, lineHeight: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '50%', width: 36, height: 36, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >×</button>
        </div>
      )}

      {/* Preview pane modal */}
      {previewPane && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={() => setPreviewPane(null)}
        >
          <div
            style={{ width: '62vw', maxWidth: 780, maxHeight: '72vh', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.55)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{previewPane.title}</span>
              <button
                onClick={() => setPreviewPane(null)}
                style={{ fontSize: 16, lineHeight: 1, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 4px' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
              >×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
              {previewPane.type === 'markdown' ? (
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]} components={components}>{previewPane.content}</ReactMarkdown>
                </div>
              ) : previewPane.type === 'image' ? (
                <img src={previewPane.content} alt={previewPane.title} style={{ maxWidth: '100%', borderRadius: 6 }} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
