"""Main application window — orchestrates sidebar, editor, preview, and graph."""
from __future__ import annotations

import os
from pathlib import Path

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QSplitter, QStatusBar, QToolBar, QStackedWidget
)
from PyQt6.QtGui import QAction
from PyQt6.QtCore import Qt, QSize

from vault.vault_manager import VaultManager
from vault.file_watcher import VaultFileWatcher
from ui.sidebar import VaultSidebar
from ui.editor_pane import EditorPane
from ui.preview_pane import PreviewPane
from ui.graph_view import GraphView


class MainWindow(QMainWindow):
    """Top-level window: sidebar | [editor+preview  /  graph]."""

    _VIEW_EDITOR = 0
    _VIEW_GRAPH  = 1

    def __init__(self, vault_path: str, vault_manager: VaultManager) -> None:
        super().__init__()
        self._vault_path = vault_path
        self._vault_manager = vault_manager

        self.setWindowTitle(f"ObsidianClone — {Path(vault_path).name}")
        self._restore_geometry()
        self._build_ui()
        self._start_file_watcher()

    # ------------------------------------------------------------------
    # UI construction
    # ------------------------------------------------------------------

    def _build_ui(self) -> None:
        central = QWidget()
        self.setCentralWidget(central)
        root_layout = QVBoxLayout(central)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        # --- Toolbar ---
        self._toolbar = QToolBar("Main Toolbar")
        self._toolbar.setMovable(False)
        self._toolbar.setStyleSheet(
            "QToolBar { background: #252526; border-bottom: 1px solid #333; spacing: 4px; }"
            "QToolButton { color: #ccc; padding: 4px 10px; border-radius: 3px; }"
            "QToolButton:checked { background: #37373d; color: #fff; }"
            "QToolButton:hover { background: #2a2d2e; }"
        )

        self._act_editor = QAction("Editor", self)
        self._act_editor.setCheckable(True)
        self._act_editor.setChecked(True)
        self._act_editor.triggered.connect(lambda: self._switch_view(self._VIEW_EDITOR))
        self._toolbar.addAction(self._act_editor)

        self._act_graph = QAction("Graph", self)
        self._act_graph.setCheckable(True)
        self._act_graph.triggered.connect(lambda: self._switch_view(self._VIEW_GRAPH))
        self._toolbar.addAction(self._act_graph)

        root_layout.addWidget(self._toolbar)

        # --- Horizontal body: sidebar | content stack ---
        body = QWidget()
        body_layout = QHBoxLayout(body)
        body_layout.setContentsMargins(0, 0, 0, 0)
        body_layout.setSpacing(0)

        self._outer_splitter = QSplitter(Qt.Orientation.Horizontal)

        # Sidebar
        self._sidebar = VaultSidebar(self._vault_path)
        self._sidebar.setMinimumWidth(160)
        self._sidebar.setMaximumWidth(480)
        self._sidebar.file_selected.connect(self._on_file_selected)
        self._outer_splitter.addWidget(self._sidebar)

        # Stacked widget: page 0 = editor/preview, page 1 = graph
        self._stack = QStackedWidget()

        # Page 0 — editor | preview
        self._inner_splitter = QSplitter(Qt.Orientation.Horizontal)
        self._editor = EditorPane()
        self._editor.content_changed.connect(self._on_content_changed)
        self._editor.file_saved.connect(self._on_file_saved)
        self._inner_splitter.addWidget(self._editor)

        self._preview = PreviewPane()
        self._preview.wikilink_clicked.connect(self._on_wikilink_clicked)
        self._inner_splitter.addWidget(self._preview)
        self._inner_splitter.setSizes([500, 500])
        self._stack.addWidget(self._inner_splitter)   # index 0

        # Page 1 — graph
        self._graph_view = GraphView(self._vault_path)
        self._graph_view.node_clicked.connect(self._on_graph_node_clicked)
        self._stack.addWidget(self._graph_view)        # index 1

        self._outer_splitter.addWidget(self._stack)

        sidebar_width = self._vault_manager.get_setting("sidebar_width", 240)
        self._outer_splitter.setSizes([sidebar_width, self.width() - sidebar_width])
        self._outer_splitter.splitterMoved.connect(self._on_splitter_moved)

        body_layout.addWidget(self._outer_splitter)
        root_layout.addWidget(body)

        # Status bar
        self._status_bar = QStatusBar()
        self.setStatusBar(self._status_bar)
        self._status_bar.showMessage(f"Vault: {self._vault_path}")

    # ------------------------------------------------------------------
    # File watcher
    # ------------------------------------------------------------------

    def _start_file_watcher(self) -> None:
        self._file_watcher = VaultFileWatcher(self._vault_path, parent=self)
        self._file_watcher.vault_changed.connect(self._on_vault_changed)

    # ------------------------------------------------------------------
    # View switching
    # ------------------------------------------------------------------

    def _switch_view(self, index: int) -> None:
        self._stack.setCurrentIndex(index)
        self._act_editor.setChecked(index == self._VIEW_EDITOR)
        self._act_graph.setChecked(index == self._VIEW_GRAPH)
        if index == self._VIEW_GRAPH:
            # Refresh graph with the currently open note highlighted
            active = None
            if self._editor.current_file():
                active = Path(self._editor.current_file()).stem
            self._graph_view.refresh(active_node=active)

    # ------------------------------------------------------------------
    # Slots
    # ------------------------------------------------------------------

    def _on_file_selected(self, path: str) -> None:
        # Switch to editor view when a note is picked in the sidebar
        self._switch_view(self._VIEW_EDITOR)
        self._editor.open_file(path)
        self.setWindowTitle(f"ObsidianClone — {Path(path).stem}")
        self._status_bar.showMessage(path)

    def _on_content_changed(self, text: str) -> None:
        self._preview.update_content(text, self._vault_path)

    def _on_file_saved(self, path: str) -> None:
        self._status_bar.showMessage(f"Saved: {path}", 3000)

    def _on_wikilink_clicked(self, target: str) -> None:
        note_path = os.path.join(self._vault_path, f"{target}.md")
        if not os.path.exists(note_path):
            try:
                with open(note_path, "w", encoding="utf-8") as f:
                    f.write(f"# {target}\n")
            except OSError as exc:
                self._status_bar.showMessage(f"Could not create note: {exc}", 4000)
                return
        self._editor.open_file(note_path)
        self.setWindowTitle(f"ObsidianClone — {target}")
        self._status_bar.showMessage(note_path)
        self._sidebar.refresh()

    def _on_graph_node_clicked(self, stem: str) -> None:
        """Node clicked in graph view — open that note and switch to editor."""
        stem_map = {}
        from core.wikilink_parser import VaultParser
        stem_map = VaultParser(self._vault_path).file_stem_to_path()
        if stem in stem_map:
            self._on_file_selected(stem_map[stem])
        else:
            # Ghost node — create it
            self._on_wikilink_clicked(stem)

    def _on_vault_changed(self) -> None:
        self._sidebar.refresh()

    def _on_splitter_moved(self, pos: int, index: int) -> None:
        sidebar_width = self._outer_splitter.sizes()[0]
        self._vault_manager.save_setting("sidebar_width", sidebar_width)

    # ------------------------------------------------------------------
    # Geometry persistence
    # ------------------------------------------------------------------

    def _restore_geometry(self) -> None:
        w = self._vault_manager.get_setting("window_width", 1200)
        h = self._vault_manager.get_setting("window_height", 800)
        self.resize(QSize(w, h))

    def closeEvent(self, event) -> None:
        self._editor.save_now()
        size = self.size()
        self._vault_manager.save_setting("window_width", size.width())
        self._vault_manager.save_setting("window_height", size.height())
        super().closeEvent(event)
