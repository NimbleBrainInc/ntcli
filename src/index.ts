#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");
import { handleLogin } from "./commands/auth/login.js";
import { handleLogout } from "./commands/auth/logout.js";
import { handleSignup } from "./commands/auth/signup.js";
import { handleStatus } from "./commands/auth/status.js";
import { handleHealthCheck } from "./commands/health.js";
import { handleMCPCall } from "./commands/mcp/call.js";
import { handleMCPConnect } from "./commands/mcp/connect.js";
import { handleMCPTools } from "./commands/mcp/tools.js";
import { handleRegistryList } from "./commands/registry/list.js";
import { handleRegistryShow } from "./commands/registry/show.js";
import { handleSecretsList } from "./commands/secrets/list.js";
import { handleSecretsSet } from "./commands/secrets/set.js";
import { handleSecretsUnset } from "./commands/secrets/unset.js";
import { handleServerClaudeConfig } from "./commands/server/claude-config.js";
import { handleServerDeploy } from "./commands/server/deploy.js";
import { handleServerInfo } from "./commands/server/info.js";
import { handleServerList } from "./commands/server/list.js";
import { handleServerLogs } from "./commands/server/logs.js";
import { handleServerRemove } from "./commands/server/remove.js";
import { handleServerScale } from "./commands/server/scale.js";
import { handleTokenRefresh } from "./commands/token/refresh.js";
import { handleTokenShow } from "./commands/token/show.js";
import { handleWorkspaceClear } from "./commands/workspace/clear.js";
import { handleWorkspaceCreate } from "./commands/workspace/create.js";
import { handleWorkspaceDelete } from "./commands/workspace/delete.js";
import { handleWorkspaceList } from "./commands/workspace/list.js";
import { handleWorkspaceSelect } from "./commands/workspace/select.js";
import { handleWorkspaceSwitch } from "./commands/workspace/switch.js";

/**
 * Main CLI application entry point
 */
