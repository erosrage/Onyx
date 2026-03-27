"""Tests for the Markdown rendering engine and wikilink parser."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.markdown_engine import render, extract_wikilinks, _expand_wikilinks


class TestExtractWikilinks:
    def test_single_link(self):
        assert extract_wikilinks("See [[My Note]]") == ["My Note"]

    def test_multiple_links(self):
        result = extract_wikilinks("[[Alpha]] and [[Beta]] and [[Gamma]]")
        assert result == ["Alpha", "Beta", "Gamma"]

    def test_link_with_alias(self):
        # [[Target|Label]] — only target is returned
        assert extract_wikilinks("Read [[Target|the guide]]") == ["Target"]

    def test_no_links(self):
        assert extract_wikilinks("Plain text with no links.") == []

    def test_ignores_single_brackets(self):
        assert extract_wikilinks("[normal link](url)") == []


class TestExpandWikilinks:
    def test_produces_anchor(self):
        html = _expand_wikilinks("See [[My Note]]")
        assert 'href="wikilink://My%20Note"' in html
        assert ">My Note<" in html

    def test_alias_used_as_label(self):
        html = _expand_wikilinks("[[Target|Click here]]")
        assert 'href="wikilink://Target"' in html
        assert ">Click here<" in html


class TestRender:
    def test_returns_html_document(self):
        html = render("# Hello")
        assert "<!DOCTYPE html>" in html
        assert "<h1" in html
        assert "Hello" in html

    def test_renders_wikilinks_as_anchors(self):
        html = render("See [[Other Note]]")
        assert "wikilink://" in html
        assert "Other%20Note" in html

    def test_renders_bold(self):
        html = render("**bold text**")
        assert "<strong>" in html

    def test_renders_fenced_code(self):
        md = "```python\nprint('hi')\n```"
        html = render(md)
        assert "<code" in html

    def test_renders_table(self):
        md = "| A | B |\n|---|---|\n| 1 | 2 |"
        html = render(md)
        assert "<table" in html

    def test_empty_string(self):
        html = render("")
        assert "<!DOCTYPE html>" in html
