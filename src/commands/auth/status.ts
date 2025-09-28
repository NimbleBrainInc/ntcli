import chalk from 'chalk';
import ora from 'ora';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ConfigManager } from '../../lib/config-manager.js';

/**
 * Display current authentication status
 */
export async function handleStatus(): Promise<void> {
  const spinner = ora('🔍 Checking authentication status...').start();

  try {
    const tokenManager = new TokenManager();
    const configManager = new ConfigManager();

    const isAuthenticated = await tokenManager.isAuthenticated();
    const userInfo = await tokenManager.getUserInfo();
    const auth = configManager.loadConfig().auth;

    spinner.stop();

    if (isAuthenticated && userInfo) {
      console.log(chalk.green('✅ Authenticated'));
      console.log(chalk.gray(`   Email: ${userInfo.email}`));
      console.log(chalk.gray(`   User ID: ${userInfo.id}`));

      if (userInfo.firstName || userInfo.lastName) {
        const fullName = [userInfo.firstName, userInfo.lastName]
          .filter(Boolean)
          .join(' ');
        console.log(chalk.gray(`   Name: ${fullName}`));
      }

      if (userInfo.organizationId) {
        console.log(chalk.gray(`   Organization: ${userInfo.organizationId}`));
      }

      if (auth && 'expiresAt' in auth) {
        const expiresAt = new Date(auth.expiresAt);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();

        if (timeUntilExpiry > 0) {
          const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
          const minutesUntilExpiry = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));

          console.log(chalk.gray(`   Token expires: ${expiresAt.toLocaleString()}`));
          console.log(chalk.gray(`   Time remaining: ${hoursUntilExpiry}h ${minutesUntilExpiry}m`));
        } else {
          console.log(chalk.yellow(`   Token expired: ${expiresAt.toLocaleString()}`));
        }
      }

      // Show bearer token info (first/last few chars for security)
      const bearerToken = await tokenManager.getNimbleBrainToken();
      if (bearerToken) {
        const tokenPreview = `${bearerToken.substring(0, 20)}...${bearerToken.substring(bearerToken.length - 10)}`;
        console.log(chalk.gray(`   Bearer token: ${tokenPreview}`));
      }
    } else {
      console.log(chalk.yellow('❌ Not authenticated'));
      console.log(chalk.gray('   Please run: ntcli auth login'));
    }

  } catch (error) {
    spinner.fail('❌ Failed to check authentication status');

    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }

    process.exit(1);
  }
}