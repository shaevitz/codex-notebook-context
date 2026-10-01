# Validation

## v0.2.0 macOS preview — October 1, 2026

- Display name: Notebook Context for Codex; extension ID remains `shaevitz.codex-notebook-context`; MIT.
- Syntax/package checks and all 36 unit/lifecycle/IPC tests pass after the latest capture and privacy changes, on standalone Node 25.9.0 x64 running on an Apple Silicon Mac. npm audit reports zero vulnerabilities. Runtime has no third-party npm dependencies. Private CI passes on Node 20/22/24, including package checks, all 36 tests, audits and the packaged Restricted Mode integration job: revision 4a0436ad09db2d889ea84c3e37f408486f4301b5, [run 36879358980](https://github.com/shaevitz/codex-notebook-context/actions/runs/36879358980). The initial CI packaging job failed because the clean checkout had no dist directory; the repaired rerun passed.
- Candidate VSIX builds successfully with 17 entries (runtime, manifest, MIT license, README/changelog/security/support, two synthetic PNG listing assets), approximately 74 KB. Packaging excludes tests, development dependencies, notebooks, transcripts, credentials, local records and test profiles. The tested candidate has 76,115 bytes; SHA-256 `11f82b4256a803d207b4ecffa70df1fb58c5af709b4ed28fe03483e8dfc426f0`.
- Install/legacy update/repeated update, standalone recovery/removal after extension deletion, rollback, preservation of unrelated hooks and byte-preservation of config.toml, invalid configuration, symlinks/ownership/permissions, concurrent edits and failure rollback have regression coverage.
- IPC tests pass for Unicode, oversized/malformed/duplicate requests, response limits, restart/disposal, real hook subprocess ancestry/origin and sibling-window exclusion. Source/selection capture is bounded and reads cell text once; context omits the absolute cell URI.
- All original and release commits were inventoried and inspected. Targeted full-history scans found no credentials, personal home paths, notebook files or transcript snapshots. Historical author email is a placeholder noreply address; new commits use the verified GitHub account noreply address.
- Positive v0.2.0 source and installed-VSIX integration both pass in VS Code 1.140.0 arm64, with native Workspace Trust approved for only the synthetic folder. Real notebook APIs verify both cells, cursor/selection changes, sidebar-focus retention, unsaved text, disable/re-enable, CLI/wrong-directory rejection, closed notebook and removal. A normal development host runs an inert test driver because extensionTestsPath uses ephemeral trust storage. No trust or sandbox bypass flags are used. The packaged Restricted Mode privacy test passes locally; CI also passes.
- Official VS Code CLI isolated-profile lifecycle passed: install the prior 0.1.0 VSIX, upgrade to 0.2.0, uninstall, and reinstall 0.2.0. Native real-Codex delivery passed with the installed candidate and real OpenAI extension 26.5917.62051: ordinary Send in a conversation created before trust, refreshed/reopened afterward, injected cell 1 / cursor 1:6 / selection alpha; a new chat injected cell 2 / cursor 1:6 / selection gamma. Model replies and real developer transcript records match at 14:56:36 UTC and 14:57:20 UTC. Neither test used tools. Native Codex review approved only the exact candidate hook in the disposable home; read-only hooks/list confirms trusted/enabled. Failed earlier startup/trust attempts remain failures and are not counted as passing tests.
- Automatic collection writes no source snapshots or cell-text logs. Explicit Preview Current Context uses VS Code Output; observation showed that VS Code retains this output in local logs. README discloses this deliberate-preview exception. Diagnostics contain no cell text.
- The normal installed extension, hooks.json and config.toml remain byte-identical to the private preservation baseline. No user notebook has been edited, saved, reloaded or used in these v0.2.0 tests.
- Private candidate 88a5aa5 was pushed and verified against origin/main while the repository remains private. The repaired full CI run passed, followed by native delivery; final documentation/package checks and release-content review precede publication. Publisher shaevitz was created after the user accepted Microsoft’s Publisher Agreement in Chrome. No automated publishing credential has been created. This is the prepublication checkpoint; publication outcomes are recorded on the GitHub release and Marketplace listing.

## Historical v0.1.0 validation — September 30, 2026

## Installed environment

- VS Code 1.140.0, commit `07f806f999227108933c2e30515b26eecc1fda74`, macOS arm64.
- OpenAI VS Code extension 26.5917.62051.
- Its embedded executable reports Codex CLI 0.155.0-alpha.16.3; `features list` reports `hooks stable true`.
- Generated app-server protocol types include `UserPromptSubmit`, `hooks/list`, per-hook trust state and hook context fragments.
- Inspection confirms the installed `chatgpt.addToThread` command returns early for any URI scheme other than `file`; notebook cells use `vscode-notebook-cell`.

## Passed

- `npm test`: 19 tests pass. Includes current cell/cursor/selection, unsaved text, selection retention, unavailable cursor, multi-cell selection, truncation, closed/unfocused/untrusted/remote/wrong-workspace rejection, actual Unix-socket IPC and child hook, nested CLI exclusion, large real-session metadata regression, malformed config protection, setup idempotence and preservation/removal of existing hooks.
- Real VS Code extension-host integration: synthetic two-cell `.ipynb`, cell 1 selection `alpha`, cursor moved to line 2/column 8, cell 2 selection `gamma`, actual hook subprocess output, CLI and wrong-workspace rejection, and no context after notebook close. No notebook kernel required.
- `npm run package`: VSIX built with only 10 manifest/runtime/documentation files; no dependencies, local snapshots, test profiles or credentials packaged.
- VSIX installed successfully through official VS Code CLI. Installed runtime files byte-match source.
- Registered hook loaded by actual installed Codex app-server: `eventName=userPromptSubmit`, `enabled=true`, `source=user`, `handlerType=command`, **`trustStatus=trusted`** (after explicit user approval and native CLI hook review).
- Private GitHub repository creation confirmed with `isPrivate=true`, owner `shaevitz`.
- npm dependency audit at installation: zero vulnerabilities. All npm packages are development-only.

## Final setup and live verification

The user explicitly approved this hook. Approval was applied through the bundled CLI's supported hook review screen: **Review hooks → UserPromptSubmit → the exact notebook hook → t to trust**. A subsequent app-server query confirmed trusted/enabled. No bypass flags or trust database edits were used. The existing VS Code extension host is serving live notebook/cursor metadata without reloading the user's modified notebook. ContextBridge remains installed and unchanged.

Two ordinary Codex sidebar prompts were verified end to end through the normal **Send** button after trust:

1. Cell 8, cursor line 7 / column 59, with a full-line selection: the model reported the correct cell, cursor and exact selected text.
2. Selection changed without editing the notebook: cell 8, cursor line 1 / column 8, four selected characters. The next ordinary prompt reported the new coordinates and exact new text.

Both successful turns have actual `response_item` / `developer` context records in the Codex transcript at 2026-09-30 19:26:04 UTC and 19:27:18 UTC. The model was instructed not to use tools or open files. Notebook contents and transcript snapshots are intentionally not checked into this repository. The original full-line selection was restored and verified afterward. No notebook text was edited, saved, or reloaded for this test.

The live test found and fixed a real compatibility bug: the initial implementation read only 16 KiB of session metadata, but the installed Codex emits a larger first record containing base instructions. The hook now reads the complete first JSON record up to a 1 MiB cap. A regression test covers a 40 KiB metadata record. Temporary metadata-only diagnostics were removed after verifying the fix.

Local macOS and the Codex sidebar are supported. Remote workspaces, untitled notebooks, out-of-workspace notebooks, inactive windows and mismatched chat cwd are deliberately excluded. Missing hook origin, session metadata, socket, or live notebook fails open without additional context. There is no interception or replacement of Codex's ordinary Send action.

## Existing-conversation refresh verification

The initial successful sidebar tests used a new conversation. A conversation opened before hook installation subsequently failed to receive context, despite sharing the same IDE origin and workspace. On September 30, the supported **Developer: Reload Window** command followed by reopening that exact existing conversation fixed delivery. Inspection of the installed Codex extension also confirmed that its app-server restart action delegates to this window reload command.

At 21:27:16 UTC, the original conversation received a real developer context record identifying cell 9. The reload had cleared text selection state, so cursor and selection were correctly reported as unavailable. After selecting the code again, an ordinary Send at 21:28:32 UTC injected cell 9, cursor line 11 / column 11, and the entire selection from line 1 / column 1 through line 11 / column 11. The model's visible reply and saved transcript both reported the exact selected code and coordinates, without tools. The notebook reported `dirty=false`; no notebook text was edited or saved. The original conversation remains open with the successful answer.

This demonstrates the necessary refresh for a preexisting loaded conversation on the tested Codex version; it does not establish that every future Codex version caches hook configuration in the same way. Installation guidance now includes this one-time refresh and reselection step.

Automatic approval review rejected an initial attempt to persistently trust the new repository folder, since approval covered only the hook. That dialog was cancelled; the hook review was successfully performed from an already trusted workspace. A separate temporary VS Code workspace remained in Restricted Mode and was closed without changing its trust. No folder-trust expansion remains necessary for normal use in the existing trusted notebook workspace.
