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
function LocalImage({ src, alt, noteFilePath }) {
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
  return <img src={dataSrc} alt={alt || ''} style={{ maxWidth: '100%', borderRadius: 6, marginTop: 8, marginBottom: 8 }} />
}

function createComponents(files, onWikiLinkClick, filePath, onLinkClick) {
  return {
    p:  ({ children }) => <p>{processChildren(children, files, onWikiLinkClick)}</p>,
    li: ({ children }) => <li>{processChildren(children, files, onWikiLinkClick)}</li>,
    td: ({ children }) => <td>{processChildren(children, files, onWikiLinkClick)}</td>,
    img: ({ src, alt }) => <LocalImage src={src} alt={alt} noteFilePath={filePath} />,
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
  const [linkPopup, setLinkPopup] = useState(null)   // { href, x, y }
  const [previewPane, setPreviewPane] = useState(null) // { title, content, type }
  const autosaveTimer = useRef(null)
  const lastSavedContent = useRef('')
  const textareaRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setSaveStatus('saved')
    window.electronAPI.readFile(file.path).then(result => {
      if (cancelled) return
      if (result.success) { setContent(result.content); lastSavedContent.current = result.content }
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

  const handleChange = useCallback((e) => setContent(e.target.value), [])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.target.selectionStart, end = e.target.selectionEnd
      const newContent = content.substring(0, start) + '  ' + content.substring(end)
      setContent(newContent)
      setTimeout(() => { e.target.selectionStart = start + 2; e.target.selectionEnd = start + 2 }, 0)
    }
  }, [content])

  // Insert text at cursor (replaces selection if any)
  const insertAtCursor = useCallback((text) => {
    if (mode !== 'edit' || !textareaRef.current) return
    const ta = textareaRef.current
    const start = ta.selectionStart, end = ta.selectionEnd
    const newContent = content.substring(0, start) + text + content.substring(end)
    setContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + text.length
      ta.selectionEnd = start + text.length
    }, 0)
  }, [content, mode])

  // Wrap selected text with before/after markers, or insert with placeholder if nothing selected
  const wrapOrInsert = useCallback((before, after = '', placeholder = '') => {
    if (mode !== 'edit' || !textareaRef.current) return
    const ta = textareaRef.current
    const start = ta.selectionStart, end = ta.selectionEnd
    const sel = content.substring(start, end)
    const mid = sel || placeholder
    const newContent = content.substring(0, start) + before + mid + after + content.substring(end)
    setContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + before.length
      ta.selectionEnd = start + before.length + mid.length
    }, 0)
  }, [content, mode])

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

  // Extract wiki links from content for display as chips
  const tags = [...new Set((content.match(/\[\[([^\]]+)\]\]/g) || []))]

  const components = createComponents(files, onWikiLinkClick, file.path, handleLinkClick)

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
          {[
            { l: 'B',    t: 'Bold',                  fn: () => wrapOrInsert('**', '**', 'bold'),                              s: { fontWeight: 700 } },
            { l: 'I',    t: 'Italic',                 fn: () => wrapOrInsert('*', '*', 'italic'),                              s: { fontStyle: 'italic' } },
            { l: '~~',   t: 'Strikethrough',          fn: () => wrapOrInsert('~~', '~~', 'text') },
            { l: '`',    t: 'Inline code',            fn: () => wrapOrInsert('`', '`', 'code') },
            null,
            { l: 'H1',   t: 'Heading 1',              fn: () => wrapOrInsert('\n# ', '', 'Heading 1') },
            { l: 'H2',   t: 'Heading 2',              fn: () => wrapOrInsert('\n## ', '', 'Heading 2') },
            { l: 'H3',   t: 'Heading 3',              fn: () => wrapOrInsert('\n### ', '', 'Heading 3') },
            null,
            { l: '❝',    t: 'Blockquote',             fn: () => wrapOrInsert('\n> ', '', 'Quote') },
            { l: '</>',  t: 'Code block',             fn: () => wrapOrInsert('\n```\n', '\n```\n', 'code here') },
            { l: '∑',    t: 'Inline math  ($…$)',     fn: () => wrapOrInsert('$', '$', 'formula') },
            { l: '∑∑',   t: 'Math block  ($$…$$)',    fn: () => wrapOrInsert('\n$$\n', '\n$$\n', 'formula') },
            { l: '—',    t: 'Horizontal divider',     fn: () => insertAtCursor('\n\n---\n\n') },
            null,
            { l: '⊞',    t: 'Table',                  fn: () => insertAtCursor('\n| Col 1 | Col 2 | Col 3 |\n|-------|-------|-------|\n| Cell  | Cell  | Cell  |\n') },
            { l: '[↗]',  t: 'Link',                   fn: () => wrapOrInsert('[', '](url)', 'link text') },
            { l: '[⊡]',  t: 'Image',                  fn: () => wrapOrInsert('![', '](url)', 'alt text') },
            { l: '▸',    t: 'Collapsible section',    fn: () => wrapOrInsert('\n<details>\n<summary>', '</summary>\n\nContent here\n\n</details>\n', 'Title') },
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
            // Click on the preview canvas (not on a link/span) → enter edit mode
            const tag = e.target.tagName.toLowerCase()
            if (tag !== 'a' && tag !== 'span' && tag !== 'button') setMode('edit')
          }}
          style={{ cursor: 'text' }}
          title="Click to edit"
        >
          <div className="markdown-body max-w-3xl mx-auto">
            {content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]} components={components}>{content}</ReactMarkdown>
            ) : (
              <p className="text-[#6b7280]/60 italic text-sm">Nothing to preview yet. Switch to Edit mode to start writing.</p>
            )}
          </div>
        </div>
      )}

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
