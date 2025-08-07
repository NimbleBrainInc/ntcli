import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { v4 as uuidv4 } from 'uuid';
import { ClerkOAuthClient } from '../../lib/auth/clerk-oauth-client.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { LocalCallbackServer } from '../../lib/auth/local-server.js';
import { Config } from '../../lib/config.js';
import { AuthCommandOptions } from '../../types/index.js';

/**
 * Handle user login/signup via OAuth
 */
export async function handleLogin(options: AuthCommandOptions = {}): Promise<void> {
  const spinner = ora('🔐 Starting authentication...').start();
  
  try {
    const config = Config.getInstance();
    const tokenManager = new TokenManager();
    
    // Check if already authenticated (unless forced)
    const isAuthenticated = await tokenManager.isAuthenticated();
    if (isAuthenticated && !options.force) {
      const userInfo = await tokenManager.getUserInfo();
      spinner.succeed('✅ Already authenticated');
      console.log(chalk.green(`   Logged in as: ${userInfo?.email || 'Unknown user'}`));
      console.log(chalk.gray('   💡 Use --force to login again with a different account'));
      return;
    }
    
    if (isAuthenticated && options.force) {
      spinner.text = '🔄 Clearing existing authentication...';
      await tokenManager.clearTokens();
    }

    // Get Clerk OAuth configuration
    const clerkConfig = config.getClerkConfig();
    const oauthClient = new ClerkOAuthClient(clerkConfig);
    
    // Start local callback server
    spinner.text = '🚀 Starting local server...';
    const callbackServer = new LocalCallbackServer({
      port: options.port || config.getDefaultPort()
    });
    
    const actualPort = await callbackServer.start();
    const callbackUrl = callbackServer.getCallbackUrl(actualPort);
    
    // Update the redirect URI to use the actual port
    clerkConfig.redirectUri = callbackUrl;
    
    // Generate PKCE challenge and state
    const pkceChallenge = oauthClient.generatePKCEChallenge();
    const state = uuidv4();
    
    // Build authorization URL
    const authUrl = oauthClient.buildAuthorizationUrl(pkceChallenge, state);
    
    spinner.text = '📱 Opening browser for authentication...';
    
    // Open browser
    try {
      await open(authUrl);
      spinner.succeed('📱 Browser opened for authentication');
    } catch (error) {
      spinner.warn('⚠️  Could not automatically open browser');
      console.log(chalk.yellow('   Please open this URL in your browser:'));
      console.log(chalk.cyan(`   ${authUrl}`));
    }
    
    console.log(chalk.gray('   If browser doesn\'t open, visit the URL above'));
    
    // Wait for callback
    const waitSpinner = ora('⏳ Waiting for authentication...').start();
    
    try {
      const callbackResponse = await callbackServer.waitForCallback(
        options.timeout || config.getOAuthTimeout()
      );
      
      // Verify state parameter
      if (callbackResponse.state !== state) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }
      
      waitSpinner.text = '🔄 Exchanging authorization code for tokens...';
      
      // Exchange code for tokens
      const tokens = await oauthClient.exchangeCodeForTokens(
        callbackResponse.code,
        pkceChallenge.codeVerifier
      );
      
      waitSpinner.text = '👤 Fetching user information...';
      
      // Fetch user information
      const userInfo = await oauthClient.fetchUserInfo(tokens.accessToken);
      
      waitSpinner.text = '💾 Saving authentication data...';
      
      // Store tokens and user info securely
      await tokenManager.saveAuthSession(tokens, userInfo);
      
      waitSpinner.succeed('✅ Authentication successful!');
      
      // Display user information
      console.log(chalk.green(`   Logged in as: ${userInfo.email}`));
      console.log(chalk.gray(`   User ID: ${userInfo.id}`));
      
      if (userInfo.firstName || userInfo.lastName) {
        const fullName = [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ');
        console.log(chalk.gray(`   Name: ${fullName}`));
      }
      
      if (userInfo.username) {
        console.log(chalk.gray(`   Username: ${userInfo.username}`));
      }
      
      // Show token expiration
      const expiresAt = new Date(tokens.expiresAt);
      console.log(chalk.gray(`   Token expires: ${expiresAt.toLocaleString()}`));
      
    } catch (error) {
      waitSpinner.fail('❌ Authentication failed');
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          console.error(chalk.red('   Authentication timed out. Please try again.'));
        } else {
          console.error(chalk.red(`   ${error.message}`));
        }
      } else {
        console.error(chalk.red('   An unexpected error occurred during authentication'));
      }
      
      process.exit(1);
    } finally {
      // Always stop the local server
      await callbackServer.stop();
    }
    
  } catch (error) {
    spinner.fail('❌ Authentication setup failed');
    
    if (error instanceof Error) {
      if (error.message.includes('environment variables')) {
        console.error(chalk.red('   Configuration Error:'));
        console.error(chalk.red(`   ${error.message}`));
        console.log(chalk.yellow('\\n   Please set up your environment variables:'));
        console.log(chalk.cyan('   export CLERK_OAUTH_CLIENT_ID="your_client_id"'));
        console.log(chalk.cyan('   export CLERK_OAUTH_CLIENT_SECRET="your_client_secret"'));
        console.log(chalk.cyan('   export CLERK_DOMAIN="your_clerk_domain"'));
      } else {
        console.error(chalk.red(`   ${error.message}`));
      }
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}