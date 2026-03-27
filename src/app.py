"""QApplication bootstrap and initial vault selection."""
import sys
from PyQt6.QtWidgets import QApplication
from vault.vault_manager import VaultManager
from ui.main_window import MainWindow


class ObsidianApp(QApplication):
    def __init__(self, argv: list[str]) -> None:
        super().__init__(argv)
        self.setApplicationName("ObsidianClone")
        self.setApplicationVersion("1.0.0")

        self.vault_manager = VaultManager()
        vault_path = self.vault_manager.prompt_vault_selection()

        if vault_path is None:
            sys.exit(0)

        self.main_window = MainWindow(vault_path, self.vault_manager)
        self.main_window.show()
