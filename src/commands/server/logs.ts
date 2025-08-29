import chalk from 'chalk';
import ora from 'ora';
import { ServerCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * Get logs for a server in the workspace
 */
export async function handleServerLogs(
  serverId: string,
  options: ServerCommandOptions & {
    lines?: number;
    follow?: boolean;
    since?: string;
    timestamps?: boolean;
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
    
    // Get token manager
    const tokenManager = new TokenManager();

    // Get authenticated API client for workspace
    const authResult = await workspaceManager.getAuthenticatedClient(workspaceId);
    if (!authResult) {
      spinner.fail('❌ No valid workspace token');
      console.log(chalk.yellow('   Please create a new workspace with `ntcli workspace create <name>`'));
      process.exit(1);
    }

    const { client: apiClient, workspaceId: finalWorkspaceId } = authResult;
    
    // Fetch server logs
    const logsRequest: any = {};
    if (options.lines !== undefined) logsRequest.lines = options.lines;
    if (options.follow !== undefined) logsRequest.follow = options.follow;
    if (options.since !== undefined) logsRequest.since = options.since;
    if (options.timestamps !== undefined) logsRequest.timestamps = options.timestamps;
    
    const logsResponse = await apiClient.getServerLogs(finalWorkspaceId, serverId, logsRequest);
    
    spinner.succeed(`📋 Retrieved ${logsResponse.logs.length} log lines for ${serverId}`);
    
    console.log();
    console.log(chalk.blue.bold(`📋 Server Logs: ${serverId}`));
    console.log(chalk.gray(`   Workspace: ${activeWorkspace.workspace_name || activeWorkspace.workspace_id} (${workspaceId})`));
    
    if (options.lines) {
      console.log(chalk.gray(`   Lines: Last ${options.lines}`));
    }
    if (options.since) {
      console.log(chalk.gray(`   Since: ${options.since}`));
    }
    if (logsResponse.truncated) {
      console.log(chalk.yellow('   ⚠️  Logs truncated - use --lines to get more'));
    }
    
    console.log();
    
    // Display logs
    if (logsResponse.logs.length === 0) {
      console.log(chalk.gray('   No logs available for this server'));
      console.log();
      console.log(chalk.cyan('💡 Tips:'));
      console.log(chalk.cyan('   • Check if the server is running: ntcli server list'));
      console.log(chalk.cyan('   • Try with more lines: ntcli server logs <server-id> --lines 100'));
    } else {
      // Print each log line
      logsResponse.logs.forEach(line => {
        // Simple log level coloring
        if (line.includes('ERROR') || line.includes('FATAL')) {
          console.log(chalk.red(line));
        } else if (line.includes('WARN')) {
          console.log(chalk.yellow(line));
        } else if (line.includes('INFO')) {
          console.log(chalk.blue(line));
        } else if (line.includes('DEBUG')) {
          console.log(chalk.gray(line));
        } else {
          console.log(line);
        }
      });
      
      console.log();
      console.log(chalk.cyan('💡 Options:'));
      console.log(chalk.cyan(`   ntcli server logs ${serverId} --lines 100        # Get more lines`));
      console.log(chalk.cyan(`   ntcli server logs ${serverId} --timestamps       # Show timestamps`));
      console.log(chalk.cyan(`   ntcli server logs ${serverId} --since 1h         # Logs from last hour`));
    }
    
  } catch (error) {
    spinner.fail('❌ Failed to fetch server logs');
    
    if (error instanceof ManagementApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli token refresh` to refresh your workspace token'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow(`   💡 Server '${serverId}' not found in this workspace`));
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