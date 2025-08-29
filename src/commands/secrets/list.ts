import chalk from 'chalk';
import ora from 'ora';
import { SecretsCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * List secrets in the active workspace
 */
export async function handleSecretsList(options: SecretsCommandOptions = {}): Promise<void> {
  const spinner = ora('🔑 Fetching workspace secrets...').start();
  
  try {
    // Get active workspace
    const workspaceManager = new WorkspaceManager();
    const activeWorkspace = await workspaceManager.getActiveWorkspace();
    
    if (!activeWorkspace) {
      spinner.fail('❌ No active workspace');
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
      spinner.fail('❌ No valid workspace token');
      console.log(chalk.yellow('   Please create a new workspace with `ntcli workspace create <name>`'));
      process.exit(1);
    }

    const { client: apiClient, workspaceId: finalWorkspaceId } = authResult;
    
    // Fetch secrets from API
    const response = await apiClient.listWorkspaceSecrets(finalWorkspaceId);
    
    spinner.succeed(`🔑 Found ${response.count} secret${response.count === 1 ? '' : 's'}`);
    
    console.log();
    
    if (response.count === 0) {
      console.log(chalk.gray('   No secrets found in this workspace'));
      console.log(chalk.cyan('   💡 Use `ntcli secrets set KEY=value` to add a secret'));
      return;
    }
    
    // Display secrets
    console.log(chalk.blue.bold('🔐 Workspace Secrets'));
    console.log(chalk.gray(`   Workspace: ${activeWorkspace.workspace_name || workspaceId}`));
    console.log();
    
    for (const secretKey of response.secrets) {
      console.log(`  ${chalk.cyan('●')} ${chalk.white(secretKey)}`);
    }
    
    console.log();
    console.log(chalk.gray(`Total: ${response.count} secret${response.count === 1 ? '' : 's'}`));
    console.log();
    console.log(chalk.cyan('💡 Use `ntcli secrets set KEY=value` to add or update a secret'));
    console.log(chalk.cyan('💡 Use `ntcli secrets unset KEY` to remove a secret'));
    
  } catch (error) {
    spinner.fail('❌ Failed to fetch secrets');
    
    if (error instanceof ManagementApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli token refresh` to refresh your workspace token'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow('   💡 Workspace not found or not accessible'));
      } else if (error.statusCode === 403) {
        console.log(chalk.yellow('   💡 You do not have permission to access secrets in this workspace'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}