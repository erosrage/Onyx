"""Unit tests for VaultManager settings persistence."""
import json
import os
import tempfile
from pathlib import Path

import pytest

# Patch SETTINGS_PATH before importing vault_manager
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


def test_load_settings_missing_file(tmp_path, monkeypatch):
    """Returns empty dict when settings file does not exist."""
    import vault.vault_manager as vm_module
    monkeypatch.setattr(vm_module, "SETTINGS_PATH", tmp_path / "nonexistent.json")
    mgr = vm_module.VaultManager.__new__(vm_module.VaultManager)
    mgr._settings = mgr._load_settings()
    assert mgr._settings == {}


def test_persist_and_reload_vault(tmp_path, monkeypatch):
    """VaultManager round-trips the vault path through settings.json."""
    settings_file = tmp_path / "settings.json"
    import vault.vault_manager as vm_module
    monkeypatch.setattr(vm_module, "SETTINGS_PATH", settings_file)

    mgr = vm_module.VaultManager.__new__(vm_module.VaultManager)
    mgr._settings = {}

    vault_dir = tmp_path / "my_vault"
    vault_dir.mkdir()
    mgr._persist_vault(str(vault_dir))

    assert settings_file.exists()
    data = json.loads(settings_file.read_text())
    assert data["last_vault_path"] == str(vault_dir)


def test_get_setting_default(tmp_path, monkeypatch):
    """get_setting returns the default when key is absent."""
    import vault.vault_manager as vm_module
    monkeypatch.setattr(vm_module, "SETTINGS_PATH", tmp_path / "s.json")
    mgr = vm_module.VaultManager.__new__(vm_module.VaultManager)
    mgr._settings = {}
    assert mgr.get_setting("sidebar_width", 240) == 240


def test_save_setting_persists(tmp_path, monkeypatch):
    """save_setting writes to disk immediately."""
    settings_file = tmp_path / "settings.json"
    import vault.vault_manager as vm_module
    monkeypatch.setattr(vm_module, "SETTINGS_PATH", settings_file)
    mgr = vm_module.VaultManager.__new__(vm_module.VaultManager)
    mgr._settings = {}
    mgr.save_setting("window_width", 1400)

    data = json.loads(settings_file.read_text())
    assert data["window_width"] == 1400
