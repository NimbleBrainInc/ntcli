import chalk from 'chalk';
import ora from 'ora';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';

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
    noExpiry?: boolean;
  } = {}
): Promise<void> {
  try {
    // Get workspace to refresh token for
    const workspaceManager = new WorkspaceManager();
    const workspaceStorage = new WorkspaceStorage();
    
    let targetWorkspace;
    
    if (workspaceNameOrId) {
      // Use specified workspace
      targetWorkspace = workspaceStorage.getWorkspaceByName(workspaceNameOrId) || 
                       workspaceStorage.getWorkspace(workspaceNameOrId);
      if (!targetWorkspace) {
        console.error(chalk.red(`❌ Workspace '${workspaceNameOrId}' not found`));
        console.log(chalk.cyan('   💡 Use `ntcli workspace list` to see available workspaces'));
        process.exit(1);
      }
    } else if (options.workspace) {
      // Use workspace from options
      targetWorkspace = workspaceStorage.getWorkspaceByName(options.workspace) || 
                       workspaceStorage.getWorkspace(options.workspace);
      if (!targetWorkspace) {
        console.error(chalk.red(`❌ Workspace '${options.workspace}' not found`));
        console.log(chalk.cyan('   💡 Use `ntcli workspace list` to see available workspaces'));
        process.exit(1);
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

    // Check if we have valid Clerk authentication
    const tokenManager = new TokenManager();
    const isAuthenticated = await tokenManager.isAuthenticated();
    if (!isAuthenticated) {
      spinner.fail('❌ Not authenticated with Clerk');
      console.log(chalk.yellow('   Please run `ntcli auth login` first'));
      process.exit(1);
    }

    // Get valid Clerk JWT token (we need the ID token for the API call)
    const clerkIdToken = await tokenManager.getValidClerkIdToken();
    if (!clerkIdToken) {
      spinner.fail('❌ No valid Clerk ID token');
      console.log(chalk.yellow('   Please run `ntcli auth login` to refresh your Clerk session'));
      process.exit(1);
    }

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
      spinner.text = '🔄 Requesting new workspace token (non-expiring)...';
    }
    
    // Request new workspace token
    const refreshResponse = await apiClient.refreshWorkspaceToken(targetWorkspace.workspace_id, tokenOptions);
    
    // Update stored token
    spinner.text = '💾 Updating stored token...';
    
    // Handle non-expiring tokens (expires_in is null)
    const expiresIn = refreshResponse.expires_in || (365 * 24 * 60 * 60); // Default to 1 year for non-expiring tokens
    
    workspaceStorage.updateWorkspaceToken(
      targetWorkspace.workspace_id,
      refreshResponse.access_token,
      refreshResponse.token_type,
      expiresIn,
      refreshResponse.scope
    );

    spinner.succeed('✅ Workspace token refreshed successfully');
    
    console.log();
    console.log(chalk.green('🎉 New workspace token obtained!'));
    console.log();
    console.log(`${chalk.gray('Workspace:')} ${targetWorkspace.workspace_name} (${targetWorkspace.workspace_id})`);
    
    const newTokenInfo = workspaceStorage.getTokenExpirationInfo(targetWorkspace.workspace_id);
    if (newTokenInfo) {
      if (refreshResponse.expires_in) {
        console.log(`${chalk.gray('Token expires:')} ${newTokenInfo.expiresAt.toLocaleString()}`);
        console.log(`${chalk.gray('Valid for:')} ${newTokenInfo.minutesRemaining} minutes`);
      } else {
        console.log(`${chalk.gray('Token expires:')} ${chalk.green('Never (non-expiring)')}`);
      }
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