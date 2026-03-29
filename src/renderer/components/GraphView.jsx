import React, { useEffect, useRef, useState } from 'react'
import { spaceColor } from './GalaxyView'

const GLASS_BORDER = '1px solid var(--glass-border)'

// Wang hash — breaks LCG correlations, gives organic-looking scatter
function wh(n) { n = (n ^ 61) ^ (n >>> 16); n *= 9; n ^= n >>> 4; n *= 0x27d4eb2d; n ^= n >>> 15; return (n >>> 0) }
// Stars: clustered — 60% seeded around 6 loose cluster centres, 40% scattered freely
const _CLUSTERS = [[22,30],[55,18],[78,65],[35,72],[68,42],[12,80]]
const GV_STARS = Array.from({ length: 260 }, (_, i) => {
  const hx = wh(i * 3 + 1), hy = wh(i * 3 + 2), hm = wh(i * 3 + 3)
  let nx, ny
  if (i < 156) { // clustered
    const [cx, cy] = _CLUSTERS[i % _CLUSTERS.length]
    nx = cx + ((hx % 40000) / 1000 - 20)   // ±20% spread around cluster
    ny = cy + ((hy % 30000) / 1000 - 15)
  } else {       // free scatter
    nx = (hx % 98000) / 1000 + 1
    ny = (hy % 96000) / 1000 + 2
  }
  return {
    nx: Math.max(0.5, Math.min(99.5, nx)),
    ny: Math.max(0.5, Math.min(99.5, ny)),
    r:  0.3 + (hm % 24) / 14,
    op: 0.06 + (wh(i * 7 + 5) % 420) / 2400,
  }
})

// Nebula clouds — fixed normalised positions, drawn as radial gradients each frame
const GV_NEBULAS = [
  { nx: 22, ny: 32, rw: 0.28, rh: 0.18, rot: -0.18, rgba: '99,102,241',  op: 0.045 },
  { nx: 68, ny: 62, rw: 0.22, rh: 0.16, rot:  0.25, rgba: '236,72,153',  op: 0.038 },
  { nx: 48, ny: 20, rw: 0.20, rh: 0.13, rot:  0.10, rgba: '56,189,248',  op: 0.032 },
  { nx: 78, ny: 78, rw: 0.18, rh: 0.14, rot: -0.30, rgba: '74,222,128',  op: 0.028 },
  { nx: 14, ny: 70, rw: 0.16, rh: 0.12, rot:  0.05, rgba: '251,146,60',  op: 0.030 },
  { nx: 55, ny: 50, rw: 0.25, rh: 0.15, rot:  0.40, rgba: '167,139,250', op: 0.035 },
]

// Convert a 6-digit hex color to { r, g, b }
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// Deterministic hue per top-level folder — avoids purple (240-290) to reduce monotony
const TOPIC_PALETTE = [200, 0, 160, 355, 32, 128, 16, 186, 52, 172, 310, 340]
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
  // Strip fenced code blocks and inline code to avoid picking up shell/code references
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]+`/g, ' ')
  const tags = []
  const regex = /#([a-zA-Z][a-zA-Z0-9_-]*)/g
  let m
  while ((m = regex.exec(stripped)) !== null) {
    if (m[1] === 'status') continue  // Kanban system tag — skip
    tags.push(m[1].toLowerCase())
  }
  return tags
}

function getNodeLocation(node, files) {
  if (node.isTag)    return { crumb: 'Journal', label: `#${node.tagName}`, kind: 'tag' }
  if (node.isJournal) return { crumb: '', label: 'Journal', kind: 'journal' }
  const file = node._path ? files.find(f => f.path === node._path) : null
  if (!file) return null
  if (!file.folder) return { crumb: 'Space root', label: file.name, kind: 'note' }
  if (node.isTheme || file.folder === file.name)
    return { crumb: 'Topic', label: file.name, kind: 'topic' }
  const parts = file.folder.split('/')
  return { crumb: parts.join(' › '), label: file.name, kind: 'note' }
}

