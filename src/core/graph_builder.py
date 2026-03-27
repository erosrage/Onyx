"""Build a networkx graph from the vault link map and export it for rendering."""
from __future__ import annotations

import json
import math
import random

import networkx as nx


class GraphBuilder:
    """
    Converts a VaultParser link map into:
      - a networkx DiGraph (for analysis / future features)
      - a JSON payload consumed by the graph canvas renderer
    """

    def __init__(self, link_map: dict[str, list[str]]) -> None:
        self._link_map = link_map
        self._graph = self._build_nx_graph()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def graph(self) -> nx.DiGraph:
        return self._graph

    def to_render_json(self, active_node: str | None = None) -> str:
        """
        Return a JSON string with {nodes, edges} ready for the JS renderer.

        Each node carries:
          - id, label, degree, is_active, x, y (initial seeded positions)
        Each edge carries:
          - source, target
        """
        degree = dict(self._graph.degree())
        max_degree = max(degree.values(), default=1)

        angle_step = (2 * math.pi) / max(len(self._graph.nodes), 1)
        radius = 200

        nodes = []
        for i, node in enumerate(self._graph.nodes()):
            angle = i * angle_step
            nodes.append({
                "id": node,
                "label": node,
                "degree": degree.get(node, 0),
                "size": 8 + 10 * (degree.get(node, 0) / max(max_degree, 1)),
                "is_active": node == active_node,
                "x": radius * math.cos(angle) + random.uniform(-20, 20),
                "y": radius * math.sin(angle) + random.uniform(-20, 20),
            })

        edges = [
            {"source": u, "target": v}
            for u, v in self._graph.edges()
        ]

        return json.dumps({"nodes": nodes, "edges": edges})

    def neighbors_of(self, node: str) -> list[str]:
        """Return nodes directly linked from *node*."""
        return list(self._graph.successors(node))

    def backlinks_of(self, node: str) -> list[str]:
        """Return nodes that link *to* node."""
        return list(self._graph.predecessors(node))

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_nx_graph(self) -> nx.DiGraph:
        g = nx.DiGraph()
        for source, targets in self._link_map.items():
            g.add_node(source)
            for target in targets:
                g.add_edge(source, target)
        return g
