import chalk from 'chalk';
import ora from 'ora';
import { ManagementApiError, ManagementClient } from '../../lib/api/management-client.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ConfigManager } from '../../lib/config-manager.js';
import { Config } from '../../lib/config.js';
import { CreateWorkspaceRequest, WorkspaceCommandOptions } from '../../types/index.js';

/**
 * Create a new workspace
 */
export async function handleWorkspaceCreate(
  name: string,
  options: WorkspaceCommandOptions & { description?: string } = {}
): Promise<void> {
  // Validate workspace name
  if (!name || name.trim().length === 0) {
    console.error(chalk.red('❌ Workspace name cannot be empty'));
    console.log(chalk.yellow('   Please provide a valid workspace name'));
    console.log(chalk.cyan('   💡 Example: ntcli workspace create my-project'));
    process.exit(1);
  }
  
  const trimmedName = name.trim();
  if (trimmedName.length > 20) {
    console.error(chalk.red('❌ Workspace name too long'));
    console.log(chalk.yellow('   Workspace names must be 20 characters or less'));
    console.log(chalk.gray(`   Current length: ${trimmedName.length} characters`));
    console.log(chalk.cyan('   💡 Try a shorter name'));
    process.exit(1);
  }
  
  const spinner = ora('🚀 Creating workspace...').start();
  
  try {
    const tokenManager = new TokenManager();
    
    // Try to get NimbleBrain bearer token (if available)
    const nimblebrainToken = await tokenManager.getNimbleBrainToken();

    // Initialize API client
    const apiClient = new ManagementClient();
    if (nimblebrainToken) {
      apiClient.setBearerToken(nimblebrainToken);
    }
    
    spinner.text = '🔨 Setting up workspace...';

    // Get user_id and organization_id - use community defaults for now
    // TODO: Extract from token when auth is fully implemented
    const config = Config.getInstance();

    // Create workspace request
    const createRequest: CreateWorkspaceRequest = {
      name: trimmedName,
      ...(options.description && { description: options.description })
    };

    // Call API to create workspace
    const response = await apiClient.createWorkspace(createRequest);
    
    spinner.text = '💾 Saving workspace locally...';
    
    // Save workspace to local storage
    const configManager = new ConfigManager();
    configManager.addWorkspace(response);
    
    // Automatically set as active workspace if it's the first one
    const workspaceCount = configManager.getWorkspaceCount();
    const shouldSetActive = workspaceCount === 1 || options.verbose; // Auto-activate if first workspace
    
    if (shouldSetActive) {
      configManager.setActiveWorkspace(response.workspace_id);
    }
    
    spinner.succeed('✅ Workspace created successfully!');
    console.log(chalk.green(`   Workspace: ${response.workspace_name} (${response.workspace_id})`));
    
    if (shouldSetActive) {
      console.log(chalk.green(`   ✓ Set as active workspace`));
    }
    
    // Show workspace info
    console.log(chalk.cyan('   💡 Workspace saved locally for easy switching!'));

    if (!shouldSetActive) {
      console.log(chalk.cyan(`   💡 Use \`ntcli workspace switch ${response.workspace_name}\` to activate this workspace`));
    }
    console.log(chalk.cyan(`   💡 Use \`ntcli workspace list\` to see all your workspaces`));
    
  } catch (error) {
    spinner.fail('❌ Failed to create workspace');
    
    if (error instanceof ManagementApiError) {
      // Handle specific API errors
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      // Provide helpful suggestions
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your authentication'));
      } else if (error.isConflictError()) {
        console.log(chalk.yellow('   💡 Try using a different workspace name'));
      } else if (error.isValidationError()) {
        console.log(chalk.yellow('   💡 Check your input parameters and try again'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}