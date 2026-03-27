"""Tests for VaultParser and GraphBuilder."""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.wikilink_parser import VaultParser
from core.graph_builder import GraphBuilder


# ---------------------------------------------------------------------------
# VaultParser tests
# ---------------------------------------------------------------------------

class TestVaultParser:
    def _make_vault(self, tmp_path, files: dict[str, str]) -> str:
        vault = tmp_path / "vault"
        vault.mkdir()
        for name, content in files.items():
            p = vault / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
        return str(vault)

    def test_empty_vault(self, tmp_path):
        vault = self._make_vault(tmp_path, {})
        parser = VaultParser(vault)
        assert parser.parse() == {}

    def test_single_file_no_links(self, tmp_path):
        vault = self._make_vault(tmp_path, {"Note.md": "Hello world"})
        result = VaultParser(vault).parse()
        assert "Note" in result
        assert result["Note"] == []

    def test_extracts_links(self, tmp_path):
        vault = self._make_vault(tmp_path, {
            "A.md": "See [[B]] and [[C]]",
            "B.md": "Back to [[A]]",
            "C.md": "No links here",
        })
        result = VaultParser(vault).parse()
        assert set(result["A"]) == {"B", "C"}
        assert result["B"] == ["A"]
        assert result["C"] == []

    def test_ghost_nodes_added(self, tmp_path):
        """Links to non-existent files create ghost keys with empty lists."""
        vault = self._make_vault(tmp_path, {"A.md": "See [[Ghost]]"})
        result = VaultParser(vault).parse()
        assert "Ghost" in result
        assert result["Ghost"] == []

    def test_alias_links_use_target(self, tmp_path):
        vault = self._make_vault(tmp_path, {"A.md": "[[B|click here]]"})
        result = VaultParser(vault).parse()
        assert result["A"] == ["B"]

    def test_file_stem_to_path(self, tmp_path):
        vault = self._make_vault(tmp_path, {"Note.md": "", "sub/Other.md": ""})
        mapping = VaultParser(vault).file_stem_to_path()
        assert "Note" in mapping
        assert "Other" in mapping
        assert mapping["Note"].endswith("Note.md")


# ---------------------------------------------------------------------------
# GraphBuilder tests
# ---------------------------------------------------------------------------

class TestGraphBuilder:
    def test_nodes_created(self):
        builder = GraphBuilder({"A": ["B"], "B": [], "C": ["A"]})
        assert set(builder.graph.nodes()) == {"A", "B", "C"}

    def test_edges_created(self):
        builder = GraphBuilder({"A": ["B", "C"], "B": [], "C": []})
        assert builder.graph.has_edge("A", "B")
        assert builder.graph.has_edge("A", "C")
        assert not builder.graph.has_edge("B", "A")

    def test_neighbors_of(self):
        builder = GraphBuilder({"A": ["B", "C"], "B": [], "C": []})
        assert set(builder.neighbors_of("A")) == {"B", "C"}

    def test_backlinks_of(self):
        builder = GraphBuilder({"A": ["B"], "B": ["A"], "C": ["A"]})
        assert set(builder.backlinks_of("A")) == {"B", "C"}

    def test_to_render_json_structure(self):
        import json
        builder = GraphBuilder({"A": ["B"], "B": []})
        data = json.loads(builder.to_render_json())
        node_ids = {n["id"] for n in data["nodes"]}
        assert "A" in node_ids and "B" in node_ids
        assert any(e["source"] == "A" and e["target"] == "B" for e in data["edges"])

    def test_active_node_flagged(self):
        import json
        builder = GraphBuilder({"A": ["B"], "B": []})
        data = json.loads(builder.to_render_json(active_node="A"))
        active = [n for n in data["nodes"] if n["is_active"]]
        assert len(active) == 1
        assert active[0]["id"] == "A"

    def test_empty_graph(self):
        import json
        builder = GraphBuilder({})
        data = json.loads(builder.to_render_json())
        assert data["nodes"] == []
        assert data["edges"] == []
