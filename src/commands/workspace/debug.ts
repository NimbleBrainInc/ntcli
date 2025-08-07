import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { WorkspaceCommandOptions } from '../../types/index.js';

/**
 * Debug workspace storage files
 */
export async function handleWorkspaceDebug(
  options: WorkspaceCommandOptions = {}
): Promise<void> {
  try {
    const configDir = join(homedir(), '.nimbletools');
    const workspacesFile = join(configDir, 'workspaces.json');
    const tokensFile = join(configDir, 'tokens.json');
    const userFile = join(configDir, 'user.json');
    
    console.log(chalk.blue.bold('🔍 NimbleTools Configuration Debug'));
    console.log();
    
    console.log(chalk.gray('Config Directory:'), configDir);
    console.log(`  ${chalk.gray('Exists:')} ${existsSync(configDir) ? chalk.green('✓') : chalk.red('✗')}`);
    console.log();
    
    // Check workspaces file
    console.log(chalk.cyan.bold('📁 Workspaces File:'));
    console.log(`  ${chalk.gray('Path:')} ${workspacesFile}`);
    console.log(`  ${chalk.gray('Exists:')} ${existsSync(workspacesFile) ? chalk.green('✓') : chalk.red('✗')}`);
    
    if (existsSync(workspacesFile)) {
      try {
        const workspacesData = readFileSync(workspacesFile, 'utf8');
        const workspacesConfig = JSON.parse(workspacesData);
        
        console.log(`  ${chalk.gray('Workspaces count:')} ${Object.keys(workspacesConfig.workspaces || {}).length}`);
        console.log(`  ${chalk.gray('Active workspace ID:')} ${workspacesConfig.activeWorkspaceId || 'None'}`);
        console.log(`  ${chalk.gray('Last updated:')} ${workspacesConfig.lastUpdated || 'Unknown'}`);
        
        if (options.verbose) {
          console.log();
          console.log(chalk.yellow('Raw workspaces.json content:'));
          console.log(JSON.stringify(workspacesConfig, null, 2));
        }
        
        // Show individual workspaces
        if (workspacesConfig.workspaces && Object.keys(workspacesConfig.workspaces).length > 0) {
          console.log();
          console.log(chalk.cyan('Individual workspaces:'));
          for (const [id, workspace] of Object.entries(workspacesConfig.workspaces)) {
            const ws = workspace as any;
            const hasToken = !!ws.access_token;
            const tokenStatus = hasToken ? chalk.green('✓') : chalk.red('✗');
            console.log(`  ${tokenStatus} ${chalk.white(ws.workspace_name)} ${chalk.gray('(' + id + ')')}`);
            if (hasToken && ws.expires_at) {
              const expiresAt = new Date(ws.expires_at);
              const isExpired = expiresAt.getTime() < Date.now();
              const expiredStatus = isExpired ? chalk.red('Expired') : chalk.green('Valid');
              console.log(`    ${chalk.gray('Token expires:')} ${expiredStatus} ${chalk.dim(expiresAt.toLocaleString())}`);
            }
          }
        }
      } catch (parseError) {
        console.log(`  ${chalk.red('Parse Error:')} ${parseError instanceof Error ? parseError.message : 'Unknown'}`);
      }
    }
    
    console.log();
    
    // Check auth tokens file
    console.log(chalk.cyan.bold('🔐 Auth Tokens File:'));
    console.log(`  ${chalk.gray('Path:')} ${tokensFile}`);
    console.log(`  ${chalk.gray('Exists:')} ${existsSync(tokensFile) ? chalk.green('✓') : chalk.red('✗')}`);
    
    if (existsSync(tokensFile)) {
      try {
        const tokensData = readFileSync(tokensFile, 'utf8');
        const tokens = JSON.parse(tokensData);
        console.log(`  ${chalk.gray('Has access token:')} ${tokens.accessToken ? chalk.green('✓') : chalk.red('✗')}`);
        console.log(`  ${chalk.gray('Has ID token:')} ${tokens.idToken ? chalk.green('✓') : chalk.red('✗')}`);
        if (tokens.expiresAt) {
          const expiresAt = new Date(tokens.expiresAt);
          const isExpired = expiresAt.getTime() < Date.now();
          const expiredStatus = isExpired ? chalk.red('Expired') : chalk.green('Valid');
          console.log(`  ${chalk.gray('Auth expires:')} ${expiredStatus} ${chalk.dim(expiresAt.toLocaleString())}`);
        }
      } catch (parseError) {
        console.log(`  ${chalk.red('Parse Error:')} ${parseError instanceof Error ? parseError.message : 'Unknown'}`);
      }
    }
    
    console.log();
    
    // Check user file
    console.log(chalk.cyan.bold('👤 User File:'));
    console.log(`  ${chalk.gray('Path:')} ${userFile}`);
    console.log(`  ${chalk.gray('Exists:')} ${existsSync(userFile) ? chalk.green('✓') : chalk.red('✗')}`);
    
    if (existsSync(userFile)) {
      try {
        const userData = readFileSync(userFile, 'utf8');
        const user = JSON.parse(userData);
        console.log(`  ${chalk.gray('User ID:')} ${user.id || 'Unknown'}`);
        console.log(`  ${chalk.gray('Email:')} ${user.email || 'Unknown'}`);
      } catch (parseError) {
        console.log(`  ${chalk.red('Parse Error:')} ${parseError instanceof Error ? parseError.message : 'Unknown'}`);
      }
    }
    
    console.log();
    console.log(chalk.yellow('💡 Use --verbose to see full file contents'));
    
  } catch (error) {
    console.error(chalk.red('❌ Debug failed'));
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    process.exit(1);
  }
}