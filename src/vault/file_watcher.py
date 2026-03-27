"""QFileSystemWatcher wrapper that monitors the vault for external file changes."""
import os
from pathlib import Path

from PyQt6.QtCore import QFileSystemWatcher, QObject, pyqtSignal


class VaultFileWatcher(QObject):
    """
    Watches the vault directory tree and emits vault_changed whenever
    files are added, removed, or modified outside of the application.
    """

    vault_changed = pyqtSignal()

    def __init__(self, vault_path: str, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self._vault_path = vault_path
        self._watcher = QFileSystemWatcher(self)
        self._watcher.directoryChanged.connect(self._on_directory_changed)
        self._watcher.fileChanged.connect(self._on_file_changed)
        self._register_all()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update_vault(self, vault_path: str) -> None:
        """Switch to a new vault, removing old watches and adding new ones."""
        existing = self._watcher.directories() + self._watcher.files()
        if existing:
            self._watcher.removePaths(existing)
        self._vault_path = vault_path
        self._register_all()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _register_all(self) -> None:
        """Walk the vault tree and watch every directory and .md file."""
        paths_to_watch: list[str] = [self._vault_path]
        for root, dirs, files in os.walk(self._vault_path):
            # Skip hidden directories (e.g. .git)
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            paths_to_watch.append(root)
            for fname in files:
                if fname.endswith(".md"):
                    paths_to_watch.append(os.path.join(root, fname))
        self._watcher.addPaths(paths_to_watch)

    def _on_directory_changed(self, path: str) -> None:
        # Re-register in case new subdirectories were created
        self._register_all()
        self.vault_changed.emit()

    def _on_file_changed(self, path: str) -> None:
        # Re-add the file path in case it was replaced (some editors do this)
        if os.path.exists(path) and path not in self._watcher.files():
            self._watcher.addPath(path)
        self.vault_changed.emit()
