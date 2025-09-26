import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import { SecretsCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * Delete a secret from the active workspace
 */
export async function handleSecretsUnset(
  secretKey: string,
  options: SecretsCommandOptions & { force?: boolean } = {}
): Promise<void> {
  try {
    // Get active workspace
    const workspaceManager = new WorkspaceManager();
    const activeWorkspace = await workspaceManager.getActiveWorkspace();
    
    if (!activeWorkspace) {
      console.error(chalk.red('❌ No active workspace'));
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
      console.error(chalk.red('❌ No valid workspace token'));
      console.log(chalk.yellow('   Please create a new workspace with `ntcli workspace create <name>`'));
      process.exit(1);
    }

    const { client: apiClient, workspaceId: finalWorkspaceId } = authResult;
    
    // Confirmation prompt (unless --force is used)
    if (!options.force) {
      console.log();
      console.log(chalk.yellow.bold('⚠️  Warning: Secret Deletion'));
      console.log();
      console.log(`   ${chalk.gray('Secret Key:')} ${chalk.cyan(secretKey)}`);
      console.log(`   ${chalk.gray('Workspace:')} ${activeWorkspace.workspace_name || workspaceId}`);
      console.log();
      console.log(chalk.red('   This action will permanently delete the secret.'));
      console.log(chalk.red('   This action cannot be undone.'));
      console.log();
      
      const confirmed = await askConfirmation('Are you sure you want to delete this secret?');
      if (!confirmed) {
        console.log(chalk.yellow('❌ Secret deletion cancelled'));
        process.exit(0);
      }
    }
    
    const spinner = ora(`🗑️  Deleting secret ${secretKey}...`).start();
    
    // Delete the secret
    const response = await apiClient.deleteWorkspaceSecret(finalWorkspaceId, secretKey);
    
    spinner.succeed(`🗑️  Secret ${secretKey} has been deleted`);
    
    console.log();
    console.log(chalk.green.bold('✅ Secret deletion successful!'));
    console.log();
    console.log(chalk.blue.bold('🔐 Deletion Details'));
    console.log(`  ${chalk.gray('Key:')} ${chalk.cyan(response.secret_key)}`);
    console.log(`  ${chalk.gray('Workspace:')} ${activeWorkspace.workspace_name || workspaceId}`);
    console.log(`  ${chalk.gray('Status:')} ${chalk.green(response.status)}`);
    console.log();
    console.log(chalk.cyan('💡 Use `ntcli secrets list` to see remaining secrets in this workspace'));
    console.log(chalk.cyan('💡 Use `ntcli secrets set KEY=value` to add a new secret'));
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Operation cancelled') {
      // Spinner was never started, so no need to fail it
      return;
    }
    
    const spinner = ora().start();
    spinner.fail('❌ Failed to delete secret');
    
    if (error instanceof ManagementApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your authentication'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow(`   💡 Secret '${secretKey}' not found in this workspace`));
        console.log(chalk.cyan('   💡 Use `ntcli secrets list` to see available secrets'));
      } else if (error.statusCode === 403) {
        console.log(chalk.yellow('   💡 You do not have permission to manage secrets in this workspace'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}

/**
 * Ask for user confirmation
 */
async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow(`${question} (y/N): `), (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase().trim();
      resolve(confirmed === 'y' || confirmed === 'yes');
    });
  });
}