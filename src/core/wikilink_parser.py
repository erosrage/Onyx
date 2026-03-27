"""Vault-wide wikilink scanner: walks every .md file and extracts [[links]]."""
from __future__ import annotations

import os
import re
from pathlib import Path

_WIKILINK_RE = re.compile(r"\[\[([^\]\|]+)(?:\|[^\]]+)?\]\]")


class VaultParser:
    """
    Scans every .md file in the vault and builds a link map.

    Result shape::

        {
            "Note A": ["Note B", "Note C"],   # Note A links to B and C
            "Note B": [],
            ...
        }

    Keys are *stem* names (no path, no extension).
    Values are lists of raw wikilink targets (also stems).
    """

    def __init__(self, vault_path: str) -> None:
        self._vault_path = vault_path

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def parse(self) -> dict[str, list[str]]:
        """Walk the vault and return the full link map."""
        link_map: dict[str, list[str]] = {}

        for md_path in self._iter_md_files():
            stem = Path(md_path).stem
            links = self._extract_links(md_path)
            link_map[stem] = links

        # Ensure every link *target* also appears as a key (even if file
        # doesn't exist yet — ghost nodes)
        all_targets: set[str] = set()
        for targets in link_map.values():
            all_targets.update(targets)
        for target in all_targets:
            if target not in link_map:
                link_map[target] = []

        return link_map

    def file_stem_to_path(self) -> dict[str, str]:
        """Return a mapping of {stem: absolute_path} for all .md files."""
        return {Path(p).stem: p for p in self._iter_md_files()}

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _iter_md_files(self):
        for root, dirs, files in os.walk(self._vault_path):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for fname in files:
                if fname.endswith(".md"):
                    yield os.path.join(root, fname)

    def _extract_links(self, path: str) -> list[str]:
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                text = f.read()
        except OSError:
            return []
        return [m.group(1).strip() for m in _WIKILINK_RE.finditer(text)]
