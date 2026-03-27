"""Interactive knowledge graph rendered in an embedded HTML canvas."""
from __future__ import annotations

from PyQt6.QtCore import QUrl, pyqtSignal
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEnginePage, QWebEngineScript
from PyQt6.QtWidgets import QWidget

from core.wikilink_parser import VaultParser
from core.graph_builder import GraphBuilder


class GraphView(QWebEngineView):
    """
    Full-vault knowledge graph.

    Renders a force-directed node graph using a self-contained HTML/JS
    canvas (no CDN — works fully offline).  Node clicks emit
    ``node_clicked(stem_name)`` so the main window can open that note.
    """

    node_clicked = pyqtSignal(str)

    def __init__(self, vault_path: str, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._vault_path = vault_path
        self._active_node: str | None = None

        page = _InterceptPage(self)
        page.node_clicked.connect(self.node_clicked)
        self.setPage(page)

        self.refresh()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def refresh(self, active_node: str | None = None) -> None:
        """Re-parse the vault and redraw the graph."""
        self._active_node = active_node
        parser = VaultParser(self._vault_path)
        link_map = parser.parse()
        builder = GraphBuilder(link_map)
        graph_json = builder.to_render_json(active_node=active_node)
        html = _build_graph_html(graph_json)
        self.setHtml(html, QUrl("about:blank"))

    def set_vault(self, vault_path: str) -> None:
        self._vault_path = vault_path
        self.refresh()


# ---------------------------------------------------------------------------
# Page that intercepts node:// navigation
# ---------------------------------------------------------------------------

class _InterceptPage(QWebEnginePage):
    node_clicked = pyqtSignal(str)

    def acceptNavigationRequest(self, url: QUrl, nav_type, is_main_frame: bool) -> bool:
        if url.scheme() == "node":
            name = url.host().replace("%20", " ")
            self.node_clicked.emit(name)
            return False
        return super().acceptNavigationRequest(url, nav_type, is_main_frame)


# ---------------------------------------------------------------------------
# Self-contained HTML + JS force simulation (no CDN required)
# ---------------------------------------------------------------------------

def _build_graph_html(graph_json: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ background: #1a1a2e; overflow: hidden; }}
  canvas {{ display: block; }}
  #tooltip {{
    position: absolute;
    background: rgba(0,0,0,0.75);
    color: #eee;
    padding: 4px 8px;
    border-radius: 4px;
    font: 12px sans-serif;
    pointer-events: none;
    display: none;
  }}
  #info {{
    position: absolute;
    top: 8px; left: 8px;
    color: #666;
    font: 11px sans-serif;
  }}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="tooltip"></div>
<div id="info">Scroll to zoom · Drag to pan · Click node to open</div>
<script>
// ── Data ──────────────────────────────────────────────────────────────────
const DATA = {graph_json};

// ── Canvas setup ─────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() {{
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}}
window.addEventListener('resize', () => {{ resize(); draw(); }});
resize();

// ── Simulation state ──────────────────────────────────────────────────────
const nodes = DATA.nodes.map(n => ({{
  ...n,
  x: W/2 + n.x,
  y: H/2 + n.y,
  vx: 0, vy: 0,
}}));
const edges = DATA.edges;

// Build adjacency for O(1) lookup
const nodeById = {{}};
nodes.forEach(n => nodeById[n.id] = n);

// ── Force parameters ──────────────────────────────────────────────────────
const REPULSION   = 4000;
const SPRING_LEN  = 120;
const SPRING_K    = 0.04;
const DAMPING     = 0.82;
const CENTER_K    = 0.018;
const ITERATIONS  = 1;

function simulate() {{
  for (let iter = 0; iter < ITERATIONS; iter++) {{
    // Repulsion (naive O(n²) — fine for <500 nodes)
    for (let i = 0; i < nodes.length; i++) {{
      for (let j = i + 1; j < nodes.length; j++) {{
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }}
    }}

    // Spring attraction along edges
    edges.forEach(e => {{
      const a = nodeById[e.source], b = nodeById[e.target];
      if (!a || !b) return;
      let dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const stretch = dist - SPRING_LEN;
      const fx = (dx / dist) * stretch * SPRING_K;
      const fy = (dy / dist) * stretch * SPRING_K;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }});

    // Centering force
    nodes.forEach(n => {{
      n.vx += (W/2 - n.x) * CENTER_K;
      n.vy += (H/2 - n.y) * CENTER_K;
    }});

    // Integrate + damp
    nodes.forEach(n => {{
      if (n.pinned) return;
      n.vx *= DAMPING; n.vy *= DAMPING;
      n.x += n.vx;    n.y += n.vy;
    }});
  }}
}}

// ── Viewport transform ────────────────────────────────────────────────────
let scale = 1, panX = 0, panY = 0;
function toScreen(x, y) {{
  return [x * scale + panX, y * scale + panY];
}}
function toWorld(sx, sy) {{
  return [(sx - panX) / scale, (sy - panY) / scale];
}}

