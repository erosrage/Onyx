import React, { useEffect, useRef, useState, useCallback } from 'react'

// ─── Colour helpers ──────────────────────────────────────────────────────────
const SPACE_COLORS = [
  '#f472b6', '#c084fc', '#60a5fa', '#34d399', '#fbbf24',
  '#f87171', '#a78bfa', '#38bdf8', '#4ade80', '#fb923c',
  '#e879f9', '#22d3ee', '#86efac', '#facc15', '#ff6b9d',
]
export function spaceColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return SPACE_COLORS[h % SPACE_COLORS.length]
}
function hexRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// ─── Seeded hash ─────────────────────────────────────────────────────────────
function _wh(n) { n=(n^61)^(n>>>16); n*=9; n^=n>>>4; n*=0x27d4eb2d; n^=n>>>15; return (n>>>0) }

// ─── Orbital tilt per space (decorative) ─────────────────────────────────────
function orbitTilt(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return {
    ix: ((h % 80) - 40),
    iy: (((h >> 4) % 60) - 30),
    ox: -(((h >> 2) % 70) - 35),
    oy: (((h >> 6) % 50) - 25),
  }
}

// ─── Background star field ────────────────────────────────────────────────────
const _BGS_CLUSTERS = [[18,25],[50,15],[80,30],[30,60],[65,50],[85,75],[10,80],[55,85],[40,35],[72,18]]
const BG_STARS = Array.from({ length: 280 }, (_, i) => {
  const hx = _wh(i*3+1), hy = _wh(i*3+2), hm = _wh(i*3+3)
  let x, y
  if (i < 196) {
    const [cx, cy] = _BGS_CLUSTERS[i % _BGS_CLUSTERS.length]
    x = cx + ((hx % 36000) / 1000 - 18); y = cy + ((hy % 28000) / 1000 - 14)
  } else { x = (hx % 98000) / 1000 + 1; y = (hy % 96000) / 1000 + 2 }
  return {
    x: Math.max(0.3, Math.min(99.7, x)) / 100,
    y: Math.max(0.3, Math.min(99.7, y)) / 100,
    r:     0.3 + (hm % 22) / 14,
    delay: (_wh(i*5+4) % 3200) / 1000,
    dur:   1.6 + (_wh(i*7+6) % 2400) / 1000,
    op:    0.10 + (_wh(i*11+9) % 480) / 1800,
  }
})

// ─── Orphaned particles ───────────────────────────────────────────────────────
const TINTS = ['255,255,255','147,197,253','196,181,253','134,239,172','251,191,36']
const ORPHAN_NODES = Array.from({ length: 32 }, (_, i) => {
  const s = (i + 17) * 9876541
  return {
    x:  5 + ((s*16807+23) % 90000) / 1000,
    y:  8 + ((s*48271+11) % 84000) / 1000,
    r:  1.2 + ((s*7919) % 18) / 10,
    ax: 10 + ((s*2311) % 25), ay: 7  + ((s*3571) % 20),
    tx: 9  + ((s*6101) % 14), ty: 8  + ((s*5381) % 12),
    px: ((s*4999) % 8000) / 1000, py: ((s*4201) % 6000) / 1000,
    op: 0.06 + ((s*9001) % 180) / 1500,
    rgb: TINTS[((s*3137) % TINTS.length)],
  }
})

// ─── Ghost (decorative) nodes ─────────────────────────────────────────────────
const GHOST_COLORS = ['#f472b6','#c084fc','#60a5fa','#34d399','#fbbf24','#f87171','#a78bfa','#38bdf8','#e879f9','#fb923c']
const GHOST_NODES = Array.from({ length: 14 }, (_, i) => {
  const s = (i + 7) * 3456789
  const angle = ((s*16807+3) % 628318) / 100000
  const r     = 10 + ((s*48271) % 30)
  return {
    x:    Math.max(6,  Math.min(94, 50 + Math.cos(angle)*r*1.6)),
    y:    Math.max(10, Math.min(90, 52 + Math.sin(angle)*r*0.9)),
    z:    Math.sin(angle*2.618 + i*0.7) * 260,
    color:   GHOST_COLORS[((s*3137) % GHOST_COLORS.length)],
    size:    14 + ((s*7919) % 18),
    hasRing: ((s*6101) % 3) !== 0,
    ringR:   28 + ((s*5381) % 18),
    ringTilt:(55 + i*13) * Math.PI / 180,
    ax:10+((s*2311)%18), ay:8+((s*3571)%14), az:12+((s*5381)%20),
    tx:13+((s*4999)%10), ty:11+((s*4201)%8),  tz:16+((s*6101)%12),
    px:((s*2999)%7000)/1000, py:((s*3499)%5500)/1000, pz:((s*4001)%6000)/1000,
    op: 0.22 + ((s*9001)%200) / 700,
  }
})

