import React, { useState, useMemo, useRef, useEffect } from 'react'

// ── Color palette ─────────────────────────────────────────────────────────────
const PALETTE = [
  { bg: 'rgba(124,58,237,0.18)', border: 'rgba(167,139,250,0.6)', glow: 'rgba(124,58,237,0.35)', text: '#c4b5fd' },
  { bg: 'rgba(37,99,235,0.18)',  border: 'rgba(96,165,250,0.6)',  glow: 'rgba(37,99,235,0.35)',  text: '#93c5fd' },
  { bg: 'rgba(5,150,105,0.18)',  border: 'rgba(52,211,153,0.6)',  glow: 'rgba(5,150,105,0.35)',  text: '#6ee7b7' },
  { bg: 'rgba(217,119,6,0.18)',  border: 'rgba(251,191,36,0.6)',  glow: 'rgba(217,119,6,0.35)',  text: '#fcd34d' },
  { bg: 'rgba(220,38,38,0.18)',  border: 'rgba(248,113,113,0.6)', glow: 'rgba(220,38,38,0.35)', text: '#fca5a5' },
  { bg: 'rgba(2,132,199,0.18)',  border: 'rgba(56,189,248,0.6)',  glow: 'rgba(2,132,199,0.35)',  text: '#7dd3fc' },
  { bg: 'rgba(162,28,175,0.18)', border: 'rgba(232,121,249,0.6)', glow: 'rgba(162,28,175,0.35)', text: '#f0abfc' },
  { bg: 'rgba(22,163,74,0.18)',  border: 'rgba(74,222,128,0.6)',  glow: 'rgba(22,163,74,0.35)',  text: '#86efac' },
  { bg: 'rgba(234,88,12,0.18)',  border: 'rgba(251,146,60,0.6)',  glow: 'rgba(234,88,12,0.35)',  text: '#fdba74' },
]
const FILE_COLOR  = { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.14)', glow: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.5)' }
const FILE_ACTIVE = { bg: 'rgba(124,58,237,0.22)', border: 'rgba(167,139,250,0.75)', glow: 'rgba(124,58,237,0.45)', text: '#c4b5fd' }

function folderColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

// ── Squarified treemap ────────────────────────────────────────────────────────
function squarify(items, x, y, w, h) {
  if (!items.length || w <= 0 || h <= 0) return []
  const total = items.reduce((s, i) => s + i.value, 0)
  if (!total) return []
  const area = w * h
  const sorted = [...items].sort((a, b) => b.value - a.value)
    .map(i => ({ ...i, area: (i.value / total) * area }))
  const out = []
  _sq(sorted, x, y, w, h, out)
  return out
}

function _sq(items, x, y, w, h, out) {
  if (!items.length || w < 1 || h < 1) return
  if (items.length === 1) { out.push({ ...items[0], x, y, w, h }); return }
  const wide = w >= h
  const s = wide ? h : w
  const row = [items[0]]
  let ra = items[0].area
  for (let i = 1; i < items.length; i++) {
    const na = ra + items[i].area
    if (_worst([...row, items[i]], na, s) <= _worst(row, ra, s)) { row.push(items[i]); ra = na }
    else break
  }
  const sl = ra / s
  let off = wide ? y : x
  for (const item of row) {
    const il = (item.area / ra) * s
    out.push(wide ? { ...item, x, y: off, w: sl, h: il } : { ...item, x: off, y, w: il, h: sl })
    off += il
  }
  const rem = items.slice(row.length)
  if (rem.length) _sq(rem,
    wide ? x + sl : x, wide ? y : y + sl,
    wide ? Math.max(w - sl, 0) : w, wide ? h : Math.max(h - sl, 0),
    out)
}

function _worst(row, area, side) {
  if (!row.length || !area || !side) return Infinity
  const sl = area / side
  return row.reduce((m, i) => { const d = (i.area / area) * side; return d ? Math.max(m, sl / d, d / sl) : Infinity }, 0)
}

const GAP = 3

