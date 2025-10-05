import chalk from 'chalk';
import ora from 'ora';
import { ServerCommandOptions, ScaleServerRequest } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * Scale a server in the workspace
 */
export async function handleServerScale(
  serverId: string,
  replicas: string,
  options: ServerCommandOptions = {}
): Promise<void> {
  // Parse and validate replica count
  const replicaCount = parseInt(replicas, 10);
  if (isNaN(replicaCount)) {
    console.error(chalk.red('❌ Invalid replica count provided'));
    console.log(chalk.yellow('   Please provide a valid number between 1 and 4'));
    console.log(chalk.cyan('   Example: ntcli server scale echo 3'));
    process.exit(1);
  }
  
  if (replicaCount < 1 || replicaCount > 4) {
    console.error(chalk.red('❌ Replica count must be between 1 and 4'));
    console.log(chalk.yellow('   Please provide a number between 1 and 4'));
    console.log(chalk.cyan('   Example: ntcli server scale echo 3'));
    process.exit(1);
  }

  const spinner = ora(`⚡ Scaling server ${serverId}...`).start();
  
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

    // Build scaling request
    const scaleRequest: ScaleServerRequest = {
      replicas: replicaCount
    };
    
    // Scale server
    const response = await apiClient.scaleServer(finalWorkspaceId, serverId, scaleRequest);
    const server = response.server || response;
    const serverName = (response.server?.name) || response.server_id || serverId;
    
    spinner.succeed(`⚡ Server scaled: ${serverName}`);
    
    console.log();
    console.log(chalk.green.bold('✅ Scaling operation successful!'));
    console.log();
    
    // Show what changed
    console.log(chalk.blue.bold('🔄 Changes Applied'));
    const replicas = server.replicas || replicaCount;
    console.log(`  ${chalk.gray('Replicas:')} ${chalk.green(`→ ${replicas}`)}`);
    console.log();
    
    // Current server status
    console.log(chalk.blue.bold('📦 Current Status'));
    console.log(`  ${chalk.gray('Server:')} ${serverName}`);
    if (response.server?.version) {
      console.log(`  ${chalk.gray('Version:')} ${response.server.version}`);
    }
    if (server.status) {
      console.log(`  ${chalk.gray('Status:')} ${getStatusColor(server.status)}${server.status}${chalk.reset()}`);
    }
    
    const currentReplicas = server.replicas || 'N/A';
    const maxReplicas = response.server?.max_replicas || 4; // Default max is 4
    console.log(`  ${chalk.gray('Current Replicas:')} ${currentReplicas} ${chalk.dim('(max: ' + maxReplicas + ')')}`);
    
    if (response.server?.cpu_request) {
      console.log(`  ${chalk.gray('CPU Request:')} ${response.server.cpu_request}`);
    }
    if (response.server?.cpu_limit) {
      console.log(`  ${chalk.gray('CPU Limit:')} ${response.server.cpu_limit}`);
    }
    if (response.server?.memory_request) {
      console.log(`  ${chalk.gray('Memory Request:')} ${response.server.memory_request}`);
    }
    if (response.server?.memory_limit) {
      console.log(`  ${chalk.gray('Memory Limit:')} ${response.server.memory_limit}`);
    }
    
    if (response.server?.service_url) {
      console.log(`  ${chalk.gray('Service URL:')} ${chalk.cyan(response.server.service_url)}`);
    }
    
    console.log();
    if (response.scaling_operation_id) {
      console.log(chalk.gray(`Scaling Operation ID: ${response.scaling_operation_id}`));
    }
    console.log(chalk.gray(`Workspace: ${activeWorkspace.workspace_name} (${finalWorkspaceId})`));
    console.log();
    
    if (options.wait) {
      console.log(chalk.yellow('⏳ Waiting for scaling operation to complete...'));
      console.log(chalk.cyan('   Use `ntcli server info ${serverId}` to check current status'));
    } else {
      console.log(chalk.cyan('💡 Use `ntcli server info ${serverId}` to monitor the scaling operation'));
      console.log(chalk.cyan('💡 Use `ntcli server list` to see all servers in this workspace'));
    }
    
  } catch (error) {
    spinner.fail('❌ Failed to scale server');
    
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
      } else if (error.isValidationError()) {
        console.log(chalk.yellow('   💡 Check your replica count:'));
        console.log(chalk.cyan('      - Replicas must be between 1 and 4'));
        console.log(chalk.cyan('      - Example: ntcli server scale echo 3'));
      } else if (error.statusCode === 409) {
        console.log(chalk.yellow('   💡 Server may be in a transitional state. Try again in a moment.'));
      } else if (error.statusCode === 503) {
        console.log(chalk.yellow('   💡 Scaling service may be temporarily unavailable. Try again later.'));
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