import React, { useEffect, useRef, useState } from 'react'
import { spaceColor } from './GalaxyView'

const GLASS_BORDER = '1px solid var(--glass-border)'

// Wang hash — breaks LCG correlations, gives organic-looking scatter
function wh(n) { n = (n ^ 61) ^ (n >>> 16); n *= 9; n ^= n >>> 4; n *= 0x27d4eb2d; n ^= n >>> 15; return (n >>> 0) }

// MW band angle — matches GalaxyView (≈ −32°)
const _GV_MW_A   = -Math.PI * 0.178
const _GV_MW_COS = Math.cos(_GV_MW_A)
const _GV_MW_SIN = Math.sin(_GV_MW_A)

// Stars: 65% concentrated along the MW band, 35% scattered — spectral colors
const GV_STARS = Array.from({ length: 580 }, (_, i) => {
  const h1 = wh(i*17+1), h2 = wh(i*17+2), h3 = wh(i*17+3)
  const h4 = wh(i*17+4), h5 = wh(i*17+5), h6 = wh(i*17+6)
  let nx, ny
  const inBand = i < 377
  if (inBand) {
    const along  = (h1 % 100000) / 100000 - 0.5
    const across = ((h2 % 10000) / 5000 - 1 + (h3 % 10000) / 5000 - 1) * 0.065
    nx = 50 + (along * 1.65 * _GV_MW_COS - across * _GV_MW_SIN) * 100
    ny = 50 + (along * 1.65 * _GV_MW_SIN + across * _GV_MW_COS) * 100
  } else {
    nx = (h1 % 98000) / 1000 + 1
    ny = (h2 % 96000) / 1000 + 2
  }
  const sc  = h4 % 1000
  const r   = sc < 680 ? 0.20 + (h5 % 10) / 22
            : sc < 900 ? 0.52 + (h5 % 10) / 14
            : sc < 970 ? 0.85 + (h5 % 12) / 11
            : 1.40 + (h5 % 14) / 8
  const bMul = inBand ? 1.45 : 1.0
  const op  = (sc < 680 ? 0.040 + (h6 % 120) / 3000
             : sc < 900 ? 0.100 + (h6 % 170) / 1800
             : sc < 970 ? 0.220 + (h6 % 180) / 1000
             : 0.450 + (h6 % 200) / 800) * bMul
  const ct  = wh(i*13+7) % 100
  const col = ct < 32 ? '#ffffff'    // white A-type
            : ct < 58 ? '#c2daff'    // blue-white B-type (dominant)
            : ct < 70 ? '#e8f2ff'    // pale blue-white
            : ct < 78 ? '#94b8ff'    // bright blue O-type
            : ct < 87 ? '#fffaf4'    // warm white F/G-type
            : ct < 93 ? '#ffd49a'    // orange K-type
            : '#ffb87a'              // red-orange M-type
  return { nx: Math.max(0.5, Math.min(99.5, nx)),
           ny: Math.max(0.5, Math.min(99.5, ny)), r, op, col }
})

