import chalk from 'chalk';
import ora from 'ora';
import { ServerCommandOptions, RestartServerRequest } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * Restart a server in the workspace
 */
export async function handleServerRestart(
  serverId: string,
  options: ServerCommandOptions & { force?: boolean } = {}
): Promise<void> {
  const spinner = ora(`🔄 Restarting server ${serverId}...`).start();

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

    // Build restart request
    const restartRequest: RestartServerRequest = {};
    if (options.force !== undefined) {
      restartRequest.force = options.force;
    }

    // Restart server
    const response = await apiClient.restartServer(finalWorkspaceId, serverId, restartRequest);
    const server = response.server || response;
    const serverName = (response.server?.name) || response.server_id || serverId;

    spinner.succeed(`🔄 Server restart initiated: ${serverName}`);

    console.log();
    console.log(chalk.green.bold('✅ Restart operation initiated!'));
    console.log();

    // Show restart status
    console.log(chalk.blue.bold('🔄 Restart Status'));
    console.log(`  ${chalk.gray('Server:')} ${serverName}`);
    console.log(`  ${chalk.gray('Status:')} ${chalk.yellow('Restarting...')}`);
    if (response.message) {
      console.log(`  ${chalk.gray('Message:')} ${response.message}`);
    }
    console.log();

    // Current server information
    if (response.server && typeof response.server === 'object') {
      console.log(chalk.blue.bold('📦 Server Information'));
      console.log(`  ${chalk.gray('Server ID:')} ${response.server_id || serverId}`);

      if (response.server.version) {
        console.log(`  ${chalk.gray('Version:')} ${response.server.version}`);
      }

      const replicas = response.server.replicas || 1;
      const maxReplicas = response.server.max_replicas || 4;
      console.log(`  ${chalk.gray('Replicas:')} ${replicas} ${chalk.dim('(max: ' + maxReplicas + ')')}`);

      if (response.server.cpu_request) {
        console.log(`  ${chalk.gray('CPU Request:')} ${response.server.cpu_request}`);
      }
      if (response.server.cpu_limit) {
        console.log(`  ${chalk.gray('CPU Limit:')} ${response.server.cpu_limit}`);
      }
      if (response.server.memory_request) {
        console.log(`  ${chalk.gray('Memory Request:')} ${response.server.memory_request}`);
      }
      if (response.server.memory_limit) {
        console.log(`  ${chalk.gray('Memory Limit:')} ${response.server.memory_limit}`);
      }

      if (response.server.service_url) {
        console.log(`  ${chalk.gray('Service URL:')} ${chalk.cyan(response.server.service_url)}`);
      }

      console.log();
    }

    if (response.restart_operation_id) {
      console.log(chalk.gray(`Restart Operation ID: ${response.restart_operation_id}`));
    }
    console.log(chalk.gray(`Workspace: ${activeWorkspace.workspace_name} (${finalWorkspaceId})`));
    console.log();

    console.log(chalk.cyan('💡 Use `ntcli server info ${serverId}` to check server status'));
    console.log(chalk.cyan('💡 Use `ntcli server logs ${serverId}` to view server logs'));

  } catch (error) {
    spinner.fail('❌ Failed to restart server');

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
      } else if (error.statusCode === 409) {
        console.log(chalk.yellow('   💡 Server may already be restarting or in a transitional state'));
        console.log(chalk.cyan('   💡 Use `ntcli server info ${serverId}` to check current status'));
      } else if (error.statusCode === 503) {
        console.log(chalk.yellow('   💡 Restart service may be temporarily unavailable. Try again later.'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }

    process.exit(1);
  }
}