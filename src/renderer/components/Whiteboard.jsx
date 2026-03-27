import React, { useState, useCallback, useRef, useEffect } from 'react'
import WhiteboardGraphView from './WhiteboardGraphView'

const COLORS = ['#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#ede9fe', '#fee2e2', '#e0f2fe', '#f1f5f9']
const PEN_COLORS = ['#1a1a2e', '#7c3aed', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b']
const GLASS = 'var(--glass-border)'
function uid() { return Math.random().toString(36).slice(2, 10) }
function newBoard(label = 'Board 1') { return { id: uid(), label, nodes: [], edges: [], strokes: [] } }

function EdgeLayer({ nodes, edges, onDeleteEdge, liveEdge }) {
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' }} onClick={e => e.stopPropagation()}>
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10z" fill="var(--accent)" />
        </marker>
      </defs>
      {edges.map(e => {
        const f = nodes.find(n => n.id === e.from), t = nodes.find(n => n.id === e.to)
        if (!f || !t) return null
        return (
          <line key={e.id} x1={f.x + f.w / 2} y1={f.y + f.h / 2} x2={t.x + t.w / 2} y2={t.y + t.h / 2}
            stroke="var(--accent)" strokeWidth="2" markerEnd="url(#arrowhead)" opacity="0.55"
            style={{ pointerEvents: 'all', cursor: 'pointer' }}
            onClick={ev => { ev.stopPropagation(); onDeleteEdge(e.id) }}
          />
        )
      })}
      {liveEdge && (
        <line x1={liveEdge.x1} y1={liveEdge.y1} x2={liveEdge.x2} y2={liveEdge.y2}
          stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 4" opacity="0.7"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  )
}

function CanvasNode({ node, isSelected, isEditing, onMouseDown, onDoubleClick, onClick, onContextMenu, onTextChange, onBlur }) {
  const isFrame = node.type === 'frame'
  const border = isSelected ? '2px solid var(--accent)'
    : isFrame ? '2px dashed rgba(124,58,237,0.35)'
    : node.type === 'text' ? 'none' : '1px solid rgba(0,0,0,0.12)'

  const style = {
    position: 'absolute', left: node.x, top: node.y, width: node.w, height: node.h,
    background: isFrame ? 'rgba(124,58,237,0.03)' : node.type === 'text' ? 'transparent' : node.color,
    border, borderRadius: node.type === 'circle' ? '50%' : node.type === 'diamond' ? 4 : 6,
    boxShadow: isSelected && !isFrame && node.type !== 'text' ? '0 0 0 4px rgba(124,58,237,0.15),0 4px 16px rgba(0,0,0,0.15)' : !isFrame && node.type !== 'text' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
    cursor: 'grab',
    transform: node.type === 'diamond' ? 'rotate(45deg)' : 'none',
    userSelect: 'none', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', alignItems: isFrame ? 'stretch' : 'center', justifyContent: isFrame ? 'flex-start' : 'center',
  }

  const textStyle = {
    fontSize: node.type === 'text' ? 18 : isFrame ? 11 : 13,
    fontWeight: node.type === 'text' || isFrame ? 700 : 400,
    color: isFrame ? 'rgba(124,58,237,0.65)' : '#1a1a2e',
    textAlign: isFrame ? 'left' : 'center',
    padding: isFrame ? '5px 8px' : '6px 8px',
    wordBreak: 'break-word', overflowWrap: 'break-word', width: '100%',
    outline: 'none', background: 'transparent', resize: 'none', border: 'none',
    cursor: 'inherit', fontFamily: 'inherit',
    transform: node.type === 'diamond' ? 'rotate(-45deg)' : 'none', lineHeight: 1.4,
    letterSpacing: isFrame ? '0.04em' : 0, textTransform: isFrame ? 'uppercase' : 'none',
    ...(isFrame ? { borderBottom: '1px dashed rgba(124,58,237,0.2)', flexShrink: 0 } : {}),
  }

  return (
    <div style={style} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onClick={onClick} onContextMenu={onContextMenu}>
      {isEditing ? (
        <textarea autoFocus style={textStyle} value={node.text}
          onChange={e => onTextChange(e.target.value)}
          onBlur={onBlur} onKeyDown={e => { if (e.key === 'Escape') onBlur() }}
        />
      ) : (
        <span style={{ ...textStyle, display: 'block' }}>
          {node.text || <span style={{ opacity: 0.28, fontStyle: 'italic', fontSize: 11 }}>
            {isFrame ? 'Section label' : 'double-click to edit'}
          </span>}
        </span>
      )}
    </div>
  )
}

function FloatingColorPicker({ node, pan, zoom, onColorChange }) {
  const sx = (node.x + node.w / 2) * zoom + pan.x
  const sy = (node.y - 14) * zoom + pan.y
  return (
    <div style={{
      position: 'absolute', left: sx, top: sy, transform: 'translate(-50%,-100%)',
      display: 'flex', gap: 4, padding: '4px 6px', borderRadius: 20,
      background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
      border: '1px solid var(--glass-border-strong)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      zIndex: 10, pointerEvents: 'all',
    }}>
      {COLORS.map(c => (
        <div key={c} onClick={e => { e.stopPropagation(); onColorChange(c) }}
          style={{ width: 16, height: 16, borderRadius: 4, background: c, cursor: 'pointer',
            border: node.color === c ? '2px solid var(--accent)' : '1px solid rgba(0,0,0,0.15)',
            boxShadow: node.color === c ? '0 0 0 2px var(--accent-glow)' : 'none' }}
        />
      ))}
    </div>
  )
}

function BoardBar({ boards, activeBoardId, onSwitch, onAdd, onRename, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 10px', overflowX: 'auto', flexShrink: 0, borderBottom: `1px solid ${GLASS}`, background: 'var(--glass-bg)', minHeight: 32 }}>
      {boards.map(b => (
        <div key={b.id} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
          background: b.id === activeBoardId ? 'rgba(124,58,237,0.14)' : 'transparent',
          border: b.id === activeBoardId ? '1px solid rgba(124,58,237,0.28)' : `1px solid transparent`,
          transition: 'all 0.12s',
        }} onClick={() => onSwitch(b.id)}>
          {editingId === b.id ? (
            <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
              style={{ width: 80, fontSize: 12, background: 'transparent', border: 'none', outline: 'none', color: 'var(--accent-text)', fontFamily: 'inherit' }}
              onClick={e => e.stopPropagation()}
              onBlur={() => { onRename(b.id, draft || b.label); setEditingId(null) }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { onRename(b.id, draft || b.label); setEditingId(null) } }}
            />
          ) : (
            <span style={{ fontSize: 12, color: b.id === activeBoardId ? 'var(--accent-text)' : 'var(--text-muted)' }}
              onDoubleClick={e => { e.stopPropagation(); setEditingId(b.id); setDraft(b.label) }}
            >{b.label}</span>
          )}
          {boards.length > 1 && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', lineHeight: 1, opacity: 0.5 }}
              onClick={e => { e.stopPropagation(); onDelete(b.id) }}
            >×</span>
          )}
        </div>
      ))}
      <button onClick={onAdd} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, background: 'transparent', border: `1px dashed ${GLASS}`, color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0, marginLeft: 2 }}>
        + New Board
      </button>
    </div>
  )
}

