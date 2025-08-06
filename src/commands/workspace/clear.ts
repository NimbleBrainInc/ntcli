import chalk from 'chalk';
import { WorkspaceCommandOptions } from '../../types/index.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';

/**
 * Clear the active workspace (unset)
 */
export async function handleWorkspaceClear(
  options: WorkspaceCommandOptions = {}
): Promise<void> {
  try {
    const workspaceStorage = new WorkspaceStorage();
    const activeWorkspace = workspaceStorage.getActiveWorkspace();
    
    if (!activeWorkspace) {
      console.log(chalk.yellow('❌ No active workspace to clear'));
      console.log(chalk.gray('   No workspace is currently active'));
      return;
    }
    
    // Clear the active workspace
    workspaceStorage.clearActiveWorkspace();
    
    console.log(chalk.green('✅ Active workspace cleared'));
    console.log(chalk.gray(`   Cleared: ${activeWorkspace.workspace_name} (${activeWorkspace.workspace_id})`));
    console.log();
    console.log(chalk.cyan('💡 Use `ntcli workspace switch <name>` to set an active workspace'));
    console.log(chalk.cyan('💡 Use `ntcli workspace list` to see all available workspaces'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to clear active workspace'));
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}