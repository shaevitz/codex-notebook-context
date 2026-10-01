# Security policy

Only the latest preview release receives fixes. This extension adds editor content to Codex conversations and must be treated as a content-sharing tool.

Report a suspected vulnerability privately through [GitHub private vulnerability reporting](https://github.com/shaevitz/codex-notebook-context/security/advisories/new) when enabled. If private reporting is unavailable, open an issue requesting a private contact channel without including exploit details, notebook data or credentials. Do not publish private user data to demonstrate a bug.

The local transport checks account ownership/permissions, exact workspace scope and IDE process ancestry. It does not protect against malicious software running as the same account. Hook trust is controlled by Codex; setup never modifies trust stores or bypasses review. Diagnostics do not prove native hook trust or end-to-end delivery.

Release checks include full-history content inspection, package allowlisting, dependency audit, configuration-preservation and failure tests. Those checks are not a comprehensive external security audit. Changes to hooks, provenance rules, configuration ownership or capture scope require review and realistic regressions.
