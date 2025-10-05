import chalk from 'chalk';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';

/**
 * Show current token information for workspaces
 */
export async function handleTokenShow(workspaceNameOrId?: string): Promise<void> {
  try {
    const tokenManager = new TokenManager();
    const workspaceStorage = new WorkspaceStorage();
    
    // Check authentication status
    const isAuthenticated = await tokenManager.isAuthenticated();
    const userInfo = await tokenManager.getUserInfo();

    if (!isAuthenticated) {
      console.log(chalk.red('❌ Not authenticated'));
      console.log(chalk.yellow('   Please run `ntcli auth login` first'));
      return;
    }

    console.log(chalk.blue.bold('🔑 Token Status'));
    console.log();

    // Show authentication status
    console.log(`${chalk.gray('API Auth:')} ${chalk.green('✅ Authenticated')}`);
    if (userInfo) {
      console.log(`${chalk.gray('User Email:')} ${userInfo.email}`);
    }
    
    console.log();
    console.log(chalk.blue.bold('🏢 Workspace Tokens'));
    console.log();
    
    if (workspaceNameOrId) {
      // Show specific workspace token
      const workspace = workspaceStorage.getWorkspaceByName(workspaceNameOrId) || 
                       workspaceStorage.getWorkspace(workspaceNameOrId);
      
      if (!workspace) {
        console.log(chalk.red(`❌ Workspace '${workspaceNameOrId}' not found`));
        console.log(chalk.cyan('   💡 Use `ntcli workspace list` to see available workspaces'));
        return;
      }
      
      console.log(`${chalk.gray('Workspace:')} ${workspace.workspace_name} (${workspace.workspace_id})`);
      
      if (workspace.access_token) {
        const tokenInfo = workspaceStorage.getTokenExpirationInfo(workspace.workspace_id);
        if (tokenInfo) {
          console.log(`${chalk.gray('Token Status:')} ${tokenInfo.isExpired ? chalk.red('❌ Expired') : chalk.green('✅ Valid')}`);
          console.log(`${chalk.gray('Token Expires:')} ${chalk.cyan(tokenInfo.expiresAt.toLocaleString())}`);
          console.log(`${chalk.gray('Valid For:')} ${tokenInfo.isExpired ? chalk.red('Expired') : chalk.green(`${tokenInfo.minutesRemaining} minutes`)}`);
          console.log(`${chalk.gray('Token Preview:')} ...${workspace.access_token.slice(-8)}`);
          console.log(`${chalk.gray('Token Type:')} ${workspace.token_type}`);
          if (workspace.scope && workspace.scope.length > 0) {
            console.log(`${chalk.gray('Scope:')} ${workspace.scope.join(', ')}`);
          }
        }
      } else {
        console.log(`${chalk.gray('Token Status:')} ${chalk.red('❌ No token')}`);
        console.log(chalk.cyan(`   💡 Run \`ntcli token refresh ${workspace.workspace_name}\` to get a token`));
      }
    } else {
      // Show all workspace tokens
      const workspaces = workspaceStorage.getAllWorkspaces();
      const workspaceManager = new WorkspaceManager();
      const activeWorkspace = await workspaceManager.getActiveWorkspace();
      
      if (workspaces.length === 0) {
        console.log(chalk.gray('   No workspaces found'));
        console.log(chalk.cyan('   💡 Create a workspace with `ntcli workspace create <name>`'));
        return;
      }
      
      for (const workspace of workspaces) {
        const isActive = activeWorkspace?.workspace_id === workspace.workspace_id;
        const prefix = isActive ? chalk.green('* ') : '  ';
        
        console.log(`${prefix}${chalk.white(workspace.workspace_name)} ${chalk.gray(`(${workspace.workspace_id})`)}`);
        
        if (workspace.access_token) {
          const tokenInfo = workspaceStorage.getTokenExpirationInfo(workspace.workspace_id);
          if (tokenInfo) {
            const status = tokenInfo.isExpired ? chalk.red('Expired') : chalk.green(`${tokenInfo.minutesRemaining}m left`);
            console.log(`  ${chalk.gray('Token:')} ${status} ${chalk.gray('ending in ...' + workspace.access_token.slice(-4))}`);
          }
        } else {
          console.log(`  ${chalk.gray('Token:')} ${chalk.red('No token')}`);
        }
      }
      
      console.log();
      console.log(chalk.gray('💡 Use `ntcli token show <workspace-name>` for detailed info'));
      console.log(chalk.gray('💡 Use `ntcli token refresh <workspace-name>` to refresh a token'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to get token information'));
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}