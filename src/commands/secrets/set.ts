import chalk from 'chalk';
import ora from 'ora';
import { SecretsCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * Set or update a secret in the active workspace
 */
export async function handleSecretsSet(
  keyValue: string,
  options: SecretsCommandOptions = {}
): Promise<void> {
  // Parse KEY=VALUE format
  const equalIndex = keyValue.indexOf('=');
  if (equalIndex === -1) {
    console.error(chalk.red('❌ Invalid format'));
    console.log(chalk.yellow('   Please use KEY=VALUE format'));
    console.log(chalk.cyan('   Example: ntcli secrets set API_KEY=your-secret-value'));
    process.exit(1);
  }
  
  const secretKey = keyValue.substring(0, equalIndex);
  const secretValue = keyValue.substring(equalIndex + 1);
  
  // Validate secret key and value
  if (!secretKey || !secretValue) {
    console.error(chalk.red('❌ Both key and value are required'));
    console.log(chalk.yellow('   Please provide both key and value'));
    console.log(chalk.cyan('   Example: ntcli secrets set API_KEY=your-secret-value'));
    process.exit(1);
  }
  
  // Validate secret key format
  if (!/^[a-zA-Z0-9_-]+$/.test(secretKey)) {
    console.error(chalk.red('❌ Invalid secret key format'));
    console.log(chalk.yellow('   Secret keys can only contain letters, numbers, hyphens, and underscores'));
    console.log(chalk.cyan('   Example: ntcli secrets set API_KEY=your-secret-value'));
    process.exit(1);
  }

  const spinner = ora(`🔑 Setting secret ${secretKey}...`).start();
  
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
    
    // Set the secret
    const response = await apiClient.setWorkspaceSecret(finalWorkspaceId, secretKey, {
      secret_value: secretValue
    });
    
    spinner.succeed(`🔑 Secret ${secretKey} has been set`);
    
    console.log();
    console.log(chalk.green.bold('✅ Secret updated successfully!'));
    console.log();
    console.log(chalk.blue.bold('🔐 Secret Details'));
    console.log(`  ${chalk.gray('Key:')} ${chalk.cyan(response.secret_key)}`);
    console.log(`  ${chalk.gray('Workspace:')} ${activeWorkspace.workspace_name || workspaceId}`);
    console.log(`  ${chalk.gray('Status:')} ${chalk.green(response.status)}`);
    console.log();
    console.log(chalk.cyan('💡 Use `ntcli secrets list` to see all secrets in this workspace'));
    console.log(chalk.cyan(`💡 Use \`ntcli secrets unset ${secretKey}\` to remove this secret`));
    
  } catch (error) {
    spinner.fail('❌ Failed to set secret');
    
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
        console.log(chalk.yellow('   💡 You do not have permission to manage secrets in this workspace'));
      } else if (error.isValidationError()) {
        console.log(chalk.yellow('   💡 Check the secret key format (alphanumeric, hyphens, underscores only)'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}