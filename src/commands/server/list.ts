import chalk from 'chalk';
import ora from 'ora';
import { ServerCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
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
        const healthIcon = getHealthIcon(server.health_status);
        
        console.log(`${statusIcon}${chalk.cyan.bold(server.name)} ${chalk.gray('v' + (server.version || 'latest'))}`);
        console.log(`  ${chalk.gray('ID:')} ${server.server_id}`);
        console.log(`  ${chalk.gray('Status:')} ${getStatusColor(server.status)}${server.status}${chalk.reset()}`);
        console.log(`  ${chalk.gray('Health:')} ${healthIcon}${server.health_status || 'unknown'}`);
        console.log(`  ${chalk.gray('Image:')} ${server.image || 'N/A'}`);
        console.log(`  ${chalk.gray('Replicas:')} ${server.ready_replicas}/${server.replicas}`);
        console.log(`  ${chalk.gray('Port:')} ${server.port}`);
        console.log(`  ${chalk.gray('Namespace:')} ${server.namespace}`);
        console.log(`  ${chalk.gray('Created:')} ${new Date(server.created).toLocaleString()}`);
        console.log();
      }
    } else {
      // Compact view
      console.log(chalk.gray('NAME').padEnd(25) + 
                  chalk.gray('STATUS').padEnd(12) + 
                  chalk.gray('REPLICAS').padEnd(12) + 
                  chalk.gray('VERSION').padEnd(12) + 
                  chalk.gray('CREATED'));
      console.log(chalk.gray('─'.repeat(80)));
      
      for (const server of servers) {
        const statusIcon = getStatusIcon(server.status);
        const name = server.name.substring(0, 22);
        const status = `${statusIcon}${server.status}`.padEnd(12);
        const replicas = `${server.ready_replicas}/${server.replicas}`.padEnd(12);
        const version = `v${server.version || 'latest'}`.substring(0, 10).padEnd(12);
        const created = new Date(server.created).toLocaleDateString();
        
        console.log(`${name.padEnd(25)}${status}${replicas}${version}${created}`);
      }
    }
    
    console.log();
    console.log(chalk.gray(`Total: ${servers.length} server${servers.length !== 1 ? 's' : ''} in workspace ${activeWorkspace.workspace_name}`));
    console.log();
    console.log(chalk.cyan('💡 Use `ntcli server info <server-id>` for detailed server information'));
    console.log(chalk.cyan('💡 Use `ntcli server deploy <server-id>` to deploy a new server'));
    
  } catch (error) {
    spinner.fail('❌ Failed to fetch servers');
    
    if (error instanceof ApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your authentication'));
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
  switch (status) {
    case 'running':
      return '🟢 ';
    case 'pending':
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
  switch (status) {
    case 'running':
      return chalk.green('');
    case 'pending':
      return chalk.yellow('');
    case 'stopped':
      return chalk.gray('');
    case 'error':
      return chalk.red('');
    default:
      return chalk.gray('');
  }
}