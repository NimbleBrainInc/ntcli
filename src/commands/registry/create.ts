import chalk from 'chalk';
import ora from 'ora';
import { RegistryCommandOptions } from '../../types/index.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { TokenManager } from '../../lib/auth/token-manager.js';

/**
 * Create/enable a new registry
 */
export async function handleRegistryCreate(
  registryUrl: string,
  options: RegistryCommandOptions = {}
): Promise<void> {
  const spinner = ora('📦 Creating registry...').start();
  
  try {
    // Initialize API client with authentication
    const tokenManager = new TokenManager();
    const apiClient = new ManagementClient();
    
    // Try to get JWT token if available
    const clerkIdToken = await tokenManager.getValidClerkIdToken();
    if (clerkIdToken) {
      apiClient.setClerkJwtToken(clerkIdToken);
    }
    
    spinner.text = '🔄 Enabling registry from URL...';
    
    // Create the registry
    const response = await apiClient.createRegistry(
      registryUrl,
      options.namespace
    );
    
    spinner.succeed('✅ Registry enabled successfully!');
    
    console.log();
    console.log(chalk.cyan('📦 Registry Details:'));
    console.log(`  ${chalk.white('Name:')} ${response.registry_name}`);
    console.log(`  ${chalk.white('Namespace:')} ${response.namespace}`);
    console.log(`  ${chalk.white('URL:')} ${response.registry_url}`)
    
    console.log();
    console.log(chalk.cyan('💡 Next steps:'));
    console.log(`  • List registry servers: ${chalk.white('ntcli reg list')}`);
    console.log(`  • View server details: ${chalk.white('ntcli reg show <server-id>')}`);
    
  } catch (error) {
    spinner.fail('❌ Failed to create registry');
    
    if (error instanceof ManagementApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your authentication'));
      } else if (error.statusCode === 409) {
        console.log(chalk.yellow('   💡 This registry may already be enabled. Use `ntcli reg list` to view existing registries.'));
      } else if (error.statusCode === 400) {
        console.log(chalk.yellow('   💡 Make sure the registry URL points to a valid registry.yaml file'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}