async function main() {
  const program = new Command();

  program
    .name("ntcli")
    .description("The CLI for NimbleTools MCP Platform")
    .version(version)
    .option("--debug", "Show detailed HTTP debugging (headers, body, errors)")
    .configureOutput({
      writeErr: (str) => process.stderr.write(chalk.red(str)),
    });

  // Auth command group
  const authCommand = program
    .command("auth")
    .description("Authentication commands");

  // Login command
  authCommand
    .command("login")
    .description("Authenticate with Clerk OAuth")
    .option("-p, --port <port>", "Port for local callback server", (val) =>
      parseInt(val, 10)
    )
    .option("-t, --timeout <timeout>", "Authentication timeout in ms", (val) =>
      parseInt(val, 10)
    )
    .option("-v, --verbose", "Enable verbose output")
    .action(async (options) => {
      try {
        await handleLogin(options);
      } catch (error) {
        console.error(
          chalk.red(
            "Login failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Signup command
  authCommand
    .command("signup")
    .description("Sign up with Clerk OAuth")
    .option("-p, --port <port>", "Port for local callback server", (val) =>
      parseInt(val, 10)
    )
    .option("-t, --timeout <timeout>", "Authentication timeout in ms", (val) =>
      parseInt(val, 10)
    )
    .option("-v, --verbose", "Enable verbose output")
    .action(async (options) => {
      try {
        await handleSignup(options);
      } catch (error) {
        console.error(
          chalk.red(
            "Signup failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Logout command
  authCommand
    .command("logout")
    .description("Clear stored authentication credentials")
    .action(async () => {
      try {
        await handleLogout();
      } catch (error) {
        console.error(
          chalk.red(
            "Logout failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Status command
  authCommand
    .command("status")
    .description("Show current authentication status")
    .action(async () => {
      try {
        await handleStatus();
      } catch (error) {
        console.error(
          chalk.red(
            "Status check failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Workspace command group
  const workspaceCommand = program
    .command("workspace")
    .alias("ws")
    .description("Workspace management commands");

  // Workspace create command
  workspaceCommand
    .command("create <name>")
    .description("Create a new workspace (name must be ≤20 characters)")
    .option("-d, --description <description>", "Workspace description")
    .option("-v, --verbose", "Enable verbose output")
    .action(async (name, options) => {
      try {
        await handleWorkspaceCreate(name, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Workspace creation failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Workspace delete command
  workspaceCommand
    .command("delete <name>")
    .alias("rm")
    .description("Delete a workspace")
    .option("-f, --force", "Skip confirmation prompt")
    .option("-v, --verbose", "Enable verbose output")
    .action(async (name, options) => {
      try {
        await handleWorkspaceDelete(name, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Workspace deletion failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Workspace switch command
  workspaceCommand
    .command("switch <name>")
    .alias("use")
    .description("Switch to a different workspace (alias: use)")
    .option("-v, --verbose", "Enable verbose output")
    .action(async (name, options) => {
      try {
        await handleWorkspaceSwitch(name, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Workspace switch failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Workspace list command
  workspaceCommand
    .command("list")
    .alias("ls")
    .description("List all workspaces")
    .option("-v, --verbose", "Show detailed information")
    .action(async (options) => {
      try {
        await handleWorkspaceList(options);
      } catch (error) {
        console.error(
          chalk.red(
            "Workspace listing failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Workspace select command (interactive)
  workspaceCommand
    .command("select")
    .description("Interactively select and switch workspace")
    .option("-v, --verbose", "Show detailed information")
    .action(async (options) => {
      try {
        await handleWorkspaceSelect(options);
      } catch (error) {
        console.error(
          chalk.red(
            "Workspace selection failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Workspace clear command (unset active workspace)
  workspaceCommand
    .command("clear")
    .alias("unset")
    .description("Clear/unset the active workspace")
    .option("-v, --verbose", "Show detailed information")
    .action(async (options) => {
      try {
        await handleWorkspaceClear(options);
      } catch (error) {
        console.error(
          chalk.red(
            "Workspace clear failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Registry command group
  const registryCommand = program
    .command("registry")
    .alias("reg")
    .description("Registry management commands");

  // Registry list command
  registryCommand
    .command("list")
    .alias("ls")
    .description("List servers from the registry")
    .option("-l, --limit <number>", "Limit number of results", (val) =>
      parseInt(val, 10)
    )
    .option("-v, --verbose", "Show detailed information")
    .action(async (options) => {
      try {
        await handleRegistryList(options);
      } catch (error) {
        console.error(
          chalk.red(
            "Registry listing failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Registry show command
  registryCommand
    .command("show <server-id>")
    .alias("info")
    .description("Show detailed information about a registry server")
    .option("-v, --verbose", "Show additional debug information")
    .action(async (serverId, options) => {
      try {
        await handleRegistryShow(serverId, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Registry show failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Server command group
  const serverCommand = program
    .command("server")
    .alias("srv")
    .description("Server management commands");

  // Server deploy command
  serverCommand
    .command("deploy <server-id>")
    .description("Deploy a server to the active workspace")
    .option("-v, --version <version>", "Specific version to deploy")
    .option("-e, --env <env...>", "Environment variables (KEY=value format)")
    .option("--cpu <limit>", 'CPU limit (e.g., "500m", "1")')
    .option("--memory <limit>", 'Memory limit (e.g., "512Mi", "1Gi")')
    .option("--min-replicas <number>", "Minimum number of replicas", (val) =>
      parseInt(val, 10)
    )
    .option("--max-replicas <number>", "Maximum number of replicas", (val) =>
      parseInt(val, 10)
    )
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("--wait", "Wait for deployment to be ready")
    .option("--verbose", "Show detailed output")
    .action(async (serverId, options) => {
      try {
        await handleServerDeploy(serverId, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Server deployment failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Server list command
  serverCommand
    .command("list")
    .alias("ls")
    .description("List servers in the active workspace")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("-v, --verbose", "Show detailed information")
    .action(async (options) => {
      try {
        await handleServerList(options);
      } catch (error) {
        console.error(
          chalk.red(
            "Server listing failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Server info command
  serverCommand
    .command("info <server-id>")
    .alias("show")
    .description("Show detailed information about a server")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("-v, --verbose", "Show additional debug information")
    .action(async (serverId, options) => {
      try {
        await handleServerInfo(serverId, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Server info failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Health check command
  program
    .command("health")
    .description("Check API health status")
    .option("--debug", "Show detailed HTTP debugging information")
    .option("-v, --verbose", "Show additional debug information")
    .action(async (options) => {
      try {
        await handleHealthCheck(options);
      } catch (error) {
        console.error(
          chalk.red(
            "Health check failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Server scale command
  serverCommand
    .command("scale <server-id> <replicas>")
    .description("Scale a server to the specified number of replicas (1-4)")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("--wait", "Wait for scaling operation to complete")
    .option("--verbose", "Show detailed output")
    .action(async (serverId, replicas, options) => {
      try {
        await handleServerScale(serverId, replicas, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Server scaling failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Server remove command
  serverCommand
    .command("remove <server-id>")
    .alias("rm")
    .description("Remove a server from the workspace")
    .option("-f, --force", "Skip confirmation prompt")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("--verbose", "Show detailed output")
    .action(async (serverId, options) => {
      try {
        await handleServerRemove(serverId, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Server removal failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Server logs command
  serverCommand
    .command("logs <server-id>")
    .description("Get logs for a server in the workspace")
    .option("-n, --lines <number>", "Number of lines to retrieve", (val) =>
      parseInt(val, 10)
    )
    .option("-f, --follow", "Follow log output (not implemented yet)")
    .option(
      "--since <time>",
      "Show logs since timestamp (e.g., 2023-01-01T00:00:00Z, 1h, 30m)"
    )
    .option("-t, --timestamps", "Show timestamps in log output")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("--verbose", "Show detailed output")
    .action(async (serverId, options) => {
      try {
        await handleServerLogs(serverId, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Server logs failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Server Claude config command
  serverCommand
    .command("claude-config <server-id>")
    .alias("config")
    .description("Generate Claude Desktop MCP configuration for a server")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option(
      "--insecure",
      "Add --insecure flag for development servers with self-signed certificates"
    )
    .option("--copy", "Show instructions for copying to clipboard")
    .option("--verbose", "Show detailed output")
    .action(async (serverId, options) => {
      try {
        await handleServerClaudeConfig(serverId, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Claude config generation failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Secrets command group
  const secretsCommand = program
    .command("secrets")
    .description("Workspace secrets management commands");

  // Secrets list command
  secretsCommand
    .command("list")
    .alias("ls")
    .description("List secrets in the active workspace")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("-v, --verbose", "Show detailed information")
    .action(async (options) => {
      try {
        await handleSecretsList(options);
      } catch (error) {
        console.error(
          chalk.red(
            "Secrets listing failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Secrets set command
  secretsCommand
    .command("set <key=value>")
    .description("Set or update a secret in the workspace")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("--verbose", "Show detailed output")
    .action(async (keyValue, options) => {
      try {
        await handleSecretsSet(keyValue, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Secret set failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Secrets unset command
  secretsCommand
    .command("unset <key>")
    .alias("rm")
    .description("Remove a secret from the workspace")
    .option("-f, --force", "Skip confirmation prompt")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("--verbose", "Show detailed output")
    .action(async (key, options) => {
      try {
        await handleSecretsUnset(key, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Secret removal failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // MCP command group
  const mcpCommand = program
    .command("mcp")
    .description("MCP protocol client commands");

  // MCP connect command
  mcpCommand
    .command("connect <server-id>")
    .description("Connect to and initialize an MCP server")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("--timeout <ms>", "Connection timeout in milliseconds", (val) =>
      parseInt(val, 10)
    )
    .option("--verbose", "Show detailed output")
    .action(async (serverId, options) => {
      try {
        await handleMCPConnect(serverId, options);
      } catch (error) {
        console.error(
          chalk.red(
            "MCP connect failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // MCP tools command
  mcpCommand
    .command("tools <server-id>")
    .description("List tools available on an MCP server")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option("--timeout <ms>", "Connection timeout in milliseconds", (val) =>
      parseInt(val, 10)
    )
    .option("--verbose", "Show detailed tool schemas")
    .action(async (serverId, options) => {
      try {
        await handleMCPTools(serverId, options);
      } catch (error) {
        console.error(
          chalk.red(
            "MCP tools failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // MCP call command
  mcpCommand
    .command("call <server-id> <tool-name> [args...]")
    .description("Call a tool on an MCP server")
    .option(
      "-w, --workspace <id>",
      "Target workspace ID (defaults to active workspace)"
    )
    .option(
      "--arg <key=value>",
      "Tool argument (can be used multiple times)",
      (value: string, previous: string[] = []) => [...previous, value]
    )
    .option("--json <json>", "Tool arguments as JSON string")
    .option("--timeout <ms>", "Connection timeout in milliseconds", (val) =>
      parseInt(val, 10)
    )
    .option("--verbose", "Show detailed output")
    .action(async (serverId, toolName, args, options) => {
      try {
        await handleMCPCall(serverId, toolName, args, options);
      } catch (error) {
        console.error(
          chalk.red(
            "MCP call failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Token command group
  const tokenCommand = program
    .command("token")
    .description("Token management commands");

  // Token refresh command
  tokenCommand
    .command("refresh [workspace]")
    .description("Refresh workspace token using NimbleTools JWT")
    .option("-w, --workspace <id>", "Target workspace ID or name")
    .option("--print", "Print the full token (use with caution)")
    .option(
      "--expires-in <seconds>",
      "Token expires in N seconds",
      (val: string) => parseInt(val, 10)
    )
    .option(
      "--expires-at <timestamp>",
      "Token expires at unix timestamp",
      (val: string) => parseInt(val, 10)
    )
    .option("--no-expiry", "Create a non-expiring token (default)")
    .action(async (workspace, options) => {
      try {
        await handleTokenRefresh(workspace, options);
      } catch (error) {
        console.error(
          chalk.red(
            "Token refresh failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Token show command
  tokenCommand
    .command("show [workspace]")
    .description("Show workspace token information")
    .action(async (workspace) => {
      try {
        await handleTokenShow(workspace);
      } catch (error) {
        console.error(
          chalk.red(
            "Token show failed:",
            error instanceof Error ? error.message : "Unknown error"
          )
        );
        process.exit(1);
      }
    });

  // Global error handling
  program.exitOverride((err) => {
    if (err.code === "commander.help") {
      process.exit(0);
    }
    if (err.code === "commander.version") {
      process.exit(0);
    }
    if (err.code === "commander.unknownCommand") {
      console.error(chalk.red(`Unknown command: ${err.message}`));
      console.log(
        chalk.yellow("\\nRun `ntcli --help` to see available commands")
      );
      process.exit(1);
    }
    throw err;
  });

  // Handle no arguments
  if (process.argv.length <= 2) {
    program.help();
  }

  // Parse command line arguments
  try {
    // Check for global flags before parsing  
    if (process.argv.includes("--debug")) {
      process.env.NTCLI_DEBUG = "1";
    }

    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    } else {
      console.error(chalk.red("An unexpected error occurred"));
    }
    process.exit(1);
  }
}

// Handle unhandled promise rejections and exceptions
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    chalk.red("Unhandled Rejection at:"),
    promise,
    chalk.red("reason:"),
    reason
  );
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error(chalk.red("Uncaught Exception:"), error);
  process.exit(1);
});

// Handle SIGINT (Ctrl+C) gracefully
process.on("SIGINT", () => {
  console.log(chalk.yellow("\\n\\n🛑 Process interrupted by user"));
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
