"""Live HTML preview pane using QWebEngineView with wikilink interception."""
from __future__ import annotations

from PyQt6.QtCore import QUrl, pyqtSignal
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEnginePage
from PyQt6.QtWidgets import QWidget

from core.markdown_engine import render


class PreviewPane(QWebEngineView):
    """
    Renders Markdown HTML and intercepts wikilink:// navigation.

    Signals
    -------
    wikilink_clicked(target)  — emitted when the user clicks a [[Wikilink]].
    """

    wikilink_clicked = pyqtSignal(str)

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._page = _InterceptPage(self)
        self._page.wikilink_clicked.connect(self.wikilink_clicked)
        self.setPage(self._page)
        self._render_placeholder()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update_content(self, markdown_text: str, vault_path: str = "") -> None:
        """Re-render the preview from fresh Markdown source."""
        html = render(markdown_text, vault_path)
        # Use a base URL so relative resources resolve inside the vault
        base = QUrl.fromLocalFile(vault_path + "/") if vault_path else QUrl()
        self.setHtml(html, base)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _render_placeholder(self) -> None:
        placeholder = render("*Select a note to start editing.*")
        self.setHtml(placeholder)


# ---------------------------------------------------------------------------
# Custom page that intercepts wikilink:// navigation
# ---------------------------------------------------------------------------

class _InterceptPage(QWebEnginePage):
    wikilink_clicked = pyqtSignal(str)

    def acceptNavigationRequest(
        self, url: QUrl, nav_type, is_main_frame: bool
    ) -> bool:
        if url.scheme() == "wikilink":
            target = url.host().replace("%20", " ")
            # Also handle path component for multi-word titles
            path_part = url.path().lstrip("/").replace("%20", " ")
            full_target = (target + (" " + path_part if path_part else "")).strip()
            self.wikilink_clicked.emit(full_target)
            return False  # block navigation; we handle it ourselves
        return super().acceptNavigationRequest(url, nav_type, is_main_frame)
