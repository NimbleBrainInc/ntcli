import chalk from 'chalk';
import ora from 'ora';
import { ServerCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * Show detailed information about a server in the workspace
 */
export async function handleServerInfo(
  serverId: string,
  options: ServerCommandOptions = {}
): Promise<void> {
  const spinner = ora(`🔍 Fetching server details for ${serverId}...`).start();
  
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
    
    // Get authenticated API client for this workspace
    const authResult = await workspaceManager.getAuthenticatedClient(workspaceId);
    if (!authResult) {
      spinner.fail('❌ No valid workspace token');
      console.log(chalk.yellow('   This workspace does not have a valid access token.'));
      console.log(chalk.cyan('   Please create a new workspace: `ntcli workspace create my-workspace`'));
      process.exit(1);
    }

    const { client: apiClient, workspaceId: finalWorkspaceId } = authResult;
    
    // Fetch server details from API
    const server = await apiClient.getWorkspaceServer(finalWorkspaceId, serverId);
    
    spinner.succeed(`📦 Server details: ${server.name}`);
    
    console.log();
    
    // Header with name and status
    const statusIcon = getStatusIcon(server.status);
    console.log(`${statusIcon}${chalk.cyan.bold(server.name)} ${getStatusColor(server.status)}[${server.status}]${chalk.reset()}`);
    console.log();
    
    // Server information
    console.log(chalk.blue.bold('📊 Server Information'));
    console.log(`  ${chalk.gray('Server ID:')} ${server.server_id}`);
    console.log(`  ${chalk.gray('Status:')} ${statusIcon}${getStatusColor(server.status)}${server.status}${chalk.reset()}`);
    console.log(`  ${chalk.gray('Created:')} ${new Date(server.created).toLocaleString()}`);
    console.log();
    
    // Scaling information
    console.log(chalk.blue.bold('⚡ Scaling'));
    console.log(`  ${chalk.gray('Current Replicas:')} ${server.replicas}`);
    console.log(`  ${chalk.gray('Ready Replicas:')} ${server.ready_replicas}`);
    console.log(`  ${chalk.gray('Max Replicas:')} 4`); // Our enforced maximum
    console.log();
    
    
    // Footer info
    console.log(chalk.gray(`Workspace: ${activeWorkspace.workspace_name} (${finalWorkspaceId})`));
    console.log();
    console.log(chalk.cyan(`💡 Use \`ntcli server scale ${serverId} <1-4>\` to change replica count`));
    console.log(chalk.cyan(`💡 Use \`ntcli server remove ${serverId}\` to remove this server`));
    console.log(chalk.cyan('💡 Use `ntcli server list` to see all servers in this workspace'));
    
  } catch (error) {
    spinner.fail('❌ Failed to fetch server details');
    
    if (error instanceof ApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli token refresh` to refresh your workspace token'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow(`   💡 Server '${serverId}' not found in this workspace`));
        console.log(chalk.cyan('   💡 Use `ntcli server list` to see deployed servers'));
      } else if (error.statusCode === 503) {
        console.log(chalk.yellow('   💡 Service may be temporarily unavailable. Try again later.'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}

/**
 * Get status icon for server status
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'running':
      return '🟢 ';
    case 'pending':
    case 'scaling':
      return '🟡 ';
    case 'stopped':
      return '⚪ ';
    case 'error':
      return '🔴 ';
    default:
      return '❓ ';
  }
}


/**
 * Get colored status indicator
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return chalk.green('');
    case 'pending':
    case 'scaling':
      return chalk.yellow('');
    case 'stopped':
      return chalk.gray('');
    case 'error':
      return chalk.red('');
    default:
      return chalk.gray('');
  }
}