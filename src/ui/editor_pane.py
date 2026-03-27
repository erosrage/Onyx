"""Raw Markdown editor pane with syntax highlighting and auto-save."""
from __future__ import annotations

import os

from PyQt6.QtCore import Qt, pyqtSignal, QObject
from PyQt6.QtGui import (
    QFont, QTextCharFormat, QColor, QSyntaxHighlighter, QTextDocument
)
from PyQt6.QtWidgets import QPlainTextEdit, QWidget

from utils.debounce import Debouncer


class EditorPane(QPlainTextEdit):
    """
    Plain-text Markdown editor.

    Signals
    -------
    content_changed(text)   — emitted (debounced) as the user types; used by
                              the preview pane to re-render.
    file_saved(path)        — emitted after auto-save writes to disk.
    """

    content_changed = pyqtSignal(str)
    file_saved = pyqtSignal(str)

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._current_file: str | None = None
        self._loading = False  # suppress signals while loading

        self._configure_appearance()
        self._highlighter = _MarkdownHighlighter(self.document())

        # Auto-save debouncer: 1 second after last keystroke
        self._save_debouncer = Debouncer(
            delay_ms=1000,
            callback=self._auto_save,
            parent=self,
        )
        # Preview debouncer: 200 ms (faster, no disk I/O)
        self._preview_debouncer = Debouncer(
            delay_ms=200,
            callback=self._emit_content,
            parent=self,
        )

        self.textChanged.connect(self._on_text_changed)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def open_file(self, path: str) -> None:
        """Load a file into the editor, replacing current content."""
        self._current_file = path
        self._loading = True
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    text = f.read()
            else:
                text = ""
            self.setPlainText(text)
        finally:
            self._loading = False
        # Immediately trigger a preview render without starting auto-save
        self.content_changed.emit(self.toPlainText())

    def save_now(self) -> None:
        """Flush the debouncer and save immediately."""
        self._save_debouncer.flush()

    def current_file(self) -> str | None:
        return self._current_file

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _configure_appearance(self) -> None:
        font = QFont("Fira Code", 13)
        font.setStyleHint(QFont.StyleHint.Monospace)
        self.setFont(font)
        self.setStyleSheet("""
            QPlainTextEdit {
                background-color: #1e1e1e;
                color: #d4d4d4;
                border: none;
                padding: 16px;
                selection-background-color: #264f78;
            }
        """)
        self.setLineWrapMode(QPlainTextEdit.LineWrapMode.WidgetWidth)

    def _on_text_changed(self) -> None:
        if self._loading:
            return
        self._preview_debouncer.call()
        if self._current_file:
            self._save_debouncer.call()

    def _emit_content(self) -> None:
        self.content_changed.emit(self.toPlainText())

    def _auto_save(self) -> None:
        if not self._current_file:
            return
        try:
            os.makedirs(os.path.dirname(self._current_file), exist_ok=True)
            with open(self._current_file, "w", encoding="utf-8") as f:
                f.write(self.toPlainText())
            self.file_saved.emit(self._current_file)
        except OSError as exc:
            # Silently log; don't crash the editor
            print(f"[EditorPane] auto-save failed: {exc}")


# ---------------------------------------------------------------------------
# Minimal Markdown syntax highlighter
# ---------------------------------------------------------------------------

class _MarkdownHighlighter(QSyntaxHighlighter):
    """Highlights headings, bold, italic, code, and wikilinks."""

    def __init__(self, document: QTextDocument) -> None:
        super().__init__(document)
        self._rules: list[tuple] = []
        self._build_rules()

    def _fmt(self, color: str, bold: bool = False, italic: bool = False) -> QTextCharFormat:
        fmt = QTextCharFormat()
        fmt.setForeground(QColor(color))
        if bold:
            fmt.setFontWeight(700)
        if italic:
            fmt.setFontItalic(True)
        return fmt

    def _build_rules(self) -> None:
        import re
        add = self._rules.append
        # Headings
        add((re.compile(r"^#{1,6} .+"), self._fmt("#569cd6", bold=True)))
        # Bold **text** or __text__
        add((re.compile(r"\*\*.+?\*\*|__.+?__"), self._fmt("#dcdcaa", bold=True)))
        # Italic *text* or _text_
        add((re.compile(r"\*.+?\*|(?<!\w)_.+?_(?!\w)"), self._fmt("#9cdcfe", italic=True)))
        # Inline code
        add((re.compile(r"`[^`]+`"), self._fmt("#ce9178")))
        # Wikilinks [[...]]
        add((re.compile(r"\[\[[^\]]+\]\]"), self._fmt("#7ab8f5")))
        # Links [text](url)
        add((re.compile(r"\[.+?\]\(.+?\)"), self._fmt("#7ab8f5")))
        # Blockquote lines
        add((re.compile(r"^>.*"), self._fmt("#808080", italic=True)))
        # Horizontal rule
        add((re.compile(r"^---+$|^\*\*\*+$"), self._fmt("#555555")))

    def highlightBlock(self, text: str) -> None:
        for pattern, fmt in self._rules:
            for m in pattern.finditer(text):
                self.setFormat(m.start(), m.end() - m.start(), fmt)
