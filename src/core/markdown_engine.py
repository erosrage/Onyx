"""Markdown → HTML renderer with wikilink pre-processing."""
from __future__ import annotations

import re
import markdown2

# Wikilink pattern: [[Note Title]] or [[Note Title|Display Text]]
_WIKILINK_RE = re.compile(r"\[\[([^\]\|]+)(?:\|([^\]]+))?\]\]")


def render(markdown_text: str, vault_path: str = "") -> str:
    """
    Convert raw Markdown to a full HTML document suitable for QWebEngineView.

    Pipeline:
      1. Replace [[Wikilinks]] with <a href="wikilink://..."> anchors.
      2. Render Markdown via markdown2 (extras: tables, fenced-code, footnotes).
      3. Wrap in a minimal HTML shell with embedded dark-mode CSS.
    """
    md_with_links = _expand_wikilinks(markdown_text)
    body_html = markdown2.markdown(
        md_with_links,
        extras=[
            "fenced-code-blocks",
            "tables",
            "footnotes",
            "strike",
            "task_list",
            "header-ids",
            "code-friendly",
        ],
    )
    return _wrap_html(body_html)


def extract_wikilinks(markdown_text: str) -> list[str]:
    """Return a list of raw link targets found in [[...]] syntax."""
    return [m.group(1).strip() for m in _WIKILINK_RE.finditer(markdown_text)]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _expand_wikilinks(text: str) -> str:
    """Replace [[Target|Label]] with an HTML anchor before markdown rendering."""
    def _replace(m: re.Match) -> str:
        target = m.group(1).strip()
        label = (m.group(2) or target).strip()
        # Use a custom URI scheme so QWebEngineView can intercept navigation
        href = f"wikilink://{target.replace(' ', '%20')}"
        return f'<a href="{href}">{label}</a>'

    return _WIKILINK_RE.sub(_replace, text)


def _wrap_html(body: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    color: #d4d4d4;
    background: #1e1e1e;
    padding: 24px 32px;
    max-width: 860px;
  }}
  h1, h2, h3, h4, h5, h6 {{
    color: #e8e8e8;
    margin: 1.4em 0 0.4em;
    font-weight: 600;
  }}
  a {{ color: #7ab8f5; text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  code {{
    background: #2d2d2d;
    border-radius: 3px;
    padding: 1px 5px;
    font-family: "Fira Code", Consolas, monospace;
    font-size: 0.88em;
    color: #ce9178;
  }}
  pre {{
    background: #252526;
    border-radius: 6px;
    padding: 14px 18px;
    overflow-x: auto;
    margin: 1em 0;
  }}
  pre code {{ background: none; padding: 0; color: #d4d4d4; }}
  blockquote {{
    border-left: 3px solid #555;
    margin: 1em 0;
    padding: 4px 16px;
    color: #aaa;
  }}
  table {{
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }}
  th, td {{
    border: 1px solid #444;
    padding: 6px 12px;
    text-align: left;
  }}
  th {{ background: #2d2d2d; color: #e8e8e8; }}
  hr {{ border: none; border-top: 1px solid #444; margin: 1.5em 0; }}
  ul, ol {{ padding-left: 1.6em; margin: 0.5em 0; }}
  li {{ margin: 0.2em 0; }}
  /* Task list checkboxes */
  input[type="checkbox"] {{ margin-right: 6px; }}
</style>
</head>
<body>
{body}
</body>
</html>"""
