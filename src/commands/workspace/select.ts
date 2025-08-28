import chalk from 'chalk';
import inquirer from 'inquirer';
import { WorkspaceCommandOptions } from '../../types/index.js';
import { ConfigManager } from '../../lib/config-manager.js';

/**
 * Interactive workspace selection (similar to kubectl namespace selection)
 */
export async function handleWorkspaceSelect(
  options: WorkspaceCommandOptions = {}
): Promise<void> {
  try {
    // Initialize configuration manager
    const configManager = new ConfigManager();
    
    // Get all workspaces
    const workspaces = configManager.getAllWorkspaces();
    const activeWorkspace = configManager.getActiveWorkspace();
    
    if (workspaces.length === 0) {
      console.log(chalk.yellow('❌ No workspaces available'));
      console.log(chalk.cyan('   💡 Create your first workspace with `ntcli workspace create <name>`'));
      return;
    }

    if (workspaces.length === 1) {
      const workspace = workspaces[0];
      if (!workspace) {
        console.log(chalk.red('❌ No workspace found'));
        return;
      }
      
      console.log(chalk.green(`✅ Only one workspace available: ${workspace.workspace_name}`));
      
      if (!activeWorkspace || activeWorkspace.workspace_id !== workspace.workspace_id) {
        const success = configManager.setActiveWorkspace(workspace.workspace_id);
        if (success) {
          console.log(chalk.green('   ✓ Set as active workspace'));
        }
      } else {
        console.log(chalk.gray('   Already active'));
      }
      return;
    }

    // Prepare choices for interactive selection
    const choices = workspaces.map(workspace => {
      const isActive = activeWorkspace?.workspace_id === workspace.workspace_id;
      const tokenInfo = configManager.getTokenExpirationInfo(workspace.workspace_id);
      
      let status = '';
      if (isActive) {
        status = chalk.green(' (current)');
      } else if (workspace.access_token && tokenInfo && !tokenInfo.isExpired) {
        status = chalk.cyan(` (token: ${tokenInfo.minutesRemaining}m)`);
      } else if (workspace.access_token) {
        status = chalk.red(' (token expired)');
      } else {
        status = chalk.gray(' (no token)');
      }

      return {
        name: `${workspace.workspace_name}${status}`,
        value: workspace.workspace_id,
        short: workspace.workspace_name
      };
    });

    // Show interactive selection
    console.log(chalk.blue.bold('🔧 Select workspace:'));
    console.log();

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'workspaceId',
        message: 'Choose a workspace:',
        choices,
        default: activeWorkspace?.workspace_id,
        pageSize: Math.min(choices.length, 10),
        loop: false
      }
    ]);

    const selectedWorkspace = workspaces.find(ws => ws.workspace_id === answer.workspaceId);
    
    if (!selectedWorkspace) {
      console.log(chalk.red('❌ Selected workspace not found'));
      return;
    }

    // Switch to selected workspace
    const success = configManager.setActiveWorkspace(selectedWorkspace.workspace_id);
    
    if (success) {
      console.log();
      console.log(chalk.green(`✅ Switched to workspace: ${selectedWorkspace.workspace_name}`));
      
      // Show token status
      const tokenInfo = configManager.getTokenExpirationInfo(selectedWorkspace.workspace_id);
      if (selectedWorkspace.access_token && tokenInfo && !tokenInfo.isExpired) {
        console.log(chalk.cyan(`   🔑 Access token available (expires in ${tokenInfo.minutesRemaining} minutes)`));
      } else if (selectedWorkspace.access_token) {
        console.log(chalk.yellow('   ⚠️  Access token expired - you may need to recreate this workspace'));
      } else {
        console.log(chalk.yellow('   ⚠️  No access token stored - you may need to recreate this workspace'));
      }
    } else {
      console.log(chalk.red('❌ Failed to switch workspace'));
    }

  } catch (error) {
    if (error && typeof error === 'object' && 'isTtyError' in error) {
      // Inquirer TTY error - fallback to non-interactive mode
      console.log(chalk.yellow('⚠️  Interactive mode not available in this terminal'));
      console.log(chalk.cyan('   💡 Use `ntcli workspace list` to see available workspaces'));
      console.log(chalk.cyan('   💡 Use `ntcli workspace switch <name>` to switch to a specific workspace'));
      return;
    }

    console.error(chalk.red('❌ Failed to select workspace'));
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}