export default function FileExplorerTreemap({ currentPath, navigateTo, files, folders, activeFile, onOpenFile, searchQuery }) {
  const ref = useRef(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [hovered, setHovered] = useState(null)
  const [tip, setTip] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!document.getElementById('tm-kf')) {
      const s = document.createElement('style'); s.id = 'tm-kf'
      s.textContent = '@keyframes tm-in{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}'
      document.head.appendChild(s)
    }
  }, [])

  useEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect
      setDims({ w: Math.floor(w), h: Math.floor(h) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const nodes = useMemo(() => {
    const prefix = currentPath ? currentPath + '/' : ''
    const seen = new Set(); const result = []
    const addFolder = (seg) => {
      if (!seg || seen.has(seg)) return; seen.add(seg)
      const fp = currentPath ? `${currentPath}/${seg}` : seg
      const fc = files.filter(f => f.folder === fp || f.folder.startsWith(fp + '/')).length
      result.push({ type: 'folder', name: seg, path: fp, fileCount: fc, value: Math.max(fc * 3, 2) })
    }
    for (const fp of folders) {
      if (prefix && !fp.startsWith(prefix)) continue
      addFolder((prefix ? fp.slice(prefix.length) : fp).split('/')[0])
    }
    for (const f of files) {
      if (!f.folder) continue
      if (prefix && !f.folder.startsWith(prefix)) continue
      const seg = (prefix ? f.folder.slice(prefix.length) : f.folder).split('/')[0]
      if (seg) addFolder(seg)
    }
    for (const f of files) {
      if ((f.folder || '') === currentPath)
        result.push({ type: 'file', name: f.name, path: f.path, fileObj: f, value: 1 })
    }
    return result
  }, [currentPath, files, folders])

  const rects = useMemo(() =>
    dims.w > 0 && dims.h > 0 ? squarify(nodes, 0, 0, dims.w, dims.h) : [],
    [nodes, dims]
  )

  const q = searchQuery?.toLowerCase() || ''

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      onMouseLeave={() => setHovered(null)}>
      {dims.w > 0 && (
        <div key={currentPath} style={{ position: 'absolute', inset: 0, animation: 'tm-in .22s ease' }}>
          {rects.map(rect => {
            const isFolder = rect.type === 'folder'
            const isActive = !isFolder && activeFile?.path === rect.path
            const color = isFolder ? folderColor(rect.name) : (isActive ? FILE_ACTIVE : FILE_COLOR)
            const isHov = hovered?.path === rect.path
            const dim = q && !rect.name.toLowerCase().includes(q)
            const tw = Math.max(rect.w - GAP, 1); const th = Math.max(rect.h - GAP, 1)
            const showLabel = tw > 34 && th > 24
            const showMeta  = tw > 85 && th > 54

            return (
              <div key={rect.path} style={{
                position: 'absolute',
                left: rect.x + GAP / 2, top: rect.y + GAP / 2,
                width: tw, height: th,
                background: color.bg,
                border: `1px solid ${isHov || isActive ? color.border : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 8,
                boxShadow: isHov ? `0 0 18px ${color.glow}` : 'none',
                cursor: 'pointer', overflow: 'hidden',
                transition: 'border-color .13s, box-shadow .13s, opacity .18s, filter .18s',
                opacity: dim ? 0.15 : 1,
                filter: dim ? 'saturate(.25)' : 'none',
              }}
                onClick={() => isFolder ? navigateTo(rect.path) : onOpenFile(rect.fileObj)}
                onMouseEnter={e => { setHovered(rect); setTip({ x: e.clientX, y: e.clientY }) }}
                onMouseMove={e => setTip({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Top accent stripe */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, ${color.border}, transparent)`,
                  borderRadius: '8px 8px 0 0',
                  opacity: isHov ? 1 : 0.5, transition: 'opacity .13s',
                }} />

                {showLabel && (
                  <div style={{ padding: '8px 8px 6px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                      <span style={{ color: color.border, flexShrink: 0, opacity: 0.9 }}>
                        {isFolder ? <FolderSvg /> : <FileSvg />}
                      </span>
                      <span style={{
                        fontSize: Math.min(Math.max(tw / 8, 9), 12),
                        fontWeight: 600, color: color.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, letterSpacing: '0.01em',
                      }}>{rect.name}</span>
                    </div>
                    {showMeta && (
                      <div style={{ marginTop: 4, fontSize: 9.5, color: color.text, opacity: 0.5, letterSpacing: '0.02em' }}>
                        {isFolder ? `${rect.fileCount} note${rect.fileCount !== 1 ? 's' : ''}` : 'note'}
                      </div>
                    )}
                    {showMeta && isFolder && (
                      <div style={{ position: 'absolute', bottom: 7, right: 8, opacity: isHov ? 0.6 : 0.25, transition: 'opacity .13s' }}>
                        <ChevronSvg color={color.text} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {rects.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-dim)' }}>
              <FolderSvg size={32} />
              <span style={{ fontSize: 12, opacity: 0.35 }}>{q ? 'No matches' : 'Empty'}</span>
            </div>
          )}
        </div>
      )}

      {hovered && <Tooltip pos={tip} node={hovered} />}
    </div>
  )
}

function Tooltip({ pos, node }) {
  return (
    <div style={{
      position: 'fixed', left: pos.x + 14, top: pos.y - 8, zIndex: 9999,
      padding: '8px 11px', minWidth: 130, maxWidth: 240,
      background: 'rgba(10,8,20,0.96)', backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(255,255,255,0.11)', borderRadius: 8,
      boxShadow: '0 10px 36px rgba(0,0,0,0.45)', pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 5, wordBreak: 'break-word' }}>
        {node.name}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TipRow k="Type"  v={node.type === 'folder' ? 'Folder' : 'Note'} />
        {node.type === 'folder'
          ? <TipRow k="Notes" v={`${node.fileCount}`} />
          : <TipRow k="In"    v={node.fileObj?.folder || 'root'} />
        }
        <TipRow k="Path" v={node.path} />
      </div>
    </div>
  )
}

function TipRow({ k, v }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 10.5 }}>
      <span style={{ color: 'rgba(255,255,255,0.35)', minWidth: 34 }}>{k}</span>
      <span style={{ color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{v}</span>
    </div>
  )
}

function FolderSvg({ size = 11 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
}
function FileSvg({ size = 11 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
}
function ChevronSvg({ color = 'currentColor' }) {
  return <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
}
