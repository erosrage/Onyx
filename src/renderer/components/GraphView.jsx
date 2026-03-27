import React, { useEffect, useRef, useState } from 'react'

const GLASS_BORDER = '1px solid var(--glass-border)'

// Deterministic hue per top-level folder — avoids purple (240-290) to reduce monotony
const TOPIC_PALETTE = [200, 160, 32, 340, 16, 128, 186, 52, 172, 310]
function folderHue(folder) {
  const key = ((folder || '').split('/')[0]).toLowerCase()
  if (!key) return 200
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffff
  return TOPIC_PALETTE[h % TOPIC_PALETTE.length]
}

function parseWikilinks(text) {
  const links = []
  const regex = /\[\[([^\]]+)\]\]/g
  let m
  while ((m = regex.exec(text)) !== null) links.push(m[1])
  return links
}

function parseTags(text) {
  const tags = []
  const regex = /#([a-zA-Z][a-zA-Z0-9_-]*)/g
  let m
  while ((m = regex.exec(text)) !== null) tags.push(m[1].toLowerCase())
  return tags
}

async function buildGraph(files) {
  const results = await Promise.all(files.map(f => window.electronAPI.readFile(f.path)))
  const nameSet = new Set(files.map(f => f.name.toLowerCase()))
  const linkMap = {}
  const tagFreq = {}
  const hasJournal = files.some(f => f.folder === 'Journal' && f.name === 'Journal')

  // Count how many notes live inside each topic folder
  const folderCount = {}
  files.forEach(f => { if (f.folder) folderCount[f.folder] = (folderCount[f.folder] || 0) + 1 })

  files.forEach((file, i) => {
    const text = results[i].success ? results[i].content : ''
    linkMap[file.name] = parseWikilinks(text).filter(l => nameSet.has(l.toLowerCase()))

    // Accumulate tags from journal files
    if (hasJournal && file.folder === 'Journal') {
      parseTags(text).forEach(tag => { tagFreq[tag] = (tagFreq[tag] || 0) + 1 })
    }
  })

  const degree = {}
  files.forEach(f => { degree[f.name] = 0 })

  const edges = []
  for (const [src, targets] of Object.entries(linkMap)) {
    for (const raw of targets) {
      const tgt = files.find(f => f.name.toLowerCase() === raw.toLowerCase())?.name
      if (tgt) {
        edges.push({ source: src, target: tgt })
        degree[src] = (degree[src] || 0) + 1
        degree[tgt] = (degree[tgt] || 0) + 1
      }
    }
  }

  const maxDeg = Math.max(...Object.values(degree), 1)
  const n = files.length
  const R = Math.min(120 + n * 10, 320)
  const step = (2 * Math.PI) / Math.max(n, 1)

  const maxNotesFolderCount = Math.max(...files.map(f => folderCount[f.name] || 0), 1)
  const nodes = files.map((file, i) => {
    const deg = degree[file.name] || 0
    const isTheme = file.folder === '' || file.folder === file.name  // top-level or topic root
    const isJournal = file.folder === 'Journal' && file.name === 'Journal'
    const noteCount = isTheme ? (folderCount[file.name] || 0) : 0
    // Topics scale by note count; leaf notes scale by connection degree
    const sizeMetric = isTheme ? Math.max(noteCount, deg) : deg
    const maxMetric = isTheme ? Math.max(maxNotesFolderCount, maxDeg) : maxDeg
    const size = isJournal
      ? 28
      : isTheme && sizeMetric > 0 ? 13 + 16 * (sizeMetric / maxMetric)
      : 6 + 8 * (deg / maxDeg)
    return {
      id: file.name, label: file.name, degree: deg, isTheme, isJournal, noteCount,
      size, folder: file.folder,
      x: R * Math.cos(i * step) + (Math.random() - 0.5) * 24,
      y: R * Math.sin(i * step) + (Math.random() - 0.5) * 24,
      vx: 0, vy: 0, pinned: false,
      _floatPhase: Math.random() * Math.PI * 2,
    }
  })

  const nodeById = {}
  nodes.forEach(nd => { nodeById[nd.id] = nd })

  // Add top tag nodes orbiting Journal
  if (hasJournal) {
    const topTags = Object.entries(tagFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
    const jNode = nodeById['Journal']
    const jx = jNode ? jNode.x : 0, jy = jNode ? jNode.y : 0
    topTags.forEach(([tag, freq], i) => {
      const angle = (i / topTags.length) * 2 * Math.PI
      const r = 100 + freq * 8
      // Check if a real Tags/tagname file already exists — if so, boost its size instead
      const realTagFile = files.find(f => f.name === tag && f.folder === 'Tags')
      const tagNode = {
        id: `__tag_${tag}`, label: `#${tag}`, degree: freq,
        isTheme: false, isTag: true, tagFreq: freq, tagName: tag,
        hasRealFile: !!realTagFile,
        size: 4 + Math.min(freq * 1.5, 9),
        x: jx + r * Math.cos(angle), y: jy + r * Math.sin(angle),
        vx: 0, vy: 0, pinned: false,
        _floatPhase: Math.random() * Math.PI * 2,
      }
      nodes.push(tagNode)
      nodeById[tagNode.id] = tagNode
      edges.push({ source: 'Journal', target: tagNode.id, isTagEdge: true })
    })
  }

  return { nodes, edges, nodeById }
}

export default function GraphView({ files, activeFile, onOpenFile, onCreateFile, onDeleteFiles, onMoveFile, theme }) {
  const canvasRef = useRef(null)
  const graphRef = useRef({ nodes: [], edges: [], nodeById: {} })
  const viewRef = useRef({ scale: 1, panX: 0, panY: 0, tiltX: 0, tiltY: 0 })
  const animRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ nodes: 0, edges: 0 })
  const [ctxMenu, setCtxMenu] = useState(null) // { node, x, y }
  const [ctxMoveOpen, setCtxMoveOpen] = useState(false)
  const setCtxMenuRef = useRef(setCtxMenu)

  // Reset move submenu whenever menu closes
  useEffect(() => { if (!ctxMenu) setCtxMoveOpen(false) }, [ctxMenu])

  // Close context menu on any outside left-click (document-level, doesn't block canvas)
  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e) => {
      if (e.button !== 0) return  // only left-clicks close via this handler
      setCtxMenu(null)
    }
    // Delay one tick so the mousedown that opened the menu doesn't close it
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [ctxMenu])

  useEffect(() => {
    if (!files.length) { setIsLoading(false); return }
    setIsLoading(true)
    buildGraph(files).then(({ nodes, edges, nodeById }) => {
      graphRef.current = { nodes, edges, nodeById }
      viewRef.current.centered = false  // reset centering for new graph
      setStats({ nodes: nodes.filter(n => !n.isTag).length, edges: edges.filter(e => !e.isTagEdge).length })
      setIsLoading(false)
    })
  }, [files])

  useEffect(() => {
    if (isLoading) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { nodes, edges, nodeById } = graphRef.current
    const view = viewRef.current
    let W = 0, H = 0

    function resize() {
      if (!canvas.parentElement) return
      const rect = canvas.parentElement.getBoundingClientRect()
      W = canvas.width = rect.width; H = canvas.height = rect.height
      // Only center once per graph build, and only when canvas has real dimensions
      if (!view.centered && W > 0 && H > 0) {
        if (nodes.length > 0) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
          nodes.forEach(n => {
            const r = n.size || 7
            minX = Math.min(minX, n.x - r); maxX = Math.max(maxX, n.x + r)
            minY = Math.min(minY, n.y - r); maxY = Math.max(maxY, n.y + r)
          })
          const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
          const pad = 80
          const scaleX = (W - pad * 2) / Math.max(maxX - minX, 1)
          const scaleY = (H - pad * 2) / Math.max(maxY - minY, 1)
          view.scale = Math.min(Math.min(scaleX, scaleY), 1.5)
          view.panX = W / 2 - cx * view.scale
          view.panY = H / 2 - cy * view.scale
        } else {
          view.panX = W / 2; view.panY = H / 2
        }
        view.centered = true
      }
    }

    function toScreen(x, y) {
      const { tiltX = 0, tiltY = 0, scale, panX, panY } = view
      // Rotate around X axis (forward/back tilt)
      const y1 = y * Math.cos(tiltX)
      const z1 = y * Math.sin(tiltX)
      // Rotate around Y axis (left/right orbit)
      const x2 = x * Math.cos(tiltY) + z1 * Math.sin(tiltY)
      const y2 = y1
      const z2 = -x * Math.sin(tiltY) + z1 * Math.cos(tiltY)
      // Perspective divide
      const d = 1100
      const pf = d / (d + z2)
      return [x2 * pf * scale + panX, y2 * pf * scale + panY, pf]
    }
    function toWorld(sx, sy) { return [(sx - view.panX) / view.scale, (sy - view.panY) / view.scale] }

    const isDark = theme !== 'light'
    const maxNotes = Math.max(...nodes.map(n => n.noteCount || 0), 1)

    function nodeColor(n) {
      if (n.id === activeFile?.name) return '#f5a623'
      if (n.isJournal) return isDark ? '#2dd4bf' : '#0d9488'           // teal
      if (n.isTag)    return isDark ? 'rgba(251,191,36,0.72)' : 'rgba(180,100,8,0.78)'  // amber
      const hue = folderHue(n.folder)
      if (n.isTheme && (n.degree > 0 || n.noteCount > 0)) {
        const t = Math.min((n.noteCount || n.degree) / maxNotes, 1)
        const sat = Math.round(isDark ? 52 + t * 32 : 48 + t * 28)
        const lit = Math.round(isDark ? 52 + t * 22 : 40 + t * 16)
        return `hsl(${hue}, ${sat}%, ${lit}%)`
      }
      if (n.degree === 0) return isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'
      return `hsl(${hue}, ${isDark ? 52 : 46}%, ${isDark ? 62 : 50}%)`
    }

    function simulate() {
      const isFloat = frame >= 280
      const REPULSION = isFloat ? 400 : 3800
      const SPRING_LEN = 110, TAG_SPRING_LEN = 90
      const SPRING_K = isFloat ? 0.006 : 0.038
      const TAG_SPRING_K = isFloat ? 0.008 : 0.055
      const DAMPING = isFloat ? 0.96 : 0.82
      const CENTER_K = isFloat ? 0.0008 : 0.006
      const FLOAT_FORCE = 0.012

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const dx = b.x - a.x, dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const f = REPULSION / (dist * dist)
          const fx = (dx / dist) * f, fy = (dy / dist) * f
          a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy
        }
      }

      edges.forEach(e => {
        const a = nodeById[e.source], b = nodeById[e.target]
        if (!a || !b) return
        const dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const sl = e.isTagEdge ? TAG_SPRING_LEN : SPRING_LEN
        const sk = e.isTagEdge ? TAG_SPRING_K : SPRING_K
        const stretch = dist - sl
        const fx = (dx / dist) * stretch * sk, fy = (dy / dist) * stretch * sk
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
      })

      const t = performance.now() * 0.001
      nodes.forEach(n => {
        if (n.pinned) return
        if (isFloat) {
          // Gentle sinusoidal float — each node drifts at its own phase
          n.vx += Math.sin(t * 0.2 + (n._floatPhase || 0)) * FLOAT_FORCE
          n.vy += Math.cos(t * 0.175 + (n._floatPhase || 0) * 1.7) * FLOAT_FORCE
        }
        n.vx = (n.vx + (0 - n.x) * CENTER_K) * DAMPING
        n.vy = (n.vy + (0 - n.y) * CENTER_K) * DAMPING
        n.x += n.vx; n.y += n.vy
      })
    }

    function draw() {
      ctx.clearRect(0, 0, W, H)

      // Dot grid background
      const dotSpacing = Math.max(28 * view.scale, 10)
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.06)'
      const ox = ((view.panX % dotSpacing) + dotSpacing) % dotSpacing
      const oy = ((view.panY % dotSpacing) + dotSpacing) % dotSpacing
      for (let gx = ox - dotSpacing; gx < W + dotSpacing; gx += dotSpacing) {
        for (let gy = oy - dotSpacing; gy < H + dotSpacing; gy += dotSpacing) {
          ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill()
        }
      }

      // Edges
      edges.forEach(e => {
        const a = nodeById[e.source], b = nodeById[e.target]
        if (!a || !b) return
        const [ax, ay] = toScreen(a.x, a.y), [bx, by, bpf] = toScreen(b.x, b.y)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
        if (e.isTagEdge) {
          ctx.strokeStyle = isDark ? 'rgba(251,191,36,0.18)' : 'rgba(180,100,8,0.14)'
          ctx.lineWidth = 0.8
          ctx.setLineDash([3, 5])
        } else {
          ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.22)' : 'rgba(100,116,139,0.18)'; ctx.lineWidth = 1
          ctx.setLineDash([])
        }
        ctx.stroke()
        ctx.setLineDash([])

        if (!e.isTagEdge) {
          const angle = Math.atan2(by - ay, bx - ax)
          const r = (b.size || 7) * view.scale * (bpf || 1)
          const tx = bx - r * Math.cos(angle), ty = by - r * Math.sin(angle)
          ctx.beginPath()
          ctx.moveTo(tx, ty)
          ctx.lineTo(tx - 7 * Math.cos(angle - 0.4), ty - 7 * Math.sin(angle - 0.4))
          ctx.lineTo(tx - 7 * Math.cos(angle + 0.4), ty - 7 * Math.sin(angle + 0.4))
          ctx.closePath(); ctx.fillStyle = isDark ? 'rgba(148,163,184,0.38)' : 'rgba(100,116,139,0.32)'; ctx.fill()
        }
      })

      // Nodes — sort by z depth so far nodes draw first (painter's algorithm)
      const sortedNodes = [...nodes].sort((a, b) => {
        const [,,pfa] = toScreen(a.x, a.y), [,,pfb] = toScreen(b.x, b.y)
        return pfb - pfa  // smaller pf = farther away = draw first
      })
      sortedNodes.forEach(n => {
        const [sx, sy, pf] = toScreen(n.x, n.y)
        const r = Math.max((n.size || 7) * view.scale * pf, 0.5)
        const isActive = n.id === activeFile?.name

        if (n.isTag) {
          // Tag node: amber — solid if backed by a real file, dashed if virtual
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2)
          ctx.fillStyle = n.hasRealFile
            ? (isDark ? 'rgba(251,191,36,0.38)' : 'rgba(180,100,8,0.28)')
            : (isDark ? 'rgba(251,191,36,0.15)' : 'rgba(180,100,8,0.10)')
          ctx.fill()
          ctx.strokeStyle = isDark ? 'rgba(251,191,36,0.7)' : 'rgba(180,100,8,0.65)'
          if (!n.hasRealFile) ctx.setLineDash([2, 3])
          ctx.lineWidth = n.hasRealFile ? 1.5 : 1; ctx.stroke(); ctx.setLineDash([])
          if (view.scale > 0.45) {
            const fs = Math.max(9, 9 * Math.min(view.scale, 1.3))
            ctx.font = `${fs}px -apple-system, "Segoe UI Variable", sans-serif`
            ctx.fillStyle = isDark ? 'rgba(253,230,138,0.82)' : 'rgba(146,64,14,0.8)'
            ctx.textAlign = 'center'
            ctx.fillText(n.label, sx, sy + r + 10 * Math.min(view.scale, 1))
          }
          return
        }

        // Journal hub glow — teal
        if (n.isJournal) {
          ctx.beginPath(); ctx.arc(sx, sy, r + 10, 0, Math.PI * 2)
          ctx.fillStyle = isDark ? 'rgba(45,212,191,0.08)' : 'rgba(13,148,136,0.07)'; ctx.fill()
          ctx.beginPath(); ctx.arc(sx, sy, r + 4, 0, Math.PI * 2)
          ctx.fillStyle = isDark ? 'rgba(45,212,191,0.13)' : 'rgba(13,148,136,0.10)'; ctx.fill()
        }

        // Theme hub glow — uses topic hue
        if (n.isTheme && (n.degree > 0 || n.noteCount > 0) && !isActive && !n.isJournal) {
          const glowT = Math.min((n.noteCount || 0) / maxNotes, 1)
          const glowAlpha = isDark ? (0.07 + glowT * 0.16).toFixed(2) : (0.05 + glowT * 0.12).toFixed(2)
          const hue = folderHue(n.folder)
          ctx.beginPath(); ctx.arc(sx, sy, r + 6 + glowT * 10, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${hue}, 65%, ${isDark ? 60 : 50}%, ${glowAlpha})`; ctx.fill()
        }

        if (isActive) {
          ctx.beginPath(); ctx.arc(sx, sy, r + 6, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(245, 166, 35, 0.14)'; ctx.fill()
        }

        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fillStyle = nodeColor(n); ctx.fill()

        if (n.isJournal) {
          ctx.strokeStyle = isDark ? 'rgba(45,212,191,0.75)' : 'rgba(13,148,136,0.65)'
          ctx.lineWidth = 2; ctx.stroke()
        } else if (n.isTheme && n.degree > 0 && !isActive) {
          const hue = folderHue(n.folder)
          ctx.strokeStyle = isDark ? `hsla(${hue},60%,65%,0.55)` : `hsla(${hue},55%,45%,0.5)`
          ctx.lineWidth = 1.5; ctx.stroke()
        }

        if (isActive) { ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 2; ctx.stroke() }

        if (view.scale > 0.38) {
          const fs = Math.max(10, 11 * Math.min(view.scale, 1.4))
          const isHub = (n.isTheme && n.degree > 0) || n.isJournal
          ctx.font = `${isHub ? 'bold ' : ''}${isHub ? fs + 1 : fs}px -apple-system, "Segoe UI Variable", sans-serif`
          const hue = folderHue(n.folder)
          ctx.fillStyle = n.degree === 0
            ? (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)')
            : isActive ? '#f5a623'
            : n.isJournal ? (isDark ? '#99f6e4' : '#0f766e')
            : isHub ? (isDark ? `hsl(${hue},75%,78%)` : `hsl(${hue},55%,32%)`)
            : (isDark ? 'rgba(226,228,240,0.82)' : 'rgba(28,28,46,0.85)')
          ctx.textAlign = 'center'
          const label = n.label.length > 22 ? n.label.slice(0, 22) + '…' : n.label
          ctx.fillText(label, sx, sy + r + 12 * Math.min(view.scale, 1))
        }
      })
    }

    let running = true, frame = 0

    function loop() {
      if (!running) return
      simulate(); draw(); frame++
      animRef.current = requestAnimationFrame(loop)
    }

    resize()
    animRef.current = requestAnimationFrame(loop)
    const ro = new ResizeObserver(() => { if (canvas.parentElement) { resize(); draw() } })
    ro.observe(canvas.parentElement)

    let draggingNode = null, dragOffX = 0, dragOffY = 0
    let isDragging = false
    let dropTarget = null   // topic node being hovered over during drag
    let panning = false, panStartX = 0, panStartY = 0, panOriginX = 0, panOriginY = 0
    let mouseDownX = 0, mouseDownY = 0

    // Wrap draw to also highlight drop target
    const drawWithDropTarget = () => {
      draw()
      if (dropTarget) {
        const [sx, sy, pf] = toScreen(dropTarget.x, dropTarget.y)
        const r = Math.max((dropTarget.size || 7) * view.scale * pf, 0.5)
        ctx.beginPath(); ctx.arc(sx, sy, r + 10, 0, Math.PI * 2)
        ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2.5
        ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([])
        ctx.beginPath(); ctx.arc(sx, sy, r + 18, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(74,222,128,0.25)'; ctx.lineWidth = 1.5
        ctx.setLineDash([3, 6]); ctx.stroke(); ctx.setLineDash([])
        ctx.fillStyle = '#4ade80'; ctx.font = '11px -apple-system, sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(`Move into "${dropTarget.label}"`, sx, sy - r - 14)
      }
    }

    function hitTest(cx, cy, exclude = null) {
      // Compute screen positions once, filter out behind-camera nodes (pf <= 0),
      // then check front-to-back (highest pf first) so visually front nodes win.
      // Pass `exclude` to skip the dragging node itself during drop detection.
      const candidates = nodes
        .map(n => { const [nx, ny, pf] = toScreen(n.x, n.y); return { n, nx, ny, pf } })
        .filter(c => c.pf > 0 && c.n !== exclude)
        .sort((a, b) => b.pf - a.pf)
      for (const { n, nx, ny, pf } of candidates) {
        const r = (n.size || 7) * view.scale * pf + 4
        if ((cx - nx) ** 2 + (cy - ny) ** 2 < r * r) return n
      }
      return null
    }

    function getCanvasXY(e) {
      const rect = canvas.getBoundingClientRect()
      return [e.clientX - rect.left, e.clientY - rect.top]
    }

    canvas.addEventListener('contextmenu', e => e.preventDefault())

    canvas.addEventListener('mousedown', e => {
      if (e.button === 2) {
        // Always stop propagation so a backdrop overlay doesn't swallow this
        e.stopPropagation()
        const [cx2, cy2] = getCanvasXY(e)
        const hitNode = hitTest(cx2, cy2)
        if (hitNode) {
          // Right-click on a node → context menu
          e.preventDefault()
          setCtxMenuRef.current({ node: hitNode, x: e.clientX, y: e.clientY })
          return
        }
        // If a menu was open, close it before starting tilt
        setCtxMenuRef.current(null)
        // Right-click on empty space → orbital 3D tilt
        const origTiltX = view.tiltX, origTiltY = view.tiltY
        const startX = e.clientX, startY = e.clientY
        const onMove = me => {
          view.tiltX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, origTiltX + (me.clientY - startY) * 0.006))
          view.tiltY = origTiltY + (me.clientX - startX) * 0.006
          frame = 0; draw()
        }
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
        document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
        return
      }
      const [cx, cy] = getCanvasXY(e)
      mouseDownX = cx; mouseDownY = cy
      const hit = hitTest(cx, cy)
      if (hit) {
        draggingNode = hit; hit.pinned = true; isDragging = false
        const [wx, wy] = toWorld(cx, cy)
        dragOffX = hit.x - wx; dragOffY = hit.y - wy; frame = 0
      } else {
        panning = true; panStartX = e.clientX; panStartY = e.clientY
        panOriginX = view.panX; panOriginY = view.panY
      }
    })

    canvas.addEventListener('mousemove', e => {
      const [cx, cy] = getCanvasXY(e)
      if (draggingNode) {
        if (Math.abs(cx - mouseDownX) > 3 || Math.abs(cy - mouseDownY) > 3) isDragging = true
        const [wx, wy] = toWorld(cx, cy)
        draggingNode.x = wx + dragOffX; draggingNode.y = wy + dragOffY
        draggingNode.vx = 0; draggingNode.vy = 0; frame = 0

        // Find a topic hub under cursor — exclude the dragging node itself so it
        // doesn't shadow the target node directly underneath it
        const under = hitTest(cx, cy, draggingNode)
        dropTarget = (under && under.isTheme && !under.isJournal && !under.isTag) ? under : null
        drawWithDropTarget()
      } else if (panning) {
        view.panX = panOriginX + (e.clientX - panStartX)
        view.panY = panOriginY + (e.clientY - panStartY)
        draw()
      }
      canvas.style.cursor = hitTest(cx, cy) ? 'pointer' : (panning ? 'grabbing' : 'default')
    })

    canvas.addEventListener('mouseup', async () => {
      const droppedNode = draggingNode
      const targetNode = dropTarget
      if (draggingNode) { draggingNode.vx = 0; draggingNode.vy = 0; draggingNode.pinned = false; draggingNode = null }
      dropTarget = null
      panning = false

      // Handle drop onto topic hub
      if (droppedNode && targetNode && isDragging && onMoveFile && !droppedNode.isTag) {
        isDragging = false
        const sourceFile = files.find(f => f.name === droppedNode.id)
        if (sourceFile && sourceFile.folder !== targetNode.id) {
          const ok = await window.electronAPI.confirmDialog(
            `Move "${sourceFile.name}" into "${targetNode.id}"?`,
            `This will move the note into the ${targetNode.id} folder.`
          )
          if (ok) onMoveFile(sourceFile, targetNode.id)
        }
      }
    })

    canvas.addEventListener('click', e => {
      if (isDragging) { isDragging = false; return }
      const [cx, cy] = getCanvasXY(e)
      const hit = hitTest(cx, cy)
      if (!hit) return
      if (hit.isTag) {
        // Tag node → open existing tag topic or create Tags/tagname.md
        const tagName = hit.tagName
        const existing = files.find(f => f.name === tagName && f.folder === 'Tags')
        if (existing) { onOpenFile(existing) }
        else if (onCreateFile) { onCreateFile(`Tags/${tagName}`, `# ${tagName}\n\nA topic from journal tags.\n\n`) }
      } else {
        const file = files.find(f => f.name === hit.id)
        if (file) onOpenFile(file)
      }
    })

    canvas.addEventListener('wheel', e => {
      e.preventDefault()
      const [cx, cy] = getCanvasXY(e)
      const factor = e.deltaY < 0 ? 1.12 : 0.9
      view.panX = cx - (cx - view.panX) * factor
      view.panY = cy - (cy - view.panY) * factor
      view.scale = Math.min(Math.max(view.scale * factor, 0.1), 5)
      draw()
    }, { passive: false })

    return () => {
      running = false
      if (animRef.current) cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  }, [isLoading, files, activeFile, onOpenFile, theme])

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: GLASS_BORDER }}
      >
        <span className="text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>Graph View</span>
        <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--text-dim)' }}>
          {stats.nodes} nodes · {stats.edges} edges
        </span>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-[#6b7280]/50 text-sm">Building graph…</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex h-full items-center justify-center flex-col gap-3">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" style={{ opacity: 0.12 }}>
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <p className="text-[#6b7280]/50 text-sm">No notes to graph yet</p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0" />
        )}
        {!isLoading && files.length > 0 && (
          <div className="absolute bottom-3 right-3 text-[10px] text-[#6b7280]/40 select-none pointer-events-none">
            Scroll to zoom · Drag to pan · Right-drag to orbit · Drag note onto topic to move · Right-click to delete
          </div>
        )}

        {/* Node context menu */}
        {ctxMenu && (() => {
          const node = ctxMenu.node
          const file = files.find(f => f.name === node.id)
          const isTagNode = node.isTag

          // Available topic hubs for "Move to" (exclude current folder and the node itself)
          const topics = graphRef.current.nodes.filter(n =>
            n.isTheme && !n.isJournal && !n.isTag &&
            n.id !== node.id &&
            n.id !== file?.folder
          )

          // Collect files that would be deleted
          const toDelete = isTagNode
            ? (file ? [file] : [])
            : file
              ? [
                  ...files.filter(f => f.folder === file.name),
                  ...files.filter(f => f.folder === file.folder && f.name !== file.name && f.name.startsWith(file.name + ' - ')),
                  file,
                ].filter((f, i, arr) => arr.findIndex(x => x.path === f.path) === i)
              : []

          const handleDelete = async () => {
            setCtxMenu(null)
            if (!toDelete.length) return
            const label = toDelete.length > 1 ? `"${file?.name}" and ${toDelete.length - 1} sub-note(s)` : `"${file?.name || node.label}"`
            const ok = await window.electronAPI.confirmDialog(
              `Delete ${label}?`,
              toDelete.length > 1
                ? `This will permanently delete:\n${toDelete.map(f => f.name).join('\n')}`
                : 'This cannot be undone.'
            )
            if (ok && onDeleteFiles) onDeleteFiles(toDelete.map(f => f.path))
          }

          const btnBase = { display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, background: 'transparent', border: 'none', cursor: 'pointer' }

          return (
            <div
              style={{ position: 'fixed', left: Math.min(ctxMenu.x, window.innerWidth - 220), top: ctxMenu.y, zIndex: 200, minWidth: 200,
                background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden',
              }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                  {node.label}
                </div>
                {file?.folder && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>in {file.folder}</div>
                )}
              </div>

              {/* Open note */}
              {file && !isTagNode && (
                <button onClick={() => { onOpenFile(file); setCtxMenu(null) }}
                  style={{ ...btnBase, color: 'var(--text-primary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >Open note</button>
              )}

              {/* Move to */}
              {file && !isTagNode && topics.length > 0 && (
                <>
                  <button
                    onClick={() => setCtxMoveOpen(o => !o)}
                    style={{ ...btnBase, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>Move to…</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8 }}>{ctxMoveOpen ? '▲' : '▶'}</span>
                  </button>
                  {ctxMoveOpen && (
                    <div style={{ borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto' }}>
                      {topics.map(topic => (
                        <button key={topic.id}
                          onClick={async () => {
                            setCtxMenu(null)
                            if (onMoveFile) onMoveFile(file, topic.id)
                          }}
                          style={{ ...btnBase, color: '#a78bfa', paddingLeft: 20, display: 'flex', alignItems: 'center', gap: 6 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.1)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ fontSize: 10, opacity: 0.6 }}>◉</span>
                          {topic.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Separator before delete */}
              <div style={{ height: 1, background: 'var(--glass-border)', margin: '2px 0' }} />

              {/* Delete — hidden for virtual tag nodes with no backing file */}
              {toDelete.length > 0 ? (
                <button onClick={handleDelete}
                  style={{ ...btnBase, color: '#f38ba8' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(243,139,168,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {toDelete.length > 1 ? `Delete (${toDelete.length} files)` : 'Delete'}
                </button>
              ) : (
                <div style={{ padding: '7px 12px', fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  Virtual node — no file
                </div>
              )}
            </div>
          )
        })()}

        {/* No backdrop — closing is handled by document mousedown listener above */}
      </div>
    </div>
  )
}
