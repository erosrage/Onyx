"""Debounce utility: fires a callback only after the user stops typing."""
from __future__ import annotations

from PyQt6.QtCore import QObject, QTimer


class Debouncer(QObject):
    """
    Wraps a QTimer so that calling `call()` resets the countdown each time.
    The underlying callback fires only when `delay_ms` milliseconds pass
    without another `call()`.

    Usage::

        saver = Debouncer(delay_ms=1000, callback=self._save_file)
        editor.textChanged.connect(saver.call)
    """

    def __init__(
        self,
        delay_ms: int,
        callback,
        parent: QObject | None = None,
    ) -> None:
        super().__init__(parent)
        self._callback = callback
        self._timer = QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.setInterval(delay_ms)
        self._timer.timeout.connect(self._fire)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def call(self, *args, **kwargs) -> None:
        """Reset the timer countdown."""
        self._pending_args = args
        self._pending_kwargs = kwargs
        self._timer.start()

    def flush(self) -> None:
        """Immediately fire the callback if a call is pending, then cancel timer."""
        if self._timer.isActive():
            self._timer.stop()
            self._fire()

    def cancel(self) -> None:
        """Cancel any pending callback without firing."""
        self._timer.stop()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _fire(self) -> None:
        args = getattr(self, "_pending_args", ())
        kwargs = getattr(self, "_pending_kwargs", {})
        self._callback(*args, **kwargs)
