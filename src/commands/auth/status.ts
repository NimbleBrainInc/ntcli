import chalk from 'chalk';
import ora from 'ora';
import { TokenManager } from '../../lib/auth/token-manager.js';

/**
 * Display current authentication status
 */
export async function handleStatus(): Promise<void> {
  const spinner = ora('🔍 Checking authentication status...').start();
  
  try {
    const tokenManager = new TokenManager();
    const authState = await tokenManager.getAuthState();
    
    spinner.stop();
    
    if (authState.isAuthenticated && authState.user) {
      console.log(chalk.green('✅ Authenticated'));
      console.log(chalk.gray(`   Email: ${authState.user.email}`));
      console.log(chalk.gray(`   User ID: ${authState.user.id}`));
      
      if (authState.user.firstName || authState.user.lastName) {
        const fullName = [authState.user.firstName, authState.user.lastName]
          .filter(Boolean)
          .join(' ');
        console.log(chalk.gray(`   Name: ${fullName}`));
      }
      
      if (authState.user.username) {
        console.log(chalk.gray(`   Username: ${authState.user.username}`));
      }
      
      if (authState.tokens) {
        const tokens = authState.tokens;
        const expiresAt = new Date(tokens.expiresAt);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        
        if (timeUntilExpiry > 0) {
          const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
          const minutesUntilExpiry = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));
          
          console.log(chalk.gray(`   Clerk token expires: ${expiresAt.toLocaleString()}`));
          
          if (hoursUntilExpiry > 0) {
            console.log(chalk.gray(`   Time remaining: ${hoursUntilExpiry}h ${minutesUntilExpiry}m`));
          } else {
            console.log(chalk.gray(`   Time remaining: ${minutesUntilExpiry}m`));
          }
          
          // Warn if token expires soon (within 1 hour)
          if (timeUntilExpiry < 60 * 60 * 1000) {
            console.log(chalk.yellow('   ⚠️  Token expires soon - consider re-authenticating'));
          }
        } else {
          console.log(chalk.red('   Clerk token has expired - please login again'));
        }
      }

      // Show workspace token info
      console.log(chalk.gray('   Workspace tokens: Stored per workspace (see `ntcli workspace list --verbose`)'));
      
      console.log();
      console.log(chalk.cyan('💡 Use `ntcli workspace list --verbose` to see workspace token status'));
      
    } else {
      console.log(chalk.red('❌ Not authenticated'));
      console.log(chalk.gray('   Run `ntcli auth login` to authenticate'));
    }
    
  } catch (error) {
    spinner.fail('❌ Failed to check authentication status');
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    // Don't exit with error code for status checks
    console.log(chalk.red('❌ Not authenticated (error occurred)'));
  }
}