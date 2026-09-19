#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, posix, resolve, win32 } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "chrome-devtools";
const SERVER_PACKAGE = "chrome-devtools-mcp@1.9.0";
const SERVER_CONFIG = {
  command: "npx",
  args: ["-y", SERVER_PACKAGE, "--autoConnect"],
  env: {
    CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: "1",
    CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1",
  },
};

function usage() {
  console.log(`devin-local-chrome

Usage:
  devin-local-chrome install [--project] [--force]
  devin-local-chrome doctor [--project]
  devin-local-chrome uninstall [--project]
  devin-local-chrome open-settings
  devin-local-chrome print-config

Options:
  --project  Use .devin/mcp_config.json in the current project.
  --force    Replace an existing chrome-devtools MCP entry.`);
}

export function userConfigPath({
  home = homedir(),
  os = platform(),
  appData = process.env.APPDATA,
} = {}) {
  if (os === "win32") {
    const root = appData || win32.join(home, "AppData", "Roaming");
    return win32.join(root, "devin", "mcp_config.json");
  }
  return posix.join(home, ".config", "devin", "mcp_config.json");
}

export function configPath({ project = false, cwd = process.cwd() } = {}) {
  return project
    ? resolve(cwd, ".devin", "mcp_config.json")
    : userConfigPath();
}

export function mergeServerConfig(config, { force = false } = {}) {
  const existing = config.mcpServers?.[SERVER_NAME];
  if (existing && !force && JSON.stringify(existing) !== JSON.stringify(SERVER_CONFIG)) {
    throw new Error(
      `An MCP server named "${SERVER_NAME}" already exists. Re-run with --force to replace it.`,
    );
  }

  return {
    ...config,
    mcpServers: {
      ...(config.mcpServers || {}),
      [SERVER_NAME]: SERVER_CONFIG,
    },
  };
}

export function removeServerConfig(config) {
  if (!config.mcpServers?.[SERVER_NAME]) {
    return { config, removed: false };
  }

  const mcpServers = { ...config.mcpServers };
  delete mcpServers[SERVER_NAME];
  return {
    config: {
      ...config,
      mcpServers,
    },
    removed: true,
  };
}

export function parseMajorVersion(value) {
  const match = value.match(/(\d+)(?:\.\d+){1,3}/);
  return match ? Number(match[1]) : null;
}

async function readConfig(path) {
  try {
    const source = await readFile(path, "utf8");
    const parsed = JSON.parse(source);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("the root value must be an object");
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Cannot parse ${path}: ${error.message}`);
    }
    throw error;
  }
}

async function writeConfig(path, config) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  const contents = `${JSON.stringify(config, null, 2)}\n`;
  await writeFile(temporaryPath, contents, { mode: 0o600 });
  await rename(temporaryPath, path);
}

async function install({ project, force }) {
  const path = configPath({ project });
  const config = await readConfig(path);
  const next = mergeServerConfig(config, { force });

  try {
    await access(path, constants.F_OK);
    await copyFile(path, `${path}.bak`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await writeConfig(path, next);
  console.log(`Installed ${SERVER_NAME} in ${path}`);
  console.log("Next: enable Remote Debugging at chrome://inspect/#remote-debugging");
  console.log("Chrome will ask for approval when Devin first connects.");
}

async function uninstall({ project }) {
  const path = configPath({ project });
  const current = await readConfig(path);
  const { config, removed } = removeServerConfig(current);

  if (!removed) {
    console.log(`No ${SERVER_NAME} entry found in ${path}`);
    return;
  }

  await copyFile(path, `${path}.bak`);
  await writeConfig(path, config);
  console.log(`Removed ${SERVER_NAME} from ${path}`);
}

function findExecutable(command) {
  const locator = platform() === "win32" ? "where" : "which";
  try {
    return execFileSync(locator, [command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split(/\r?\n/)[0];
  } catch {
    return null;
  }
}

function chromeCandidates() {
  if (platform() === "darwin") {
    return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  }
  if (platform() === "win32") {
    const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA];
    return roots
      .filter(Boolean)
      .map((root) => join(root, "Google", "Chrome", "Application", "chrome.exe"));
  }
  return ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
}

function chromeVersion() {
  for (const candidate of chromeCandidates()) {
    const executable = candidate.includes("/") || candidate.includes("\\")
      ? candidate
      : findExecutable(candidate);
    if (!executable) {
      continue;
    }
    try {
      const output = execFileSync(executable, ["--version"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      return { executable, output, major: parseMajorVersion(output) };
    } catch {
      continue;
    }
  }
  return null;
}

function mark(ok) {
  return ok ? "PASS" : "FAIL";
}

async function doctor({ project }) {
  let failed = false;
  const checks = [];
  const add = (ok, label, detail) => {
    checks.push({ ok, label, detail });
    failed ||= !ok;
  };

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const nodeMinor = Number(process.versions.node.split(".")[1]);
  const supportedNode = nodeMajor > 20 || (nodeMajor === 20 && nodeMinor >= 19);
  add(supportedNode, "Node.js", process.version);

  const npx = findExecutable("npx");
  add(Boolean(npx), "npx", npx || "not found");

  const devin = findExecutable("devin");
  add(Boolean(devin), "Devin CLI", devin || "not found");

  const chrome = chromeVersion();
  add(Boolean(chrome), "Chrome", chrome?.output || "not found");
  if (chrome) {
    add(
      chrome.major !== null && chrome.major >= 144,
      "Chrome auto-connect",
      chrome.major === null ? "version unknown" : `major version ${chrome.major}`,
    );
  }

  const path = configPath({ project });
  try {
    const config = await readConfig(path);
    const installed = JSON.stringify(config.mcpServers?.[SERVER_NAME]) === JSON.stringify(SERVER_CONFIG);
    add(installed, "MCP configuration", installed ? path : `missing or different in ${path}`);
  } catch (error) {
    add(false, "MCP configuration", error.message);
  }

  for (const check of checks) {
    console.log(`${mark(check.ok)}  ${check.label}: ${check.detail}`);
  }
  console.log("\nManual check: Remote Debugging is enabled at chrome://inspect/#remote-debugging");

  if (failed) {
    process.exitCode = 1;
  }
}

function openSettings() {
  const url = "chrome://inspect/#remote-debugging";
  const os = platform();
  const command = os === "darwin" ? "open" : os === "win32" ? "cmd" : "xdg-open";
  const args = os === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
  console.log(`Opened ${url}`);
}

function parseOptions(args) {
  return {
    project: args.includes("--project"),
    force: args.includes("--force"),
  };
}

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  const options = parseOptions(args);

  if (command === "install") {
    await install(options);
  } else if (command === "doctor") {
    await doctor(options);
  } else if (command === "uninstall") {
    await uninstall(options);
  } else if (command === "open-settings") {
    openSettings();
  } else if (command === "print-config") {
    console.log(JSON.stringify({ mcpServers: { [SERVER_NAME]: SERVER_CONFIG } }, null, 2));
  } else if (command === "help" || command === "--help" || command === "-h") {
    usage();
  } else {
    usage();
    process.exitCode = 1;
  }
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
