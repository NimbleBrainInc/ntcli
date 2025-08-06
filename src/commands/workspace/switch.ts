import chalk from 'chalk';
import ora from 'ora';
import { WorkspaceCommandOptions } from '../../types/index.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';
/**
 * Switch to a different workspace
 */
export async function handleWorkspaceSwitch(
  nameOrId: string,
  options: WorkspaceCommandOptions = {}
): Promise<void> {
  const spinner = ora('🔍 Finding workspace...').start();
  
  try {
    
    // Initialize workspace storage
    const workspaceStorage = new WorkspaceStorage();
    
    // Find workspace by name or ID
    let workspace = workspaceStorage.getWorkspaceByName(nameOrId) || 
                    workspaceStorage.getWorkspace(nameOrId);
    
    if (!workspace) {
      spinner.fail('❌ Workspace not found');
      console.error(chalk.red(`   Workspace '${nameOrId}' not found locally`));
      
      // Show all available workspaces
      const availableWorkspaces = workspaceStorage.getAllWorkspaces();
      if (availableWorkspaces.length > 0) {
        console.log(chalk.yellow('\\n   Available workspaces:'));
        availableWorkspaces.forEach(ws => {
          console.log(chalk.cyan(`   - ${ws.workspace_name} (${ws.workspace_id})`));
        });
      } else {
        console.log(chalk.yellow('   💡 No workspaces found locally. Try `ntcli workspace list` to sync from server.'));
      }
      
      process.exit(1);
    }
    
    spinner.text = '💾 Setting active workspace...';
    
    // Set as active workspace
    const success = workspaceStorage.setActiveWorkspace(workspace.workspace_id);
    
    if (!success) {
      spinner.fail('❌ Failed to set active workspace');
      console.error(chalk.red('   Unable to set workspace as active'));
      process.exit(1);
    }
    
    spinner.succeed('✅ Switched workspace successfully!');
    console.log(chalk.green(`   Active workspace: ${workspace.workspace_name} (${workspace.workspace_id})`));
    
    // Show access token status
    if (workspace.access_token) {
      const tokenInfo = workspaceStorage.getTokenExpirationInfo(workspace.workspace_id);
      if (tokenInfo && !tokenInfo.isExpired) {
        console.log(chalk.cyan(`   🔑 Access token available (expires in ${tokenInfo.minutesRemaining} minutes)`));
      } else {
        console.log(chalk.yellow('   ⚠️  Access token expired - you may need to recreate this workspace'));
      }
    } else {
      console.log(chalk.yellow('   ⚠️  No access token stored - you may need to recreate this workspace'));
    }
    
  } catch (error) {
    spinner.fail('❌ Failed to switch workspace');
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}