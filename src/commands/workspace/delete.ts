import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import { WorkspaceCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';

/**
 * Delete a workspace
 */
export async function handleWorkspaceDelete(
  name: string,
  options: WorkspaceCommandOptions & { force?: boolean } = {}
): Promise<void> {
  const spinner = ora('🔍 Finding workspace...').start();
  
  try {
    const tokenManager = new TokenManager();
    const workspaceStorage = new WorkspaceStorage();
    
    // Check authentication
    const isAuthenticated = await tokenManager.isAuthenticated();
    if (!isAuthenticated) {
      spinner.fail('❌ Authentication required');
      console.log(chalk.yellow('   Please run `ntcli auth login` first'));
      process.exit(1);
    }
    
    // Find workspace by name or ID
    spinner.text = '🔍 Finding workspace...';
    let workspaceToDelete = workspaceStorage.getWorkspaceByName(name);
    if (!workspaceToDelete) {
      workspaceToDelete = workspaceStorage.getWorkspace(name);
    }
    
    if (!workspaceToDelete) {
      spinner.fail('❌ Workspace not found');
      console.error(chalk.red(`   Workspace '${name}' not found locally`));
      console.log(chalk.cyan('   💡 Use `ntcli workspace list` to see available workspaces'));
      process.exit(1);
    }
    
    const workspaceId = workspaceToDelete.workspace_id;
    const workspaceName = workspaceToDelete.workspace_name;
    
    // Confirm deletion unless --force is used
    if (!options.force) {
      spinner.stop();
      console.log();
      console.log(chalk.yellow.bold('⚠️  Warning: Workspace Deletion'));
      console.log();
      console.log(`   ${chalk.gray('Workspace:')} ${chalk.cyan(workspaceName)}`);
      console.log(`   ${chalk.gray('ID:')} ${workspaceId}`);
      console.log();
      console.log(chalk.red('   This action will permanently delete the workspace and all its servers.'));
      console.log(chalk.red('   This action cannot be undone.'));
      console.log();
      
      const confirmed = await askConfirmation('Are you sure you want to delete this workspace?');
      if (!confirmed) {
        console.log(chalk.yellow('❌ Workspace deletion cancelled'));
        process.exit(0);
      }
      
      spinner.start('🗑️  Deleting workspace from API...');
    }
    
    spinner.text = '🗑️  Deleting workspace from API...';
    
    // Delete workspace via API using Clerk ID token
    const clerkIdToken = await tokenManager.getValidClerkIdToken();
    if (!clerkIdToken) {
      spinner.fail('❌ No valid authentication token');
      console.log(chalk.yellow('   Please run `ntcli auth login` first'));
      process.exit(1);
    }
    
    const apiClient = new NimbleBrainApiClient();
    apiClient.setClerkJwtToken(clerkIdToken);
    
    try {
      await apiClient.deleteWorkspace(workspaceId);
    } catch (apiError) {
      if (apiError instanceof ApiError && apiError.statusCode === 404) {
        // Workspace doesn't exist on server, but we can still remove it locally
        console.log(chalk.yellow('   ⚠️  Workspace not found on server, removing from local config'));
      } else {
        throw apiError;
      }
    }
    
    spinner.text = '🗑️  Removing workspace from local config...';
    
    // Remove workspace from local storage
    workspaceStorage.removeWorkspace(workspaceId);
    
    spinner.succeed('✅ Workspace deleted successfully!');
    console.log(chalk.gray(`   Deleted workspace: ${workspaceName} (${workspaceId})`));
    
    // Check if this was the active workspace
    const activeWorkspace = workspaceStorage.getActiveWorkspace();
    if (!activeWorkspace) {
      console.log(chalk.yellow('   ⚠️  This was your active workspace'));
      console.log(chalk.cyan('   💡 Use `ntcli workspace switch <name>` to set a new active workspace'));
    }
    
  } catch (error) {
    spinner.fail('❌ Failed to delete workspace');
    
    if (error instanceof ApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your authentication'));
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