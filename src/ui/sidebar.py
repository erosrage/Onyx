"""Left-hand collapsible sidebar: QTreeView backed by QFileSystemModel."""
import os
from pathlib import Path

from PyQt6.QtCore import Qt, QDir, pyqtSignal, QSortFilterProxyModel
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QTreeView, QLabel, QSizePolicy
)
from PyQt6.QtGui import QFileSystemModel


class VaultSidebar(QWidget):
    """
    Shows the vault directory tree filtered to .md files and folders.
    Emits file_selected(path) when the user clicks a note.
    """

    file_selected = pyqtSignal(str)

    def __init__(self, vault_path: str, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._vault_path = vault_path
        self._build_ui()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_vault(self, vault_path: str) -> None:
        """Switch the tree to a different vault root."""
        self._vault_path = vault_path
        root_index = self._fs_model.setRootPath(vault_path)
        proxy_root = self._proxy.mapFromSource(root_index)
        self._tree.setRootIndex(proxy_root)
        self._vault_label.setText(self._vault_name())

    def refresh(self) -> None:
        """Force the model to re-scan (called after external file changes)."""
        # QFileSystemModel updates automatically via OS notifications;
        # explicit refresh is achieved by toggling the root path.
        self._fs_model.setRootPath("")
        root_index = self._fs_model.setRootPath(self._vault_path)
        proxy_root = self._proxy.mapFromSource(root_index)
        self._tree.setRootIndex(proxy_root)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self._vault_label = QLabel(self._vault_name())
        self._vault_label.setStyleSheet(
            "padding: 6px 8px; font-weight: bold; background: #2b2b2b; color: #ddd;"
        )
        layout.addWidget(self._vault_label)

        # File system model — shows real filesystem
        self._fs_model = QFileSystemModel()
        self._fs_model.setRootPath(self._vault_path)
        self._fs_model.setFilter(QDir.Filter.AllDirs | QDir.Filter.Files | QDir.Filter.NoDotAndDotDot)
        self._fs_model.setNameFilters(["*.md"])
        self._fs_model.setNameFilterDisables(False)  # hide non-.md files entirely

        # Proxy for sorting
        self._proxy = _SortProxy()
        self._proxy.setSourceModel(self._fs_model)
        self._proxy.setDynamicSortFilter(True)
        self._proxy.sort(0, Qt.SortOrder.AscendingOrder)

        self._tree = QTreeView()
        self._tree.setModel(self._proxy)
        self._tree.setSortingEnabled(False)

        # Hide Name/Size/Type/Date columns except Name
        for col in range(1, self._fs_model.columnCount()):
            self._tree.hideColumn(col)

        self._tree.setHeaderHidden(True)
        self._tree.setAnimated(True)
        self._tree.setIndentation(16)
        self._tree.setUniformRowHeights(True)

        # Set root
        root_index = self._fs_model.index(self._vault_path)
        proxy_root = self._proxy.mapFromSource(root_index)
        self._tree.setRootIndex(proxy_root)

        self._tree.clicked.connect(self._on_item_clicked)

        layout.addWidget(self._tree)
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)

    def _on_item_clicked(self, proxy_index) -> None:
        source_index = self._proxy.mapToSource(proxy_index)
        path = self._fs_model.filePath(source_index)
        if os.path.isfile(path) and path.endswith(".md"):
            self.file_selected.emit(path)

    def _vault_name(self) -> str:
        return Path(self._vault_path).name or self._vault_path


class _SortProxy(QSortFilterProxyModel):
    """Sorts directories before files, then alphabetically."""

    def lessThan(self, left, right) -> bool:
        fs_model: QFileSystemModel = self.sourceModel()
        left_is_dir = fs_model.isDir(left)
        right_is_dir = fs_model.isDir(right)
        if left_is_dir != right_is_dir:
            return left_is_dir  # dirs first
        return fs_model.fileName(left).lower() < fs_model.fileName(right).lower()
