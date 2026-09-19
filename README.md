# Devin Local Chrome

Connect Devin CLI to the Chrome window already running on your computer. This
project installs Google's official Chrome DevTools MCP server in Devin CLI and
uses Chrome's explicit connection approval flow.

## Requirements

- Devin CLI
- Node.js 24 LTS and npm (also supports Node 20.19+ and 22.12+)
- Google Chrome 144 or newer

## Install

```sh
git clone https://github.com/mister36/devin-local-chrome.git
cd devin-local-chrome
npm install
npm link
devin-local-chrome install
devin-local-chrome open-settings
```

Enable **Remote Debugging** on the Chrome page that opens. The first time Devin
tries to use Chrome, Chrome displays a permission dialog. Approve it to connect.

Run a readiness check:

```sh
devin-local-chrome doctor
```

Then start Devin CLI in any repository and ask it to list the available Chrome
tabs or inspect the current page. Devin CLI will expose the server's tools with
names beginning with `mcp__chrome-devtools__`.

## Project-only configuration

The default install updates the user-level Devin MCP configuration:

- macOS and Linux: `~/.config/devin/mcp_config.json`
- Windows: `%APPDATA%\devin\mcp_config.json`

To configure only the current repository:

```sh
devin-local-chrome install --project
```

This writes `.devin/mcp_config.json`, which can be committed for a team. Devin
CLI prompts before MCP tool calls by default; this project does not add blanket
tool permissions.

If you decide to pre-approve selected read-only tools later, add those individual
tool names to Devin's `permissions.allow` list instead of allowing
`mcp__chrome-devtools__*`.

## Security

Connecting to an existing Chrome session gives the MCP server access to the tabs
and logged-in websites in that browser. Chrome requires remote debugging to be
enabled and asks for approval when an agent connects.

Use a separate Chrome profile for sensitive work. Disable Remote Debugging when
you are finished. This project pins the MCP server version, disables its usage
statistics and update checks, and leaves Devin's per-tool approval prompts on.

## Older Chrome fallback

Automatic connection requires Chrome 144 or newer. For an older Chrome release,
start a separate Chrome profile with a debugging port and replace `--autoConnect`
with:

```text
--browser-url=http://127.0.0.1:9222
```

Chrome 136 and newer require a non-default `--user-data-dir` when using a remote
debugging port. This fallback cannot attach to an already-running default
profile, so upgrading Chrome is preferable.

## Remove

```sh
devin-local-chrome uninstall
npm unlink --global devin-local-chrome
```

The installer creates `mcp_config.json.bak` before changing an existing config.
Uninstall refuses to remove a customized Chrome server unless you pass `--force`.

## Commands

```text
devin-local-chrome install [--project] [--force]
devin-local-chrome doctor [--project]
devin-local-chrome uninstall [--project] [--force]
devin-local-chrome open-settings
devin-local-chrome print-config
```

## Upstream documentation

- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Connect to an existing Chrome session](https://developer.chrome.com/docs/devtools/agents/get-started/configuration#connect_to_an_existing_browser_session)
- [Devin CLI MCP configuration](https://docs.devin.ai/cli/extensibility/mcp/configuration)
