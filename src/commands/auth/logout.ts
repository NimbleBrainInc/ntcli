import chalk from 'chalk';
import ora from 'ora';
import { TokenManager } from '../../lib/auth/token-manager.js';

/**
 * Handle user logout by clearing stored credentials
 */
export async function handleLogout(): Promise<void> {
  const spinner = ora('🔐 Logging out...').start();
  
  try {
    const tokenManager = new TokenManager();
    
    // Check if user is currently authenticated
    const authState = await tokenManager.getAuthState();
    
    if (!authState.isAuthenticated) {
      spinner.warn('⚠️  Not currently authenticated');
      console.log(chalk.yellow('   You are not logged in'));
      return;
    }
    
    // Clear stored tokens and user info
    await tokenManager.clearTokens();
    
    spinner.succeed('✅ Logged out successfully');
    
    if (authState.user) {
      console.log(chalk.gray(`   Cleared credentials for: ${authState.user.email}`));
    }
    
  } catch (error) {
    spinner.fail('❌ Logout failed');
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred during logout'));
    }
    
    process.exit(1);
  }
}