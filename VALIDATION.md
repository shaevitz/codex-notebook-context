# Validation — 2026-09-30

## Installed environment

- VS Code 1.140.0, commit `07f806f999227108933c2e30515b26eecc1fda74`, macOS arm64.
- OpenAI VS Code extension 26.5917.62051.
- Its embedded executable reports Codex CLI 0.155.0-alpha.16.3; `features list` reports `hooks stable true`.
- Generated app-server protocol types include `UserPromptSubmit`, `hooks/list`, per-hook trust state and hook context fragments.
- Inspection confirms the installed `chatgpt.addToThread` command returns early for any URI scheme other than `file`; notebook cells use `vscode-notebook-cell`.

## Passed

- `npm test`: 18 tests pass. Includes current cell/cursor/selection, unsaved text, selection retention, unavailable cursor, multi-cell selection, truncation, closed/unfocused/untrusted/remote/wrong-workspace rejection, actual Unix-socket IPC and child hook, nested CLI exclusion, malformed config protection, setup idempotence and preservation/removal of existing hooks.
- Real VS Code extension-host integration: synthetic two-cell `.ipynb`, cell 1 selection `alpha`, cursor moved to line 2/column 8, cell 2 selection `gamma`, actual hook subprocess output, CLI and wrong-workspace rejection, and no context after notebook close. No notebook kernel required.
- `npm run package`: VSIX built with only 10 manifest/runtime/documentation files; no dependencies, local snapshots, test profiles or credentials packaged.
- VSIX installed successfully through official VS Code CLI. Installed runtime files byte-match source.
- Registered hook loaded by actual installed Codex app-server: `eventName=userPromptSubmit`, `enabled=true`, `source=user`, `handlerType=command`, **`trustStatus=trusted`** (after explicit user approval and native CLI hook review).
- Private GitHub repository creation confirmed with `isPrivate=true`, owner `shaevitz`.
- npm dependency audit at installation: zero vulnerabilities. All npm packages are development-only.

## Final setup and remaining verification

The user explicitly approved this hook. Approval was applied through the bundled CLI's supported hook review screen: **Review hooks → UserPromptSubmit → the exact notebook hook → t to trust**. A subsequent app-server query confirmed trusted/enabled. No bypass flags or trust database edits were used. The existing VS Code extension host is serving live notebook/cursor metadata without reloading the user's modified notebook. ContextBridge remains installed and unchanged.

An ordinary Codex sidebar prompt reaching a model with this additional context has **not yet been verified**. The integration test exercises a real extension host and hook subprocess, but uses a synthetic session metadata fixture; it does not substitute for a trusted app-server/model turn. The actual app-server `hooks/list` probe verifies configuration loading and saved trust state. The ordinary UI check could not yet run because the user was actively interacting with VS Code; computer control declined actions rather than interrupt that work.

After trust, use a synthetic notebook and ask: “Without opening files or tools, report the active notebook cell, cursor and selected text from the context provided with this prompt.” Change the selection and repeat. Then close the notebook and confirm no fresh notebook hook context is added. Previous-turn context can remain in conversation history, so a model recalling earlier data is not evidence that a closed notebook was injected again.

Local macOS and the Codex sidebar are supported. Remote workspaces, untitled notebooks, out-of-workspace notebooks, inactive windows and mismatched chat cwd are deliberately excluded. Missing hook origin, session metadata, socket, or live notebook fails open without additional context. There is no interception or replacement of Codex's ordinary Send action.

Automatic approval review rejected an initial attempt to persistently trust the new repository folder, since approval covered only the hook. That dialog was cancelled; the hook review was successfully performed from an already trusted workspace. A separate temporary VS Code workspace remained in Restricted Mode and was closed without changing its trust. No folder-trust expansion remains necessary for normal use in the existing trusted notebook workspace.
