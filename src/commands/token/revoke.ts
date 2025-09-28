import chalk from 'chalk';
import ora from 'ora';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { ConfigManager } from '../../lib/config-manager.js';
import { WorkspaceInfo } from '../../types/index.js';

/**
 * Revoke workspace token by JTI using NimbleTools JWT
 */
export async function handleTokenRevoke(
  jti: string,
  workspaceNameOrId?: string,
  options: { 
    workspace?: string;
  } = {}
): Promise<void> {
  try {
    if (!jti) {
      console.error(chalk.red('❌ JTI (JWT ID) is required'));
      console.log(chalk.yellow('   Usage: ntcli token revoke <jti> [workspace]'));
      process.exit(1);
    }

    // Get workspace to revoke token for
    const workspaceManager = new WorkspaceManager();
    const configManager = new ConfigManager();
    
    // Get token manager
    const tokenManager = new TokenManager();

    // Try to get valid NimbleBrain bearer token (we need the ID token for the API call)
    const nimblebrainToken = await tokenManager.getNimbleBrainToken();

    let targetWorkspace;
    let serverWorkspaceInfo: WorkspaceInfo | null = null;
    const workspaceIdentifier = workspaceNameOrId || options.workspace;
    
    if (workspaceIdentifier) {
      // Use specified workspace - first try locally
      targetWorkspace = configManager.getWorkspaceByName(workspaceIdentifier) || 
                       configManager.getWorkspace(workspaceIdentifier);
      
      if (!targetWorkspace) {
        // Not found locally, check the server
        console.log(chalk.yellow(`   Workspace '${workspaceIdentifier}' not found locally, checking server...`));
        
        // Initialize API client with NimbleBrain bearer token
        const apiClient = new ManagementClient();
        if (nimblebrainToken) {
          apiClient.setBearerToken(nimblebrainToken);
        }
        
        try {
          // Fetch workspaces from server
          const serverResponse = await apiClient.listWorkspaces();
          const serverWorkspaces = serverResponse.workspaces || [];
          
          // Try to find the workspace on the server
          serverWorkspaceInfo = serverWorkspaces.find(ws => 
            ws.workspace_name === workspaceIdentifier || ws.workspace_id === workspaceIdentifier
          ) || null;
          
          if (!serverWorkspaceInfo) {
            console.error(chalk.red(`❌ Workspace '${workspaceIdentifier}' not found locally or on server`));
            console.log(chalk.cyan('   💡 Use `ntcli workspace list` to see available workspaces'));
            process.exit(1);
          }
          
          console.log(chalk.green(`   ✓ Found workspace '${serverWorkspaceInfo.workspace_name}' on server`));
          
          // Create a temporary workspace object for token revocation
          targetWorkspace = {
            workspace_id: `ws-${serverWorkspaceInfo.workspace_name}-${serverWorkspaceInfo.workspace_id}`,
            workspace_name: serverWorkspaceInfo.workspace_name,
            access_token: '',
            token_type: 'Bearer',
            expires_at: 0,
            scope: []
          };
          
        } catch (serverError) {
          console.error(chalk.red(`❌ Failed to check server for workspace '${workspaceIdentifier}'`));
          console.log(chalk.cyan('   💡 Use `ntcli workspace list` to see available workspaces'));
          process.exit(1);
        }
      }
    } else {
      // Use active workspace
      targetWorkspace = await workspaceManager.getActiveWorkspace();
      if (!targetWorkspace) {
        console.error(chalk.red('❌ No active workspace'));
        console.log(chalk.yellow('   Please specify a workspace or set an active workspace:'));
        console.log(chalk.cyan('   ntcli token revoke <jti> <workspace-name>'));
        console.log(chalk.cyan('   # OR'));
        console.log(chalk.cyan('   ntcli workspace switch <workspace-name>'));
        process.exit(1);
      }
    }

    const spinner = ora(`🔄 Revoking token ${jti} for workspace: ${targetWorkspace.workspace_name}...`).start();

    // Initialize API client with NimbleBrain bearer token
    const apiClient = new ManagementClient();
    if (nimblebrainToken) {
      apiClient.setBearerToken(nimblebrainToken);
    }
    
    // Revoke the token
    const revokeResponse = await apiClient.revokeWorkspaceToken(targetWorkspace.workspace_id, jti);

    spinner.succeed('✅ Token revoked successfully');
    
    console.log();
    console.log(chalk.green('🗑️  Token revoked!'));
    console.log();
    console.log(`${chalk.gray('Workspace:')} ${targetWorkspace.workspace_name} (${targetWorkspace.workspace_id})`);
    console.log(`${chalk.gray('Revoked JTI:')} ${jti}`);
    
    if (revokeResponse.message) {
      console.log(`${chalk.gray('Message:')} ${revokeResponse.message}`);
    }
    
    // If this was the active workspace token, warn the user
    if (targetWorkspace.jti === jti) {
      console.log();
      console.log(chalk.yellow('⚠️  Warning: You just revoked the token stored for this workspace'));
      console.log(chalk.yellow('   Run `ntcli token refresh` to generate a new token for CLI use'));
    }
    
    console.log();
    console.log(chalk.red('💡 This token is now invalid and cannot be used for API access'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to revoke token'));
    
    if (error instanceof ManagementApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your Clerk authentication'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow('   💡 Check that the workspace and token JTI are correct'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}