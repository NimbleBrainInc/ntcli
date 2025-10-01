import chalk from 'chalk';
import ora from 'ora';
import { ServerCommandOptions, ServerLogEntry } from '../../types/index.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * Parse relative time strings like "1h", "30m", "2d" into ISO 8601 format
 */
function parseRelativeTime(timeStr: string): string {
  const now = new Date();
  const match = timeStr.match(/^(\d+)([smhd])$/);

  if (!match) {
    // Assume it's already in ISO format or another format
    return timeStr;
  }

  const [, amount, unit] = match;
  const value = parseInt(amount!, 10);

  switch (unit) {
    case 's':
      now.setSeconds(now.getSeconds() - value);
      break;
    case 'm':
      now.setMinutes(now.getMinutes() - value);
      break;
    case 'h':
      now.setHours(now.getHours() - value);
      break;
    case 'd':
      now.setDate(now.getDate() - value);
      break;
  }

  return now.toISOString();
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(timestamp: string, showTimestamps: boolean): string {
  if (!showTimestamps) {
    return '';
  }

  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');

  return chalk.gray(`[${hours}:${minutes}:${seconds}.${ms}] `);
}

/**
 * Format and colorize log level
 */
function formatLogLevel(level: string): string {
  switch (level.toLowerCase()) {
    case 'debug':
      return chalk.gray('[DEBUG]');
    case 'info':
      return chalk.blue('[INFO] ');
    case 'warning':
    case 'warn':
      return chalk.yellow('[WARN] ');
    case 'error':
      return chalk.red('[ERROR]');
    case 'critical':
    case 'fatal':
      return chalk.redBright('[FATAL]');
    default:
      return `[${level.toUpperCase()}]`;
  }
}

/**
 * Format a log entry for display
 */
function formatLogEntry(entry: ServerLogEntry, options: { timestamps?: boolean }): string {
  const timestamp = formatTimestamp(entry.timestamp, options.timestamps ?? false);
  const level = formatLogLevel(entry.level);
  const podInfo = entry.pod_name ? chalk.gray(` [${entry.pod_name}]`) : '';

  // Colorize message based on level
  let messageColor;
  switch (entry.level.toLowerCase()) {
    case 'error':
      messageColor = chalk.red;
      break;
    case 'warning':
      messageColor = chalk.yellow;
      break;
    case 'debug':
      messageColor = chalk.gray;
      break;
    case 'critical':
      messageColor = chalk.redBright;
      break;
    default:
      messageColor = (s: string) => s;
  }

  return `${timestamp}${level}${podInfo} ${messageColor(entry.message)}`;
}

/**
 * Get logs for a server in the workspace
 */
export async function handleServerLogs(
  serverId: string,
  options: ServerCommandOptions & {
    limit?: number;
    follow?: boolean;
    since?: string;
    until?: string;
    level?: 'debug' | 'info' | 'warning' | 'error' | 'critical';
    pod?: string;
    timestamps?: boolean;
    json?: boolean;
  } = {}
): Promise<void> {
  const spinner = ora(`📋 Fetching logs for server ${serverId}...`).start();

  try {
    // Get active workspace
    const workspaceManager = new WorkspaceManager();
    const activeWorkspace = await workspaceManager.getActiveWorkspace();

    if (!activeWorkspace) {
      spinner.fail('❌ No active workspace');
      console.log(chalk.yellow('   Please create and activate a workspace first:'));
      console.log(chalk.cyan('   ntcli workspace create my-workspace'));
      console.log(chalk.cyan('   ntcli workspace switch my-workspace'));
      process.exit(1);
    }

    const workspaceId = options.workspace || activeWorkspace.workspace_id;

    // Get authenticated API client for workspace
    const authResult = await workspaceManager.getAuthenticatedClient(workspaceId);
    if (!authResult) {
      spinner.fail('❌ No valid workspace token');
      console.log(chalk.yellow('   Please create a new workspace with `ntcli workspace create <name>`'));
      process.exit(1);
    }

    const { client: apiClient, workspaceId: finalWorkspaceId } = authResult;

    // Build logs request
    const logsRequest: any = {};

    if (options.limit !== undefined) {
      logsRequest.limit = options.limit;
    }

    if (options.since !== undefined) {
      logsRequest.since = parseRelativeTime(options.since);
    }

    if (options.until !== undefined) {
      logsRequest.until = parseRelativeTime(options.until);
    }

    if (options.level !== undefined) {
      logsRequest.level = options.level;
    }

    if (options.pod !== undefined) {
      logsRequest.pod_name = options.pod;
    }

    // Fetch server logs
    const logsResponse = await apiClient.getServerLogs(finalWorkspaceId, serverId, logsRequest);

    spinner.succeed(`📋 Retrieved ${logsResponse.count} log entries for ${serverId}`);

    // If JSON output requested, print and return
    if (options.json) {
      console.log(JSON.stringify(logsResponse, null, 2));
      return;
    }

    // Display header
    console.log();
    console.log(chalk.blue.bold(`📋 Server Logs: ${logsResponse.server_id}`));
    console.log(chalk.gray(`   Workspace: ${activeWorkspace.workspace_name || activeWorkspace.workspace_id}`));

    // Display filters if applied
    if (options.limit) {
      console.log(chalk.gray(`   Limit: ${options.limit} entries`));
    }
    if (options.since) {
      console.log(chalk.gray(`   Since: ${options.since}`));
    }
    if (options.until) {
      console.log(chalk.gray(`   Until: ${options.until}`));
    }
    if (options.level) {
      console.log(chalk.gray(`   Level: ${options.level} and above`));
    }
    if (options.pod) {
      console.log(chalk.gray(`   Pod: ${options.pod}`));
    }

    if (logsResponse.has_more) {
      console.log(chalk.yellow('   ⚠️  More logs available - increase --limit to see more'));
    }

    console.log();

    // Display logs
    if (logsResponse.logs.length === 0) {
      console.log(chalk.gray('   No logs found matching the specified filters'));
      console.log();
      console.log(chalk.cyan('💡 Tips:'));
      console.log(chalk.cyan('   • Check if the server is running: ntcli server list'));
      console.log(chalk.cyan('   • Try with a higher limit: ntcli server logs <server-id> --limit 100'));
      console.log(chalk.cyan('   • Remove time/level filters to see more logs'));
    } else {
      // Print each log entry
      logsResponse.logs.forEach(entry => {
        console.log(formatLogEntry(entry, { timestamps: options.timestamps || false }));
      });

      console.log();
      console.log(chalk.cyan('💡 Options:'));
      console.log(chalk.cyan(`   ntcli server logs ${serverId} --limit 100              # Get more logs`));
      console.log(chalk.cyan(`   ntcli server logs ${serverId} --timestamps             # Show timestamps`));
      console.log(chalk.cyan(`   ntcli server logs ${serverId} --since 1h               # Logs from last hour`));
      console.log(chalk.cyan(`   ntcli server logs ${serverId} --level error            # Only errors and above`));
      console.log(chalk.cyan(`   ntcli server logs ${serverId} --json                   # JSON output`));

      if (options.follow) {
        console.log();
        console.log(chalk.yellow('   ℹ️  Note: --follow mode is not yet implemented'));
      }
    }

  } catch (error) {
    spinner.fail('❌ Failed to fetch server logs');

    if (error instanceof ManagementApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));

      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your authentication'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow(`   💡 Server '${serverId}' not found or has no running pods`));
        console.log(chalk.cyan('   💡 Use `ntcli server list` to see deployed servers'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }

    process.exit(1);
  }
}