// ─── Milky-way spiral layout ──────────────────────────────────────────────────
function milkyWayPos(index, total) {
  if (total === 1) return { x: 50, y: 50, z: 0 }
  const phi   = (1 + Math.sqrt(5)) / 2
  const theta = index * 2 * Math.PI / (phi * phi)
  const maxR  = total <= 3 ? 22 : Math.min(34, 16 + total * 2.4)
  const r     = Math.sqrt((index + 0.5) / total) * maxR
  const x = 50 + Math.cos(theta) * r * 1.55
  const y = 52 + Math.sin(theta) * r * 0.78
  const jx = Math.sin(index * 2.3998 + 1) * 5
  const jy = Math.cos(index * 4.7123 + 2) * 3
  const zTheta = index * 2.3998 * 1.618
  const z = Math.sin(zTheta) * 220 * Math.sqrt((index + 0.5) / total)
  return {
    x: Math.max(9, Math.min(91, x + jx)),
    y: Math.max(14, Math.min(86, y + jy)),
    z,
  }
}

// ─── Random connections ───────────────────────────────────────────────────────
function generateConnections(spaces) {
  if (spaces.length < 2) return []
  const edges = [], seen = new Set()
  spaces.forEach((space, i) => {
    let h = 0
    for (let k = 0; k < space.name.length; k++) h = (h*31 + space.name.charCodeAt(k)) & 0xfffff
    const numConns = 1 + (_wh(h) % 3)
    for (let c = 0; c < numConns; c++) {
      const j = (i + 1 + (_wh(h + c*997 + i*31) % (spaces.length - 1))) % spaces.length
      const key = Math.min(i,j) + '-' + Math.max(i,j)
      if (!seen.has(key)) { seen.add(key); edges.push([i, j]) }
    }
  })
  return edges
}

// ─── 3-D → screen projection (mirrors CSS perspective-1000px transform) ──────
// Node positions are in 0–100 space; nz is in pixels
function project(nx, ny, nz, W, H, pan, tilt, zoom, fov = 1000) {
  const lx = (nx / 100) * W - W / 2
  const ly = (ny / 100) * H - H / 2
  const lz = nz
  const ty = tilt.y, tx = tilt.x
  // rotateY
  const x1 = lx * Math.cos(ty) + lz * Math.sin(ty)
  const y1 = ly
  const z1 = -lx * Math.sin(ty) + lz * Math.cos(ty)
  // rotateX
  const x2 = x1
  const y2 = y1 * Math.cos(tx) - z1 * Math.sin(tx)
  const z2 = y1 * Math.sin(tx) + z1 * Math.cos(tx)
  // scale + perspective
  const pf = fov / (fov + z2)
  return {
    sx: W / 2 + x2 * zoom * pf + pan.x,
    sy: H / 2 + y2 * zoom * pf + pan.y,
    pf: Math.max(0.05, pf),
  }
}

// ─── Sphere shading on canvas ─────────────────────────────────────────────────
function drawSphere(ctx, sx, sy, r, color) {
  const [cr, cg, cb] = hexRgb(color)
  // Base fill
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2)
  ctx.fillStyle = color; ctx.fill()
  // Diffuse shading: highlights upper-left, darkens lower-right rim
  const sheen = ctx.createRadialGradient(sx - r*0.34, sy - r*0.34, 0, sx, sy, r)
  sheen.addColorStop(0,    'rgba(255,255,255,0.38)')
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.08)')
  sheen.addColorStop(1,    'rgba(0,0,0,0.42)')
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2)
  ctx.fillStyle = sheen; ctx.fill()
  // Specular highlight — tight white dot upper-left
  const spec = ctx.createRadialGradient(sx - r*0.30, sy - r*0.28, 0, sx - r*0.30, sy - r*0.28, r*0.18)
  spec.addColorStop(0, 'rgba(255,255,255,0.90)')
  spec.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2)
  ctx.fillStyle = spec; ctx.fill()
  // Inward dark rim — enhances curvature at the edge
  const rim = ctx.createRadialGradient(sx, sy, r*0.78, sx, sy, r)
  rim.addColorStop(0, 'rgba(0,0,0,0)')
  rim.addColorStop(1, 'rgba(0,0,0,0.28)')
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2)
  ctx.fillStyle = rim; ctx.fill()
  return [cr, cg, cb]
}

const BH_R = 32

