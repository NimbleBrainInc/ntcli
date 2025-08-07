import chalk from 'chalk';
import ora from 'ora';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';
import { WorkspaceInfo } from '../../types/index.js';

/**
 * Refresh workspace token using NimbleTools JWT
 */
export async function handleTokenRefresh(
  workspaceNameOrId?: string,
  options: { 
    print?: boolean; 
    workspace?: string;
    expiresIn?: number;
    expiresAt?: number;
  } = {}
): Promise<void> {
  try {
    // Get workspace to refresh token for
    const workspaceManager = new WorkspaceManager();
    const workspaceStorage = new WorkspaceStorage();
    
    // Check if we have valid Clerk authentication first
    const tokenManager = new TokenManager();
    const isAuthenticated = await tokenManager.isAuthenticated();
    if (!isAuthenticated) {
      console.error(chalk.red('❌ Not authenticated with Clerk'));
      console.log(chalk.yellow('   Please run `ntcli auth login` first'));
      process.exit(1);
    }

    // Get valid Clerk JWT token (we need the ID token for the API call)
    const clerkIdToken = await tokenManager.getValidClerkIdToken();
    if (!clerkIdToken) {
      console.error(chalk.red('❌ No valid Clerk ID token'));
      console.log(chalk.yellow('   Please run `ntcli auth login` to refresh your Clerk session'));
      process.exit(1);
    }

    let targetWorkspace;
    let serverWorkspaceInfo: WorkspaceInfo | null = null;
    const workspaceIdentifier = workspaceNameOrId || options.workspace;
    
    if (workspaceIdentifier) {
      // Use specified workspace - first try locally
      targetWorkspace = workspaceStorage.getWorkspaceByName(workspaceIdentifier) || 
                       workspaceStorage.getWorkspace(workspaceIdentifier);
      
      if (!targetWorkspace) {
        // Not found locally, check the server
        console.log(chalk.yellow(`   Workspace '${workspaceIdentifier}' not found locally, checking server...`));
        
        // Initialize API client with Clerk ID token
        const apiClient = new NimbleBrainApiClient();
        apiClient.setClerkJwtToken(clerkIdToken);
        
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
          
          // Create a temporary workspace object for token refresh
          targetWorkspace = {
            workspace_id: `ws-${serverWorkspaceInfo.workspace_name}-${serverWorkspaceInfo.workspace_id}`,
            workspace_name: serverWorkspaceInfo.workspace_name,
            access_token: '', // No token yet
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
        console.log(chalk.cyan('   ntcli token refresh <workspace-name>'));
        console.log(chalk.cyan('   # OR'));
        console.log(chalk.cyan('   ntcli workspace switch <workspace-name>'));
        process.exit(1);
      }
    }

    const spinner = ora(`🔄 Refreshing token for workspace: ${targetWorkspace.workspace_name}...`).start();

    // Show warning if existing token exists
    if (targetWorkspace.access_token) {
      const tokenInfo = workspaceStorage.getTokenExpirationInfo(targetWorkspace.workspace_id);
      if (tokenInfo && !tokenInfo.isExpired) {
        spinner.stop();
        console.log();
        console.log(chalk.yellow.bold('⚠️  Warning: Active Token Found'));
        console.log();
        console.log(`   ${chalk.gray('Workspace:')} ${targetWorkspace.workspace_name}`);
        console.log(`   ${chalk.gray('Current token expires:')} ${tokenInfo.expiresAt.toLocaleString()}`);
        console.log(`   ${chalk.gray('Valid for:')} ${tokenInfo.minutesRemaining} more minutes`);
        console.log();
        console.log(chalk.red('   ⚠️  Refreshing will invalidate the existing CLI token.'));
        console.log(chalk.red('   ⚠️  Any other CLI instances using this workspace will need to refresh.'));
        console.log();
        
        // Could add confirmation prompt here in the future
        spinner.start(`🔄 Proceeding to refresh token for: ${targetWorkspace.workspace_name}...`);
      }
    }

    // Initialize API client with Clerk ID token
    const apiClient = new NimbleBrainApiClient();
    apiClient.setClerkJwtToken(clerkIdToken);
    
    // Prepare token options
    const tokenOptions: { expires_in?: number; expires_at?: number } = {};
    
    if (options.expiresIn) {
      tokenOptions.expires_in = options.expiresIn;
      spinner.text = `🔄 Requesting new workspace token (expires in ${options.expiresIn}s)...`;
    } else if (options.expiresAt) {
      tokenOptions.expires_at = options.expiresAt;
      const expiryDate = new Date(options.expiresAt * 1000);
      spinner.text = `🔄 Requesting new workspace token (expires at ${expiryDate.toLocaleString()})...`;
    } else {
      // Default to 1 year expiration
      tokenOptions.expires_in = 365 * 24 * 60 * 60; // 1 year in seconds
      spinner.text = '🔄 Requesting new workspace token (expires in 1 year)...';
    }
    
    // Step 1: Generate new workspace token
    const refreshResponse = await apiClient.generateWorkspaceToken(targetWorkspace.workspace_id, tokenOptions);
    
    // Step 2: Revoke old token if it exists and has JTI
    if (targetWorkspace.access_token && targetWorkspace.jti) {
      try {
        await apiClient.revokeWorkspaceToken(targetWorkspace.workspace_id, targetWorkspace.jti);
        spinner.text = '🗑️  Old token revoked, updating with new token...';
      } catch (revokeError) {
        // Log the error but continue - the old token might already be expired
        console.warn(`Warning: Could not revoke old token: ${revokeError instanceof Error ? revokeError.message : String(revokeError)}`);
      }
    }
    
    // Update stored token
    spinner.text = '💾 Storing token...';
    
    // Handle non-expiring tokens (expires_in is null)
    const expiresIn = refreshResponse.expires_in || (365 * 24 * 60 * 60); // Default to 1 year for non-expiring tokens
    
    // If this workspace came from server (not local), we need to create it first
    if (serverWorkspaceInfo) {
      // Create the workspace locally with the new token
      const createWorkspaceResponse = {
        workspace_name: serverWorkspaceInfo.workspace_name,
        workspace_id: targetWorkspace.workspace_id,
        namespace: `ns-${serverWorkspaceInfo.workspace_name}`,
        created: serverWorkspaceInfo.created,
        status: 'active',
        message: 'Token refreshed for existing server workspace',
        access_token: refreshResponse.access_token,
        token_type: refreshResponse.token_type,
        expires_in: expiresIn,
        scope: refreshResponse.scope || [],
        ...(refreshResponse.jti && { jti: refreshResponse.jti })
      };
      
      workspaceStorage.addWorkspace(createWorkspaceResponse);
    } else {
      // Update existing local workspace
      const updateSuccess = workspaceStorage.updateWorkspaceToken(
        targetWorkspace.workspace_id,
        refreshResponse.access_token,
        refreshResponse.token_type,
        expiresIn,
        refreshResponse.scope,
        refreshResponse.jti
      );
      
      if (!updateSuccess) {
        spinner.fail('❌ Failed to update workspace token');
        console.error(chalk.red('   Could not update local workspace storage'));
        process.exit(1);
      }
    }

    spinner.succeed('✅ Workspace token refreshed successfully');
    
    console.log();
    console.log(chalk.green('🎉 New workspace token obtained!'));
    console.log();
    console.log(`${chalk.gray('Workspace:')} ${targetWorkspace.workspace_name} (${targetWorkspace.workspace_id})`);
    
    const newTokenInfo = workspaceStorage.getTokenExpirationInfo(targetWorkspace.workspace_id);
    if (newTokenInfo) {
      console.log(`${chalk.gray('Token expires:')} ${newTokenInfo.expiresAt.toLocaleString()}`);
      console.log(`${chalk.gray('Valid for:')} ${newTokenInfo.minutesRemaining} minutes`);
      console.log(`${chalk.gray('Token ending in:')} ...${refreshResponse.access_token.slice(-8)}`);
    }
    
    if (refreshResponse.message) {
      console.log(`${chalk.gray('Message:')} ${refreshResponse.message}`);
    }
    
    if (options.print) {
      console.log();
      console.log(chalk.blue.bold('🔑 Full Workspace Token:'));
      console.log(chalk.white(refreshResponse.access_token));
      console.log();
      console.log(chalk.yellow('⚠️  Keep this token secure - do not share it publicly'));
    }
    
    console.log();
    console.log(chalk.cyan('💡 You can now use workspace-specific commands with this token'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to refresh workspace token'));
    
    if (error instanceof ApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your Clerk authentication'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow('   💡 Check that the workspace exists and you have access'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}