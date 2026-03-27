import React, { useState, useEffect, useRef, useCallback } from 'react'

function runLayout(nodes, edges) {
  if (!nodes.length) return {}
  const pos = {}, vel = {}
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * 2 * Math.PI
    const r = 70 + nodes.length * 22
    pos[n.id] = { x: Math.cos(a) * r, y: Math.sin(a) * r }
    vel[n.id] = { vx: 0, vy: 0 }
  })
  for (let s = 0; s < 280; s++) {
    const f = {}
    nodes.forEach(n => { f[n.id] = { fx: 0, fy: 0 } })
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].id, b = nodes[j].id
        const dx = pos[a].x - pos[b].x, dy = pos[a].y - pos[b].y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const str = 5500 / (d * d)
        f[a].fx += dx / d * str; f[a].fy += dy / d * str
        f[b].fx -= dx / d * str; f[b].fy -= dy / d * str
      }
    }
    edges.forEach(e => {
      if (!pos[e.from] || !pos[e.to]) return
      const dx = pos[e.to].x - pos[e.from].x, dy = pos[e.to].y - pos[e.from].y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const str = 0.05 * (d - 155)
      f[e.from].fx += dx / d * str; f[e.from].fy += dy / d * str
      f[e.to].fx -= dx / d * str; f[e.to].fy -= dy / d * str
    })
    const cool = 1 - s / 280
    nodes.forEach(n => {
      f[n.id].fx -= pos[n.id].x * 0.008
      f[n.id].fy -= pos[n.id].y * 0.008
      vel[n.id].vx = (vel[n.id].vx + f[n.id].fx) * 0.78
      vel[n.id].vy = (vel[n.id].vy + f[n.id].fy) * 0.78
      pos[n.id].x += vel[n.id].vx * cool
      pos[n.id].y += vel[n.id].vy * cool
    })
  }
  return pos
}

const NR = 38

export default function WhiteboardGraphView({ nodes, edges }) {
  const [positions, setPositions] = useState({})
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(0.9)
  const containerRef = useRef(null)

  const visibleNodes = nodes.filter(n => n.type !== 'frame')

  useEffect(() => {
    setPositions(runLayout(visibleNodes, edges))
  }, [visibleNodes.length, edges.length]) // eslint-disable-line

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = e => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const mx = e.clientX - r.left, my = e.clientY - r.top
      const d = e.deltaY * 0.001
      setZoom(z => {
        const nz = Math.max(0.1, Math.min(3, z * (1 - d)))
        setPan(p => ({ x: mx - (mx - p.x) * (nz / z), y: my - (my - p.y) * (nz / z) }))
        return nz
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleBgDown = useCallback(e => {
    if (e.button !== 0) return
    let last = { x: e.clientX, y: e.clientY }
    const onMove = me => { setPan(p => ({ x: p.x + me.clientX - last.x, y: p.y + me.clientY - last.y })); last = { x: me.clientX, y: me.clientY } }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [])

  const handleNodeDown = useCallback((e, id) => {
    e.stopPropagation()
    let last = { x: e.clientX, y: e.clientY }
    const onMove = me => {
      const dx = (me.clientX - last.x) / zoom, dy = (me.clientY - last.y) / zoom
      last = { x: me.clientX, y: me.clientY }
      setPositions(p => ({ ...p, [id]: { x: (p[id]?.x || 0) + dx, y: (p[id]?.y || 0) + dy } }))
    }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [zoom])

  if (!visibleNodes.length) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
        No nodes yet — add some in canvas view
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'grab', background: 'var(--bg-primary)' }}
      onMouseDown={handleBgDown}
    >
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <pattern id="gv-dots" x={pan.x % (28 * zoom)} y={pan.y % (28 * zoom)} width={28 * zoom} height={28 * zoom} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={0.8} fill="var(--text-dim)" opacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gv-dots)" />
      </svg>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <marker id="gv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0L10 5L0 10z" fill="#7c3aed" opacity="0.65" />
          </marker>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {edges.map(e => {
            const fp = positions[e.from], tp = positions[e.to]
            if (!fp || !tp) return null
            const dx = tp.x - fp.x, dy = tp.y - fp.y, d = Math.sqrt(dx * dx + dy * dy) || 1
            return (
              <line key={e.id}
                x1={fp.x + (dx / d) * NR} y1={fp.y + (dy / d) * NR}
                x2={tp.x - (dx / d) * (NR + 5)} y2={tp.y - (dy / d) * (NR + 5)}
                stroke="#7c3aed" strokeWidth={1.5} opacity={0.4} markerEnd="url(#gv-arrow)"
              />
            )
          })}
          {visibleNodes.map(n => {
            const p = positions[n.id]
            if (!p) return null
            const label = (n.text || n.type || '').trim()
            const fill = n.color && n.color !== 'transparent' ? n.color : '#ede9fe'
            const lines = label.split('\n').slice(0, 2)
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`}
                onMouseDown={ev => handleNodeDown(ev, n.id)} style={{ cursor: 'grab' }}
              >
                <circle r={NR} fill={fill} stroke="#7c3aed" strokeWidth={1.5}
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))' }}
                />
                {lines.map((line, i) => (
                  <text key={i} textAnchor="middle" dominantBaseline="middle"
                    y={(i - (lines.length - 1) / 2) * 14}
                    fontSize={10} fill="#1a1a2e" fontFamily="inherit" fontWeight={500}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {line.length > 15 ? line.slice(0, 14) + '…' : line}
                  </text>
                ))}
              </g>
            )
          })}
        </g>
      </svg>
      <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', background: 'var(--glass-bg)', padding: '3px 10px', borderRadius: 8, border: '1px solid var(--glass-border)', pointerEvents: 'none' }}>
        {visibleNodes.length} nodes · {edges.length} edges · {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}