// ─── Component ────────────────────────────────────────────────────────────────
export default function GalaxyView({ spaceGroups, currentSpacePath, onSelectSpace, onClose, onLogout }) {
  const [spaces, setSpaces]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [entered, setEntered]           = useState(false)
  const [hoveredId, setHoveredId]       = useState(null)
  const [flyingTo, setFlyingTo]         = useState(null)
  const [draggingStar, setDraggingStar] = useState(null)
  const [ghostPos, setGhostPos]         = useState({ x: 0, y: 0 })
  const [overBH, setOverBH]             = useState(false)

  const canvasRef       = useRef(null)
  const tilt            = useRef({ x: 0, y: 0 })
  const pan             = useRef({ x: 0, y: 0 })
  const zoom            = useRef(1)
  const spreadRef       = useRef(1)
  const spreadAnimRef   = useRef(null)
  const draggingStarRef = useRef(null)
  const overBHRef       = useRef(false)
  const suppressClick   = useRef(false)
  const hoveredRef      = useRef(null)
  const flyingToRef     = useRef(null)
  const spacesRef       = useRef([])
  const connectionsRef  = useRef([])
  const rafRef          = useRef(null)

  useEffect(() => { spacesRef.current = spaces }, [spaces])
  useEffect(() => { flyingToRef.current = flyingTo }, [flyingTo])

  // ── Resize canvas to fill viewport ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // ── Load spaces ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      const all = []
      const norm = p => (p || '').replace(/\\/g, '/')
      const curNorm = norm(currentSpacePath)
      for (const group of (spaceGroups || [])) {
        try {
          const res = await window.electronAPI.listSpaces(group.path)
          if (!res.success || cancelled) continue
          for (const space of res.spaces) {
            try {
              const vr = await window.electronAPI.readVault(space.path)
              if (cancelled) return
              const files = vr.success ? vr.files : []
              const folds = vr.success ? (vr.folders || []) : []
              const topicCount = folds.filter(f => !f.includes('/')).length
              all.push({ path: space.path, name: space.name, groupName: group.name, groupPath: group.path,
                topicCount, noteCount: files.length, color: spaceColor(space.name),
                isCurrent: norm(space.path) === curNorm })
            } catch {
              all.push({ path: space.path, name: space.name, groupName: group.name, groupPath: group.path,
                topicCount: 0, noteCount: 0, color: spaceColor(space.name),
                isCurrent: norm(space.path) === curNorm })
            }
          }
        } catch {}
      }
      if (!cancelled) { setSpaces(all); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [spaceGroups, currentSpacePath])

  // Recompute connections when spaces change
  useEffect(() => { connectionsRef.current = generateConnections(spaces) }, [spaces])

  // ── Spread animation ─────────────────────────────────────────────────────
  const animateSpread = useCallback((target) => {
    if (spreadAnimRef.current) cancelAnimationFrame(spreadAnimRef.current)
    const step = () => {
      spreadRef.current += (target - spreadRef.current) * 0.08
      if (Math.abs(spreadRef.current - target) < 0.001) { spreadRef.current = target; return }
      spreadAnimRef.current = requestAnimationFrame(step)
    }
    spreadAnimRef.current = requestAnimationFrame(step)
  }, [])

  const handleRecenter = useCallback(() => {
    pan.current = { x: 0, y: 0 }; tilt.current = { x: 0, y: 0 }; zoom.current = 1
    animateSpread(1)
  }, [animateSpread])
  const handleGravity     = useCallback(() => animateSpread(0.18), [animateSpread])
  const handleAntigravity = useCallback(() => animateSpread(2.2),  [animateSpread])

  // ── Positions from current spread (computed fresh each frame) ────────────
  function getPositions(spaces) {
    const sp = spreadRef.current
    const nonCurrent = spaces.filter(s => !s.isCurrent)
    return spaces.map(space => {
      if (space.isCurrent) return { x: 50, y: 50, z: 0 }
      const p = milkyWayPos(nonCurrent.indexOf(space), nonCurrent.length)
      return { x: 50 + (p.x - 50) * sp, y: 50 + (p.y - 50) * sp, z: (p.z || 0) * sp }
    })
  }

  // ── Hit-test a canvas-space mouse position against space nodes ────────────
  const hitTest = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current; if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const mx = clientX - rect.left, my = clientY - rect.top
    const W = canvas.width, H = canvas.height
    const spaces = spacesRef.current
    const positions = getPositions(spaces)
    // Iterate in reverse so topmost (drawn last) wins
    for (let i = spaces.length - 1; i >= 0; i--) {
      const pos = positions[i]; if (!pos) continue
      const { sx, sy, pf } = project(pos.x, pos.y, pos.z, W, H, pan.current, tilt.current, zoom.current)
      const space = spaces[i]
      const cs = space.noteCount + space.topicCount * 2
      const base = space.isCurrent
        ? Math.max(46, Math.min(72, 38 + Math.sqrt(cs) * 4.5))
        : Math.max(28, Math.min(54, 26 + Math.sqrt(cs) * 3.5))
      if (Math.hypot(mx - sx, my - sy) <= base * pf + 4) return space
    }
    return null
  }, [])

  // ── Main draw loop ────────────────────────────────────────────────────────
  const draw = useCallback((ts) => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const t = ts / 1000

    ctx.clearRect(0, 0, W, H)

    // Background
    const bg = ctx.createRadialGradient(W*0.42, H*0.58, 0, W/2, H/2, Math.max(W,H)*0.85)
    bg.addColorStop(0, '#09091c'); bg.addColorStop(1, '#020207')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

    // Nebula clouds
    const nebulas = [
      { cx:0.22,cy:0.32,rx:0.28,ry:0.18,rot:-0.18, r:99, g:102,b:241, op:0.045 },
      { cx:0.68,cy:0.62,rx:0.22,ry:0.16,rot: 0.25, r:236,g:72, b:153, op:0.038 },
      { cx:0.48,cy:0.20,rx:0.20,ry:0.13,rot: 0.10, r:56, g:189,b:248, op:0.032 },
      { cx:0.78,cy:0.78,rx:0.18,ry:0.14,rot:-0.30, r:74, g:222,b:128, op:0.028 },
      { cx:0.14,cy:0.70,rx:0.16,ry:0.12,rot: 0.05, r:251,g:146,b:60,  op:0.030 },
      { cx:0.55,cy:0.50,rx:0.25,ry:0.15,rot: 0.40, r:167,g:139,b:250, op:0.035 },
    ]
    nebulas.forEach(n => {
      ctx.save()
      ctx.translate(n.cx*W, n.cy*H); ctx.rotate(n.rot)
      const rw = n.rx*W, rh = n.ry*H
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rw, rh))
      grad.addColorStop(0, `rgba(${n.r},${n.g},${n.b},${n.op})`)
      grad.addColorStop(1, `rgba(${n.r},${n.g},${n.b},0)`)
      ctx.scale(1, rh/rw)
      ctx.filter = 'blur(42px)'
      ctx.beginPath(); ctx.arc(0, 0, rw, 0, Math.PI*2)
      ctx.fillStyle = grad; ctx.fill()
      ctx.filter = 'none'
      ctx.restore()
    })

    // Background stars — twinkle via sin
    BG_STARS.forEach(s => {
      const tw = 0.5 + 0.5 * Math.sin(2*Math.PI*t/s.dur + s.delay)
      ctx.globalAlpha = s.op * (0.2 + 0.8*tw)
      ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r*(1 + 0.6*tw), 0, Math.PI*2)
      ctx.fillStyle = '#fff'; ctx.fill()
    })
    ctx.globalAlpha = 1

    // Orphaned drifting particles
    ORPHAN_NODES.forEach(o => {
      const dx = Math.cos(t/o.tx + o.px) * o.ax
      const dy = Math.cos(t/o.ty + o.py) * o.ay
      const x = (o.x/100)*W + dx, y = (o.y/100)*H + dy
      const [rr, gg, bb] = o.rgb.split(',').map(Number)
      ctx.globalAlpha = o.op
      ctx.beginPath(); ctx.arc(x, y, o.r, 0, Math.PI*2)
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`; ctx.fill()
      ctx.globalAlpha = 1
    })

    const spaces = spacesRef.current
    const positions = getPositions(spaces)
    const connections = connectionsRef.current
    const curTilt = tilt.current
    const curPan = pan.current
    const curZoom = zoom.current
    const curHovered = hoveredRef.current
    const curFlyingTo = flyingToRef.current

    // Decorative ghost nodes — projected into 3D space
    GHOST_NODES.forEach((g, i) => {
      const dx = Math.cos(t/g.tx + g.px) * g.ax
      const dy = Math.cos(t/g.ty + g.py) * g.ay
      const dz = Math.cos(t/g.tz + g.pz) * g.az
      const { sx, sy, pf } = project(g.x + dx*0.1, g.y + dy*0.1, g.z + dz, W, H, curPan, curTilt, curZoom)
      const size = g.size * pf
      const [cr, cg, cb] = hexRgb(g.color)
      ctx.globalAlpha = g.op
      if (g.hasRing) {
        ctx.save(); ctx.translate(sx, sy)
        ctx.beginPath()
        ctx.ellipse(0, 0, g.ringR*pf, g.ringR*pf*0.28, g.ringTilt, 0, Math.PI*2)
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.18)`
        ctx.lineWidth = 1; ctx.stroke()
        ctx.restore()
      }
      drawSphere(ctx, sx, sy, size, g.color)
      ctx.globalAlpha = 1
    })

    // Connection lines between space nodes
    if (!loading && connections.length > 0) {
      ctx.save()
      connections.forEach(([a, b]) => {
        const pa = positions[a], pb = positions[b]; if (!pa || !pb) return
        const { sx: x1, sy: y1 } = project(pa.x, pa.y, pa.z, W, H, curPan, curTilt, curZoom)
        const { sx: x2, sy: y2 } = project(pb.x, pb.y, pb.z, W, H, curPan, curTilt, curZoom)
        const [cr, cg, cb] = hexRgb(spaces[a]?.color || '#ffffff')
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.14)`
        ctx.lineWidth = 0.8; ctx.stroke()
      })
      ctx.restore()
    }

    // Space nodes — sorted by depth (painter's algorithm)
    if (!loading && spaces.length > 0) {
      const indexed = spaces.map((space, i) => {
        const pos = positions[i]
        const { pf } = pos ? project(pos.x, pos.y, pos.z, W, H, curPan, curTilt, curZoom) : { pf: 1 }
        return { space, pos, pf }
      }).sort((a, b) => b.pf - a.pf)  // farther (smaller pf) first

      indexed.forEach(({ space, pos }) => {
        if (!pos) return
        const { sx, sy, pf } = project(pos.x, pos.y, pos.z, W, H, curPan, curTilt, curZoom)
        const isHovered = curHovered === space.path
        const isFading  = curFlyingTo !== null && curFlyingTo.path !== space.path
        const cs = space.noteCount + space.topicCount * 2
        const base = space.isCurrent
          ? Math.max(46, Math.min(72, 38 + Math.sqrt(cs) * 4.5))
          : Math.max(28, Math.min(54, 26 + Math.sqrt(cs) * 3.5))
        const bodyR = (isHovered && !space.isCurrent ? base + 6 : base) * pf
        const isHub = cs > 6
        const [cr, cg, cb] = hexRgb(space.color)

        ctx.globalAlpha = isFading ? 0 : 1

        // Hub glow
        const glowT = Math.min(cs / 80, 1)
        const glowA = 0.07 + glowT * 0.20
        const glowR = bodyR * 0.7 + Math.min(Math.sqrt(cs) * 2.5 * pf, 24 * pf)
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, bodyR + glowR)
        glow.addColorStop(0, `rgba(${cr},${cg},${cb},${glowA})`)
        glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
        ctx.beginPath(); ctx.arc(sx, sy, bodyR + glowR, 0, Math.PI*2)
        ctx.fillStyle = glow; ctx.fill()

        // Pulse ring for active space
        if (space.isCurrent) {
          const phase = (t % 2.4) / 2.4
          const pr = bodyR + 11 + phase * (bodyR * 0.9 + 11)
          ctx.beginPath(); ctx.arc(sx, sy, pr, 0, Math.PI*2)
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(1-phase)*0.65})`
          ctx.lineWidth = 1.5; ctx.stroke()
        }

        // Inner orbital ring + dots (tilted)
        const tiltData = orbitTilt(space.name)
        const innerDots = Math.min(space.topicCount, 8)
        if (innerDots > 0) {
          const innerR = bodyR / 2 + 23 * pf
          ctx.save(); ctx.translate(sx, sy)
          ctx.scale(1, Math.abs(Math.cos(tiltData.ix * Math.PI / 180)) * 0.5 + 0.15)
          ctx.rotate(tiltData.iy * Math.PI / 180)
          ctx.beginPath(); ctx.arc(0, 0, innerR, 0, Math.PI*2)
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.20)`; ctx.lineWidth = 1; ctx.stroke()
          for (let d = 0; d < innerDots; d++) {
            const angle = (t / (4.5 + d*0.8) + d / innerDots) * Math.PI * 2
            ctx.beginPath(); ctx.arc(Math.cos(angle)*innerR, Math.sin(angle)*innerR, 2*pf, 0, Math.PI*2)
            ctx.fillStyle = `rgba(${cr},${cg},${cb},0.72)`; ctx.fill()
          }
          ctx.restore()
        }

        // Outer orbital ring + dots
        const outerDots = Math.min(Math.ceil(space.noteCount / 4), 12)
        if (outerDots > 0) {
          const outerR = bodyR / 2 + 35 * pf
          ctx.save(); ctx.translate(sx, sy)
          ctx.scale(1, Math.abs(Math.cos(tiltData.ox * Math.PI / 180)) * 0.5 + 0.15)
          ctx.rotate(tiltData.oy * Math.PI / 180)
          ctx.beginPath(); ctx.arc(0, 0, outerR, 0, Math.PI*2)
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.10)`; ctx.lineWidth = 1; ctx.stroke()
          for (let d = 0; d < outerDots; d++) {
            const angle = (t / (7 + d*0.45) + d / outerDots) * Math.PI * 2
            ctx.beginPath(); ctx.arc(Math.cos(angle)*outerR, Math.sin(angle)*outerR, pf, 0, Math.PI*2)
            ctx.fillStyle = `rgba(${cr},${cg},${cb},0.38)`; ctx.fill()
          }
          ctx.restore()
        }

        // Node sphere
        drawSphere(ctx, sx, sy, bodyR, space.color)

        // Active ring stroke
        if (space.isCurrent) {
          ctx.beginPath(); ctx.arc(sx, sy, bodyR, 0, Math.PI*2)
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.8)`; ctx.lineWidth = 2; ctx.stroke()
        }

        // Label
        const fontPx = Math.max(9, (isHub ? 12 : 11) * Math.min(pf, 1.4))
        const labelY = sy + bodyR + 14 * Math.min(pf, 1.2)
        ctx.textAlign = 'center'
        ctx.font = `${isHub || space.isCurrent ? 'bold ' : ''}${fontPx}px -apple-system,"Segoe UI Variable",sans-serif`
        ctx.fillStyle = space.isCurrent ? space.color
          : isHovered ? 'rgba(255,255,255,0.95)'
          : isHub ? `rgba(${cr},${cg},${cb},0.87)` : 'rgba(255,255,255,0.70)'
        const label = space.name.length > 22 ? space.name.slice(0, 22) + '…' : space.name
        ctx.fillText(label, sx, labelY)

        if (space.isCurrent) {
          ctx.font = `9px -apple-system,"Segoe UI Variable",sans-serif`
          ctx.fillStyle = `rgba(${cr},${cg},${cb},0.67)`
          ctx.fillText('● active', sx, labelY + 13)
        }

        const subFontPx = Math.max(9, 10 * Math.min(pf, 1))
        ctx.font = `${subFontPx}px -apple-system,"Segoe UI Variable",sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.fillText(
          `${space.topicCount} topic${space.topicCount!==1?'s':''} · ${space.noteCount} note${space.noteCount!==1?'s':''}`,
          sx, labelY + (space.isCurrent ? 25 : 13)
        )
        if (space.groupName) {
          ctx.font = `9px -apple-system,"Segoe UI Variable",sans-serif`
          ctx.fillStyle = 'rgba(255,255,255,0.11)'
          ctx.fillText(space.groupName, sx, labelY + (space.isCurrent ? 37 : 25))
        }

        ctx.globalAlpha = 1
      })
    }

    // Loading / empty overlay text
    if (loading || spaces.length === 0) {
      ctx.font = '13px -apple-system,"Segoe UI Variable",sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.textAlign = 'center'
      ctx.fillText(
        loading ? 'Mapping the galaxy…' : 'No spaces found. Add a Space Group to get started.',
        W/2, H/2
      )
    }
  }, [loading])

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = ts => { draw(ts); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  // ── Hover tracking ────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    if (flyingToRef.current) return
    const hit = hitTest(e.clientX, e.clientY)
    const id = hit?.path ?? null
    if (id !== hoveredRef.current) {
      hoveredRef.current = id
      setHoveredId(id)
      if (canvasRef.current) canvasRef.current.style.cursor = id ? 'pointer' : 'grab'
    }
  }, [hitTest])

  // ── Select / fly ─────────────────────────────────────────────────────────
  const handleSelect = useCallback((space, clientX, clientY) => {
    if (suppressClick.current) { suppressClick.current = false; return }
    if (space.isCurrent) { onClose(); return }
    setFlyingTo({ path: space.path, color: space.color, clientX, clientY })
  }, [onClose])

  // ── Mouse down — pan / tilt / drag-to-archive / click ────────────────────
  const handleMouseDown = useCallback((e) => {
    if (flyingToRef.current) return
    e.preventDefault()
    const hit = e.button === 0 ? hitTest(e.clientX, e.clientY) : null

    if (hit && e.button === 0) {
      if (hit.isCurrent) return
      const startX = e.clientX, startY = e.clientY
      let didDrag = false
      const onMove = me => {
        if (!didDrag && (Math.abs(me.clientX-startX) > 6 || Math.abs(me.clientY-startY) > 6)) {
          didDrag = true; suppressClick.current = true
          draggingStarRef.current = hit; setDraggingStar(hit)
        }
        if (didDrag) {
          setGhostPos({ x: me.clientX, y: me.clientY })
          const near = Math.hypot(me.clientX-(window.innerWidth-72), me.clientY-(window.innerHeight-72)) < BH_R*1.8
          overBHRef.current = near; setOverBH(near)
        }
      }
      const onUp = async () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        const dropped = draggingStarRef.current, wasOverBH = overBHRef.current
        draggingStarRef.current = null; overBHRef.current = false
        setDraggingStar(null); setGhostPos({ x:0, y:0 }); setOverBH(false)
        if (!didDrag) { handleSelect(hit, startX, startY); return }
        if (dropped && wasOverBH) {
          const ok = await window.electronAPI.confirmDialog(
            `Archive "${dropped.name}"?`,
            `This will move "${dropped.name}" and all its contents to the Archive folder.`
          )
          if (ok) {
            const archivePath = `${dropped.groupPath}/Archive`
            await window.electronAPI.ensureFolder(archivePath)
            const result = await window.electronAPI.renameFile(dropped.path, `${archivePath}/${dropped.name}`)
            if (result.success) { setSpaces(prev => prev.filter(s => s.path !== dropped.path)); if (dropped.isCurrent) onClose() }
          }
        }
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      return
    }

    // Background orbit (right-drag) or pan (left-drag)
    if (e.button === 2) {
      const ox = tilt.current.x, oy = tilt.current.y, sx = e.clientX, sy = e.clientY
      const onMove = me => {
        tilt.current.x = Math.max(-0.55, Math.min(0.55, ox + (me.clientY-sy)*0.005))
        tilt.current.y = oy + (me.clientX-sx)*0.005
      }
      const onUp = () => { document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp) }
      document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp)
    } else if (e.button === 0) {
      const ox = pan.current.x, oy = pan.current.y, sx = e.clientX, sy = e.clientY
      const onMove = me => { pan.current.x = ox+(me.clientX-sx); pan.current.y = oy+(me.clientY-sy) }
      const onUp = () => { document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp) }
      document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp)
    }
  }, [hitTest, handleSelect, onClose])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    zoom.current = Math.max(0.3, Math.min(2.8, zoom.current * (e.deltaY < 0 ? 1.09 : 0.92)))
  }, [])

  const handleFlyEnd = useCallback(() => {
    if (flyingTo && onSelectSpace) onSelectSpace(flyingTo.path)
  }, [flyingTo, onSelectSpace])

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
    return () => { cancelAnimationFrame(id); if (spreadAnimRef.current) cancelAnimationFrame(spreadAnimRef.current) }
  }, [])

  return (
    <div
      onContextMenu={e => e.preventDefault()}
      style={{
        position:'fixed', inset:0, zIndex:200, overflow:'hidden',
        cursor: draggingStar ? 'grabbing' : 'grab',
        opacity: entered ? 1 : 0,
        transform: entered ? 'scale(1)' : 'scale(5)',
        transformOrigin:'50% 50%',
        transition: flyingTo ? 'none' : 'opacity 0.28s ease-out, transform 1s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Full-viewport canvas */}
      <canvas
        ref={canvasRef}
        style={{ position:'absolute', inset:0, display:'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
      />

      {/* Header */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,zIndex:10,
        display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'14px 24px',background:'rgba(2,2,7,0.6)',
        borderBottom:'1px solid rgba(255,255,255,0.04)',backdropFilter:'blur(18px)',
        opacity:flyingTo?0:1,transition:'opacity 0.25s',pointerEvents:flyingTo?'none':'auto',
      }}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.82)',letterSpacing:'0.06em',textTransform:'uppercase'}}>
            ✦ Galaxy View
          </div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.22)',marginTop:2}}>
            {loading ? 'Mapping the galaxy…'
              : `${spaces.length} space${spaces.length!==1?'s':''} discovered · drag to pan · right-drag to orbit · scroll to zoom`}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {[
            { label:'Recenter', title:'Reset pan, tilt, zoom and spread', onClick: handleRecenter,
              icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg> },
            { label:'Gravity', title:'Pull spaces toward center', onClick: handleGravity,
              icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="8"/><polyline points="9 5 12 8 15 5"/><line x1="22" y1="12" x2="16" y2="12"/><polyline points="19 9 16 12 19 15"/><line x1="12" y1="22" x2="12" y2="16"/><polyline points="15 19 12 16 9 19"/><line x1="2" y1="12" x2="8" y2="12"/><polyline points="5 15 8 12 5 9"/></svg> },
            { label:'Antigravity', title:'Push spaces apart', onClick: handleAntigravity,
              icon: <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="8" x2="12" y2="2"/><polyline points="15 5 12 2 9 5"/><line x1="16" y1="12" x2="22" y2="12"/><polyline points="19 9 22 12 19 15"/><line x1="12" y1="16" x2="12" y2="22"/><polyline points="9 19 12 22 15 19"/><line x1="8" y1="12" x2="2" y2="12"/><polyline points="5 9 2 12 5 15"/></svg> },
          ].map(btn => (
            <button key={btn.label} onClick={btn.onClick} title={btn.title}
              style={{padding:'5px 10px',fontSize:12,borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',gap:5,
                background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.38)',
                border:'1px solid rgba(255,255,255,0.07)',transition:'all 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.08)';e.currentTarget.style.color='rgba(255,255,255,0.7)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='rgba(255,255,255,0.38)'}}
            >{btn.icon}{btn.label}</button>
          ))}
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.08)',margin:'0 2px'}}/>
          {onLogout && (
            <button onClick={onLogout}
              style={{padding:'5px 14px',fontSize:12,borderRadius:8,cursor:'pointer',
                background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.38)',
                border:'1px solid rgba(255,255,255,0.07)',transition:'all 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.08)';e.currentTarget.style.color='rgba(255,255,255,0.7)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='rgba(255,255,255,0.38)'}}
            >Space Groups</button>
          )}
          <button onClick={onClose}
            style={{padding:'5px 14px',fontSize:12,borderRadius:8,cursor:'pointer',
              background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.38)',
              border:'1px solid rgba(255,255,255,0.07)',transition:'all 0.15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.08)';e.currentTarget.style.color='rgba(255,255,255,0.7)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='rgba(255,255,255,0.38)'}}
          >✕ Close</button>
        </div>
      </div>

      {/* Black hole — fixed screen-space, bottom-right */}
      <div style={{
        position:'absolute', right:72, bottom:72,
        transform:'translate(50%,50%)',
        width:BH_R*8, height:BH_R*8,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        zIndex:flyingTo?-1:10, pointerEvents:'none',
      }}>
        <div style={{
          position:'absolute', width:BH_R*6, height:BH_R*6, borderRadius:'50%',
          background: overBH
            ? 'radial-gradient(circle,rgba(180,80,255,0.55) 0%,rgba(100,20,220,0.22) 50%,rgba(0,0,0,0) 100%)'
            : 'radial-gradient(circle,rgba(100,40,200,0.28) 0%,rgba(60,10,150,0.10) 50%,rgba(0,0,0,0) 100%)',
          transition:'background 0.2s',
        }} />
        <div style={{position:'absolute',width:BH_R*3,height:BH_R*3,animation:'gv-bh-spin 3s linear infinite'}}>
          <div style={{width:'100%',height:'100%',borderRadius:'50%',
            border: overBH ? '3.5px solid rgba(200,120,255,0.75)' : '2.5px solid rgba(140,70,230,0.45)',
            transform:'scaleY(0.27)',transition:'border 0.2s'}} />
        </div>
        <div style={{position:'absolute',width:BH_R*2.2,height:BH_R*2.2,animation:'gv-bh-spin2 5s linear infinite'}}>
          <div style={{width:'100%',height:'100%',borderRadius:'50%',
            border:'1.5px solid rgba(160,100,240,0.28)',transform:'scaleY(0.25)'}} />
        </div>
        <div style={{
          width:BH_R*1.24,height:BH_R*1.24,borderRadius:'50%',background:'#000',
          boxShadow: overBH ? '0 0 0 1.5px rgba(200,120,255,0.9)' : '0 0 0 1.5px rgba(140,70,230,0.6)',
          zIndex:1,transition:'box-shadow 0.2s',
        }} />
        <div style={{
          position:'absolute', bottom:-4, fontSize: overBH?10:9, fontWeight: overBH?600:400,
          color: overBH?'rgba(220,160,255,0.95)':'rgba(160,100,220,0.55)',
          letterSpacing:'0.04em', whiteSpace:'nowrap', transition:'all 0.2s',
        }}>{overBH ? '⬤ Archive' : 'Archive'}</div>
      </div>

      {/* Ghost star — follows cursor while dragging */}
      {draggingStar && (
        <div style={{
          position:'fixed', left:ghostPos.x, top:ghostPos.y,
          width:40, height:40, marginLeft:-20, marginTop:-20, borderRadius:'50%',
          background:`radial-gradient(circle at 30% 27%,rgba(255,255,255,0.92) 0%,rgba(255,255,255,0) 16%),radial-gradient(circle at 34% 32%,rgba(255,255,255,0.38) 0%,rgba(255,255,255,0.08) 45%,rgba(0,0,0,0.42) 100%),${draggingStar.color}`,
          boxShadow:`0 0 14px ${draggingStar.color}88`,
          opacity: overBH ? 0.5 : 0.9,
          transform: overBH ? 'scale(0.7)' : 'scale(1)',
          transition:'transform 0.15s ease,opacity 0.15s ease',
          zIndex:250, pointerEvents:'none',
        }} />
      )}

      {/* Fly-into-star overlay */}
      {flyingTo && (
        <div
          style={{
            position:'fixed', left:flyingTo.clientX, top:flyingTo.clientY,
            width:64, height:64, marginLeft:-32, marginTop:-32, borderRadius:'50%',
            background:`radial-gradient(circle at 30% 30%,${flyingTo.color} 0%,${flyingTo.color}cc 45%,${flyingTo.color}33 100%)`,
            boxShadow:`0 0 50px ${flyingTo.color},0 0 100px ${flyingTo.color}88`,
            animation:'gv-fly-expand 0.65s cubic-bezier(0.55,0,1,0.45) forwards',
            zIndex:300, pointerEvents:'none',
          }}
          onAnimationEnd={handleFlyEnd}
        />
      )}

      <style>{`
        @keyframes gv-fly-expand {
          0%  { transform:scale(1);  opacity:1;   }
          60% { transform:scale(8);  opacity:1;   }
          100%{ transform:scale(55); opacity:0.9; }
        }
        @keyframes gv-bh-spin  { from{transform:rotate(0deg);}   to{transform:rotate(360deg);}  }
        @keyframes gv-bh-spin2 { from{transform:rotate(216deg);} to{transform:rotate(576deg);}  }
      `}</style>
    </div>
  )
}
