---
name: testing-existing-chrome-mcp
description: Verify linked CLI config safety and prove MCP controls an existing VM Chrome tab without replacing the browser.
---

# Existing Chrome MCP testing

## Devin Secrets Needed
None for CLI config lifecycle or direct local stdio MCP. Full Devin CLI routing
requires an installed, authenticated user Devin CLI; do not assume the VM's
editor binary named devin is that product.

## Runtime setup
- Read the repo blueprint first. If Node is installed with nvm but absent from
  noninteractive PATH, source `$HOME/.nvm/nvm.sh`.
- Run `npm install` and `npm link`; invoke the linked `devin-local-chrome`,
  not only `node src/cli.mjs`, to exercise symlink startup.
- Inspect actual Chrome version, launch command/profile, and debug port before
  changing any browser settings. Keep the existing process alive.

## Same-tab proof
1. Maximize and record the existing Chrome window. Open a normal page with a
   unique URL fragment before installing/connecting.
2. Install the repo config. Spawn its exact command, args, and environment
   through an MCP stdio client. Initialize, send initialized notification, list
   tools, and call list_pages.
3. Chrome autoConnect needs Chrome 144+ and the appropriate profile's Remote
   Debugging toggle. Older Chrome may redirect that settings URL to Devices.
   Report missing approval flow as untested, not successful.
4. If existing Chrome already has a debug port, the README browser-url fallback
   can prove same-tab interaction without a new browser. Clearly separate this
   modified configuration from the default autoConnect golden path.
5. Match the unique URL in list_pages, select its pageId with bringToFront,
   take_snapshot, and click a real navigation link by returned UID. Check that
   the same pageId changes URL and the existing visible tab navigates. Record
   screenshots plus raw JSON-RPC messages. Query tool schemas rather than
   assuming required pageId parameters.
6. The computer tool's DOM can track a different tab after an external MCP
   selects one; use screenshots for actual visible state.

## Config cleanup
Save existing config and backup before tests, or use a previously absent
test-owned config location. Seed unrelated top-level metadata and an unrelated
MCP entry. Verify byte-identical backups and preserved values after install.
Custom fallback args should make plain uninstall refuse without changing
config or backup; forced removal should preserve unrelated values. Reordered
managed JSON should remain recognized. Verify idempotent uninstall, unlink the
global test CLI, and restore only test-owned files. Never close the shared VM
browser or alter its existing debug listener.