async function buildGraph(allFiles) {
  // Exclude system/utility folders — Archive, assets, whiteboards should not appear in the graph
  const GRAPH_EXCLUDED = new Set(['assets', 'whiteboards'])
  const files = allFiles.filter(f => !GRAPH_EXCLUDED.has((f.folder || '').split('/')[0]))
  const results = await Promise.all(files.map(f => window.electronAPI.readFile(f.path)))
  const linkMap = {}
  const tagFreq = {}
  const hasJournal = files.some(f => f.folder === 'Journal' && f.name === 'Journal')

  // Helper: unique node ID based on relative path (avoids duplicate-name collisions)
  const fileId = (f) => f.relativePath.replace(/\.md$/, '').replace(/\\/g, '/')

  // Count notes per top-level topic folder (used for topic node sizing)
  const topicNoteCount = {}
  files.forEach(f => {
    if (!f.folder) return
    const top = f.folder.split('/')[0]
    topicNoteCount[top] = (topicNoteCount[top] || 0) + 1
  })

  // Build name→fileId map (first file wins for duplicate names)
  const nameToId = {}
  files.forEach(f => {
    const key = f.name.toLowerCase()
    if (!nameToId[key]) nameToId[key] = fileId(f)
  })

  files.forEach((file, i) => {
    const text = results[i].success ? results[i].content : ''
    const id = fileId(file)
    linkMap[id] = parseWikilinks(text)
      .map(raw => nameToId[raw.toLowerCase()])
      .filter(Boolean)
    if (hasJournal && file.folder === 'Journal') {
      parseTags(text).forEach(tag => { tagFreq[tag] = (tagFreq[tag] || 0) + 1 })
    }
  })

  // ── Phase 1: build ALL edges before creating any nodes ──────────────────────
  // This ensures degree counts are accurate when nodes are sized and coloured.

  const degree = {}
  files.forEach(f => { degree[fileId(f)] = 0 })

  const edges = []

  // 1a. Wiki-link edges
  for (const [srcId, targets] of Object.entries(linkMap)) {
    for (const tgtId of targets) {
      if (!edges.some(e => e.source === srcId && e.target === tgtId)) {
        edges.push({ source: srcId, target: tgtId })
        degree[srcId]++
        degree[tgtId] = (degree[tgtId] || 0) + 1
      }
    }
  }

  // 1b. Implicit parent-topic edges for every note that lives inside a folder.
  //     Topic node ID = exact folder name (matching the root file name if one exists,
  //     or the raw folder name for virtual topics — both cases use the same topFolder string).
  //     We also record which topic names need a virtual node (no real file for that folder).
  const properTopicRoots = new Map() // topFolder.toLowerCase() → fileId of root file
  files.filter(f => f.folder && f.folder === f.name).forEach(f => {
    properTopicRoots.set(f.folder.toLowerCase(), fileId(f))
  })
  const virtualTopics = new Map() // topFolder → note count

  files.forEach(file => {
    if (!file.folder) return
    const id = fileId(file)
    const topFolder = file.folder.split('/')[0]
    if (topFolder === 'Archive') return // archived files float freely
    if (file.folder === file.name) return  // this file IS the topic root — skip

    const topicId = properTopicRoots.has(topFolder.toLowerCase())
      ? properTopicRoots.get(topFolder.toLowerCase())
      : topFolder

    if (!edges.some(e => (e.source === id && e.target === topicId) || (e.source === topicId && e.target === id))) {
      edges.push({ source: id, target: topicId, isImplicit: true })
      degree[id] = (degree[id] || 0) + 1
      degree[topicId] = (degree[topicId] || 0) + 1
    }

    if (!properTopicRoots.has(topFolder.toLowerCase())) {
      virtualTopics.set(topFolder, (virtualTopics.get(topFolder) || 0) + 1)
    }
  })

  // ── Phase 2: build nodes now that all degrees are final ──────────────────────

  const maxDeg = Math.max(...Object.values(degree), 1)
  const n = files.length
  const R = Math.min(120 + n * 10, 320)
  const step = (2 * Math.PI) / Math.max(n, 1)
  const maxTopicNotes = Math.max(...Object.values(topicNoteCount), 1)

  const nodes = files.map((file, i) => {
    const id = fileId(file)
    const deg = degree[id] || 0
    const isTheme = file.folder === '' || file.folder === file.name
    const isJournal = file.folder === 'Journal' && file.name === 'Journal'
    const noteCount = isTheme ? (topicNoteCount[file.name] || 0) : 0
    const sizeMetric = isTheme ? Math.max(noteCount, deg) : deg
    const maxMetric  = isTheme ? Math.max(maxTopicNotes, maxDeg) : maxDeg
    const size = isJournal
      ? 28
      : isTheme && sizeMetric > 0 ? 13 + 16 * (sizeMetric / maxMetric)
      : 6 + 8 * (deg / maxDeg)
    return {
      id, label: file.name, _path: file.path,
      _topicFolder: isTheme ? file.folder.split('/')[0] : null,
      degree: deg, isTheme, isJournal, noteCount,
      size, folder: file.folder,
      x: R * Math.cos(i * step) + (Math.random() - 0.5) * 24,
      y: R * Math.sin(i * step) + (Math.random() - 0.5) * 24,
      z: (Math.random() - 0.5) * 60,
      vx: 0, vy: 0, vz: 0, pinned: false,
      _floatPhase: Math.random() * Math.PI * 2,
      _archived: file.folder?.split('/')[0] === 'Archive',
    }
  })

  const nodeById = {}
  nodes.forEach(nd => { nodeById[nd.id] = nd })

  // Create virtual topic nodes (folders with no root .md file)
  virtualTopics.forEach((count, folderName) => {
    const deg = degree[folderName] || 0
    const size = 13 + 16 * (Math.min(count, maxTopicNotes) / maxTopicNotes)
    const vNode = {
      id: folderName, label: folderName, _path: null, _topicFolder: folderName,
      degree: deg, isTheme: true, isJournal: false,
      noteCount: count, size, folder: folderName,
      x: R * Math.cos(Math.random() * 2 * Math.PI),
      y: R * Math.sin(Math.random() * 2 * Math.PI),
      z: (Math.random() - 0.5) * 60,
      vx: 0, vy: 0, vz: 0, pinned: false,
      _floatPhase: Math.random() * Math.PI * 2,
    }
    nodes.push(vNode)
    nodeById[folderName] = vNode
  })

  // Add top tag nodes orbiting Journal
  if (hasJournal) {
    const topTags = Object.entries(tagFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
    const jNode = nodes.find(n => n.isJournal) || null
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
        z: (Math.random() - 0.5) * 40,
        vx: 0, vy: 0, vz: 0, pinned: false,
        _floatPhase: Math.random() * Math.PI * 2,
      }
      nodes.push(tagNode)
      nodeById[tagNode.id] = tagNode
      edges.push({ source: 'Journal', target: tagNode.id, isTagEdge: true })
    })
  }

  return { nodes, edges, nodeById }
}

