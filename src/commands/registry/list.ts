import chalk from 'chalk';
import ora from 'ora';
import { RegistryCommandOptions, RegistryServer, RegistryServerFilters } from '../../types/index.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
import { TokenManager } from '../../lib/auth/token-manager.js';

/**
 * List servers from the registry
 */
export async function handleRegistryList(
  options: RegistryCommandOptions = {}
): Promise<void> {
  const spinner = ora('📦 Fetching registry servers...').start();
  
  try {
    // Initialize API client with authentication
    const tokenManager = new TokenManager();
    const apiClient = new NimbleBrainApiClient();
    
    // Check authentication and set JWT token
    const isAuthenticated = await tokenManager.isAuthenticated();
    if (isAuthenticated) {
      const clerkIdToken = await tokenManager.getValidClerkIdToken();
      if (clerkIdToken) {
        apiClient.setClerkJwtToken(clerkIdToken);
      }
    }
    
    spinner.text = '🔍 Searching registry...';
    
    // Fetch servers from API
    const response = await apiClient.listRegistryServers({});
    
    let servers = response.servers || [];
    const total = response.total || 0;
    
    // Apply limit if specified
    if (options.limit) {
      servers = servers.slice(0, options.limit);
    }
    
    spinner.succeed(`📦 Registry servers (${servers.length} of ${total}):`);
    
    if (servers.length === 0) {
      console.log(chalk.gray('   No servers found'));
      return;
    }
    
    console.log();
    for (const server of servers) {
      // Server name with version and ID
      const serverName = server.name || 'Unknown Server';
      const serverVersion = server.version || '0.0.0';
      const serverId = server.id || server.server_id || 'unknown';
      const featuredIcon = server.featured ? '⭐ ' : '';
      console.log(`${featuredIcon}${chalk.cyan(serverName)} ${chalk.gray('v' + serverVersion)} ${chalk.dim('[' + serverId + ']')}`);
      
      // Description
      const description = server.description || 'No description available';
      console.log(`  ${chalk.white(description)}`);
      
      // Author and category
      const author = server.author || 'unknown';
      const category = server.category || 'uncategorized';
      console.log(`  ${chalk.gray('by ' + author)} • ${chalk.blue(category)}`);
      
      // Capabilities
      const capabilities = [];
      if (server.tools_count > 0) {
        capabilities.push(`${server.tools_count} tools`);
      }
      if (server.resources_count > 0) {
        capabilities.push(`${server.resources_count} resources`);
      }
      if (server.prompts_count > 0) {
        capabilities.push(`${server.prompts_count} prompts`);
      }
      if (capabilities.length > 0) {
        console.log(`  ${chalk.cyan('Capabilities:')} ${capabilities.join(', ')}`);
      }
      
      if (options.verbose) {
        console.log(`  ${chalk.gray('ID: ' + (server.id || server.server_id || 'N/A'))}`);
        if (server.status) {
          console.log(`  ${chalk.gray('Status: ' + server.status)}`);
        }
        if (server.license) {
          console.log(`  ${chalk.gray('License: ' + server.license)}`);
        }
        if (server.created_at) {
          console.log(`  ${chalk.gray('Created: ' + new Date(server.created_at).toLocaleString())}`);
        }
        if (server.updated_at) {
          console.log(`  ${chalk.gray('Updated: ' + new Date(server.updated_at).toLocaleString())}`);
        }
        
        if (server.repository) {
          console.log(`  ${chalk.gray('Repository: ' + server.repository)}`);
        }
        if (server.homepage) {
          console.log(`  ${chalk.gray('Homepage: ' + server.homepage)}`);
        }
        
        // Deployment info
        if (server.deployment) {
          if (server.deployment.resource_limits) {
            const memory = server.deployment.resource_limits.memory || 'N/A';
            const cpu = server.deployment.resource_limits.cpu || 'N/A';
            console.log(`  ${chalk.gray('Resource limits: ' + memory + ' memory, ' + cpu + ' CPU')}`);
          }
        }
      }
      
      console.log();
    }
    
    // Show summary and filter info
    if (response.registry_url) {
      console.log(chalk.gray(`   Registry URL: ${response.registry_url}`));
    }
    if (response.user_id) {
      console.log(chalk.gray(`   User ID: ${response.user_id}`));
    }
    
    if (!options.verbose) {
      console.log(chalk.gray('   💡 Use --verbose for deployment details'));
    }
    
    // Show available categories if returned by API
    if (response.categories && Array.isArray(response.categories) && response.categories.length > 0) {
      console.log(chalk.cyan('   💡 Available categories: ' + response.categories.join(', ')));
    }
    console.log(chalk.cyan('   💡 Use `ntcli registry show <server-id>` for detailed information'));
    
  } catch (error) {
    spinner.fail('❌ Failed to fetch registry servers');
    
    if (error instanceof ApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your authentication'));
      } else if (error.statusCode === 503) {
        console.log(chalk.yellow('   💡 Registry service may be temporarily unavailable. Try again later.'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}