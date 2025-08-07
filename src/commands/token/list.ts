import chalk from 'chalk';
import ora from 'ora';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';
import { WorkspaceInfo } from '../../types/index.js';

/**
 * List active workspace tokens
 */
export async function handleTokenList(
  workspaceNameOrId?: string,
  options: { 
    workspace?: string;
    verbose?: boolean;
  } = {}
): Promise<void> {
  try {
    // Get workspace to list tokens for
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
          
          // Create a temporary workspace object for token listing
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
        console.log(chalk.cyan('   ntcli token list <workspace-name>'));
        console.log(chalk.cyan('   # OR'));
        console.log(chalk.cyan('   ntcli workspace switch <workspace-name>'));
        process.exit(1);
      }
    }

    const spinner = ora(`📋 Fetching tokens for workspace: ${targetWorkspace.workspace_name}...`).start();

    // Get authenticated API client for this workspace
    const authResult = await workspaceManager.getAuthenticatedClient(targetWorkspace.workspace_id);
    if (!authResult) {
      spinner.fail('❌ No valid workspace token');
      console.log(chalk.yellow('   This workspace does not have a valid access token.'));
      console.log(chalk.yellow('   Workspace tokens are required to list tokens.'));
      console.log(chalk.cyan('   Please refresh your workspace token: `ntcli token refresh`'));
      process.exit(1);
    }

    const { client: apiClient } = authResult;
    
    // List workspace tokens
    const tokensResponse = await apiClient.listWorkspaceTokens(targetWorkspace.workspace_id);

    spinner.succeed(`📋 Found ${tokensResponse.count} active token${tokensResponse.count !== 1 ? 's' : ''}`);
    
    if (tokensResponse.count === 0) {
      console.log();
      console.log(chalk.yellow('No active tokens found for this workspace.'));
      console.log();
      console.log(chalk.cyan('💡 Create a new token:'));
      console.log(chalk.cyan('   ntcli token create                    # Create temporary token'));
      console.log(chalk.cyan('   ntcli token refresh                   # Refresh stored workspace token'));
      return;
    }
    
    console.log();
    console.log(chalk.blue.bold(`🏢 Workspace: ${targetWorkspace.workspace_name}`));
    console.log(`   ${chalk.gray('Workspace ID:')} ${targetWorkspace.workspace_id}`);
    console.log();
    
    if (options.verbose) {
      // Detailed view
      console.log(chalk.blue.bold('📋 Active Tokens:'));
      console.log();
      
      for (const token of tokensResponse.tokens) {
        const createdDate = new Date(token.created_at * 1000);
        const now = new Date();
        const timeDiff = now.getTime() - createdDate.getTime();
        const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        
        let timeAgo;
        if (daysAgo > 0) {
          timeAgo = `${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`;
        } else if (hoursAgo > 0) {
          timeAgo = `${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`;
        } else if (minutesAgo > 0) {
          timeAgo = `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;
        } else {
          timeAgo = 'just now';
        }
        
        // Check if this is the current workspace token
        const isCurrentToken = targetWorkspace.jti === token.jti;
        const tokenLabel = isCurrentToken ? `${chalk.green('🔑')} ${chalk.green.bold('CURRENT')}` : '🆔';
        
        console.log(`${tokenLabel} ${chalk.cyan.bold(token.jti)}`);
        console.log(`   ${chalk.gray('Created:')} ${createdDate.toLocaleString()} (${timeAgo})`);
        console.log(`   ${chalk.gray('Revoke:')} ${chalk.yellow('ntcli token revoke ' + token.jti)}`);
        console.log();
      }
    } else {
      // Compact view
      console.log(chalk.gray('TOKEN ID (JTI)').padEnd(45) + 
                  chalk.gray('CREATED').padEnd(20) + 
                  chalk.gray('AGE'));
      console.log(chalk.gray('─'.repeat(80)));
      
      for (const token of tokensResponse.tokens) {
        const createdDate = new Date(token.created_at * 1000);
        const now = new Date();
        const timeDiff = now.getTime() - createdDate.getTime();
        const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        
        let timeAgo;
        if (daysAgo > 0) {
          timeAgo = `${daysAgo}d`;
        } else if (hoursAgo > 0) {
          timeAgo = `${hoursAgo}h`;
        } else if (minutesAgo > 0) {
          timeAgo = `${minutesAgo}m`;
        } else {
          timeAgo = 'now';
        }
        
        // Check if this is the current workspace token
        const isCurrentToken = targetWorkspace.jti === token.jti;
        const jtiDisplay = isCurrentToken ? `${token.jti} ${chalk.green('(current)')}` : token.jti;
        const created = createdDate.toLocaleDateString();
        
        console.log(`${jtiDisplay.padEnd(45)}${created.padEnd(20)}${timeAgo}`);
      }
    }
    
    console.log();
    console.log(chalk.gray(`Total: ${tokensResponse.count} active token${tokensResponse.count !== 1 ? 's' : ''} in workspace ${targetWorkspace.workspace_name}`));
    console.log();
    console.log(chalk.cyan('💡 Use `ntcli token revoke <jti>` to revoke a specific token'));
    console.log(chalk.cyan('💡 Use `ntcli token create` to create a new token'));
    console.log(chalk.cyan('💡 Use `--verbose` flag for detailed view'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to list workspace tokens'));
    
    if (error instanceof ApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli token refresh` to refresh your workspace token'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow('   💡 Workspace not found or not accessible'));
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