export default function GraphView({ files, activeFile, onOpenFile, onCreateFile, onDeleteFiles, onMoveFile, onArchiveTopic, onArchiveFile, onUnarchiveTopic, onUnarchiveFile, onRevealFolder, theme, vaultPath, onSwitchSpace, isVisible, recenterToken, centerOnStarToken, hasOverlay }) {
  const canvasRef = useRef(null)
  const graphRef = useRef({ nodes: [], edges: [], nodeById: {} })
  const viewRef = useRef({ scale: 1, panX: 0, panY: 0, tiltX: 0, tiltY: 0 })
  const animRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ nodes: 0, edges: 0 })
  const [ctxMenu, setCtxMenu] = useState(null) // { node, x, y }
  const [ctxMoveOpen, setCtxMoveOpen] = useState(false)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null) // { title, message }
  const confirmResolveRef = useRef(null)
  // showConfirm is ref-stable so canvas handlers can call it without going stale
  const showConfirmRef = useRef(null)
  showConfirmRef.current = (title, message) => new Promise(resolve => {
    confirmResolveRef.current = resolve
    setConfirmModal({ title, message })
  })
  const setCtxMenuRef = useRef(setCtxMenu)
  const setHoveredNodeRef = useRef(setHoveredNode)
  const recenterRef = useRef(null)
  const centerOnStarRef = useRef(null)
  const gravityImpulseRef = useRef(0) // >0 = attract toward center, <0 = repel from center
  const centerStarRef = useRef({ sx: -9999, sy: -9999, r: 42 }) // screen pos + hit radius of center star

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
    const prevNodeById = graphRef.current.nodeById || {}
    buildGraph(files).then(({ nodes, edges, nodeById }) => {
      // Preserve positions for existing nodes; spawn new/restored nodes from the center
      // so they visually "fly out" from the graph origin when restored from archive.
      nodes.forEach(node => {
        if (prevNodeById[node.id]) {
          // Re-use the stable position from the previous render
          const prev = prevNodeById[node.id]
          node.x = prev.x; node.y = prev.y; node.z = prev.z
          node.vx = prev.vx; node.vy = prev.vy; node.vz = prev.vz
          node.pinned = prev.pinned
        } else {
          // Brand-new node (restored from archive or just created) — spawn at center
          // and give it a small outward burst so it flies out visibly.
          node.x = (Math.random() - 0.5) * 10
          node.y = (Math.random() - 0.5) * 10
          node.z = (Math.random() - 0.5) * 10
          const angle = Math.random() * Math.PI * 2
          node.vx = Math.cos(angle) * 3
          node.vy = Math.sin(angle) * 3
          node.vz = (Math.random() - 0.5) * 1.5
          node._isNew = true
        }
      })
      graphRef.current = { nodes, edges, nodeById }
      // Reset centering on first load OR vault switch (no node overlap with previous graph)
      const hadNodes = Object.keys(prevNodeById).length > 0
      const isVaultSwitch = hadNodes && nodes.length > 0 && nodes.every(n => !prevNodeById[n.id])
      if (!hadNodes || isVaultSwitch) viewRef.current.centered = false
      setStats({ nodes: nodes.filter(n => !n.isTag && !n._archived).length, edges: edges.filter(e => !e.isTagEdge).length })
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
      // offsetWidth/offsetHeight give the layout size — unaffected by CSS transforms
      // on ancestor elements (e.g. the galaxy zoom-out scale(0.5) transition).
      W = canvas.width = canvas.parentElement.offsetWidth
      H = canvas.height = canvas.parentElement.offsetHeight
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

    function toScreen(x, y, z = 0) {
      const { tiltX = 0, tiltY = 0, scale, panX, panY } = view
      // Rotate around X axis (forward/back tilt) — full 3D including z
      const y1 = y * Math.cos(tiltX) - z * Math.sin(tiltX)
      const z1 = y * Math.sin(tiltX) + z * Math.cos(tiltX)
      // Rotate around Y axis (left/right orbit)
      const x2 = x * Math.cos(tiltY) + z1 * Math.sin(tiltY)
      const y2 = y1
      const z2 = -x * Math.sin(tiltY) + z1 * Math.cos(tiltY)
      // Perspective divide
      const d = 1100
      const pf = d / (d + z2)
      return [x2 * pf * scale + panX, y2 * pf * scale + panY, pf]
    }
    // Inverse projection: screen (sx,sy) → world (x,y) at a fixed z depth.
    // Approximates pf using z alone (ignores x/y contribution to z2), which is
    // accurate enough for interactive dragging since d=1100 >> typical node z values.
    function toWorldAtZ(sx, sy, z = 0) {
      const { tiltX = 0, tiltY = 0, scale, panX, panY } = view
      const cosTX = Math.cos(tiltX), sinTX = Math.sin(tiltX)
      const cosTY = Math.cos(tiltY), sinTY = Math.sin(tiltY)
      // Approximate pf using z's contribution to z2 only
      const z1_approx = z * cosTX
      const z2_approx = z1_approx * cosTY
      const pf = 1100 / (1100 + z2_approx)
      // Unproject screen → pre-perspective world coords
      const x2 = (sx - panX) / (pf * scale)
      const y2 = (sy - panY) / (pf * scale)
      // Invert Y rotation: y2 = y1 = y*cosTX - z*sinTX
      const y = Math.abs(cosTX) > 0.01 ? (y2 + z * sinTX) / cosTX : y2
      const z1 = y * sinTX + z * cosTX
      // Invert X rotation: x2 = x*cosTY + z1*sinTY
      const x = Math.abs(cosTY) > 0.01 ? (x2 - z1 * sinTY) / cosTY : x2
      return [x, y]
    }

    const isDark = theme !== 'light'
    const maxNotes = Math.max(...nodes.map(n => n.noteCount || 0), 1)

    function nodeColor(n) {
      if (n._archived) return isDark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.38)'
      if (n._path && n._path === activeFile?.path) return '#f5a623'
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
      const SPRING_LEN = 90, TAG_SPRING_LEN = 75
      const SPRING_K = isFloat ? 0.006 : 0.038
      const TAG_SPRING_K = isFloat ? 0.008 : 0.055
      const DAMPING = isFloat ? 0.96 : 0.82
      const CENTER_K = isFloat ? 0.0008 : 0.006
      const FLOAT_FORCE = 0.012

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const dx = b.x - a.x, dy = b.y - a.y, dz = (b.z || 0) - (a.z || 0)
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
          // Scale repulsion by combined radii so large nodes push further
          const minGap = (a.size + b.size) + 10
          const f = REPULSION * minGap / (dist * dist)
          const fx = (dx / dist) * f, fy = (dy / dist) * f, fz = (dz / dist) * f
          a.vx -= fx; a.vy -= fy; a.vz = (a.vz || 0) - fz
          b.vx += fx; b.vy += fy; b.vz = (b.vz || 0) + fz
          // Hard collision separation when nodes overlap
          const overlap = minGap - dist
          if (overlap > 0) {
            const cf = overlap * 0.5
            a.vx -= (dx / dist) * cf; a.vy -= (dy / dist) * cf; a.vz = (a.vz || 0) - (dz / dist) * cf
            b.vx += (dx / dist) * cf; b.vy += (dy / dist) * cf; b.vz = (b.vz || 0) + (dz / dist) * cf
          }
        }
      }

      edges.forEach(e => {
        const a = nodeById[e.source], b = nodeById[e.target]
        if (!a || !b) return
        const dx = b.x - a.x, dy = b.y - a.y, dz = (b.z || 0) - (a.z || 0)
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
        // Rest length accounts for node sizes — halved offset vs before for tighter layout
        const sl = e.isTagEdge ? TAG_SPRING_LEN : SPRING_LEN + (a.size || 7) * 0.5 + (b.size || 7) * 0.5
        const sk = e.isTagEdge ? TAG_SPRING_K : SPRING_K
        const stretch = dist - sl
        const fx = (dx / dist) * stretch * sk, fy = (dy / dist) * stretch * sk, fz = (dz / dist) * stretch * sk
        a.vx += fx; a.vy += fy; a.vz = (a.vz || 0) + fz
        b.vx -= fx; b.vy -= fy; b.vz = (b.vz || 0) - fz
      })

      // Gravity / antigravity impulse — decays each frame
      const gImpulse = gravityImpulseRef.current
      if (gImpulse !== 0) {
        const IMPULSE_K = 0.018
        nodes.forEach(n => {
          if (n.pinned) return
          // positive → pull toward origin; negative → push away from origin
          n.vx   += -n.x         * gImpulse * IMPULSE_K
          n.vy   += -n.y         * gImpulse * IMPULSE_K
          n.vz    = (n.vz || 0)  + -(n.z || 0) * gImpulse * IMPULSE_K
        })
        gravityImpulseRef.current *= 0.88
        if (Math.abs(gravityImpulseRef.current) < 0.005) gravityImpulseRef.current = 0
      }

      const t = performance.now() * 0.001
      nodes.forEach(n => {
        if (n.pinned) return
        if (isFloat) {
          // Gentle sinusoidal float in all 3 axes — each node has its own phase
          n.vx += Math.sin(t * 0.2  + (n._floatPhase || 0)) * FLOAT_FORCE
          n.vy += Math.cos(t * 0.175 + (n._floatPhase || 0) * 1.7) * FLOAT_FORCE
          n.vz  = ((n.vz || 0) + Math.sin(t * 0.13 + (n._floatPhase || 0) * 2.4) * FLOAT_FORCE * 0.7)
        }
        n.vx = (n.vx + (0 - n.x) * CENTER_K) * DAMPING
        n.vy = (n.vy + (0 - n.y) * CENTER_K) * DAMPING
        n.vz = ((n.vz || 0) + (0 - (n.z || 0)) * CENTER_K) * DAMPING
        n.x += n.vx; n.y += n.vy; n.z = (n.z || 0) + (n.vz || 0)
      })
    }

    function draw() {
      const t = performance.now() * 0.001
      ctx.clearRect(0, 0, W, H)

      // Nebula clouds + starfield — dark mode only, matches galaxy view aesthetic
      if (isDark) {
        // Nebula clouds — soft radial gradients at fixed canvas-relative positions
        for (const nb of GV_NEBULAS) {
          const cx = nb.nx / 100 * W, cy = nb.ny / 100 * H
          const rx = nb.rw * W, ry = nb.rh * H
          ctx.save()
          ctx.translate(cx, cy); ctx.rotate(nb.rot); ctx.scale(1, ry / rx)
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
          g.addColorStop(0,   `rgba(${nb.rgba},${nb.op})`)
          g.addColorStop(0.5, `rgba(${nb.rgba},${nb.op * 0.4})`)
          g.addColorStop(1,   `rgba(${nb.rgba},0)`)
          ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2)
          ctx.fillStyle = g; ctx.fill()
          ctx.restore()
        }
        // Stars — clustered, organic scatter
        for (const star of GV_STARS) {
          ctx.beginPath()
          ctx.arc(star.nx / 100 * W, star.ny / 100 * H, star.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${star.op})`
          ctx.fill()
        }
      }

      // ── Central star at world origin — color matches the current space in galaxy view ──
      const [starSX, starSY] = toScreen(0, 0, 0)
      centerStarRef.current.sx = starSX; centerStarRef.current.sy = starSY
      if (starSX > -80 && starSX < W + 80 && starSY > -80 && starSY < H + 80) {
        const vaultName = (vaultPath || '').split(/[\\/]/).pop() || 'Space'
        const { r: sr, g: sg, b: sb } = hexToRgb(spaceColor(vaultName))
        const pulse = 1 + Math.sin(t * 1.4) * 0.18
        const starR = 7 * pulse
        // Corona glow
        const corona = ctx.createRadialGradient(starSX, starSY, 0, starSX, starSY, starR * 6)
        corona.addColorStop(0,   `rgba(${sr},${sg},${sb},0.38)`)
        corona.addColorStop(0.3, `rgba(${sr},${sg},${sb},0.14)`)
        corona.addColorStop(1,   `rgba(${sr},${sg},${sb},0)`)
        ctx.beginPath(); ctx.arc(starSX, starSY, starR * 6, 0, Math.PI * 2)
        ctx.fillStyle = corona; ctx.fill()
        // 8-point star
        ctx.save(); ctx.translate(starSX, starSY); ctx.rotate(t * 0.22)
        ctx.beginPath()
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 - Math.PI / 2
          const r = i % 2 === 0 ? starR : starR * 0.38
          i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r)
        }
        ctx.closePath()
        ctx.fillStyle = `rgba(${sr},${sg},${sb},0.92)`
        ctx.shadowColor = `rgba(${sr},${sg},${sb},0.8)`; ctx.shadowBlur = 8
        ctx.fill(); ctx.shadowBlur = 0
        ctx.restore()
        // Vault name label beneath the star
        ctx.font = `bold ${Math.max(10, 11 * Math.min(view.scale, 1.4))}px -apple-system,"Segoe UI Variable",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(${sr},${sg},${sb},0.85)`
        ctx.fillText(vaultName, starSX, starSY + starR + 14 * Math.min(view.scale, 1))
      }

      // Edges
      edges.forEach(e => {
        const _ea = nodeById[e.source]?._archived || nodeById[e.target]?._archived
        if (_ea) ctx.globalAlpha = 0.15
        const a = nodeById[e.source], b = nodeById[e.target]
        if (!a || !b) return
        const [ax, ay] = toScreen(a.x, a.y, a.z || 0), [bx, by, bpf] = toScreen(b.x, b.y, b.z || 0)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
        if (e.isTagEdge) {
          ctx.strokeStyle = isDark ? 'rgba(251,191,36,0.18)' : 'rgba(180,100,8,0.14)'
          ctx.lineWidth = 0.8
          ctx.setLineDash([3, 5])
        } else if (e.isImplicit) {
          ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.10)'
          ctx.lineWidth = 0.7
          ctx.setLineDash([2, 6])
        } else {
          ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.22)' : 'rgba(100,116,139,0.18)'; ctx.lineWidth = 1
          ctx.setLineDash([])
        }
        ctx.stroke()
        ctx.setLineDash([])

        if (!e.isTagEdge && !e.isImplicit) {
          const angle = Math.atan2(by - ay, bx - ax)
          const r = (b.size || 7) * view.scale * (bpf || 1)
          const tx = bx - r * Math.cos(angle), ty = by - r * Math.sin(angle)
          ctx.beginPath()
          ctx.moveTo(tx, ty)
          ctx.lineTo(tx - 7 * Math.cos(angle - 0.4), ty - 7 * Math.sin(angle - 0.4))
          ctx.lineTo(tx - 7 * Math.cos(angle + 0.4), ty - 7 * Math.sin(angle + 0.4))
          ctx.closePath(); ctx.fillStyle = isDark ? 'rgba(148,163,184,0.38)' : 'rgba(100,116,139,0.32)'; ctx.fill()
        }
        if (_ea) ctx.globalAlpha = 1
      })

      // Nodes — sort by z depth so far nodes draw first (painter's algorithm)
      const sortedNodes = [...nodes].sort((a, b) => {
        const [,,pfa] = toScreen(a.x, a.y, a.z || 0), [,,pfb] = toScreen(b.x, b.y, b.z || 0)
        return pfb - pfa  // smaller pf = farther away = draw first
      })
      sortedNodes.forEach(n => {
        const _prevAlpha = ctx.globalAlpha
        if (n._archived) ctx.globalAlpha = 0.32
        const [sx, sy, pf] = toScreen(n.x, n.y, n.z || 0)
        const r = Math.max((n.size || 7) * view.scale * pf, 0.5)
        const isActive = !!(n._path && n._path === activeFile?.path)

        if (n.isTag) {
          // Tag node: amber — solid if backed by a real file, dashed if virtual
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2)
          ctx.fillStyle = n.hasRealFile
            ? (isDark ? 'rgba(251,191,36,0.38)' : 'rgba(180,100,8,0.28)')
            : (isDark ? 'rgba(251,191,36,0.15)' : 'rgba(180,100,8,0.10)')
          ctx.fill()
          // sphere sheen
          const tagSheen = ctx.createRadialGradient(sx - r*0.3, sy - r*0.3, 0, sx, sy, r)
          tagSheen.addColorStop(0, 'rgba(255,255,255,0.22)'); tagSheen.addColorStop(1, 'rgba(0,0,0,0.12)')
          ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fillStyle = tagSheen; ctx.fill()
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
          ctx.globalAlpha = _prevAlpha
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

        // Sphere-sheen overlay: radial gradient creates a lit highlight in the upper-left
        // and a subtle shadow at the base, giving nodes a glassy/3-D surface texture
        const sheen = ctx.createRadialGradient(sx - r * 0.34, sy - r * 0.34, 0, sx, sy, r)
        sheen.addColorStop(0,    'rgba(255,255,255,0.30)')
        sheen.addColorStop(0.45, 'rgba(255,255,255,0.06)')
        sheen.addColorStop(1,    'rgba(0,0,0,0.22)')
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fillStyle = sheen; ctx.fill()

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
        ctx.globalAlpha = _prevAlpha
      })

      // ── Black hole (fixed screen-space, bottom-right) ─────────────────────
      bhX = W - 72; bhY = H - 72
      const bhActive = bhHover
      const spin = Math.sin(t * 0.06) * 0.22
      // Outer glow — warm orange/amber
      const bhGrad = ctx.createRadialGradient(bhX, bhY, BH_R * 0.3, bhX, bhY, BH_R * 2.8)
      bhGrad.addColorStop(0,   bhActive ? 'rgba(255,160,40,0.52)' : 'rgba(255,110,15,0.28)')
      bhGrad.addColorStop(0.5, bhActive ? 'rgba(200,60,0,0.22)'  : 'rgba(180,50,0,0.10)')
      bhGrad.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.beginPath(); ctx.arc(bhX, bhY, BH_R * 2.8, 0, Math.PI * 2)
      ctx.fillStyle = bhGrad; ctx.fill()
      // Accretion disk (tilted ellipse, wobbling)
      ctx.save(); ctx.translate(bhX, bhY); ctx.rotate(spin)
      ctx.beginPath()
      ctx.ellipse(0, 0, BH_R * 1.5, BH_R * 0.32, 0, 0, Math.PI * 2)
      ctx.strokeStyle = bhActive ? 'rgba(255,210,60,0.88)' : 'rgba(255,160,30,0.55)'
      ctx.lineWidth = bhActive ? 4 : 2.5; ctx.stroke()
      ctx.restore()
      ctx.save(); ctx.translate(bhX, bhY); ctx.rotate(spin + Math.PI * 0.6)
      ctx.beginPath()
      ctx.ellipse(0, 0, BH_R * 1.05, BH_R * 0.22, 0, 0, Math.PI * 2)
      ctx.strokeStyle = bhActive ? 'rgba(255,120,20,0.50)' : 'rgba(200,70,0,0.28)'
      ctx.lineWidth = 1.5; ctx.stroke()
      ctx.restore()
      // Dark singularity with photon ring
      ctx.beginPath(); ctx.arc(bhX, bhY, BH_R * 0.62, 0, Math.PI * 2)
      ctx.fillStyle = '#000'; ctx.fill()
      ctx.strokeStyle = bhActive ? 'rgba(255,200,70,1)' : 'rgba(255,160,30,0.80)'
      ctx.lineWidth = bhActive ? 2.5 : 2; ctx.stroke()
      // Label
      ctx.font = bhActive ? 'bold 10px -apple-system, sans-serif' : '9px -apple-system, sans-serif'
      ctx.fillStyle = bhActive ? 'rgba(255,210,80,0.95)' : 'rgba(220,130,30,0.55)'
      ctx.textAlign = 'center'
      ctx.fillText(bhActive ? '⬤ Archive' : 'Archive', bhX, bhY + BH_R + 15)
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

    // AbortController lets us remove every canvas listener in one call on cleanup,
    // preventing duplicate handlers from accumulating across re-renders.
    const ac = new AbortController()
    const sig = { signal: ac.signal }

    let draggingNode = null, dragOffX = 0, dragOffY = 0
    let isDragging = false
    let dropTarget = null   // topic node being hovered over during drag
    let panning = false, panStartX = 0, panStartY = 0, panOriginX = 0, panOriginY = 0
    let mouseDownX = 0, mouseDownY = 0
    // Black hole — fixed screen-space position, updated each draw call
    let bhX = 0, bhY = 0
    const BH_R = 32
    let bhHover = false  // true while dragging a node over the black hole

    // Wrap draw to also highlight drop target
    const drawWithDropTarget = () => {
      draw()
      if (dropTarget) {
        const [sx, sy, pf] = toScreen(dropTarget.x, dropTarget.y, dropTarget.z || 0)
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
        .map(n => { const [nx, ny, pf] = toScreen(n.x, n.y, n.z || 0); return { n, nx, ny, pf } })
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

    canvas.addEventListener('contextmenu', e => e.preventDefault(), sig)

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
        const [wx, wy] = toWorldAtZ(cx, cy, hit.z || 0)
        dragOffX = hit.x - wx; dragOffY = hit.y - wy; frame = 0
      } else {
        panning = true; panStartX = e.clientX; panStartY = e.clientY
        panOriginX = view.panX; panOriginY = view.panY
      }
    }, sig)

    canvas.addEventListener('mousemove', e => {
      const [cx, cy] = getCanvasXY(e)
      if (draggingNode) {
        if (Math.abs(cx - mouseDownX) > 3 || Math.abs(cy - mouseDownY) > 3) isDragging = true
        const [wx, wy] = toWorldAtZ(cx, cy, draggingNode.z || 0)
        draggingNode.x = wx + dragOffX; draggingNode.y = wy + dragOffY
        draggingNode.vx = 0; draggingNode.vy = 0; draggingNode.vz = 0; frame = 0

        // Black hole proximity check
        bhHover = Math.hypot(cx - bhX, cy - bhY) < BH_R * 1.6
        // Find a topic hub under cursor (skip if hovering black hole)
        const under = bhHover ? null : hitTest(cx, cy, draggingNode)
        dropTarget = (under && under.isTheme && !under.isJournal && !under.isTag) ? under : null
        drawWithDropTarget()
        setHoveredNodeRef.current(null)
      } else if (panning) {
        view.panX = panOriginX + (e.clientX - panStartX)
        view.panY = panOriginY + (e.clientY - panStartY)
        draw()
        setHoveredNodeRef.current(null)
      } else {
        setHoveredNodeRef.current(hitTest(cx, cy) || null)
      }
      const { sx: _csx, sy: _csy, r: _csr } = centerStarRef.current
      const overStar = (cx - _csx) ** 2 + (cy - _csy) ** 2 < _csr * _csr
      canvas.style.cursor = (overStar || hitTest(cx, cy)) ? 'pointer' : (panning ? 'grabbing' : 'default')
    }, sig)

    const handleMouseUp = async () => {
      const droppedNode = draggingNode
      const targetNode = dropTarget
      const wasOverBH = bhHover
      if (draggingNode) { draggingNode.vx = 0; draggingNode.vy = 0; draggingNode.pinned = false; draggingNode = null }
      dropTarget = null; bhHover = false
      panning = false

      // Handle drop onto black hole → archive the topic or note
      if (droppedNode && wasOverBH && isDragging && !droppedNode.isTag && !droppedNode.isJournal && !droppedNode._archived) {
        isDragging = false
        const sourceFile = droppedNode._path ? files.find(f => f.path === droppedNode._path) : null
        if (droppedNode.isTheme && onArchiveTopic) {
          onArchiveTopic(droppedNode._topicFolder)
        } else if (sourceFile && onArchiveFile) {
          onArchiveFile(sourceFile)
        }
        return
      }

      // Handle drop onto topic hub → move file
      if (droppedNode && targetNode && isDragging && onMoveFile && !droppedNode.isTag) {
        isDragging = false
        const sourceFile = droppedNode._path ? files.find(f => f.path === droppedNode._path) : null
        if (sourceFile && sourceFile.folder.split('/')[0] !== targetNode._topicFolder) {
          const ok = await showConfirmRef.current(
            `Move "${sourceFile.name}" into "${targetNode.label}"?`,
            `This will move the note into the ${targetNode.label} folder.`
          )
          if (ok) onMoveFile(sourceFile, targetNode._topicFolder)
        }
      }
      isDragging = false
    }
    document.addEventListener('mouseup', handleMouseUp)

    canvas.addEventListener('click', e => {
      const [cx, cy] = getCanvasXY(e)
      // Suppress click if the mouse moved significantly — it was a drag, not a tap.
      // Using position delta avoids the race where handleMouseUp clears isDragging
      // before the click event fires (mouseup always precedes click in the event order).
      if (Math.abs(cx - mouseDownX) > 4 || Math.abs(cy - mouseDownY) > 4) return
      // Center star hit — open galaxy view
      const { sx: csx, sy: csy, r: csr } = centerStarRef.current
      if ((cx - csx) ** 2 + (cy - csy) ** 2 < csr * csr) {
        if (onSwitchSpace) { onSwitchSpace(); return }
      }
      const hit = hitTest(cx, cy)
      if (!hit) return
      if (hit.isTag) {
        // Tag node → open existing tag topic or create Tags/tagname.md
        const tagName = hit.tagName
        const existing = files.find(f => f.name === tagName && f.folder === 'Tags')
        if (existing) { onOpenFile(existing) }
        else if (onCreateFile) { onCreateFile(`Tags/${tagName}`, `# ${tagName}\n\nA topic from journal tags.\n\n`) }
      } else {
        const file = hit._path ? files.find(f => f.path === hit._path) : null
        if (file) onOpenFile(file)
        else if (hit.isTheme && hit._topicFolder && onRevealFolder) onRevealFolder(hit._topicFolder)
      }
    }, sig)

    canvas.addEventListener('mouseleave', () => setHoveredNodeRef.current(null), sig)

    recenterRef.current = () => {
      // Always re-measure using offsetWidth/offsetHeight — layout dimensions,
      // not affected by CSS transforms (e.g. the galaxy zoom-out scale transition).
      if (canvas.parentElement) {
        const ow = canvas.parentElement.offsetWidth
        const oh = canvas.parentElement.offsetHeight
        if (ow > 0 && oh > 0) { W = canvas.width = ow; H = canvas.height = oh }
      }
      const { nodes } = graphRef.current
      if (!nodes.length) return
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      nodes.forEach(n => {
        const r = n.size || 7
        minX = Math.min(minX, n.x - r); maxX = Math.max(maxX, n.x + r)
        minY = Math.min(minY, n.y - r); maxY = Math.max(maxY, n.y + r)
      })
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
      const pad = 80
      const cw = canvas.width, ch = canvas.height
      const scaleX = (cw - pad * 2) / Math.max(maxX - minX, 1)
      const scaleY = (ch - pad * 2) / Math.max(maxY - minY, 1)
      view.scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.5), 1.5)
      view.panX = cw / 2 - cx * view.scale
      view.panY = ch / 2 - cy * view.scale
      view.tiltX = 0; view.tiltY = 0
      frame = 0
      draw()
    }

    centerOnStarRef.current = () => {
      if (canvas.parentElement) {
        const ow = canvas.parentElement.offsetWidth
        const oh = canvas.parentElement.offsetHeight
        if (ow > 0 && oh > 0) { W = canvas.width = ow; H = canvas.height = oh }
      }
      view.panX = canvas.width / 2
      view.panY = canvas.height / 2
      view.tiltX = 0; view.tiltY = 0
      frame = 0
      draw()
    }

    canvas.addEventListener('wheel', e => {
      e.preventDefault()
      const [cx, cy] = getCanvasXY(e)
      const factor = e.deltaY < 0 ? 1.12 : 0.9
      view.panX = cx - (cx - view.panX) * factor
      view.panY = cy - (cy - view.panY) * factor
      view.scale = Math.min(Math.max(view.scale * factor, 0.1), 5)
      draw()
    }, { passive: false, signal: ac.signal })

    return () => {
      running = false
      if (animRef.current) cancelAnimationFrame(animRef.current)
      ro.disconnect()
      ac.abort()  // removes all canvas listeners registered with sig
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isLoading, files, activeFile, onOpenFile, theme])

  // Re-fit whenever the graph becomes visible or recenterToken changes.
  useEffect(() => {
    if (!isVisible) return
    // One rAF lets the browser paint the panel at full size before we measure it.
    const id = requestAnimationFrame(() => {
      if (recenterRef.current) recenterRef.current()
    })
    return () => cancelAnimationFrame(id)
  }, [isVisible, recenterToken])

  // Center on the star (world origin) when returning from galaxy view.
  useEffect(() => {
    if (!centerOnStarToken) return
    const id = requestAnimationFrame(() => {
      if (centerOnStarRef.current) centerOnStarRef.current()
    })
    return () => cancelAnimationFrame(id)
  }, [centerOnStarToken])

  // Recenter after graph finishes building — runs AFTER the canvas effect has set
  // recenterRef.current, guaranteeing we fit the correct vault's nodes.
  // Delay gives the force simulation time to spread nodes from their spawn positions.
  useEffect(() => {
    if (isLoading || !isVisible) return
    const id = setTimeout(() => {
      if (recenterRef.current) recenterRef.current()
    }, 900)
    return () => clearTimeout(id)
  }, [isLoading, isVisible])

  return (
    <div className="relative h-full" style={{ background: theme === 'light' ? 'var(--bg-primary)' : 'radial-gradient(ellipse at 42% 58%, #09091c 0%, #020207 100%)' }}>

      {/* Floating top-left label — hidden when another panel overlays the graph */}
      {!hasOverlay && (
        <div className="absolute top-3 left-3" style={{ zIndex: 10 }}>
          <span className="text-sm font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.28)' }}>Home Panel</span>
        </div>
      )}

      {/* Floating top-right controls — hidden when another panel overlays the graph */}
      {!hasOverlay && <div className="absolute top-3 right-3 flex items-center gap-1.5" style={{ zIndex: 10 }}>
        <button
          onClick={() => recenterRef.current?.()}
          title="Center"
          className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; e.currentTarget.style.background = 'rgba(0,0,0,0.65)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
        </button>
        <button
          onClick={() => { gravityImpulseRef.current = 1 }}
          title="Gravity — pull nodes toward center"
          className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; e.currentTarget.style.background = 'rgba(0,0,0,0.65)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="8"/><polyline points="9 5 12 8 15 5"/>
            <line x1="22" y1="12" x2="16" y2="12"/><polyline points="19 9 16 12 19 15"/>
            <line x1="12" y1="22" x2="12" y2="16"/><polyline points="15 19 12 16 9 19"/>
            <line x1="2" y1="12" x2="8" y2="12"/><polyline points="5 15 8 12 5 9"/>
          </svg>
        </button>
        <button
          onClick={() => { gravityImpulseRef.current = -1 }}
          title="Antigravity — push nodes away from center"
          className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; e.currentTarget.style.background = 'rgba(0,0,0,0.65)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="8" x2="12" y2="2"/><polyline points="15 5 12 2 9 5"/>
            <line x1="16" y1="12" x2="22" y2="12"/><polyline points="19 9 22 12 19 15"/>
            <line x1="12" y1="16" x2="12" y2="22"/><polyline points="9 19 12 22 15 19"/>
            <line x1="8" y1="12" x2="2" y2="12"/><polyline points="5 9 2 12 5 15"/>
          </svg>
        </button>
        <span className="text-[10px] font-mono tabular-nums px-2 py-1 rounded-lg"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {stats.nodes}n · {stats.edges}e
        </span>
      </div>}

      <div className="absolute inset-0">
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
            Scroll to zoom · Drag to pan · Right-drag to orbit · Drag note onto topic to move · Drag to ⬤ Archive · Right-click for options
          </div>
        )}

        {/* Node location breadcrumb — shown on hover */}
        {hoveredNode && (() => {
          const loc = getNodeLocation(hoveredNode, files)
          if (!loc) return null
          const isThemeDark = theme !== 'light'
          const kindColor = {
            topic:   'var(--accent-text)',
            journal: isThemeDark ? '#99f6e4' : '#0f766e',
            tag:     'rgba(251,191,36,0.9)',
            note:    'var(--text-muted)',
          }
          return (
            <div className="absolute bottom-10 left-3 pointer-events-none select-none" style={{ zIndex: 10 }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: 'var(--glass-bg-strong)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', maxWidth: 320 }}
              >
                {loc.crumb && (
                  <>
                    <span style={{ color: 'var(--text-dim)', opacity: 0.7 }}>{loc.crumb}</span>
                    <span style={{ color: 'var(--text-dim)', opacity: 0.4 }}>›</span>
                  </>
                )}
                <span style={{ color: kindColor[loc.kind] || 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                  {loc.label}
                </span>
                <span style={{ color: 'var(--text-dim)', opacity: 0.4, marginLeft: 2, flexShrink: 0 }}>· click to open</span>
              </div>
            </div>
          )
        })()}

        {/* Node context menu */}
        {ctxMenu && (() => {
          const node = ctxMenu.node
          const file = node._path ? files.find(f => f.path === node._path) : null
          const isTagNode = node.isTag

          // Available topic hubs for "Move to" (exclude current folder and the node itself)
          const topics = graphRef.current.nodes.filter(n =>
            n.isTheme && !n.isJournal && !n.isTag && !n._archived &&
            n.id !== node.id &&
            n._topicFolder !== file?.folder?.split('/')[0]
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
            const ok = await showConfirmRef.current(
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
                            if (onMoveFile) onMoveFile(file, topic._topicFolder)
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

              {/* Archive / Restore */}
              {node._archived && (onUnarchiveTopic || onUnarchiveFile) && (
                <button
                  onClick={() => {
                    setCtxMenu(null)
                    if (file && onUnarchiveFile) {
                      onUnarchiveFile(file.relativePath.replace(/\\/g, '/'))
                    } else if (node._topicFolder && onUnarchiveTopic) {
                      onUnarchiveTopic(`Archive/${node._topicFolder}`)
                    }
                  }}
                  style={{ ...btnBase, color: '#86efac' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(134,239,172,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >↩ Restore</button>
              )}
              {!node._archived && node.isTheme && !node.isJournal && !node.isTag && onArchiveTopic && (
                <button
                  onClick={() => { setCtxMenu(null); onArchiveTopic(node._topicFolder) }}
                  style={{ ...btnBase, color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >Archive topic</button>
              )}
              {!node._archived && !node.isTheme && !node.isTag && !node.isJournal && file && onArchiveFile && (
                <button
                  onClick={() => { setCtxMenu(null); onArchiveFile(file) }}
                  style={{ ...btnBase, color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >Archive note</button>
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

      {/* In-app confirm modal — replaces native OS dialog */}
      {confirmModal && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 100, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="flex flex-col gap-4 rounded-xl px-6 py-5"
            style={{
              background: 'var(--glass-bg-strong)',
              border: '1px solid var(--glass-border-strong)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              minWidth: 300, maxWidth: 400,
            }}
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {confirmModal.title}
              </span>
              <span className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>
                {confirmModal.message}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setConfirmModal(null); confirmResolveRef.current?.(false) }}
                className="px-3 py-1.5 rounded-md text-xs transition-all duration-150"
                style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--glass-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
              >Cancel</button>
              <button
                onClick={() => { setConfirmModal(null); confirmResolveRef.current?.(true) }}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
                style={{ background: 'var(--accent-gradient)', color: '#fff', border: '1px solid transparent', boxShadow: '0 1px 6px var(--accent-glow)' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
