import chalk from 'chalk';
import ora from 'ora';
import { WorkspaceCommandOptions } from '../../types/index.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ErrorHandler } from '../../lib/error-handler.js';

/**
 * List all workspaces
 */
export async function handleWorkspaceList(
  options: WorkspaceCommandOptions = {}
): Promise<void> {
  const spinner = ora('📋 Loading workspaces...').start();
  
  try {
    // Initialize storage and API client
    const workspaceStorage = new WorkspaceStorage();
    const tokenManager = new TokenManager();
    const apiClient = new NimbleBrainApiClient();
    
    // Check authentication
    const isAuthenticated = await tokenManager.isAuthenticated();
    if (!isAuthenticated) {
      spinner.fail('❌ Not authenticated');
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
    
    // Fetch workspaces from server
    const serverResponse = await apiClient.listWorkspaces();
    const serverWorkspaces = serverResponse.workspaces || [];
    
    // Get local workspace info (for active workspace and tokens)
    const activeWorkspace = workspaceStorage.getActiveWorkspace();
    const localWorkspaces = workspaceStorage.getAllWorkspaces();
    
    // Create a helper function to extract UUID from full workspace ID
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
    
    // Create a map of local workspace info by UUID (extracted from full workspace ID)
    const localWorkspaceMap = new Map();
    for (const local of localWorkspaces) {
      const uuid = extractUuid(local.workspace_id);
      localWorkspaceMap.set(uuid, local);
    }
    
    spinner.succeed(`📋 Workspaces (${serverWorkspaces.length} total):`);
    
    if (serverWorkspaces.length === 0) {
      console.log(chalk.gray('   No workspaces found'));
      console.log(chalk.cyan('   💡 Create your first workspace with `ntcli workspace create <name>`'));
      return;
    }
    
    console.log();
    for (const workspace of serverWorkspaces) {
      // Check if this workspace is active by comparing UUIDs
      const activeWorkspaceUuid = activeWorkspace ? extractUuid(activeWorkspace.workspace_id) : null;
      const isActive = activeWorkspaceUuid === workspace.workspace_id;
      const prefix = isActive ? chalk.green('* ') : '  ';
      const nameColor = isActive ? chalk.green : chalk.white;
      
      // Display format: "name (id)"
      console.log(`${prefix}${nameColor(workspace.workspace_name)} ${chalk.gray(`(${workspace.workspace_id})`)}`);
      
      if (options.verbose) {
        // Show server info
        console.log(`    ${chalk.gray('Created:')} ${chalk.dim(new Date(workspace.created).toLocaleString())}`);
        
        // Show local token info if available
        const localInfo = localWorkspaceMap.get(workspace.workspace_id);
        if (localInfo && localInfo.access_token) {
          const tokenInfo = workspaceStorage.getTokenExpirationInfo(workspace.workspace_id);
          if (tokenInfo && !tokenInfo.isExpired) {
            console.log(`    ${chalk.gray('Token:')} ${chalk.gray('••••••••' + localInfo.access_token.slice(-8))} ${chalk.dim('(expires in ' + tokenInfo.minutesRemaining + 'm)')}`);
          } else {
            console.log(`    ${chalk.gray('Token:')} ${chalk.red('Expired or missing')}`);
          }
        } else {
          console.log(`    ${chalk.gray('Token:')} ${chalk.red('No token stored locally')}`);
        }
      }
    }
    
    if (!options.verbose) {
      console.log();
      console.log(chalk.gray('   💡 Use --verbose for detailed information'));
    }
    
    console.log();
    // Show active workspace info
    if (activeWorkspace) {
      console.log(chalk.green(`   ✓ Active workspace: ${activeWorkspace.workspace_name}`));
    } else {
      console.log(chalk.yellow('   No active workspace selected'));
      console.log(chalk.cyan('   💡 Use `ntcli workspace switch <workspace-name>` to select a workspace'));
    }
    
  } catch (error) {
    spinner.stop();
    ErrorHandler.handleApiError(error, 'Workspace listing');
    process.exit(1);
  }
}

