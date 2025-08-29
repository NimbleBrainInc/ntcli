import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import { ServerCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * Remove a server from the workspace
 */
export async function handleServerRemove(
  serverId: string,
  options: ServerCommandOptions = {}
): Promise<void> {
  try {
    // Get active workspace
    const workspaceManager = new WorkspaceManager();
    const activeWorkspace = await workspaceManager.getActiveWorkspace();
    
    if (!activeWorkspace) {
      console.error(chalk.red('❌ No active workspace'));
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
      console.error(chalk.red('❌ No valid workspace token'));
      console.log(chalk.yellow('   Please create a new workspace with `ntcli workspace create <name>`'));
      process.exit(1);
    }

    const { client: apiClient, workspaceId: finalWorkspaceId } = authResult;
    
    // Get server info first to show what will be removed
    let serverInfo;
    try {
      const serverResponse = await apiClient.getWorkspaceServer(finalWorkspaceId, serverId);
      serverInfo = serverResponse;
    } catch (error) {
      if (error instanceof ManagementApiError && error.isNotFoundError()) {
        console.error(chalk.red(`❌ Server '${serverId}' not found in workspace`));
        console.log(chalk.cyan('   💡 Use `ntcli server list` to see deployed servers'));
        process.exit(1);
      }
      // For other errors, continue with removal attempt
    }
    
    // Confirmation prompt (unless --force is used)
    if (!options.force) {
      console.log();
      console.log(chalk.yellow.bold('⚠️  Warning: Server Removal'));
      console.log();
      
      if (serverInfo) {
        const currentReplicas = serverInfo.replicas || (serverInfo.spec as any)?.replicas || (serverInfo.status as any)?.replicas || 'Unknown';
        const readyReplicas = serverInfo.ready_replicas || (serverInfo.status as any)?.ready_replicas || 'Unknown';
        const status = typeof serverInfo.status === 'object' ? (serverInfo.status as any)?.phase || 'Unknown' : serverInfo.status;
        
        console.log(`   ${chalk.gray('Server:')} ${chalk.cyan(serverInfo.name)}`);
        console.log(`   ${chalk.gray('Status:')} ${status}`);
        console.log(`   ${chalk.gray('Replicas:')} ${currentReplicas}/${readyReplicas}`);
        if (serverInfo.created) {
          console.log(`   ${chalk.gray('Created:')} ${new Date(serverInfo.created).toLocaleString()}`);
        }
      } else {
        console.log(`   ${chalk.gray('Server ID:')} ${chalk.cyan(serverId)}`);
      }
      
      console.log(`   ${chalk.gray('Workspace:')} ${activeWorkspace.workspace_name || activeWorkspace.workspace_id || 'Unknown'} (${workspaceId})`);
      console.log();
      console.log(chalk.red('   This action will permanently remove the server and all its data.'));
      console.log(chalk.red('   This action cannot be undone.'));
      console.log();
      
      const confirmed = await askConfirmation('Are you sure you want to remove this server?');
      if (!confirmed) {
        console.log(chalk.yellow('❌ Server removal cancelled'));
        process.exit(0);
      }
    }
    
    const spinner = ora(`🗑️  Removing server ${serverId}...`).start();
    
    // Remove server
    const response = await apiClient.removeServer(finalWorkspaceId, serverId);
    
    spinner.succeed(`🗑️  Server removed: ${serverId}`);
    
    console.log();
    console.log(chalk.green.bold('✅ Server removal successful!'));
    console.log();
    console.log(`${chalk.gray('Server ID:')} ${response.server_id}`);
    console.log(`${chalk.gray('Workspace:')} ${activeWorkspace.workspace_name} (${workspaceId})`);
    console.log(`${chalk.gray('Removed at:')} ${new Date().toLocaleString()}`);
    
    if (serverInfo) {
      console.log();
      console.log(chalk.blue.bold('📦 Removed Server Details'));
      console.log(`  ${chalk.gray('Name:')} ${serverInfo.name}`);
      const serverId = serverInfo.server_id || serverInfo.id;
      const status = typeof serverInfo.status === 'object' ? (serverInfo.status as any)?.phase || 'Unknown' : serverInfo.status;
      
      console.log(`  ${chalk.gray('Server ID:')} ${serverId}`);
      console.log(`  ${chalk.gray('Last Status:')} ${status}`);
      if (serverInfo.created) {
        console.log(`  ${chalk.gray('Created:')} ${new Date(serverInfo.created).toLocaleString()}`);
      }
    }
    
    console.log();
    console.log(chalk.cyan('💡 Use `ntcli server list` to see remaining servers in this workspace'));
    console.log(chalk.cyan('💡 Use `ntcli server deploy <server-id>` to deploy a new server'));
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Operation cancelled') {
      // Spinner was never started, so no need to fail it
      return;
    }
    
    const spinner = ora().start();
    spinner.fail('❌ Failed to remove server');
    
    if (error instanceof ManagementApiError) {
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
      } else if (error.statusCode === 409) {
        console.log(chalk.yellow('   💡 Server may be in use or have dependent resources'));
        console.log(chalk.cyan('   💡 Try scaling to 0 replicas first: `ntcli server scale ${serverId} --replicas 0`'));
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
 * Ask for user confirmation
 */
async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow(`${question} (y/N): `), (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase().trim();
      resolve(confirmed === 'y' || confirmed === 'yes');
    });
  });
}