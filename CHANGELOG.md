# Changelog

## 0.2.0 — release candidate

- Use the name Notebook Context for Codex while retaining the installed extension ID.
- Replace versioned hook paths with a standalone stable launcher and post-uninstall recovery tool.
- Validate/discover standalone Node; add diagnostics and explicit untested-Codex opt-in.
- Preserve unrelated configuration and files during install, update, removal and rollback; detect concurrent setup and restore staged assets after failure.
- Bound and validate IPC, handle UTF-8 correctly and preserve host/window/workspace scoping.
- Explain whole-cell/unsaved-text privacy, storage, scope and compatibility limitations.
- Add CI, isolated packaged-extension checks and lifecycle/security regressions.

## 0.1.0 — 2026-09-30

Private prototype: active notebook cell, cursor and selection supplied to ordinary Codex sidebar prompts; original unit, extension-host and live-sidebar verification.