// Nebula clouds — 10 overlapping gradient ellipses matching reference imagery
// cx/cy in 0-100 normalised; rx/ry as fraction of W/H; r,g,b,op for fill color
const GV_NEBULAS = [
  { cx:42, cy:36, rx:0.44, ry:0.27, rot: 0.15, r:28,  g:168, b:205, op:0.115 }, // teal
  { cx:62, cy:50, rx:0.40, ry:0.26, rot:-0.10, r:112, g:40,  b:188, op:0.105 }, // violet
  { cx:78, cy:28, rx:0.30, ry:0.21, rot: 0.22, r:198, g:38,  b:150, op:0.090 }, // magenta
  { cx:82, cy:70, rx:0.28, ry:0.20, rot:-0.15, r:205, g:85,  b:28,  op:0.098 }, // orange
  { cx:15, cy:52, rx:0.34, ry:0.25, rot: 0.05, r:38,  g:70,  b:198, op:0.098 }, // deep blue
  { cx:58, cy:18, rx:0.24, ry:0.17, rot: 0.30, r:40,  g:210, b:228, op:0.078 }, // cyan
  { cx:20, cy:72, rx:0.30, ry:0.21, rot:-0.20, r:50,  g:36,  b:182, op:0.098 }, // indigo
  { cx:28, cy:36, rx:0.26, ry:0.18, rot: 0.10, r:150, g:48,  b:172, op:0.082 }, // purple-rose
  { cx:68, cy:62, rx:0.24, ry:0.17, rot: 0.08, r:26,  g:188, b:148, op:0.072 }, // teal-green
  { cx:50, cy:76, rx:0.28, ry:0.19, rot:-0.05, r:178, g:34,  b:122, op:0.080 }, // rose-violet
]
// Featured bright stars — animated halo + 4-point & diagonal diffraction spikes
const GV_BRIGHT_STARS = [
  { nx:0.07, ny:0.09, r:2.4, col:'#9dc8ff' },
  { nx:0.90, ny:0.11, r:2.0, col:'#b8d4ff' },
  { nx:0.83, ny:0.83, r:1.7, col:'#ffecd0' },
  { nx:0.13, ny:0.78, r:1.9, col:'#c0d8ff' },
  { nx:0.53, ny:0.16, r:2.2, col:'#d0e4ff' },
  { nx:0.93, ny:0.47, r:1.5, col:'#a8c0ff' },
  { nx:0.37, ny:0.92, r:1.6, col:'#ffe8c0' },
  { nx:0.72, ny:0.05, r:1.8, col:'#c8e0ff' },
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

export default function GraphView({ files, activeFile, onOpenFile, onCreateFile, onDeleteFiles, onMoveFile, onArchiveTopic, onArchiveFile, onUnarchiveTopic, onUnarchiveFile, onRevealFolder, theme, vaultPath, onSwitchSpace, isVisible, recenterToken, centerOnStarToken, hasOverlay, spaceGroups = [], onMoveTopic, onConvertTopicToNote, homeViewMode, onSetHomeViewMode }) {
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
  const [moveToSpaceModal, setMoveToSpaceModal] = useState(null) // { topicFolder, topicName }
  const [availableSpaces, setAvailableSpaces] = useState([]) // [{ groupName, spaces }]
  const [convertModal, setConvertModal] = useState(null) // { topicFolder, topicName, destination?, conflict? }
  const setCtxMenuRef = useRef(setCtxMenu)
  const setHoveredNodeRef = useRef(setHoveredNode)
  const recenterRef = useRef(null)
  const centerOnStarRef = useRef(null)
  const gravityImpulseRef = useRef(0) // >0 = attract toward center, <0 = repel from center
  const [bhArchiveOpen, setBhArchiveOpen] = useState(false)
  const [bhCtxMenu, setBhCtxMenu]         = useState(null) // { x, y }
  const setBhArchiveOpenRef = useRef(setBhArchiveOpen)
  const setBhCtxMenuRef     = useRef(setBhCtxMenu)
  useEffect(() => { setBhArchiveOpenRef.current = setBhArchiveOpen }, [setBhArchiveOpen])
  useEffect(() => { setBhCtxMenuRef.current = setBhCtxMenu }, [setBhCtxMenu])
  const centerStarRef = useRef({ sx: -9999, sy: -9999, r: 42 }) // screen pos + hit radius of center star
  const prevVaultPathRef = useRef(vaultPath)
  const fitAfterBuildRef = useRef(null) // single timer: fires 1s after vault load, fits spread nodes

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
      // Reset centering on first load OR vault switch.
      // Use vault path comparison (not just node IDs) so spaces that share
      // identically-named files are still detected as a vault switch.
      const hadNodes = Object.keys(prevNodeById).length > 0
      const isVaultSwitch = hadNodes && prevVaultPathRef.current !== vaultPath
      prevVaultPathRef.current = vaultPath
      if (!hadNodes || isVaultSwitch) {
        viewRef.current.centered = false
        // One timer: wait 1 s for nodes to spread, then fit.
        // By then the canvas effect has always already run and recenterRef points at the correct closure.
        if (fitAfterBuildRef.current) clearTimeout(fitAfterBuildRef.current)
        fitAfterBuildRef.current = setTimeout(() => {
          if (recenterRef.current) recenterRef.current()
        }, 1000)
      }
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
          const spread = Math.max(maxX - minX, maxY - minY)
          if (spread < 100) {
            // Nodes just spawned and are still clustered — use a neutral view centered
            // on the origin so nodes have room to spread outward before the 900ms refit.
            view.scale = 1.0
            view.panX = W / 2
            view.panY = H / 2
          } else {
            const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
            const pad = 80
            const scaleX = (W - pad * 2) / Math.max(maxX - minX, 1)
            const scaleY = (H - pad * 2) / Math.max(maxY - minY, 1)
            view.scale = Math.min(Math.min(scaleX, scaleY), 1.5)
            view.panX = W / 2 - cx * view.scale
            view.panY = H / 2 - cy * view.scale
          }
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
      const _bhDt = bhPrevT !== null ? Math.min(t - bhPrevT, 0.1) : 0.016
      bhPrevT = t
      // Smooth speed ramp — 3× faster when cursor is over BH
      const _bhAnyHover = bhCursorHover || bhHover
      const _bhTarget = _bhAnyHover ? 1.08 : 0.359
      const _bhLerp = Math.min(_bhDt * 14, 1)
      bhSpeedCurrent += (_bhTarget - bhSpeedCurrent) * _bhLerp
      bhScaleCurrent += ((_bhAnyHover ? 1.28 : 1.0) - bhScaleCurrent) * _bhLerp
      ctx.clearRect(0, 0, W, H)

      // Background — dark mode: deep space + nebula clouds + bright stars
      if (isDark) {
        // Very dark blue-black base
        ctx.fillStyle = '#000510'
        ctx.fillRect(0, 0, W, H)
        // Edge vignette
        const vig = ctx.createRadialGradient(W/2,H/2,0, W/2,H/2,Math.max(W,H)*0.72)
        vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,12,0.60)')
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)

        // 10 layered nebula clouds — soft radial gradients, no blur filter
        for (const n of GV_NEBULAS) {
          ctx.save()
          ctx.translate(n.cx/100*W, n.cy/100*H); ctx.rotate(n.rot)
          const rw = n.rx*W, rh = n.ry*H
          const ng = ctx.createRadialGradient(0,0,0, 0,0,rw)
          ng.addColorStop(0,    `rgba(${n.r},${n.g},${n.b},${n.op})`)
          ng.addColorStop(0.38, `rgba(${n.r},${n.g},${n.b},${+(n.op*0.52).toFixed(4)})`)
          ng.addColorStop(0.72, `rgba(${n.r},${n.g},${n.b},${+(n.op*0.14).toFixed(4)})`)
          ng.addColorStop(1,    `rgba(${n.r},${n.g},${n.b},0)`)
          ctx.scale(1, rh/rw)
          ctx.beginPath(); ctx.arc(0,0,rw,0,Math.PI*2)
          ctx.fillStyle = ng; ctx.fill()
          ctx.restore()
        }

        // Central blue-white core glow
        const cg = ctx.createRadialGradient(W*0.48,H*0.46,0, W*0.48,H*0.46,Math.min(W,H)*0.20)
        cg.addColorStop(0,    'rgba(148,198,255,0.15)')
        cg.addColorStop(0.38, 'rgba(88,142,225,0.06)')
        cg.addColorStop(1,    'rgba(0,0,0,0)')
        ctx.beginPath(); ctx.arc(W*0.48,H*0.46,Math.min(W,H)*0.20,0,Math.PI*2)
        ctx.fillStyle = cg; ctx.fill()

        // Featured bright stars — halo + 4-point & diagonal spikes, animated
        for (const bs of GV_BRIGHT_STARS) {
          const x = bs.nx*W, y = bs.ny*H
          const tw = 0.5 + 0.5*Math.sin(t*1.9 + bs.nx*18.7 + bs.ny*12.3)
          const bsg = ctx.createRadialGradient(x,y,0, x,y,bs.r*15)
          bsg.addColorStop(0,    `rgba(175,215,255,${+(0.22*tw).toFixed(3)})`)
          bsg.addColorStop(0.28, `rgba(120,172,255,${+(0.08*tw).toFixed(3)})`)
          bsg.addColorStop(1,    'rgba(0,0,0,0)')
          ctx.beginPath(); ctx.arc(x,y,bs.r*15,0,Math.PI*2); ctx.fillStyle=bsg; ctx.fill()
          ctx.globalAlpha = 0.78 + 0.22*tw
          ctx.beginPath(); ctx.arc(x,y,bs.r,0,Math.PI*2); ctx.fillStyle=bs.col; ctx.fill()
          const spL = bs.r*(9+16*tw)*0.4
          ctx.globalAlpha = (0.28 + 0.44*tw)*0.4
          ctx.strokeStyle = bs.col; ctx.lineWidth = 0.65
          ctx.beginPath(); ctx.moveTo(x-spL,y); ctx.lineTo(x+spL,y); ctx.moveTo(x,y-spL); ctx.lineTo(x,y+spL); ctx.stroke()
          const spD = spL*0.42
          ctx.globalAlpha = (0.28+0.44*tw)*0.44*0.4; ctx.lineWidth = 0.42
          ctx.beginPath(); ctx.moveTo(x-spD,y-spD); ctx.lineTo(x+spD,y+spD); ctx.moveTo(x+spD,y-spD); ctx.lineTo(x-spD,y+spD); ctx.stroke()
          ctx.globalAlpha = 1
        }

        // Star field — MW-band concentrated, spectral colors
        for (const star of GV_STARS) {
          ctx.globalAlpha = star.op
          ctx.beginPath()
          ctx.arc(star.nx/100*W, star.ny/100*H, star.r, 0, Math.PI*2)
          ctx.fillStyle = star.col; ctx.fill()
        }
        ctx.globalAlpha = 1
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
        // White core dot
        ctx.beginPath(); ctx.arc(starSX, starSY, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 5
        ctx.fill(); ctx.shadowBlur = 0
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
      const bhActive = bhCursorHover || bhHover
      const bhR = BH_R * bhScaleCurrent
      // Drag-radius hint — dashed ring shown while dragging any node
      if (isDragging) {
        ctx.beginPath(); ctx.arc(bhX, bhY, bhR * 1.8, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,140,30,0.28)'; ctx.lineWidth = 1
        ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([])
      }
      // Outer glow — warm orange/amber
      const bhGrad = ctx.createRadialGradient(bhX, bhY, bhR * 0.3, bhX, bhY, bhR * 2.8)
      bhGrad.addColorStop(0,   bhActive ? 'rgba(255,160,40,0.62)' : 'rgba(255,110,15,0.28)')
      bhGrad.addColorStop(0.5, bhActive ? 'rgba(200,60,0,0.28)'  : 'rgba(180,50,0,0.10)')
      bhGrad.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.beginPath(); ctx.arc(bhX, bhY, bhR * 2.8, 0, Math.PI * 2)
      ctx.fillStyle = bhGrad; ctx.fill()
      // Event horizon disk — scattered/broken particle field (x-axis orbit)
      ctx.save()
      ctx.translate(bhX, bhY)
      for (let i = 0; i < 209; i++) {
        const r1 = Math.abs(Math.sin(i * 127.1 + 311.7))
        const r2 = Math.abs(Math.sin(i * 269.5 + 183.3))
        const r3 = Math.abs(Math.sin(i * 419.2 +  71.1))
        const r4 = Math.abs(Math.sin(i *  73.8 + 229.4))
        if (r4 < 0.20) continue
        const angle = (i / 209) * Math.PI * 2 + (r1 - 0.5) * 0.50 + t * bhSpeedCurrent
        const radF  = r2
        const diskR = bhR * (0.88 + radF * 0.90)
        const ex = Math.cos(angle) * diskR
        const ey = Math.sin(angle) * diskR * 0.30
        const pSize = 0.2 + r3 * 0.9
        const heat  = 1 - radF
        const tw = 0.60 + 0.40 * Math.sin(t * 1.6 + r1 * 6.283)
        const depth = 0.75 + 0.25 * Math.sin(angle)
        const baseA = bhActive ? 0.60 + 0.38 * heat : 0.22 + 0.28 * heat
        ctx.globalAlpha = baseA * (0.40 + 0.60 * r3) * tw * depth
        ctx.beginPath(); ctx.arc(ex, ey, pSize, 0, Math.PI * 2)
        ctx.fillStyle = heat > 0.60 ? (bhActive ? '#fff5cc' : '#ffd050')
                     : heat > 0.28 ? (bhActive ? '#ffaa28' : '#ff7010')
                     :                (bhActive ? '#ff4c0c' : '#b83208')
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.restore()
      // Spaghettification — stretch trail from dragging node toward BH
      if (bhHover && draggingNode) {
        const [_sx, _sy] = toScreen(draggingNode.x, draggingNode.y, draggingNode.z || 0)
        const _nr = Math.max((draggingNode.size || 7) * view.scale, 4)
        for (let _si = 1; _si <= 10; _si++) {
          const _f = _si / 10
          const _tx = _sx + (bhX - _sx) * _f * 0.65
          const _ty = _sy + (bhY - _sy) * _f * 0.65
          ctx.globalAlpha = (1 - _f) * 0.32
          ctx.beginPath(); ctx.arc(_tx, _ty, _nr * (1 - _f * 0.55), 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,160,30,1)'; ctx.fill()
        }
        ctx.globalAlpha = 1
      }
      // Dark singularity
      ctx.beginPath(); ctx.arc(bhX, bhY, bhR * 0.62, 0, Math.PI * 2)
      ctx.fillStyle = '#000'; ctx.fill()
      // Photon ring glow — layered thin strokes for soft halo
      const ringPulse = 0.75 + 0.25 * Math.sin(t * 1.2)
      ctx.beginPath(); ctx.arc(bhX, bhY, bhR * 0.62, 0, Math.PI * 2)
      ctx.strokeStyle = bhActive ? `rgba(255,240,180,${(0.18 * ringPulse).toFixed(3)})` : `rgba(255,210,120,${(0.08 * ringPulse).toFixed(3)})`
      ctx.lineWidth = bhActive ? 7 : 5; ctx.stroke()
      ctx.beginPath(); ctx.arc(bhX, bhY, bhR * 0.62, 0, Math.PI * 2)
      ctx.strokeStyle = bhActive ? `rgba(255,255,220,${(0.75 * ringPulse).toFixed(3)})` : `rgba(255,200,80,${(0.38 * ringPulse).toFixed(3)})`
      ctx.lineWidth = 0.8; ctx.stroke()
      // Gravitational pulse rings
      if (bhPulseStartT !== null) {
        const _pe = t - bhPulseStartT
        if (_pe < 1.4) {
          for (let _ri = 0; _ri < 3; _ri++) {
            const _re = _pe - _ri * 0.22; if (_re <= 0) continue
            const _rp = Math.min(_re / 0.9, 1)
            ctx.beginPath(); ctx.arc(bhX, bhY, bhR * (1.2 + _rp * 4.5), 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(255,170,40,${((1 - _rp) * 0.55).toFixed(3)})`
            ctx.lineWidth = 1.2; ctx.stroke()
          }
        } else { bhPulseStartT = null }
      }
      // Label
      ctx.font = bhActive ? 'bold 10px -apple-system, sans-serif' : '9px -apple-system, sans-serif'
      ctx.fillStyle = bhActive ? 'rgba(255,210,80,0.95)' : 'rgba(220,130,30,0.55)'
      ctx.textAlign = 'center'
      ctx.fillText(bhActive ? '⬤ Archive' : 'Archive', bhX, bhY + bhR + 15)
      // Archive count badge
      const _archCount = files.filter(f => f.folder?.split('/')[0] === 'Archive').length
      if (_archCount > 0) {
        const _bx = bhX + bhR * 0.74, _by = bhY - bhR * 0.74
        ctx.beginPath(); ctx.arc(_bx, _by, 8, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,140,30,0.92)'; ctx.fill()
        ctx.font = 'bold 8px -apple-system, sans-serif'; ctx.fillStyle = '#000'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(_archCount), _bx, _by)
        ctx.textBaseline = 'alphabetic'
      }
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
    const BH_R = 35
    let bhHover = false         // true while dragging a node over the black hole
    let bhCursorHover = false   // true when cursor is over BH without dragging
    let bhSpeedCurrent = 0.359  // lerps toward target for smooth speed ramp
    let bhScaleCurrent = 1.0    // lerps toward 1.28 on hover for size/brightness
    let bhPrevT = null          // for delta-time based lerp
    let bhPulseStartT = null    // gravitational pulse animation start time

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
        bhCursorHover = false
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
        bhCursorHover = Math.hypot(cx - bhX, cy - bhY) < BH_R * 1.8
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

    canvas.addEventListener('contextmenu', e => {
      e.preventDefault()
      const [cx, cy] = getCanvasXY(e)
      if (Math.hypot(cx - bhX, cy - bhY) < BH_R * 1.5) setBhCtxMenuRef.current({ x: e.clientX, y: e.clientY })
    }, sig)

    canvas.addEventListener('click', e => {
      const [cx, cy] = getCanvasXY(e)
      // Suppress click if the mouse moved significantly — it was a drag, not a tap.
      // Using position delta avoids the race where handleMouseUp clears isDragging
      // before the click event fires (mouseup always precedes click in the event order).
      if (Math.abs(cx - mouseDownX) > 4 || Math.abs(cy - mouseDownY) > 4) return
      // BH click → pulse + open archive panel
      if (Math.hypot(cx - bhX, cy - bhY) < BH_R * 1.5) {
        bhPulseStartT = performance.now() * 0.001
        setBhArchiveOpenRef.current(true)
        return
      }
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

    canvas.addEventListener('mouseleave', () => { bhCursorHover = false }, { signal: ac.signal })

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

  // Cancel the refit timer only when GraphView unmounts (not on every canvas effect re-run).
  // If cancelled on every re-run the timer set in buildGraph.then() gets wiped out the moment
  // setIsLoading(false) triggers the canvas effect, which is exactly why centering never fires.
  useEffect(() => {
    return () => { if (fitAfterBuildRef.current) { clearTimeout(fitAfterBuildRef.current); fitAfterBuildRef.current = null } }
  }, [])

  // Re-fit whenever the graph becomes visible or the recenter button is pressed.
  useEffect(() => {
    if (!isVisible) return
    const id = requestAnimationFrame(() => { if (recenterRef.current) recenterRef.current() })
    return () => cancelAnimationFrame(id)
  }, [isVisible, recenterToken])

  // Center on the star (world origin) when closing galaxy view.
  useEffect(() => {
    if (!centerOnStarToken) return
    const id = requestAnimationFrame(() => { if (centerOnStarRef.current) centerOnStarRef.current() })
    return () => cancelAnimationFrame(id)
  }, [centerOnStarToken])

  return (
    <div className="relative h-full" style={{ background: theme === 'light' ? 'var(--bg-primary)' : 'radial-gradient(ellipse at 42% 58%, #09091c 0%, #020207 100%)' }}>

      {/* Floating top-left label — hidden when another panel overlays the graph */}
      {!hasOverlay && (
        <div className="absolute top-3 left-3" style={{ zIndex: 10 }}>
          <span className="text-sm font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.28)' }}>Home</span>
        </div>
      )}

      {/* Floating top-right controls — hidden when another panel overlays the graph */}
      {!hasOverlay && <div className="absolute top-3 right-3 flex items-center gap-1.5" style={{ zIndex: 10 }}>

        {/* View mode toggle */}
        {onSetHomeViewMode && (
          <>
            {[
              { mode: 'graph',    title: 'Graph view',    icon: <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> },
              { mode: 'explorer', title: 'File explorer', icon: <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
              { mode: 'treemap',  title: 'Treemap view',  icon: <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="8" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/></svg> },
            ].map(({ mode, title, icon }) => {
              const active = homeViewMode === mode
              return (
                <button key={mode} onClick={() => onSetHomeViewMode(mode)} title={title}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150"
                  style={{
                    background: active ? 'rgba(124,58,237,0.35)' : 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(8px)',
                    border: active ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    color: active ? 'rgba(196,181,253,1)' : 'rgba(255,255,255,0.45)',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; e.currentTarget.style.background = 'rgba(0,0,0,0.65)' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'rgba(0,0,0,0.45)' } }}
                >{icon}</button>
              )
            })}
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
          </>
        )}

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
              {!node._archived && node.isTheme && !node.isJournal && !node.isTag && onConvertTopicToNote && (
                <button
                  onClick={() => {
                    setCtxMenu(null)
                    setConvertModal({ topicFolder: node._topicFolder, topicName: node.label })
                  }}
                  style={{ ...btnBase, color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >Convert to Note…</button>
              )}
              {!node._archived && node.isTheme && !node.isJournal && !node.isTag && onMoveTopic && spaceGroups.length > 0 && (
                <button
                  onClick={async () => {
                    setCtxMenu(null)
                    const norm = p => p.replace(/\\/g, '/')
                    const groups = []
                    for (const group of spaceGroups) {
                      const result = await window.electronAPI.listSpaces(group.path)
                      if (!result.success) continue
                      const spaces = result.spaces.filter(s => norm(s.path) !== norm(vaultPath))
                      if (spaces.length > 0) groups.push({ groupName: group.name, spaces })
                    }
                    setAvailableSpaces(groups)
                    setMoveToSpaceModal({ topicFolder: node._topicFolder, topicName: node.label })
                  }}
                  style={{ ...btnBase, color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-strong)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >Move to Space…</button>
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

      {/* BH right-click context menu */}
      {bhCtxMenu && (
        <div
          style={{ position:'fixed', left:bhCtxMenu.x, top:bhCtxMenu.y, zIndex:400,
            background:'var(--glass-bg-strong)', border:'1px solid rgba(255,165,40,0.22)',
            borderRadius:10, padding:'4px 0', minWidth:160,
            boxShadow:'0 8px 32px rgba(0,0,0,0.5)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)' }}
          onMouseLeave={() => setBhCtxMenu(null)}
        >
          {[
            { label:'View Archive', action:() => { setBhArchiveOpen(true); setBhCtxMenu(null) } },
            { label:'Empty Archive', action:async () => {
              setBhCtxMenu(null)
              const archived = files.filter(f => f.folder?.split('/')[0] === 'Archive')
              if (!archived.length) return
              const ok = await showConfirmRef.current('Empty Archive?', 'This permanently deletes all archived notes. This cannot be undone.')
              if (ok && onDeleteFiles) onDeleteFiles(archived.map(f => f.path))
            }},
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{ display:'block', width:'100%', padding:'8px 14px', background:'none', border:'none',
                cursor:'pointer', fontSize:12, color:'rgba(255,220,140,0.85)', textAlign:'left' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,140,30,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}
            >{item.label}</button>
          ))}
        </div>
      )}

      {/* BH archive panel */}
      {bhArchiveOpen && (() => {
        const archivedFiles  = files.filter(f => f.folder?.split('/')[0] === 'Archive')
        const archivedTopics = [...new Set(archivedFiles.map(f => f.folder?.split('/')[1]).filter(Boolean))]
        return (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex:200, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(8px)' }}>
            <div style={{ background:'var(--glass-bg-strong)', border:'1px solid rgba(255,165,40,0.22)',
              borderRadius:16, padding:'22px 26px', maxWidth:400, width:'90%', maxHeight:'72vh',
              display:'flex', flexDirection:'column', gap:14,
              boxShadow:'0 8px 48px rgba(0,0,0,0.6), 0 0 24px rgba(255,140,30,0.10)',
              backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'rgba(255,215,135,0.95)' }}>
                  ⬤ Archive {archivedFiles.length > 0 && <span style={{ fontSize:11, opacity:0.6 }}>({archivedFiles.length})</span>}
                </span>
                <button onClick={() => setBhArchiveOpen(false)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:15 }}>✕</button>
              </div>
              {archivedFiles.length === 0
                ? <p style={{ fontSize:12, color:'var(--text-dim)', textAlign:'center', padding:'12px 0' }}>Nothing archived yet</p>
                : <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:6, maxHeight:'calc(72vh - 120px)' }}>
                    {archivedTopics.map(topic => (
                      <div key={topic} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'7px 11px', borderRadius:8, background:'var(--glass-bg)', border:'1px solid var(--glass-border)' }}>
                        <span style={{ fontSize:12, color:'var(--text-primary)' }}>📁 {topic}</span>
                        {onUnarchiveTopic && (
                          <button onClick={() => onUnarchiveTopic(topic)}
                            style={{ padding:'3px 10px', borderRadius:6, fontSize:11, cursor:'pointer',
                              background:'rgba(255,140,30,0.18)', border:'1px solid rgba(255,140,30,0.35)', color:'rgba(255,200,80,0.9)' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(255,140,30,0.32)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(255,140,30,0.18)'}
                          >Restore</button>
                        )}
                      </div>
                    ))}
                    {archivedFiles.filter(f => !f.folder?.split('/')[1]).map(file => (
                      <div key={file.path} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'7px 11px', borderRadius:8, background:'var(--glass-bg)', border:'1px solid var(--glass-border)' }}>
                        <span style={{ fontSize:12, color:'var(--text-muted)' }}>📄 {file.name}</span>
                        {onUnarchiveFile && (
                          <button onClick={() => onUnarchiveFile(file)}
                            style={{ padding:'3px 10px', borderRadius:6, fontSize:11, cursor:'pointer',
                              background:'rgba(255,140,30,0.18)', border:'1px solid rgba(255,140,30,0.35)', color:'rgba(255,200,80,0.9)' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(255,140,30,0.32)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(255,140,30,0.18)'}
                          >Restore</button>
                        )}
                      </div>
                    ))}
                  </div>
              }
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:4, borderTop:'1px solid var(--glass-border)' }}>
                <button onClick={async () => {
                  if (!archivedFiles.length) return
                  const ok = await showConfirmRef.current('Empty Archive?', 'This permanently deletes all archived notes. This cannot be undone.')
                  if (ok && onDeleteFiles) { onDeleteFiles(archivedFiles.map(f => f.path)); setBhArchiveOpen(false) }
                }}
                  style={{ padding:'5px 14px', borderRadius:8, fontSize:11, cursor:'pointer',
                    background:'rgba(220,40,40,0.15)', border:'1px solid rgba(220,40,40,0.28)', color:'rgba(255,90,70,0.8)' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(220,40,40,0.28)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(220,40,40,0.15)'}
                >Empty Archive</button>
                <button onClick={() => setBhArchiveOpen(false)}
                  style={{ padding:'5px 14px', borderRadius:8, fontSize:11, cursor:'pointer',
                    background:'var(--glass-bg)', border:'1px solid var(--glass-border)', color:'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--glass-bg-strong)'}
                  onMouseLeave={e => e.currentTarget.style.background='var(--glass-bg)'}
                >Done</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Convert to Note modal */}
      {convertModal && (() => {
        const topicNames = [...new Set(
          graphRef.current.nodes
            .filter(n => n.isTheme && !n.isJournal && !n.isTag && !n._archived && n._topicFolder !== convertModal.topicFolder)
            .map(n => n._topicFolder)
        )]
        const destinations = [
          { label: 'Space Root', value: '' },
          ...topicNames.map(t => ({ label: t, value: t })),
        ]
        const isPickStep = convertModal.destination === undefined
        const hasConflict = convertModal.conflict

        return (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 300, background: 'rgba(0,0,12,0.72)', backdropFilter: 'blur(6px)' }}>
            <div style={{
              background: 'rgba(8,6,20,0.97)', border: '1px solid rgba(255,165,40,0.22)',
              borderRadius: 16, padding: '22px 24px', maxWidth: 340, width: '90%', maxHeight: '70vh',
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 32px rgba(255,140,30,0.10)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,215,135,0.95)' }}>
                  Convert &ldquo;{convertModal.topicName}&rdquo; to Note
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  {isPickStep ? 'Move contents to:' : hasConflict ? 'Conflict detected' : `Move to "${convertModal.destination || 'Space Root'}"?`}
                </span>
              </div>

              {isPickStep && (
                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 'calc(70vh - 130px)' }}>
                  {destinations.map(dest => (
                    <button key={dest.value}
                      onClick={() => {
                        const conflict = files.some(f =>
                          (dest.value === '' ? f.folder === '' : f.folder === dest.value) &&
                          f.name === convertModal.topicName
                        )
                        setConvertModal(m => ({ ...m, destination: dest.value, conflict }))
                      }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                        borderRadius: 8, fontSize: 12, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                        color: 'rgba(255,255,255,0.72)', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,140,30,0.14)'; e.currentTarget.style.borderColor = 'rgba(255,140,30,0.30)'; e.currentTarget.style.color = 'rgba(255,200,80,0.95)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)' }}
                    >{dest.label}</button>
                  ))}
                </div>
              )}

              {!isPickStep && hasConflict && (
                <div style={{ fontSize: 12, color: 'rgba(255,180,80,0.9)', background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.20)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>
                  A note named &ldquo;{convertModal.topicName}&rdquo; already exists in {convertModal.destination ? `"${convertModal.destination}"` : 'Space Root'}. It will be overwritten.
                </div>
              )}

              {!isPickStep && !hasConflict && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 1.5 }}>
                  The root note will be copied and all child notes will be moved to {convertModal.destination ? `"${convertModal.destination}"` : 'Space Root'}.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <button
                  onClick={() => {
                    if (!isPickStep) { setConvertModal(m => ({ ...m, destination: undefined, conflict: false })); return }
                    setConvertModal(null)
                  }}
                  style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.42)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.42)'; e.currentTarget.style.background = 'transparent' }}
                >{isPickStep ? 'Cancel' : '← Back'}</button>
                {!isPickStep && (
                  <button
                    onClick={async () => {
                      const { topicFolder, destination } = convertModal
                      setConvertModal(null)
                      await onConvertTopicToNote(topicFolder, destination)
                    }}
                    style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: hasConflict ? 'linear-gradient(135deg,rgba(220,80,40,0.92),rgba(180,30,20,0.92))' : 'linear-gradient(135deg,rgba(255,155,35,0.92),rgba(215,85,0,0.92))',
                      color: '#fff', border: '1px solid rgba(255,165,40,0.35)',
                      boxShadow: '0 2px 12px rgba(255,120,0,0.32)', transition: 'opacity 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >{hasConflict ? 'Overwrite & Convert' : 'Convert'}</button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Move to Space modal */}
      {moveToSpaceModal && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 300, background: 'rgba(0,0,12,0.72)', backdropFilter: 'blur(6px)' }}
        >
          <div style={{
            background: 'rgba(8,6,20,0.97)', border: '1px solid rgba(255,165,40,0.22)',
            borderRadius: 16, padding: '22px 24px', maxWidth: 340, width: '90%', maxHeight: '70vh',
            display: 'flex', flexDirection: 'column', gap: 14,
            boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 32px rgba(255,140,30,0.10)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,215,135,0.95)' }}>
                Move &ldquo;{moveToSpaceModal.topicName}&rdquo; to Space
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Select a destination space</span>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(70vh - 130px)' }}>
              {availableSpaces.length === 0
                ? <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '8px 0' }}>No other spaces available</p>
                : availableSpaces.map(group => (
                    <div key={group.groupName}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                        {group.groupName}
                      </div>
                      {group.spaces.map(space => (
                        <button key={space.path}
                          onClick={async () => {
                            const modal = moveToSpaceModal
                            setMoveToSpaceModal(null)
                            await onMoveTopic(modal.topicFolder, space.path)
                          }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                            borderRadius: 8, fontSize: 12, cursor: 'pointer',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                            color: 'rgba(255,255,255,0.72)', marginBottom: 4, transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,140,30,0.14)'; e.currentTarget.style.borderColor = 'rgba(255,140,30,0.30)'; e.currentTarget.style.color = 'rgba(255,200,80,0.95)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)' }}
                        >{space.name}</button>
                      ))}
                    </div>
                  ))
              }
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setMoveToSpaceModal(null)}
                style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.42)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.42)'; e.currentTarget.style.background = 'transparent' }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* In-app confirm modal — replaces native OS dialog */}
      {confirmModal && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 100, background: 'rgba(0,0,12,0.72)', backdropFilter: 'blur(6px)' }}
        >
          <div
            style={{
              background: 'rgba(8,6,20,0.95)', border: '1px solid rgba(255,165,40,0.22)',
              borderRadius: 14, padding: '22px 26px', maxWidth: 340, width: '90%',
              display: 'flex', flexDirection: 'column', gap: 16,
              boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 32px rgba(255,140,30,0.10)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,215,135,0.95)' }}>
                {confirmModal.title}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                {confirmModal.message}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => { setConfirmModal(null); confirmResolveRef.current?.(false) }}
                style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.42)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.42)'; e.currentTarget.style.background = 'transparent' }}
              >Cancel</button>
              <button
                onClick={() => { setConfirmModal(null); confirmResolveRef.current?.(true) }}
                style={{ padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: 'linear-gradient(135deg,rgba(255,155,35,0.92),rgba(215,85,0,0.92))',
                  color: '#fff', border: '1px solid rgba(255,165,40,0.35)',
                  boxShadow: '0 2px 12px rgba(255,120,0,0.32)', transition: 'opacity 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.82'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
