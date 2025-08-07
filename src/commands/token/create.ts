import chalk from 'chalk';
import ora from 'ora';
import { ApiError, NimbleBrainApiClient } from '../../lib/api/client.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';
import { WorkspaceInfo } from '../../types/index.js';

/**
 * Create new workspace token using NimbleTools JWT (without persisting it)
 */
export async function handleTokenCreate(
  workspaceNameOrId?: string,
  options: { 
    workspace?: string;
    expiresIn?: number;
    expiresAt?: number;
  } = {}
): Promise<void> {
  try {
    // Get workspace to create token for
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
          
          // Create a temporary workspace object for token creation
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
        console.log(chalk.cyan('   ntcli token create <workspace-name>'));
        console.log(chalk.cyan('   # OR'));
        console.log(chalk.cyan('   ntcli workspace switch <workspace-name>'));
        process.exit(1);
      }
    }

    const spinner = ora(`🔄 Creating new token for workspace: ${targetWorkspace.workspace_name}...`).start();

    // Initialize API client with Clerk ID token
    const apiClient = new NimbleBrainApiClient();
    apiClient.setClerkJwtToken(clerkIdToken);
    
    // Prepare token options
    const tokenOptions: { expires_in?: number; expires_at?: number } = {};
    
    if (options.expiresIn) {
      tokenOptions.expires_in = options.expiresIn;
      spinner.text = `🔄 Creating new workspace token (expires in ${options.expiresIn}s)...`;
    } else if (options.expiresAt) {
      tokenOptions.expires_at = options.expiresAt;
      const expiryDate = new Date(options.expiresAt * 1000);
      spinner.text = `🔄 Creating new workspace token (expires at ${expiryDate.toLocaleString()})...`;
    } else {
      // Default to 1 year expiration
      tokenOptions.expires_in = 365 * 24 * 60 * 60; // 1 year in seconds
      spinner.text = '🔄 Creating new workspace token (expires in 1 year)...';
    }
    
    // Generate new workspace token (without persisting)
    const tokenResponse = await apiClient.generateWorkspaceToken(targetWorkspace.workspace_id, tokenOptions);

    spinner.succeed('✅ New workspace token created successfully');
    
    console.log();
    console.log(chalk.green('🎉 New workspace token generated!'));
    console.log();
    console.log(`${chalk.gray('Workspace:')} ${targetWorkspace.workspace_name} (${targetWorkspace.workspace_id})`);
    
    const expiresAt = new Date(Date.now() + (tokenResponse.expires_in * 1000));
    console.log(`${chalk.gray('Token expires:')} ${expiresAt.toLocaleString()}`);
    console.log(`${chalk.gray('Valid for:')} ${Math.floor(tokenResponse.expires_in / 60)} minutes`);
    
    if (tokenResponse.jti) {
      console.log(`${chalk.gray('Token ID (JTI):')} ${tokenResponse.jti}`);
    }
    
    console.log(`${chalk.gray('Token ending in:')} ...${tokenResponse.access_token.slice(-8)}`);
    
    if (tokenResponse.message) {
      console.log(`${chalk.gray('Message:')} ${tokenResponse.message}`);
    }
    
    console.log();
    console.log(chalk.blue.bold('🔑 Full Workspace Token:'));
    console.log(chalk.white(tokenResponse.access_token));
    console.log();
    
    // Extract JTI from response or decode from token
    let jti = tokenResponse.jti;
    if (!jti && tokenResponse.access_token) {
      try {
        // Decode JWT payload to extract JTI
        const parts = tokenResponse.access_token.split('.');
        if (parts.length === 3 && parts[1]) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          jti = payload.jti;
        }
      } catch (error) {
        // Ignore decoding errors
      }
    }
    
    if (jti) {
      console.log(chalk.blue.bold('🆔 Token ID (JTI):'));
      console.log(chalk.white(jti));
      console.log();
      console.log(chalk.cyan('💡 You can revoke this token at any time by running: `ntcli token revoke ' + jti + '`'));
    }
    console.log();
    console.log(chalk.yellow('⚠️  Keep this token secure - do not share it publicly'));
    console.log(chalk.yellow('⚠️  This token was NOT saved to your local workspace configuration'));
    console.log(chalk.cyan('💡 Use `ntcli token refresh` to update your saved workspace token'));
    console.log();
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to create workspace token'));
    
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