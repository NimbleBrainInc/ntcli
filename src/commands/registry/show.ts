import chalk from 'chalk';
import ora from 'ora';
import { RegistryCommandOptions } from '../../types/index.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';

/**
 * Show detailed information about a registry server
 */
export async function handleRegistryShow(
  serverId: string,
  options: RegistryCommandOptions = {}
): Promise<void> {
  const spinner = ora(`🔍 Fetching server details for ${serverId}...`).start();
  
  try {
    // Initialize API client (registry is public, no auth needed)
    const apiClient = new NimbleBrainApiClient();
    
    // Fetch server details from API
    const server = await apiClient.getRegistryServer(serverId);
    
    spinner.succeed(`📦 Server details: ${server.name}`);
    
    console.log();
    
    // Header with name and version
    const featuredIcon = server.featured ? '⭐ ' : '';
    console.log(`${featuredIcon}${chalk.cyan.bold(server.name)} ${chalk.gray('v' + server.version)}`);
    
    // Basic info
    console.log(`${chalk.white(server.description)}`);
    console.log();
    
    // Metadata
    console.log(chalk.blue.bold('📋 Metadata'));
    console.log(`  ${chalk.gray('Server ID:')} ${server.id || server.server_id}`);
    console.log(`  ${chalk.gray('Author:')} ${server.author}`);
    console.log(`  ${chalk.gray('Category:')} ${chalk.blue(server.category)}`);
    if (server.ownership || server.ownership_type) {
      console.log(`  ${chalk.gray('Ownership:')} ${server.ownership || server.ownership_type}`);
    }
    if (server.license) {
      console.log(`  ${chalk.gray('License:')} ${server.license}`);
    }
    if (server.status) {
      console.log(`  ${chalk.gray('Status:')} ${server.status}`);
    }
    if (server.featured !== undefined) {
      console.log(`  ${chalk.gray('Featured:')} ${server.featured ? '✅ Yes' : '❌ No'}`);
    }
    if (server.created_at) {
      console.log(`  ${chalk.gray('Created:')} ${new Date(server.created_at).toLocaleString()}`);
    }
    if (server.updated_at) {
      console.log(`  ${chalk.gray('Updated:')} ${new Date(server.updated_at).toLocaleString()}`);
    }
    console.log();
    
    // Links
    if (server.homepage || server.repository) {
      console.log(chalk.blue.bold('🔗 Links'));
      if (server.homepage) {
        console.log(`  ${chalk.gray('Homepage:')} ${chalk.cyan(server.homepage)}`);
      }
      if (server.repository) {
        console.log(`  ${chalk.gray('Repository:')} ${chalk.cyan(server.repository)}`);
      }
      console.log();
    }
    
    // Capabilities
    console.log(chalk.blue.bold('⚡ Capabilities'));
    console.log(`  ${chalk.gray('Tools:')} ${server.tools_count}`);
    console.log(`  ${chalk.gray('Resources:')} ${server.resources_count}`);
    console.log(`  ${chalk.gray('Prompts:')} ${server.prompts_count}`);
    
    // Show detailed tool information if available
    if (server.capabilities && Array.isArray(server.capabilities.tools) && server.capabilities.tools.length > 0) {
      console.log();
      console.log(chalk.blue.bold('🔧 Available Tools'));
      for (const tool of server.capabilities.tools) {
        console.log(`  ${chalk.cyan(tool.name)}: ${chalk.gray(tool.description || 'No description')}`);
      }
    }
    console.log();
    
    // Deployment configuration (if available)
    if (server.deployment) {
      console.log(chalk.blue.bold('🚀 Deployment Configuration'));
      
      if (server.deployment.resource_limits) {
        console.log(`  ${chalk.gray('Memory Limit:')} ${server.deployment.resource_limits.memory}`);
        console.log(`  ${chalk.gray('CPU Limit:')} ${server.deployment.resource_limits.cpu}`);
      } else {
        console.log(`  ${chalk.gray('No resource limits specified')}`);
      }
      
      if (server.deployment.environment_variables && Object.keys(server.deployment.environment_variables).length > 0) {
        console.log(`  ${chalk.gray('Environment Variables:')}`);
        for (const [key, value] of Object.entries(server.deployment.environment_variables)) {
          console.log(`    ${chalk.cyan(key)}: ${value}`);
        }
      }
      console.log();
    }
    
    // Source information (if available)
    if (server.source) {
      console.log(chalk.blue.bold('📦 Source Information'));
      console.log(`  ${chalk.gray('Type:')} ${server.source.type}`);
      if (server.source.repository) {
        console.log(`  ${chalk.gray('Repository:')} ${server.source.repository}`);
      }
      if (server.source.docker_image) {
        console.log(`  ${chalk.gray('Docker Image:')} ${server.source.docker_image}`);
      }
      if (server.source.tag) {
        console.log(`  ${chalk.gray('Tag:')} ${server.source.tag}`);
      }
      console.log();
    }
    
    // Footer info
    console.log(chalk.cyan('💡 Use `ntcli registry list` to browse all available servers'));
    
  } catch (error) {
    spinner.fail('❌ Failed to fetch server details');
    
    if (error instanceof ApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your authentication'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow(`   💡 Server '${serverId}' not found in registry`));
        console.log(chalk.cyan('   💡 Use `ntcli registry list` to see available servers'));
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