const CONN_DOT_SIDES = [
  { id: 'top',    dx: 0.5, dy: 0   },
  { id: 'right',  dx: 1,   dy: 0.5 },
  { id: 'bottom', dx: 0.5, dy: 1   },
  { id: 'left',   dx: 0,   dy: 0.5 },
]

export default function Whiteboard({ vaultPath }) {
  const [boards, setBoards] = useState(() => [newBoard()])
  const [activeBoardId, setActiveBoardId] = useState(boards[0].id)
  const [viewMode, setViewMode] = useState('canvas')
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [tool, setTool] = useState('select')
  const [liveEdge, setLiveEdge] = useState(null)
  const [penColor, setPenColor] = useState('#7c3aed')
  const [contextMenu, setContextMenu] = useState(null)
  const [saved, setSaved] = useState(true)

  const containerRef = useRef(null)
  const wasDragging = useRef(false)
  const livePathRef = useRef(null)
  const penStrokeRef = useRef(null)

  const activeBoard = boards.find(b => b.id === activeBoardId) || boards[0]
  const { nodes, edges, strokes = [] } = activeBoard

  const patchBoard = useCallback((id, patch) => {
    setBoards(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))
    setSaved(false)
  }, [])

  const setNodes = useCallback(upd => {
    setBoards(prev => prev.map(b => b.id === activeBoardId ? { ...b, nodes: typeof upd === 'function' ? upd(b.nodes) : upd } : b))
    setSaved(false)
  }, [activeBoardId])

  const setEdges = useCallback(upd => {
    setBoards(prev => prev.map(b => b.id === activeBoardId ? { ...b, edges: typeof upd === 'function' ? upd(b.edges) : upd } : b))
    setSaved(false)
  }, [activeBoardId])

  // Load — try new format, fall back to legacy
  useEffect(() => {
    if (!vaultPath) return
    window.electronAPI.readFile(`${vaultPath}/_whiteboards.json`).then(r => {
      if (r.success) {
        try {
          const d = JSON.parse(r.content)
          if (d.boards?.length) { setBoards(d.boards); setActiveBoardId(d.activeBoardId || d.boards[0].id); return }
        } catch {}
      }
      window.electronAPI.readFile(`${vaultPath}/_whiteboard.json`).then(r2 => {
        if (r2.success) try {
          const d = JSON.parse(r2.content)
          if (d.nodes) {
            const b = [{ ...newBoard('Board 1'), nodes: d.nodes, edges: d.edges || [], strokes: [] }]
            setBoards(b); setActiveBoardId(b[0].id)
          }
        } catch {}
      })
    })
  }, [vaultPath])

  // Save (debounced)
  useEffect(() => {
    if (saved) return
    const t = setTimeout(() => {
      window.electronAPI.writeFile(`${vaultPath}/_whiteboards.json`, JSON.stringify({ boards, activeBoardId }, null, 2)).then(() => setSaved(true))
    }, 800)
    return () => clearTimeout(t)
  }, [boards, activeBoardId, saved, vaultPath])

  const toCanvas = useCallback((sx, sy) => {
    const r = containerRef.current.getBoundingClientRect()
    return { x: (sx - r.left - pan.x) / zoom, y: (sy - r.top - pan.y) / zoom }
  }, [pan, zoom])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = e => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const mx = e.clientX - r.left, my = e.clientY - r.top
      const delta = e.deltaY * (e.ctrlKey ? 0.008 : 0.001)
      setZoom(z => { const nz = Math.max(0.15, Math.min(4, z * (1 - delta))); setPan(p => ({ x: mx - (mx - p.x) * (nz / z), y: my - (my - p.y) * (nz / z) })); return nz })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleCanvasMouseDown = useCallback(e => {
    if (e.button !== 0) return
    setContextMenu(null)

    if (tool === 'pen') {
      const { x, y } = toCanvas(e.clientX, e.clientY)
      penStrokeRef.current = { id: uid(), color: penColor, d: `M${x.toFixed(1)},${y.toFixed(1)}`, width: 2.5 }
      if (livePathRef.current) livePathRef.current.setAttribute('d', penStrokeRef.current.d)
      const onMove = me => {
        if (!penStrokeRef.current) return
        const { x: cx, y: cy } = toCanvas(me.clientX, me.clientY)
        penStrokeRef.current.d += ` L${cx.toFixed(1)},${cy.toFixed(1)}`
        if (livePathRef.current) livePathRef.current.setAttribute('d', penStrokeRef.current.d)
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
        if (!penStrokeRef.current) return
        const s = penStrokeRef.current; penStrokeRef.current = null
        if (livePathRef.current) livePathRef.current.setAttribute('d', '')
        setBoards(prev => prev.map(b => b.id === activeBoardId ? { ...b, strokes: [...(b.strokes || []), s] } : b))
        setSaved(false)
      }
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
      return
    }

    if (e.target !== e.currentTarget) return
    wasDragging.current = false
    let last = { x: e.clientX, y: e.clientY }
    const onMove = me => { wasDragging.current = true; setPan(p => ({ x: p.x + me.clientX - last.x, y: p.y + me.clientY - last.y })); last = { x: me.clientX, y: me.clientY } }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [tool, toCanvas, penColor, activeBoardId])

  const handleCanvasClick = useCallback(e => {
    if (e.target !== e.currentTarget || wasDragging.current) return
    if (tool === 'select' || tool === 'pen') { setSelected(null); return }
    const { x, y } = toCanvas(e.clientX, e.clientY)
    const defs = {
      sticky:  { w: 220, h: 140, color: '#fef3c7', text: '' },
      text:    { w: 180, h: 44,  color: 'transparent', text: 'Heading' },
      rect:    { w: 200, h: 120, color: '#dbeafe', text: '' },
      circle:  { w: 140, h: 140, color: '#dcfce7', text: '' },
      diamond: { w: 140, h: 140, color: '#fce7f3', text: '' },
      frame:   { w: 320, h: 220, color: 'transparent', text: 'Section' },
    }
    const def = defs[tool] || defs.sticky
    const node = { id: uid(), type: tool, x: x - def.w / 2, y: y - def.h / 2, ...def }
    setNodes(prev => [...prev, node]); setSelected(node.id); setTool('select')
  }, [tool, toCanvas, setNodes])

  const handleNodeMouseDown = useCallback((e, nodeId) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setSelected(nodeId)
    let last = { x: e.clientX, y: e.clientY }
    wasDragging.current = false
    const onMove = me => {
      wasDragging.current = true
      const dx = (me.clientX - last.x) / zoom, dy = (me.clientY - last.y) / zoom
      last = { x: me.clientX, y: me.clientY }
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x: n.x + dx, y: n.y + dy } : n))
    }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [zoom, setNodes])

  const handleConnectDotMouseDown = useCallback((e, nodeId, startX, startY) => {
    e.stopPropagation()
    e.preventDefault()
    // capture nodes at drag-start time for hit-testing
    const nodesSnap = nodes
    const onMove = me => {
      const cp = toCanvas(me.clientX, me.clientY)
      setLiveEdge({ x1: startX, y1: startY, x2: cp.x, y2: cp.y })
    }
    const onUp = me => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const cp = toCanvas(me.clientX, me.clientY)
      const target = nodesSnap.find(n =>
        n.id !== nodeId &&
        cp.x >= n.x && cp.x <= n.x + n.w &&
        cp.y >= n.y && cp.y <= n.y + n.h
      )
      if (target) {
        setEdges(prev => prev.some(ed => ed.from === nodeId && ed.to === target.id)
          ? prev
          : [...prev, { id: uid(), from: nodeId, to: target.id }]
        )
      }
      setLiveEdge(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [nodes, toCanvas, setEdges])

  const handleNodeContextMenu = useCallback((e, nodeId) => {
    e.preventDefault(); e.stopPropagation()
    setContextMenu({ nodeId, x: e.clientX, y: e.clientY })
    setSelected(nodeId)
  }, [])

  const deleteNode = useCallback(nodeId => {
    setNodes(p => p.filter(n => n.id !== nodeId))
    setEdges(p => p.filter(ed => ed.from !== nodeId && ed.to !== nodeId))
    setSelected(null); setContextMenu(null)
  }, [setNodes, setEdges])

  useEffect(() => {
    const onKey = e => {
      if (editing) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        deleteNode(selected)
      }
      if (e.key === 'Escape') { setTool('select'); setEditing(null); setContextMenu(null); setLiveEdge(null) }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && tool === 'pen') {
        setBoards(prev => prev.map(b => b.id === activeBoardId ? { ...b, strokes: (b.strokes || []).slice(0, -1) } : b))
        setSaved(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, selected, tool, activeBoardId, deleteNode])

  const selectedNode = nodes.find(n => n.id === selected)

  const tools = [
    { id: 'select', icon: '↖', label: 'Select' },
    null,
    { id: 'sticky', icon: '📄', label: 'Sticky' },
    { id: 'text', icon: 'T', label: 'Text' },
    { id: 'rect', icon: '▭', label: 'Rect' },
    { id: 'circle', icon: '◯', label: 'Circle' },
    { id: 'diamond', icon: '◈', label: 'Diamond' },
    { id: 'frame', icon: '⬜', label: 'Frame' },
    null,
    { id: 'pen', icon: '✏', label: 'Pen' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      <BoardBar boards={boards} activeBoardId={activeBoardId}
        onSwitch={id => { setActiveBoardId(id); setSaved(false) }}
        onAdd={() => { const b = newBoard(`Board ${boards.length + 1}`); setBoards(p => [...p, b]); setActiveBoardId(b.id); setSaved(false) }}
        onRename={(id, label) => { setBoards(p => p.map(b => b.id === id ? { ...b, label } : b)); setSaved(false) }}
        onDelete={id => { const rest = boards.filter(b => b.id !== id); setBoards(rest); if (activeBoardId === id) setActiveBoardId(rest[0].id); setSaved(false) }}
      />

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 10px', borderBottom: `1px solid ${GLASS}`, background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', flexShrink: 0, flexWrap: 'wrap' }}>
        {tools.map((t, i) => t === null ? (
          <div key={i} style={{ width: 1, height: 16, background: GLASS, margin: '0 3px' }} />
        ) : (
          <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
            style={{ padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
              background: tool === t.id ? 'var(--accent-gradient)' : 'var(--glass-bg-strong)',
              color: tool === t.id ? '#fff' : 'var(--text-muted)',
              borderColor: tool === t.id ? 'var(--accent)' : GLASS,
            }}
          >{t.icon} {t.label}</button>
        ))}
        {tool === 'pen' && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 4, padding: '2px 6px', borderRadius: 8, border: `1px solid ${GLASS}`, background: 'var(--glass-bg-strong)' }}>
            {PEN_COLORS.map(c => (
              <div key={c} onClick={() => setPenColor(c)} style={{ width: 14, height: 14, borderRadius: '50%', background: c, cursor: 'pointer', border: penColor === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)', boxShadow: penColor === c ? `0 0 0 2px ${c}` : 'none' }} />
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center', marginLeft: 2 }}>Ctrl+Z undo</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setViewMode(v => v === 'canvas' ? 'graph' : 'canvas')}
          style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, border: '1px solid', cursor: 'pointer',
            background: viewMode === 'graph' ? 'var(--accent-gradient)' : 'var(--glass-bg-strong)',
            color: viewMode === 'graph' ? '#fff' : 'var(--text-muted)', borderColor: viewMode === 'graph' ? 'var(--accent)' : GLASS,
          }}
          title="Toggle graph view"
        >⬡ Graph</button>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', marginLeft: 6 }}>
          {Math.round(zoom * 100)}% <span style={{ color: saved ? 'var(--text-dim)' : '#f59e0b' }}>{saved ? '· saved' : '· saving…'}</span>
        </span>
        <button onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1) }}
          style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'var(--glass-bg-strong)', color: 'var(--text-muted)', border: `1px solid ${GLASS}`, cursor: 'pointer', marginLeft: 4 }}
        >Reset</button>
      </div>

      {viewMode === 'graph' ? (
        <WhiteboardGraphView nodes={nodes} edges={edges} />
      ) : (
        <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: tool === 'select' ? 'default' : 'crosshair' }}
          onMouseDown={handleCanvasMouseDown} onClick={handleCanvasClick}
        >
          {/* Dot grid */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <pattern id="wb-grid" x={pan.x % (24 * zoom)} y={pan.y % (24 * zoom)} width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
                <circle cx={1} cy={1} r={0.9} fill="var(--text-dim)" opacity="0.22" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#wb-grid)" />
          </svg>

          {/* Transformed content */}
          <div style={{ position: 'absolute', transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: 0, height: 0 }}>
            {/* Strokes */}
            <svg style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible', pointerEvents: 'none' }}>
              {strokes.map(s => (
                <path key={s.id} d={s.d} stroke={s.color} strokeWidth={s.width || 2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
              ))}
              <path ref={livePathRef} stroke={penColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} d="" />
            </svg>
            <EdgeLayer nodes={nodes} edges={edges} liveEdge={liveEdge} onDeleteEdge={id => setEdges(p => p.filter(e => e.id !== id))} />
            {/* Frames first (behind), then other nodes */}
            {[...nodes.filter(n => n.type === 'frame'), ...nodes.filter(n => n.type !== 'frame')].map(node => (
              <CanvasNode key={node.id} node={node}
                isSelected={selected === node.id} isEditing={editing === node.id}
                onMouseDown={e => handleNodeMouseDown(e, node.id)}
                onDoubleClick={e => { e.stopPropagation(); setEditing(node.id); setSelected(node.id) }}
                onClick={e => e.stopPropagation()}
                onContextMenu={e => handleNodeContextMenu(e, node.id)}
                onTextChange={val => setNodes(p => p.map(n => n.id === node.id ? { ...n, text: val } : n))}
                onBlur={() => setEditing(null)}
              />
            ))}
            {/* Connection dots on selected node */}
            {selectedNode && !editing && CONN_DOT_SIDES.map(({ id, dx, dy }) => {
              const cx = selectedNode.x + selectedNode.w * dx
              const cy = selectedNode.y + selectedNode.h * dy
              return (
                <div key={id}
                  style={{
                    position: 'absolute',
                    left: cx - 6, top: cy - 6,
                    width: 12, height: 12,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    border: '2.5px solid #fff',
                    cursor: 'crosshair',
                    zIndex: 20,
                    boxShadow: '0 0 0 2px var(--accent-glow), 0 2px 6px rgba(0,0,0,0.2)',
                    pointerEvents: 'all',
                  }}
                  onMouseDown={e => handleConnectDotMouseDown(e, selectedNode.id, cx, cy)}
                />
              )
            })}
          </div>

          {selectedNode && selectedNode.type !== 'text' && selectedNode.type !== 'frame' && !editing && (
            <FloatingColorPicker node={selectedNode} pan={pan} zoom={zoom}
              onColorChange={color => setNodes(p => p.map(n => n.id === selected ? { ...n, color } : n))}
            />
          )}

          {/* Right-click context menu with backdrop */}
          {contextMenu && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onMouseDown={() => setContextMenu(null)}
              />
              <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: 'var(--glass-bg)', border: `1px solid ${GLASS}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', backdropFilter: 'blur(16px)', zIndex: 100, overflow: 'hidden', minWidth: 140 }}>
                <button
                  onMouseDown={e => { e.stopPropagation(); setEditing(contextMenu.nodeId); setContextMenu(null) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 12, background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                >✏ Edit text</button>
                <div style={{ height: 1, background: GLASS, margin: '2px 0' }} />
                <button
                  onMouseDown={e => { e.stopPropagation(); deleteNode(contextMenu.nodeId) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 12, background: 'transparent', border: 'none', color: '#f38ba8', cursor: 'pointer' }}
                >🗑 Delete</button>
              </div>
            </>
          )}

          {nodes.length === 0 && strokes.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
              <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.07, color: 'var(--text-primary)' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, fontWeight: 500, margin: 0 }}>Choose a tool to start</p>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-dim)', opacity: 0.55 }}>
                <span>Scroll to zoom</span><span>·</span><span>Drag to pan</span><span>·</span><span>Right-click to delete</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
