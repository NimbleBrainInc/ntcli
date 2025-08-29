import chalk from 'chalk';
import ora from 'ora';
import { ServerCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * List servers in the active workspace
 */
export async function handleServerList(
  options: ServerCommandOptions = {}
): Promise<void> {
  const spinner = ora('📦 Fetching workspace servers...').start();
  
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
      console.log(chalk.yellow('   Workspace tokens are created when you create a new workspace.'));
      console.log(chalk.cyan('   Please create a new workspace: `ntcli workspace create my-workspace`'));
      process.exit(1);
    }

    const { client: apiClient, workspaceId: finalWorkspaceId } = authResult;
    
    // Fetch servers from API
    const response = await apiClient.listWorkspaceServers(finalWorkspaceId);
    const servers = response.servers;
    
    spinner.succeed(`📦 Found ${servers.length} server${servers.length !== 1 ? 's' : ''}`);
    
    if (servers.length === 0) {
      console.log();
      console.log(chalk.yellow('No servers deployed in this workspace.'));
      console.log();
      console.log(chalk.cyan('💡 Deploy a server from the registry:'));
      console.log(chalk.cyan('   ntcli registry list                    # Browse available servers'));
      console.log(chalk.cyan('   ntcli server deploy <server-id>       # Deploy a server'));
      return;
    }
    
    console.log();
    console.log(chalk.blue.bold(`🏢 Workspace: ${activeWorkspace.workspace_name}`));
    console.log();
    
    // Display servers in a table format
    if (options.verbose) {
      // Detailed view
      for (const server of servers) {
        const statusIcon = getStatusIcon(server.status);
        const serverId = server.id || (server as any).server_id;
        
        console.log(`${statusIcon}${chalk.cyan.bold(server.name)}`);
        console.log(`  ${chalk.gray('ID:')} ${serverId}`);
        console.log(`  ${chalk.gray('Status:')} ${getStatusColor(server.status)}${server.status}${chalk.reset()}`);
        console.log(`  ${chalk.gray('Image:')} ${server.image || 'N/A'}`);
        console.log(`  ${chalk.gray('Replicas:')} ${server.replicas || 'N/A'}`);
        console.log(`  ${chalk.gray('Namespace:')} ${server.namespace}`);
        if (server.created) {
          console.log(`  ${chalk.gray('Created:')} ${new Date(server.created).toLocaleString()}`);
        }
        console.log();
      }
    } else {
      // Compact view
      console.log(chalk.gray('NAME').padEnd(25) + 
                  chalk.gray('STATUS').padEnd(15) + 
                  chalk.gray('REPLICAS').padEnd(12) + 
                  chalk.gray('IMAGE').padEnd(20) + 
                  chalk.gray('CREATED'));
      console.log(chalk.gray('─'.repeat(80)));
      
      for (const server of servers) {
        const statusIcon = getStatusIcon(server.status);
        const name = server.name.substring(0, 22);
        const status = `${statusIcon}${server.status}`.padEnd(15);
        const replicas = `${server.replicas || 'N/A'}`.padEnd(12);
        const image = `${server.image || 'N/A'}`.substring(0, 18).padEnd(20);
        const created = server.created ? new Date(server.created).toLocaleDateString() : 'N/A';
        
        console.log(`${name.padEnd(25)}${status}${replicas}${image}${created}`);
      }
    }
    
    console.log();
    console.log(chalk.gray(`Total: ${servers.length} server${servers.length !== 1 ? 's' : ''} in workspace ${activeWorkspace.workspace_name}`));
    console.log();
    console.log(chalk.cyan('💡 Use `ntcli server info <server-id>` for detailed server information'));
    console.log(chalk.cyan('💡 Use `ntcli server deploy <server-id>` to deploy a new server'));
    
  } catch (error) {
    spinner.fail('❌ Failed to fetch servers');
    
    if (error instanceof ManagementApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli token refresh` to refresh your workspace token'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow('   💡 Workspace not found or not accessible'));
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
  // Normalize status (trim whitespace and convert to lowercase)
  const normalizedStatus = status?.toString().trim().toLowerCase();
  
  switch (normalizedStatus) {
    case 'running':
      return '🟢 ';
    case 'pending':
      return '🟡 ';
    case 'stopped':
      return '⚪ ';
    case 'error':
    case 'failed':
      return '🔴 ';
    case 'scaling':
      return '⚡ ';
    default:
      // For debugging: log unknown status
      if (process.env.NTCLI_DEBUG) {
        console.error(`[DEBUG] Unknown server status: "${status}" (normalized: "${normalizedStatus}")`);
      }
      return '❓ ';
  }
}

/**
 * Get health icon for server health
 */
function getHealthIcon(health?: string): string {
  switch (health) {
    case 'healthy':
      return '✅ ';
    case 'unhealthy':
      return '❌ ';
    case 'unknown':
    default:
      return '❓ ';
  }
}

/**
 * Get colored status indicator
 */
function getStatusColor(status: string): string {
  // Normalize status (trim whitespace and convert to lowercase)
  const normalizedStatus = status?.toString().trim().toLowerCase();
  
  switch (normalizedStatus) {
    case 'running':
      return chalk.green('');
    case 'pending':
      return chalk.yellow('');
    case 'stopped':
      return chalk.gray('');
    case 'error':
    case 'failed':
      return chalk.red('');
    case 'scaling':
      return chalk.cyan('');
    default:
      return chalk.gray('');
  }
}