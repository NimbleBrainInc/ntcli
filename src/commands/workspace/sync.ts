import chalk from 'chalk';
import ora from 'ora';
import { WorkspaceCommandOptions } from '../../types/index.js';
import { ConfigManager } from '../../lib/config-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ErrorHandler } from '../../lib/error-handler.js';

/**
 * Sync local workspace storage with server workspaces
 */
export async function handleWorkspaceSync(
  options: WorkspaceCommandOptions = {}
): Promise<void> {
  const spinner = ora('🔄 Syncing workspaces with server...').start();
  
  try {
    // Initialize storage and API client
    const configManager = new ConfigManager();
    const tokenManager = new TokenManager();
    const apiClient = new ManagementClient();
    
    // Try to get valid NimbleBrain bearer token
    const nimblebrainToken = await tokenManager.getNimbleBrainToken();
    if (nimblebrainToken) {
      apiClient.setBearerToken(nimblebrainToken);
    }
    
    // Fetch workspaces from server
    const serverResponse = await apiClient.listWorkspaces();
    const serverWorkspaces = serverResponse.workspaces || [];
    
    // Get local workspaces
    const localWorkspaces = configManager.getAllWorkspaces();
    
    // Helper to extract UUID from workspace ID
    const extractUuid = (fullWorkspaceId: string): string => {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(fullWorkspaceId)) {
        return fullWorkspaceId;
      }
      
      const parts = fullWorkspaceId.split("-");
      if (parts.length >= 5) {
        return parts.slice(-5).join("-");
      }
      
      return fullWorkspaceId;
    };
    
    // Create maps for comparison
    const localWorkspaceMap = new Map();
    for (const local of localWorkspaces) {
      const uuid = extractUuid(local.workspace_id);
      localWorkspaceMap.set(uuid, local);
    }
    
    const serverWorkspaceMap = new Map();
    for (const server of serverWorkspaces) {
      serverWorkspaceMap.set(server.workspace_id, server);
    }
    
    // Find differences
    const onlyOnServer = [];
    const onlyLocally = [];
    const inBoth = [];
    
    // Check server workspaces
    for (const serverWorkspace of serverWorkspaces) {
      if (localWorkspaceMap.has(serverWorkspace.workspace_id)) {
        inBoth.push(serverWorkspace);
      } else {
        onlyOnServer.push(serverWorkspace);
      }
    }
    
    // Check local workspaces
    for (const localWorkspace of localWorkspaces) {
      const uuid = extractUuid(localWorkspace.workspace_id);
      if (!serverWorkspaceMap.has(uuid)) {
        onlyLocally.push(localWorkspace);
      }
    }
    
    spinner.succeed('✅ Workspace sync completed');
    
    console.log();
    console.log(chalk.blue.bold('📊 Sync Summary'));
    console.log(`  ${chalk.gray('Server workspaces:')} ${serverWorkspaces.length}`);
    console.log(`  ${chalk.gray('Local workspaces:')} ${localWorkspaces.length}`);
    console.log(`  ${chalk.green('In sync:')} ${inBoth.length}`);
    console.log(`  ${chalk.yellow('On server only:')} ${onlyOnServer.length}`);
    console.log(`  ${chalk.red('Local only:')} ${onlyLocally.length}`);
    console.log();
    
    if (onlyOnServer.length > 0) {
      console.log(chalk.yellow.bold('⚠️  Workspaces on server but not locally:'));
      for (const workspace of onlyOnServer) {
        console.log(`  ${chalk.cyan(workspace.workspace_name)} ${chalk.gray('(' + workspace.workspace_id + ')')}`);
      }
      console.log();
      console.log(chalk.cyan('   💡 To use these workspaces, you need to get access tokens:'));
      console.log(chalk.cyan('   💡 `ntcli token refresh <workspace-name>`'));
      console.log();
    }
    
    if (onlyLocally.length > 0) {
      console.log(chalk.red.bold('⚠️  Local workspaces not found on server:'));
      for (const workspace of onlyLocally) {
        console.log(`  ${chalk.cyan(workspace.workspace_name)} ${chalk.gray('(' + workspace.workspace_id + ')')}`);
      }
      console.log();
      console.log(chalk.yellow('   💡 These workspaces may have been deleted from the server.'));
      console.log(chalk.yellow('   💡 Consider cleaning up local storage or recreating them.'));
      console.log();
    }
    
    if (inBoth.length > 0) {
      console.log(chalk.green.bold('✅ Workspaces in sync:'));
      for (const workspace of inBoth) {
        const localInfo = localWorkspaceMap.get(workspace.workspace_id);
        const tokenStatus = localInfo?.access_token ? '🔑' : '❌';
        console.log(`  ${tokenStatus} ${chalk.cyan(workspace.workspace_name)} ${chalk.gray('(' + workspace.workspace_id + ')')}`);
      }
      console.log();
    }
    
  } catch (error) {
    spinner.stop();
    ErrorHandler.handleApiError(error, 'Workspace sync');
    process.exit(1);
  }
}