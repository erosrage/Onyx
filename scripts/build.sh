#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# build.sh — Local build script for ObsidianClone
#
# Usage:
#   bash scripts/build.sh            # standard build
#   bash scripts/build.sh --clean    # wipe dist/ and build/ first
#   bash scripts/build.sh --onefile  # single-file exe (slower startup)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Parse arguments ───────────────────────────────────────────────────────────
CLEAN=0
ONEFILE=0
for arg in "$@"; do
  case "$arg" in
    --clean)   CLEAN=1 ;;
    --onefile) ONEFILE=1 ;;
    *) echo "Unknown argument: $arg" && exit 1 ;;
  esac
done

# ── Clean previous artifacts ──────────────────────────────────────────────────
if [[ $CLEAN -eq 1 ]]; then
  echo ">> Cleaning dist/ and build/ …"
  rm -rf dist build
fi

# ── Validate Python version ───────────────────────────────────────────────────
PYTHON=$(command -v python3 || command -v python)
PY_VER=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo ">> Python $PY_VER detected"

if [[ "${PY_VER%%.*}" -lt 3 ]] || \
   [[ "${PY_VER%%.*}" -eq 3 && "${PY_VER##*.}" -lt 10 ]]; then
  echo "ERROR: Python 3.10+ required (found $PY_VER)" && exit 1
fi

# ── Install / verify dependencies ─────────────────────────────────────────────
echo ">> Installing dependencies …"
"$PYTHON" -m pip install --quiet --upgrade pip
"$PYTHON" -m pip install --quiet -r requirements.txt

# ── Run tests before packaging ────────────────────────────────────────────────
echo ">> Running test suite …"
"$PYTHON" -m pytest tests/ -q --tb=short
echo ">> Tests passed."

# ── Build with PyInstaller ────────────────────────────────────────────────────
echo ">> Building executable …"

if [[ $ONEFILE -eq 1 ]]; then
  "$PYTHON" -m PyInstaller \
    --onefile \
    --windowed \
    --name ObsidianClone \
    --add-data "config/settings.json:config" \
    --paths src \
    --hidden-import vault \
    --hidden-import vault.vault_manager \
    --hidden-import vault.file_watcher \
    --hidden-import ui.main_window \
    --hidden-import ui.sidebar \
    --hidden-import ui.editor_pane \
    --hidden-import ui.preview_pane \
    --hidden-import ui.graph_view \
    --hidden-import core.markdown_engine \
    --hidden-import core.wikilink_parser \
    --hidden-import core.graph_builder \
    --hidden-import utils.debounce \
    src/main.py
else
  "$PYTHON" -m PyInstaller obsidianclone.spec
fi

# ── Report ────────────────────────────────────────────────────────────────────
echo ""
echo "✓ Build complete!"
if [[ $ONEFILE -eq 1 ]]; then
  ls -lh dist/ObsidianClone* 2>/dev/null || true
else
  echo "  Executable directory: dist/ObsidianClone/"
  du -sh dist/ObsidianClone/ 2>/dev/null || true
fi
