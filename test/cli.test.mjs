import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeServerConfig,
  parseMajorVersion,
  removeServerConfig,
  userConfigPath,
} from "../src/cli.mjs";

test("uses the documented Devin CLI user config paths", () => {
  assert.equal(
    userConfigPath({ home: "/Users/ada", os: "darwin" }),
    "/Users/ada/.config/devin/mcp_config.json",
  );
  assert.equal(
    userConfigPath({ home: "C:\\Users\\Ada", os: "win32", appData: "C:\\Users\\Ada\\AppData\\Roaming" }),
    "C:\\Users\\Ada\\AppData\\Roaming\\devin\\mcp_config.json",
  );
});

test("merges the Chrome server without removing other servers", () => {
  const config = mergeServerConfig({
    mcpServers: {
      github: { command: "github-mcp" },
    },
  });

  assert.deepEqual(config.mcpServers.github, { command: "github-mcp" });
  assert.equal(config.mcpServers["chrome-devtools"].command, "npx");
  assert.ok(config.mcpServers["chrome-devtools"].args.includes("--autoConnect"));
});

test("requires force before replacing a different Chrome server", () => {
  assert.throws(
    () => mergeServerConfig({ mcpServers: { "chrome-devtools": { command: "custom" } } }),
    /--force/,
  );
});

test("removes only the Chrome server", () => {
  const initial = mergeServerConfig({
    mcpServers: {
      github: { command: "github-mcp" },
    },
  });
  const { config, removed } = removeServerConfig(initial);

  assert.equal(removed, true);
  assert.deepEqual(config.mcpServers, { github: { command: "github-mcp" } });
});

test("parses Chrome version output", () => {
  assert.equal(parseMajorVersion("Google Chrome 144.0.7559.3"), 144);
  assert.equal(parseMajorVersion("Chromium 143.0.0.0"), 143);
  assert.equal(parseMajorVersion("unknown"), null);
});
