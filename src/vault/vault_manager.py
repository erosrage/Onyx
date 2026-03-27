"""Vault selection, creation, and persistence of the last-used vault path."""
import json
import os
from pathlib import Path

from PyQt6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QLabel, QFileDialog


SETTINGS_PATH = Path(__file__).parent.parent.parent / "config" / "settings.json"


class VaultManager:
    """Manages vault path resolution and settings persistence."""

    def __init__(self) -> None:
        self._settings = self._load_settings()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def prompt_vault_selection(self) -> str | None:
        """Show the vault-picker dialog and return the chosen path, or None to quit."""
        last = self._settings.get("last_vault_path")
        dialog = _VaultPickerDialog(last)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            path = dialog.selected_path
            self._persist_vault(path)
            return path
        return None

    def get_last_vault(self) -> str | None:
        return self._settings.get("last_vault_path")

    def get_setting(self, key: str, default=None):
        return self._settings.get(key, default)

    def save_setting(self, key: str, value) -> None:
        self._settings[key] = value
        self._write_settings()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _persist_vault(self, path: str) -> None:
        self._settings["last_vault_path"] = path
        self._write_settings()

    def _load_settings(self) -> dict:
        if SETTINGS_PATH.exists():
            try:
                with SETTINGS_PATH.open("r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def _write_settings(self) -> None:
        SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with SETTINGS_PATH.open("w", encoding="utf-8") as f:
            json.dump(self._settings, f, indent=2)


# ---------------------------------------------------------------------------
# Vault Picker Dialog
# ---------------------------------------------------------------------------

class _VaultPickerDialog(QDialog):
    """Modal dialog shown on launch to open or create a vault."""

    def __init__(self, last_path: str | None = None) -> None:
        super().__init__()
        self.selected_path: str = ""
        self.setWindowTitle("ObsidianClone — Select Vault")
        self.setMinimumWidth(420)
        self._build_ui(last_path)

    def _build_ui(self, last_path: str | None) -> None:
        layout = QVBoxLayout(self)
        layout.setSpacing(12)

        title = QLabel("<h2>Welcome to ObsidianClone</h2>")
        title.setStyleSheet("margin-bottom: 4px;")
        layout.addWidget(title)

        subtitle = QLabel("A local-first Markdown knowledge base.\nChoose a vault to get started.")
        layout.addWidget(subtitle)

        if last_path and os.path.isdir(last_path):
            recent_label = QLabel(f"<b>Recent:</b> {last_path}")
            recent_label.setWordWrap(True)
            layout.addWidget(recent_label)

            btn_recent = QPushButton(f"Open Recent Vault")
            btn_recent.setToolTip(last_path)
            btn_recent.clicked.connect(lambda: self._accept_path(last_path))
            layout.addWidget(btn_recent)

        btn_row = QHBoxLayout()

        btn_open = QPushButton("Open Existing Folder…")
        btn_open.clicked.connect(self._browse_existing)
        btn_row.addWidget(btn_open)

        btn_new = QPushButton("Create New Vault…")
        btn_new.clicked.connect(self._create_new)
        btn_row.addWidget(btn_new)

        layout.addLayout(btn_row)

        btn_quit = QPushButton("Quit")
        btn_quit.clicked.connect(self.reject)
        layout.addWidget(btn_quit)

    def _browse_existing(self) -> None:
        path = QFileDialog.getExistingDirectory(self, "Open Vault Folder")
        if path:
            self._accept_path(path)

    def _create_new(self) -> None:
        path = QFileDialog.getExistingDirectory(self, "Select Parent Folder for New Vault")
        if path:
            # Ask for vault name via simple input
            from PyQt6.QtWidgets import QInputDialog
            name, ok = QInputDialog.getText(self, "New Vault", "Vault name:")
            if ok and name.strip():
                vault_path = os.path.join(path, name.strip())
                os.makedirs(vault_path, exist_ok=True)
                self._accept_path(vault_path)

    def _accept_path(self, path: str) -> None:
        self.selected_path = path
        self.accept()
