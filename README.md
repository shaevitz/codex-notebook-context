# Codex Notebook Context

A standalone macOS VS Code extension that supplies the active Jupyter notebook cell, cursor and selected text to ordinary local Codex prompts. No clipboard or special send command. This extension does not modify Codex or ContextBridge.

## Install

1. Install Node.js (20 or later) and the packaged VSIX with `code --install-extension dist/codex-notebook-context-0.1.0.vsix`.
2. Run **Codex Notebook Context: Install Prompt Hook** from the command palette. This adds one `UserPromptSubmit` handler to `$CODEX_HOME/hooks.json` (defaults to `~/.codex/hooks.json`). It preserves other hooks and leaves `config.toml` unchanged; existing hook files get timestamped backups.
3. Review and trust the new **Codex Notebook Context** hook in Codex `/hooks`. Codex skips untrusted hooks. Use the CLI's `/hooks` if the IDE does not expose the hook browser. Use the same CODEX_HOME as the IDE.
4. Start a fresh Codex conversation in the notebook's workspace folder. Keep the notebook active, select text or place the cursor in a cell, and submit a normal prompt in the Codex sidebar.

Use **Codex Notebook Context: Preview Current Context** to inspect what can be sent. The extension setting `codexNotebookContext.enabled` pauses collection immediately. The hook may not produce a composer attachment chip; its context is added during submission.

## Scope and privacy

- Local macOS VS Code only. Remote SSH/WSL/containers, browser editors and untitled/outside-workspace notebooks are excluded.
- Requires trusted VS Code workspace, a focused VS Code window, an active open file notebook, and an exact match between Codex's working directory and the notebook's workspace folder. Chats rooted in another directory (including a subdirectory) receive no context.
- A private Unix socket belongs to each extension host. The hook checks Codex's IDE origin and the transcript's IDE session metadata and finds the matching socket in its process ancestry, avoiding another window's notebook. Ordinary CLI and desktop Codex sessions receive nothing.
- Source text is read on demand from the live VS Code API, including unsaved edits. Nothing is written to snapshot files, clipboard, notebook outputs or project instructions. The only socket files are in the user's private temporary directory; closing/reloading the host removes its socket. An unreachable socket fails open without context.
- Context includes the active cell only, at most 6,000 source characters and 6,000 selected characters by default (configurable up to 20,000 each). No outputs, other cells or kernel variables. Coordinates are 1-based UTF-16 positions. A missing cursor is reported as unavailable, never invented.
- Hook context becomes part of the Codex conversation and is subject to Codex's existing storage/data handling. Disabling this extension does not erase context in earlier turns.
- On Codex updates that change its origin identifier or process topology, the hook fails closed for context delivery; revalidate after upgrading.

## Remove / roll back

Run **Codex Notebook Context: Remove Prompt Hook**, then uninstall the extension. Restart Codex to apply hook changes. Removal strips only this extension's handler; it retains other hooks and never modifies `config.toml`. Alternatively run `node scripts/setup.js --remove` from the checkout. Backups are adjacent to `hooks.json` with `.notebook-backup-<timestamp>` suffixes. Do not restore a whole old backup over newer unrelated hook changes without comparing it first.

## Development

```sh
npm ci
npm test
npm run test:integration
npm run package
```

The integration suite launches an isolated window using the installed VS Code app, a synthetic notebook and a separate test profile. It exercises actual notebook/cell/selection APIs and the hook subprocess. No notebook kernel is required. Test profiles, packaged binaries and dependencies are ignored by Git. Runtime has no third-party npm dependencies.

## Compatibility evidence

Developed against VS Code 1.140.0 (arm64), OpenAI extension 26.5917.62051, and its bundled Codex CLI 0.155.0-alpha.16.3. The bundled CLI reports `hooks` stable/enabled and generated app-server types include `UserPromptSubmit`, hook trust metadata and additional context output. This is not a guarantee that untrusted hooks run: trust review remains required.

References:
- [Codex hooks and trust](https://learn.chatgpt.com/docs/hooks)
- [VS Code notebook/editor API](https://code.visualstudio.com/api/references/vscode-api)
- [Codex notebook selection issue #38514](https://github.com/openai/codex/issues/38514)

See `VALIDATION.md` for the actual completed checks and outstanding limitations.
