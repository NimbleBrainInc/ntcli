import chalk from 'chalk';
import ora from 'ora';
import { WorkspaceCommandOptions } from '../../types/index.js';
import { ConfigManager } from '../../lib/config-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ErrorHandler } from '../../lib/error-handler.js';
/**
 * Switch to a different workspace
 */
export async function handleWorkspaceSwitch(
  nameOrId: string,
  options: WorkspaceCommandOptions = {}
): Promise<void> {
  const spinner = ora('🔍 Finding workspace...').start();
  
  try {
    // Initialize storage and API client
    const configManager = new ConfigManager();
    const tokenManager = new TokenManager();
    const apiClient = new ManagementClient();
    
    // Find workspace by name or ID locally first
    let workspace = configManager.getWorkspaceByName(nameOrId) || 
                    configManager.getWorkspace(nameOrId);
    
    if (!workspace) {
      // Not found locally, check the server
      spinner.text = '🌐 Checking server for workspace...';
      
      // Try to get Clerk JWT token (if available)
      const clerkJwt = await tokenManager.getValidClerkIdToken();
      if (clerkJwt) {
        apiClient.setClerkJwtToken(clerkJwt);
      }
      
      try {
        // Fetch workspaces from server
        const serverResponse = await apiClient.listWorkspaces();
        const serverWorkspaces = serverResponse.workspaces || [];
        
        // Try to find the workspace on the server
        const serverWorkspace = serverWorkspaces.find(ws => 
          ws.workspace_name === nameOrId || ws.workspace_id === nameOrId
        );
        
        if (serverWorkspace) {
          // Create a local workspace entry without tokens first
          spinner.text = '📝 Creating local workspace entry...';
          
          configManager.addWorkspaceWithoutToken(
            serverWorkspace.workspace_id,
            serverWorkspace.workspace_name
          );
          workspace = configManager.getWorkspace(serverWorkspace.workspace_id);
          spinner.succeed('✅ Created local workspace entry');
        }
      } catch (serverError) {
        // Server lookup failed, continue with local-only error
      }
      
      // Only show error if we still don't have a workspace (i.e., creation failed or not found)
      if (!workspace) {
        spinner.fail('❌ Workspace not found');
        console.error(chalk.red(`   Workspace '${nameOrId}' not found locally or on server`));
        
        // Show all available workspaces
        const availableWorkspaces = configManager.getAllWorkspaces();
        if (availableWorkspaces.length > 0) {
          console.log(chalk.yellow('\\n   Available local workspaces:'));
          availableWorkspaces.forEach(ws => {
            console.log(chalk.cyan(`   - ${ws.workspace_name} (${ws.workspace_id})`));
          });
        } else {
          console.log(chalk.yellow('   💡 No workspaces found locally. Try `ntcli workspace list` to sync from server.'));
        }
        
        process.exit(1);
      }
    }
    
    spinner.text = '💾 Setting active workspace...';
    
    // Set as active workspace
    const success = configManager.setActiveWorkspace(workspace.workspace_id);
    
    if (!success) {
      spinner.fail('❌ Failed to set active workspace');
      console.error(chalk.red('   Unable to set workspace as active'));
      process.exit(1);
    }
    
    spinner.succeed('✅ Switched workspace successfully!');
    console.log(chalk.green(`   Active workspace: ${workspace.workspace_name} (${workspace.workspace_id})`));
    
    // Show access token status
    if (workspace.access_token) {
      const tokenInfo = configManager.getTokenExpirationInfo(workspace.workspace_id);
      if (tokenInfo && !tokenInfo.isExpired) {
        console.log(chalk.cyan(`   🔑 Access token available (expires in ${tokenInfo.minutesRemaining} minutes)`));
      } else {
        console.log(chalk.yellow('   ⚠️  Access token expired - you may need to recreate this workspace'));
      }
    } else {
      console.log(chalk.yellow('   ⚠️  No access token stored - you may need to recreate this workspace'));
    }
    
  } catch (error) {
    spinner.stop();
    ErrorHandler.handleApiError(error, 'Workspace switch');
    process.exit(1);
  }
}