import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  mergeServerConfig,
  parseMajorVersion,
  removeServerConfig,
  supportsNodeVersion,
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

test("matches the upstream MCP Node requirements", () => {
  for (const version of ["20.19.0", "22.12.0", "24.21.0"]) {
    assert.equal(supportsNodeVersion(version), true, version);
  }
  for (const version of ["18.20.0", "20.18.0", "21.7.0", "22.11.0"]) {
    assert.equal(supportsNodeVersion(version), false, version);
  }
});

test("runs through the symlink created by npm link", {
  skip: process.platform === "win32",
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "devin-local-chrome-"));
  try {
    const executable = join(directory, "devin-local-chrome");
    await symlink(fileURLToPath(new URL("../src/cli.mjs", import.meta.url)), executable);
    const output = execFileSync(process.execPath, [executable, "print-config"], {
      encoding: "utf8",
    });
    const config = JSON.parse(output);
    assert.equal(config.mcpServers["chrome-devtools"].command, "npx");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