// ── Colour helpers ────────────────────────────────────────────────────────
function nodeColor(n) {{
  if (n.is_active) return '#f5a623';
  return n.degree === 0 ? '#555' : `hsl(${{200 + n.degree * 12}}, 60%, 55%)`;
}}

// ── Draw ──────────────────────────────────────────────────────────────────
function draw() {{
  ctx.clearRect(0, 0, W, H);

  // Edges
  ctx.lineWidth = 1;
  edges.forEach(e => {{
    const a = nodeById[e.source], b = nodeById[e.target];
    if (!a || !b) return;
    const [ax, ay] = toScreen(a.x, a.y);
    const [bx, by] = toScreen(b.x, b.y);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = 'rgba(100,150,255,0.25)';
    ctx.stroke();

    // Arrow head
    const angle = Math.atan2(by - ay, bx - ax);
    const r = (b.size || 10) * scale;
    const tx = bx - r * Math.cos(angle);
    const ty = by - r * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - 7*Math.cos(angle-0.4), ty - 7*Math.sin(angle-0.4));
    ctx.lineTo(tx - 7*Math.cos(angle+0.4), ty - 7*Math.sin(angle+0.4));
    ctx.closePath();
    ctx.fillStyle = 'rgba(100,150,255,0.4)';
    ctx.fill();
  }});

  // Nodes
  nodes.forEach(n => {{
    const [sx, sy] = toScreen(n.x, n.y);
    const r = (n.size || 10) * scale;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = nodeColor(n);
    ctx.fill();
    if (n.is_active) {{
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }}

    // Label
    if (scale > 0.5) {{
      ctx.font = `${{Math.max(10, 11 * scale)}}px sans-serif`;
      ctx.fillStyle = '#ccc';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, sx, sy + r + 13 * scale);
    }}
  }});
}}

// ── Animation loop ────────────────────────────────────────────────────────
let frame = 0;
function loop() {{
  simulate();
  draw();
  frame++;
  // Slow down after convergence but keep running for interaction
  if (frame < 300 || dragging) {{
    requestAnimationFrame(loop);
  }} else {{
    draw(); // final static frame
    setTimeout(() => {{ frame = 0; requestAnimationFrame(loop); }}, 2000);
  }}
}}
requestAnimationFrame(loop);

// ── Interaction ───────────────────────────────────────────────────────────
let dragging = null, dragOffX = 0, dragOffY = 0;
let panning = false, panStartX = 0, panStartY = 0, panOriginX = 0, panOriginY = 0;
const tooltip = document.getElementById('tooltip');

function hitTest(sx, sy) {{
  for (const n of nodes) {{
    const [nx, ny] = toScreen(n.x, n.y);
    const r = (n.size || 10) * scale + 4;
    if ((sx-nx)**2 + (sy-ny)**2 < r*r) return n;
  }}
  return null;
}}

canvas.addEventListener('mousedown', e => {{
  const hit = hitTest(e.clientX, e.clientY);
  if (hit) {{
    dragging = hit;
    hit.pinned = true;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    dragOffX = hit.x - wx;
    dragOffY = hit.y - wy;
  }} else {{
    panning = true;
    panStartX = e.clientX; panStartY = e.clientY;
    panOriginX = panX;     panOriginY = panY;
  }}
}});

canvas.addEventListener('mousemove', e => {{
  if (dragging) {{
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    dragging.x = wx + dragOffX;
    dragging.y = wy + dragOffY;
    dragging.vx = 0; dragging.vy = 0;
    frame = 0; // restart simulation
    draw();
  }} else if (panning) {{
    panX = panOriginX + (e.clientX - panStartX);
    panY = panOriginY + (e.clientY - panStartY);
    draw();
  }}
  // Tooltip
  const hit = hitTest(e.clientX, e.clientY);
  if (hit) {{
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top  = (e.clientY - 8) + 'px';
    tooltip.textContent = hit.label + ' (' + hit.degree + ' links)';
    canvas.style.cursor = 'pointer';
  }} else {{
    tooltip.style.display = 'none';
    canvas.style.cursor = panning ? 'grabbing' : 'default';
  }}
}});

canvas.addEventListener('mouseup', e => {{
  if (dragging) {{ dragging.pinned = false; dragging = null; }}
  panning = false;
}});

canvas.addEventListener('click', e => {{
  const hit = hitTest(e.clientX, e.clientY);
  if (hit) {{
    window.location.href = 'node://' + encodeURIComponent(hit.id);
  }}
}});

canvas.addEventListener('wheel', e => {{
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.91;
  const mx = e.clientX, my = e.clientY;
  panX = mx - (mx - panX) * factor;
  panY = my - (my - panY) * factor;
  scale *= factor;
  scale = Math.min(Math.max(scale, 0.1), 5);
  draw();
}}, {{ passive: false }});
</script>
</body>
</html>"""
