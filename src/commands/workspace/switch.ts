import chalk from 'chalk';
import ora from 'ora';
import { WorkspaceCommandOptions } from '../../types/index.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
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
    const workspaceStorage = new WorkspaceStorage();
    const tokenManager = new TokenManager();
    const apiClient = new NimbleBrainApiClient();
    
    // Find workspace by name or ID locally first
    let workspace = workspaceStorage.getWorkspaceByName(nameOrId) || 
                    workspaceStorage.getWorkspace(nameOrId);
    
    if (!workspace) {
      // Not found locally, check the server
      spinner.text = '🌐 Checking server for workspace...';
      
      // Check authentication
      const isAuthenticated = await tokenManager.isAuthenticated();
      if (!isAuthenticated) {
        spinner.fail('❌ Authentication required');
        console.log(chalk.yellow('   💡 Please login first: `ntcli auth login`'));
        process.exit(1);
      }
      
      // Get valid Clerk JWT token
      const clerkJwt = await tokenManager.getValidClerkIdToken();
      if (!clerkJwt) {
        spinner.fail('❌ No valid authentication token');
        console.log(chalk.yellow('   💡 Please login first: `ntcli auth login`'));
        process.exit(1);
      }
      
      // Set JWT for API calls
      apiClient.setClerkJwtToken(clerkJwt);
      
      try {
        // Fetch workspaces from server
        const serverResponse = await apiClient.listWorkspaces();
        const serverWorkspaces = serverResponse.workspaces || [];
        
        // Try to find the workspace on the server
        const serverWorkspace = serverWorkspaces.find(ws => 
          ws.workspace_name === nameOrId || ws.workspace_id === nameOrId
        );
        
        if (serverWorkspace) {
          spinner.fail('❌ Workspace exists on server but not locally');
          console.log(chalk.yellow(`   Found workspace '${serverWorkspace.workspace_name}' on server but it's not stored locally.`));
          console.log(chalk.cyan('   💡 You need a local access token to switch to this workspace.'));
          console.log(chalk.cyan('   💡 Try: `ntcli token refresh ' + serverWorkspace.workspace_name + '`'));
          console.log(chalk.gray('   💡 Or recreate the workspace: `ntcli workspace create ' + serverWorkspace.workspace_name + '`'));
          
          process.exit(1);
        }
      } catch (serverError) {
        // Server lookup failed, continue with local-only error
      }
      
      spinner.fail('❌ Workspace not found');
      console.error(chalk.red(`   Workspace '${nameOrId}' not found locally or on server`));
      
      // Show all available workspaces
      const availableWorkspaces = workspaceStorage.getAllWorkspaces();
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
    
    spinner.text = '💾 Setting active workspace...';
    
    // Set as active workspace
    const success = workspaceStorage.setActiveWorkspace(workspace.workspace_id);
    
    if (!success) {
      spinner.fail('❌ Failed to set active workspace');
      console.error(chalk.red('   Unable to set workspace as active'));
      process.exit(1);
    }
    
    spinner.succeed('✅ Switched workspace successfully!');
    console.log(chalk.green(`   Active workspace: ${workspace.workspace_name} (${workspace.workspace_id})`));
    
    // Show access token status
    if (workspace.access_token) {
      const tokenInfo = workspaceStorage.getTokenExpirationInfo(workspace.workspace_id);
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