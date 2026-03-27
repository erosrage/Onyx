"""Tests for the Debouncer utility (non-GUI, timer mocked)."""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


def test_debouncer_fires_after_delay(qtbot):
    """Callback fires once after the timer interval elapses."""
    from utils.debounce import Debouncer
    fired = []
    d = Debouncer(delay_ms=100, callback=lambda: fired.append(1))
    d.call()
    qtbot.waitSignal(d._timer.timeout, timeout=500)
    assert fired == [1]


def test_debouncer_resets_on_repeated_calls(qtbot):
    """Multiple rapid calls should result in only one callback invocation."""
    from utils.debounce import Debouncer
    fired = []
    d = Debouncer(delay_ms=150, callback=lambda: fired.append(1))
    d.call()
    d.call()
    d.call()
    qtbot.waitSignal(d._timer.timeout, timeout=500)
    assert len(fired) == 1


def test_debouncer_flush_fires_immediately(qtbot):
    """flush() fires the callback right away without waiting."""
    from utils.debounce import Debouncer
    fired = []
    d = Debouncer(delay_ms=5000, callback=lambda: fired.append(1))
    d.call()
    d.flush()
    assert fired == [1]
    assert not d._timer.isActive()


def test_debouncer_cancel_prevents_fire(qtbot):
    """cancel() stops a pending callback from firing."""
    from utils.debounce import Debouncer
    fired = []
    d = Debouncer(delay_ms=100, callback=lambda: fired.append(1))
    d.call()
    d.cancel()
    # Wait longer than the delay; callback must NOT have fired
    import time; time.sleep(0.25)
    assert fired == []
