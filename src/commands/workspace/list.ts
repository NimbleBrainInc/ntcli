import chalk from 'chalk';
import ora from 'ora';
import { WorkspaceCommandOptions } from '../../types/index.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';

/**
 * List all workspaces
 */
export async function handleWorkspaceList(
  options: WorkspaceCommandOptions = {}
): Promise<void> {
  const spinner = ora('📋 Loading workspaces...').start();
  
  try {
    // Initialize workspace storage
    const workspaceStorage = new WorkspaceStorage();
    
    // Get local workspaces
    const workspaces = workspaceStorage.getAllWorkspaces();
    const activeWorkspace = workspaceStorage.getActiveWorkspace();
    
    spinner.succeed(`📋 Local workspaces (${workspaces.length} total):`);
    
    if (workspaces.length === 0) {
      console.log(chalk.gray('   No workspaces found'));
      console.log(chalk.cyan('   💡 Create your first workspace with `ntcli workspace create <name>`'));
      return;
    }
    
    console.log();
    for (const workspace of workspaces) {
      const isActive = workspace.isActive || (activeWorkspace?.workspace_id === workspace.workspace_id);
      const prefix = isActive ? chalk.green('* ') : '  ';
      const nameColor = isActive ? chalk.green : chalk.white;
      
      // Display format: "name (id)"
      console.log(`${prefix}${nameColor(workspace.workspace_name)} ${chalk.gray(`(${workspace.workspace_id})`)}`);
      
      if (options.verbose) {
        if (workspace.access_token) {
          const tokenInfo = workspaceStorage.getTokenExpirationInfo(workspace.workspace_id);
          if (tokenInfo && !tokenInfo.isExpired) {
            console.log(`    Token: ${chalk.gray('••••••••' + workspace.access_token.slice(-8))} (expires in ${tokenInfo.minutesRemaining}m)`);
          } else {
            console.log(`    Token: ${chalk.red('Expired or missing')}`);
          }
        } else {
          console.log(`    Token: ${chalk.red('No token stored')}`);
        }
      }
    }
    
    if (!options.verbose) {
      console.log();
      console.log(chalk.gray('   💡 Use --verbose for token details'));
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
    spinner.fail('❌ Failed to list workspaces');
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}

