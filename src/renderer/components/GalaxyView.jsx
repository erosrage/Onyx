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
// Returns 4 orbit configs seeded from the space name — each has unique radius,
// ellipse flatness, rotation angle, speed, dot count, and opacity.
function orbitRings(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff
  const w = (n) => { n = (n ^ 61) ^ (n >>> 16); n *= 9; n ^= n >>> 4; n *= 0x27d4eb2d; n ^= n >>> 15; return (n >>> 0) }
  return [0, 1, 2, 3].map(i => ({
    radiusOffset: 14 + (w(h + i * 7)     % 28),        // 14–42 px beyond bodyR/2
    flatness:     0.12 + (w(h + i * 13)  % 52) / 100,  // 0.12–0.64 scaleY compression
    rotation:     (w(h + i * 19) % 6283) / 1000,       // 0–2π rotation
    speed:        3.5 + (w(h + i * 31)   % 60) / 10,   // 3.5–9.5 s period
    dots:         1 + (w(h + i * 41)     % 3),          // 1–3 dots per ring
    alpha:        0.45 + (w(h + i * 53)  % 40) / 100,  // 0.45–0.85 opacity
    dotR:         1.2 + (w(h + i * 61)   % 14) / 10,   // 1.2–2.6 dot radius
    dir:          w(h + i * 71) % 2 === 0 ? 1 : -1,    // CW or CCW
  }))
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
    r:     0.06 + (hm % 7) / 24,
    delay: (_wh(i*5+4) % 3200) / 1000,
    dur:   1.8 + (_wh(i*7+6) % 3000) / 1000,
    op:    0.08 + (_wh(i*11+9) % 380) / 2000,
    // drift params — Lissajous float
    dax: ((_wh(i*17+10) % 800) - 400) / 400,
    day: ((_wh(i*17+11) % 600) - 300) / 300,
    dtx: 22 + (_wh(i*17+12) % 44),
    dty: 20 + (_wh(i*17+13) % 40),
    dpx: (_wh(i*17+14) % 6283) / 1000,
    dpy: (_wh(i*17+15) % 6283) / 1000,
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

// ─── Per-node organic float parameters (seeded by name) ──────────────────────
// Two-harmonic Lissajous-style drift: different x/y/z periods so motion never
// exactly repeats. Amplitudes are in %-units for x/y and px for z.
function floatParams(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff
  return {
    ax:  1.6 + (_wh(h)      % 24) / 10,   // x amplitude  1.6–4 %
    ay:  1.2 + (_wh(h+1)    % 20) / 10,   // y amplitude  1.2–3.2 %
    az:  22  + (_wh(h+2)    % 38),         // z amplitude  22–60 px
    ax2: 0.5 + (_wh(h+6)    % 14) / 10,   // 2nd harmonic x
    ay2: 0.4 + (_wh(h+7)    % 12) / 10,   // 2nd harmonic y
    tx:  6   + (_wh(h+3)    % 9),           // x period     6–15 s
    ty:  5   + (_wh(h+4)    % 9),           // y period     5–14 s
    tz:  8   + (_wh(h+5)    % 11),          // z period     8–19 s
    tx2: 9   + (_wh(h+8)    % 12),          // 2nd x period
    ty2: 10  + (_wh(h+9)    % 11),          // 2nd y period
    px:  (_wh(h+10) % 6283) / 1000,        // x phase offset  0–2π
    py:  (_wh(h+11) % 6283) / 1000,
    pz:  (_wh(h+12) % 6283) / 1000,
    px2: (_wh(h+13) % 6283) / 1000,
    py2: (_wh(h+14) % 6283) / 1000,
  }
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


// ─── Star-appearance node: corona + diffraction spikes + hot core ────────────
// rotPhase gives each node a unique starting angle so they don't all spin in sync.
function drawStarNode(ctx, sx, sy, color, t) {
  const [cr, cg, cb] = hexRgb(color)
  const pulse  = 1 + Math.sin(t * 1.4) * 0.18
  const starR  = 10 * pulse

  // Corona — single radial gradient extending to starR × 6
  const corona = ctx.createRadialGradient(sx, sy, 0, sx, sy, starR * 6)
  corona.addColorStop(0,   `rgba(${cr},${cg},${cb},0.38)`)
  corona.addColorStop(0.3, `rgba(${cr},${cg},${cb},0.14)`)
  corona.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`)
  ctx.beginPath(); ctx.arc(sx, sy, starR * 6, 0, Math.PI * 2)
  ctx.fillStyle = corona; ctx.fill()

  // 8-point polygon star (16 vertices alternating outer/inner)
  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(t * 0.22)
  ctx.beginPath()
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? starR : starR * 0.38
    i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
            : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fillStyle = `rgba(${cr},${cg},${cb},0.92)`
  ctx.shadowColor = `rgba(${cr},${cg},${cb},0.8)`
  ctx.shadowBlur = 8
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.restore()

  // White-hot core pinpoint
  const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, starR * 0.28)
  core.addColorStop(0, 'rgba(255,255,255,1)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.beginPath(); ctx.arc(sx, sy, starR * 0.28, 0, Math.PI * 2)
  ctx.fillStyle = core; ctx.fill()
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
  const rafRef           = useRef(null)
  const timeRef          = useRef(0)
  const prevTsRef        = useRef(null)
  const shootingStarsRef = useRef([])
  const nextShootRef     = useRef(2 + Math.random() * 5) // seconds until next spawn

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

  // ── Positions from current spread + organic float offset ─────────────────
  function getPositions(spaces, t = 0) {
    const sp = spreadRef.current
    const nonCurrent = spaces.filter(s => !s.isCurrent)
    return spaces.map(space => {
      if (space.isCurrent) return { x: 50, y: 50, z: 0 }
      const p  = milkyWayPos(nonCurrent.indexOf(space), nonCurrent.length)
      const fp = floatParams(space.name)
      const fx = Math.sin(t / fp.tx  + fp.px)  * fp.ax  + Math.sin(t / fp.tx2 + fp.px2) * fp.ax2
      const fy = Math.cos(t / fp.ty  + fp.py)  * fp.ay  + Math.cos(t / fp.ty2 + fp.py2) * fp.ay2
      const fz = Math.sin(t / fp.tz  + fp.pz)  * fp.az
      return {
        x: 50 + (p.x - 50) * sp + fx,
        y: 50 + (p.y - 50) * sp + fy,
        z: (p.z || 0) * sp + fz,
      }
    })
  }

  // ── Hit-test a canvas-space mouse position against space nodes ────────────
  const hitTest = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current; if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const mx = clientX - rect.left, my = clientY - rect.top
    const W = canvas.width, H = canvas.height
    const spaces = spacesRef.current
    const positions = getPositions(spaces, timeRef.current)
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
    const dt = prevTsRef.current !== null ? Math.min((ts - prevTsRef.current) / 1000, 0.1) : 0
    prevTsRef.current = ts
    timeRef.current = t

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

    // Background stars — drift + twinkle + subtle spikes
    BG_STARS.forEach(s => {
      const tw = 0.5 + 0.5 * Math.sin(2*Math.PI*t/s.dur + s.delay)
      const dx = s.dax * 3.5 * Math.sin(t / s.dtx + s.dpx)
      const dy = s.day * 2.8 * Math.cos(t / s.dty + s.dpy)
      const x = s.x*W + dx, y = s.y*H + dy
      const r = s.r * (0.85 + 0.35*tw)
      const op = s.op * (0.25 + 0.75*tw)
      // Core dot
      ctx.globalAlpha = op
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2)
      ctx.fillStyle = '#fff'; ctx.fill()
      // Cross spikes — twinkle fires broadly, longer spikes
      if (tw > 0.35) {
        const spikeAlpha = op * (tw - 0.35) * 2.4
        const spikeLen = r * 4.5 * ((tw - 0.35) / 0.65)
        ctx.globalAlpha = spikeAlpha
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 0.35
        ctx.beginPath()
        ctx.moveTo(x - spikeLen, y); ctx.lineTo(x + spikeLen, y)
        ctx.moveTo(x, y - spikeLen); ctx.lineTo(x, y + spikeLen)
        ctx.stroke()
      }
    })
    ctx.globalAlpha = 1

    // ── Shooting stars ────────────────────────────────────────────────────────
    nextShootRef.current -= dt
    if (nextShootRef.current <= 0) {
      // Spawn from a random point along the top-left region, heading diagonally
      const angle = (Math.PI / 6) + Math.random() * (Math.PI / 4)  // 30–75° downward
      const speed = 220 + Math.random() * 280                        // px/s
      shootingStarsRef.current.push({
        x:   W * (0.05 + Math.random() * 0.75),
        y:   H * (0.02 + Math.random() * 0.28),
        vx:  Math.cos(angle) * speed,
        vy:  Math.sin(angle) * speed,
        len: 60 + Math.random() * 100,
        life: 1,                 // 0→1, counts down
        dur:  0.5 + Math.random() * 0.4,
      })
      nextShootRef.current = 4 + Math.random() * 9   // 4–13 s until next
    }
    shootingStarsRef.current = shootingStarsRef.current.filter(ss => ss.life > 0)
    shootingStarsRef.current.forEach(ss => {
      ss.life -= dt / ss.dur
      const progress = 1 - Math.max(0, ss.life)
      const alpha = Math.sin(progress * Math.PI) * 0.7  // fade in + out
      const tx = ss.x + ss.vx * progress * ss.dur
      const ty = ss.y + ss.vy * progress * ss.dur
      const tailX = tx - Math.cos(Math.atan2(ss.vy, ss.vx)) * ss.len * Math.min(progress * 4, 1)
      const tailY = ty - Math.sin(Math.atan2(ss.vy, ss.vx)) * ss.len * Math.min(progress * 4, 1)
      const grad = ctx.createLinearGradient(tailX, tailY, tx, ty)
      grad.addColorStop(0, `rgba(255,255,255,0)`)
      grad.addColorStop(1, `rgba(255,255,255,${alpha})`)
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(tx, ty)
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.2
      ctx.stroke()
      // bright head
      ctx.globalAlpha = alpha * 0.9
      ctx.beginPath(); ctx.arc(tx, ty, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.fill()
      ctx.globalAlpha = 1
    })

    const spaces = spacesRef.current
    const positions = getPositions(spaces, t)
    const curTilt = tilt.current
    const curPan = pan.current
    const curZoom = zoom.current
    const curHovered = hoveredRef.current
    const curFlyingTo = flyingToRef.current

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

        // 4 orbital paths — dots only, no visible ring lines
        const rings = orbitRings(space.name)
        rings.forEach(ring => {
          const orbitR = (bodyR / 2 + ring.radiusOffset) * pf
          ctx.save()
          ctx.translate(sx, sy)
          ctx.rotate(ring.rotation)
          ctx.scale(1, ring.flatness)
          for (let d = 0; d < ring.dots; d++) {
            const angle = (t * ring.dir / ring.speed + d / ring.dots) * Math.PI * 2
            const dx = Math.cos(angle) * orbitR
            const dy = Math.sin(angle) * orbitR
            ctx.beginPath()
            ctx.arc(dx, dy, ring.dotR * pf, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${cr},${cg},${cb},${ring.alpha})`
            ctx.fill()
          }
          ctx.restore()
        })

        drawStarNode(ctx, sx, sy, space.color, t)

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

    // ── Black hole (bottom-right, canvas-rendered) ────────────────────────────
    {
      const bhX = W - 72, bhY = H - 72
      const bhActive = overBHRef.current
      const bhTilt = Math.sin(t * Math.PI / 9) * (14 * Math.PI / 180)
      const diskRX = BH_R * 1.9, diskRY = BH_R * 0.38
      const singR  = BH_R * 0.69

      // Outer ambient glow
      const bhGlow = ctx.createRadialGradient(bhX, bhY, 0, bhX, bhY, BH_R * 3.25)
      bhGlow.addColorStop(0,    bhActive ? 'rgba(255,160,40,0.52)' : 'rgba(255,110,15,0.28)')
      bhGlow.addColorStop(0.42, bhActive ? 'rgba(255,70,0,0.20)'  : 'rgba(200,50,0,0.09)')
      bhGlow.addColorStop(1,    'rgba(0,0,0,0)')
      ctx.beginPath(); ctx.arc(bhX, bhY, BH_R * 3.25, 0, Math.PI * 2)
      ctx.fillStyle = bhGlow; ctx.fill()

      // Back disk — dim, behind singularity (clip to upper half)
      ctx.save()
      ctx.beginPath(); ctx.rect(0, 0, W, bhY); ctx.clip()
      ctx.beginPath(); ctx.ellipse(bhX, bhY, diskRX, diskRY, bhTilt, 0, Math.PI * 2)
      ctx.strokeStyle = bhActive ? 'rgba(180,60,0,0.55)' : 'rgba(180,60,0,0.38)'
      ctx.lineWidth = bhActive ? 5 : 4; ctx.stroke()
      ctx.restore()

      // Event horizon — black circle
      ctx.beginPath(); ctx.arc(bhX, bhY, singR, 0, Math.PI * 2)
      ctx.fillStyle = '#000'; ctx.fill()
      // Photon ring glow
      ctx.save()
      ctx.shadowColor = bhActive ? 'rgba(255,130,0,0.95)' : 'rgba(255,90,0,0.60)'
      ctx.shadowBlur  = bhActive ? 16 : 12
      ctx.beginPath(); ctx.arc(bhX, bhY, singR, 0, Math.PI * 2)
      ctx.strokeStyle = bhActive ? 'rgba(255,200,70,1)' : 'rgba(255,160,30,0.80)'
      ctx.lineWidth = bhActive ? 2.5 : 2; ctx.stroke()
      ctx.restore()

      // Front disk — bright, in front of singularity (clip to lower half)
      ctx.save()
      ctx.beginPath(); ctx.rect(0, bhY, W, H); ctx.clip()
      ctx.save()
      ctx.shadowColor = bhActive ? 'rgba(255,170,30,0.92)' : 'rgba(255,150,20,0.75)'
      ctx.shadowBlur  = bhActive ? 22 : 14
      ctx.beginPath(); ctx.ellipse(bhX, bhY, diskRX, diskRY, bhTilt, 0, Math.PI * 2)
      ctx.strokeStyle = bhActive ? 'rgba(255,210,60,0.96)' : 'rgba(255,210,60,0.88)'
      ctx.lineWidth = bhActive ? 8 : 6; ctx.stroke()
      ctx.restore(); ctx.restore()

      // Label
      ctx.textAlign = 'center'
      ctx.font = bhActive ? 'bold 10px -apple-system,sans-serif' : '9px -apple-system,sans-serif'
      ctx.fillStyle = bhActive ? 'rgba(255,210,80,0.95)' : 'rgba(220,130,30,0.52)'
      ctx.fillText(bhActive ? '⬤ Archive' : 'Archive', bhX, bhY + singR + 14)
    }

    // Loading / empty overlay text
    if (loading || spaces.length === 0) {
      ctx.font = '13px -apple-system,"Segoe UI Variable",sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.textAlign = 'center'
      ctx.fillText(
        loading ? 'Mapping the galaxy…' : 'No spaces found. Add a Space to get started.',
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
      if (hit.isCurrent) {
        // Current star: close galaxy on mouseup (no drag allowed)
        const onUp = () => { document.removeEventListener('mouseup', onUp); handleSelect(hit, e.clientX, e.clientY) }
        document.addEventListener('mouseup', onUp)
        return
      }
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

  // Must use a native listener with { passive: false } so preventDefault() is allowed.
  // React's synthetic onWheel is passive in React 17+ and cannot call preventDefault.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

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
        <div style={{
          position:'absolute',left:'50%',transform:'translateX(-50%)',
          fontSize:18,fontWeight:300,color:'rgba(255,255,255,0.28)',
          letterSpacing:'0.04em',pointerEvents:'none',userSelect:'none',
        }}>
          What's on your mind?
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {[
            { label:'Center', title:'Reset pan, tilt, zoom and spread', onClick: handleRecenter,
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
            >Spaces</button>
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
      `}</style>
    </div>
  )
}
