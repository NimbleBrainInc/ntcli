import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { v4 as uuidv4 } from 'uuid';
import { ClerkOAuthClient } from '../../lib/auth/clerk-oauth-client.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { LocalCallbackServer } from '../../lib/auth/local-server.js';
import { TokenExchangeClient } from '../../lib/auth/token-exchange.js';
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

      // Fetch user information from Clerk
      const clerkUserInfo = await oauthClient.fetchUserInfo(tokens.accessToken);

      // Exchange Clerk token for NimbleBrain API token
      if (!tokens.idToken) {
        throw new Error('No ID token received from authentication provider');
      }

      waitSpinner.text = '🔐 Validating CLI access...';

      let nimblebrainToken: string;
      try {
        const tokenExchangeClient = new TokenExchangeClient();
        nimblebrainToken = await tokenExchangeClient.exchangeToken(tokens.idToken);
      } catch (error) {
        // Token exchange failure is a login failure
        if (error instanceof Error) {
          if (error.message.includes('403')) {
            throw new Error('Access denied: Your account does not have CLI access. Please contact your administrator.');
          } else if (error.message.includes('401')) {
            throw new Error('Authentication failed: Invalid credentials.');
          } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            throw new Error('Service temporarily unavailable. Please try again later.');
          } else {
            throw new Error(`Failed to validate CLI access: ${error.message}`);
          }
        }
        throw new Error('Failed to validate CLI access');
      }

      // Decode the NimbleBrain token to get organization ID
      let organizationId: string | undefined;
      try {
        const jwtParts = nimblebrainToken.split('.');
        if (jwtParts[1]) {
          const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString());
          organizationId = payload.nb_organization_id;
        }
      } catch {
        // If we can't decode, that's okay - organizationId is optional
      }

      waitSpinner.text = '💾 Saving authentication data...';

      // Store only the NimbleBrain bearer token and user info
      await tokenManager.saveAuthSession({
        bearerToken: nimblebrainToken,
        expiresAt: tokens.expiresAt, // Use the same expiration as the OAuth token
        user: {
          id: clerkUserInfo.id,
          email: clerkUserInfo.email,
          firstName: clerkUserInfo.firstName,
          lastName: clerkUserInfo.lastName,
          organizationId
        }
      });
      
      waitSpinner.succeed('✅ Authentication successful!');

      // Display user information
      console.log(chalk.green(`   Logged in as: ${clerkUserInfo.email}`));
      console.log(chalk.gray(`   User ID: ${clerkUserInfo.id}`));

      if (clerkUserInfo.firstName || clerkUserInfo.lastName) {
        const fullName = [clerkUserInfo.firstName, clerkUserInfo.lastName].filter(Boolean).join(' ');
        console.log(chalk.gray(`   Name: ${fullName}`));
      }

      if (organizationId) {
        console.log(chalk.gray(`   Organization: ${organizationId}`));
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