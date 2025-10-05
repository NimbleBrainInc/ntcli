import chalk from 'chalk';
import ora from 'ora';
import { ServerCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
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
    
    // Extract data from the actual API response structure
    const serverIdFromResponse = (server as any).id || server.server_id || serverId;
    
    // Smart status determination
    let serverStatus = 'Unknown';
    if (typeof server.status === 'object') {
      const statusObj = server.status as any;
      const phase = statusObj?.phase;
      const deploymentReady = statusObj?.deployment_ready;
      const replicas = statusObj?.replicas || 0;
      const readyReplicas = statusObj?.ready_replicas || 0;
      
      // If deployment is ready and replicas are up, consider it running even if phase is "Unknown"
      if (deploymentReady && replicas > 0 && readyReplicas === replicas) {
        serverStatus = 'Running';
      } else if (phase && phase !== 'Unknown') {
        serverStatus = phase;
      } else if (deploymentReady) {
        serverStatus = 'Ready';
      } else {
        serverStatus = 'Unknown';
      }
    } else {
      serverStatus = server.status || 'Unknown';
    }
    const currentReplicas = (server.spec as any)?.replicas || (server.status as any)?.replicas || 'Unknown';
    const readyReplicas = (server.status as any)?.ready_replicas || 'Unknown';
    const containerImage = (server.spec as any)?.container?.image || server.image || 'Unknown';
    const serviceEndpoint = (server.status as any)?.service_endpoint;
    const deploymentReady = (server.status as any)?.deployment_ready;

    // Header with name and status
    const statusIcon = getStatusIcon(serverStatus);
    console.log(`${statusIcon}${chalk.cyan.bold(server.name)} ${getStatusColor(serverStatus)}[${serverStatus}]${chalk.reset()}`);
    console.log();
    
    // Server information
    console.log(chalk.blue.bold('📊 Server Information'));
    console.log(`  ${chalk.gray('Server ID:')} ${serverIdFromResponse}`);
    console.log(`  ${chalk.gray('Name:')} ${server.name}`);
    console.log(`  ${chalk.gray('Status:')} ${statusIcon}${getStatusColor(serverStatus)}${serverStatus}${chalk.reset()}`);
    console.log(`  ${chalk.gray('Image:')} ${containerImage}`);
    console.log(`  ${chalk.gray('Namespace:')} ${server.namespace}`);
    if (server.created) {
      console.log(`  ${chalk.gray('Created:')} ${new Date(server.created).toLocaleString()}`);
    }
    console.log();
    
    // Deployment status
    console.log(chalk.blue.bold('🚀 Deployment'));
    console.log(`  ${chalk.gray('Deployment Ready:')} ${deploymentReady ? '✅ Yes' : '❌ No'}`);
    if (serviceEndpoint) {
      console.log(`  ${chalk.gray('Service Endpoint:')} ${chalk.cyan(serviceEndpoint)}`);
    }
    console.log();
    
    // Scaling information
    console.log(chalk.blue.bold('⚡ Scaling'));
    console.log(`  ${chalk.gray('Current Replicas:')} ${currentReplicas}`);
    console.log(`  ${chalk.gray('Ready Replicas:')} ${readyReplicas}`);
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
    
    if (error instanceof ManagementApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your authentication'));
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
  const normalizedStatus = status?.toString().trim().toLowerCase();
  
  switch (normalizedStatus) {
    case 'running':
      return '🟢 ';
    case 'ready':
      return '🟢 '; // Also show ready as green
    case 'pending':
    case 'scaling':
      return '🟡 ';
    case 'stopped':
      return '⚪ ';
    case 'error':
    case 'failed':
      return '🔴 ';
    case 'unknown':
      return '⚪ '; // Show as neutral for unknown status
    default:
      return '❓ ';
  }
}


/**
 * Get colored status indicator
 */
function getStatusColor(status: string): string {
  const normalizedStatus = status?.toString().trim().toLowerCase();
  
  switch (normalizedStatus) {
    case 'running':
      return chalk.green('');
    case 'ready':
      return chalk.green(''); // Also show ready as green
    case 'pending':
    case 'scaling':
      return chalk.yellow('');
    case 'stopped':
      return chalk.gray('');
    case 'error':
    case 'failed':
      return chalk.red('');
    case 'unknown':
      return chalk.cyan(''); // Use cyan for unknown to differentiate from stopped
    default:
      return chalk.gray('');
  }
}