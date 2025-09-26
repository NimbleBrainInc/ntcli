import chalk from 'chalk';
import ora from 'ora';
import { RegistryCommandOptions } from '../../types/index.js';
import { RegistryClient, RegistryApiError } from '../../lib/api/registry-client.js';

/**
 * Show detailed information about a registry server
 */
export async function handleRegistryShow(
  serverId: string,
  options: RegistryCommandOptions = {}
): Promise<void> {
  const spinner = ora(`🔍 Fetching server details for ${serverId}...`).start();

  try {
    // Initialize registry client
    const registryClient = new RegistryClient();

    // Fetch server details from registry
    const server = await registryClient.getServer(serverId, options.version as string | undefined);
    
    spinner.succeed(`📦 Server details: ${server.name}`);
    
    console.log();
    
    // Header with name and version
    const featured = server._meta?.['ai.nimblebrain.mcp/v1']?.registry?.showcase?.featured;
    const featuredIcon = featured ? '⭐ ' : '';
    console.log(`${featuredIcon}${chalk.cyan.bold(server.name)} ${chalk.gray('v' + server.version)}`);

    // Basic info
    console.log(`${chalk.white(server.description || 'No description available')}`)
    console.log();
    
    // Metadata
    console.log(chalk.blue.bold('📋 Metadata'));
    console.log(`  ${chalk.gray('Name:')} ${server.name}`);
    console.log(`  ${chalk.gray('Version:')} ${server.version}`);
    console.log(`  ${chalk.gray('Author:')} ${server.author || 'Unknown'}`);

    // Categories from NimbleTools metadata
    const categories = server._meta?.['ai.nimblebrain.mcp/v1']?.registry?.categories || [];
    if (categories.length > 0) {
      console.log(`  ${chalk.gray('Categories:')} ${chalk.blue(categories.join(', '))}`);
    }

    // Tags from NimbleTools metadata
    const tags = server._meta?.['ai.nimblebrain.mcp/v1']?.registry?.tags || [];
    if (tags.length > 0) {
      console.log(`  ${chalk.gray('Tags:')} ${tags.join(', ')}`);
    }

    if (server.license) {
      console.log(`  ${chalk.gray('License:')} ${server.license}`);
    }

    if (featured !== undefined) {
      console.log(`  ${chalk.gray('Featured:')} ${featured ? '✅ Yes' : '❌ No'}`);
    }
    console.log();
    
    // Links
    const repoUrl = typeof server.repository === 'object' && server.repository !== null && 'url' in server.repository
      ? server.repository.url
      : typeof server.repository === 'string' ? server.repository : undefined;

    if (server.homepage || repoUrl) {
      console.log(chalk.blue.bold('🔗 Links'));
      if (server.homepage) {
        console.log(`  ${chalk.gray('Homepage:')} ${chalk.cyan(server.homepage)}`);
      }
      if (repoUrl && typeof repoUrl === 'string') {
        console.log(`  ${chalk.gray('Repository:')} ${chalk.cyan(repoUrl)}`);
      }
      console.log();
    }
    
    // Capabilities
    console.log(chalk.blue.bold('⚡ Capabilities'));
    const toolsCount = server.capabilities?.tools?.length || 0;
    const resourcesCount = server.capabilities?.resources?.length || 0;
    const promptsCount = server.capabilities?.prompts?.length || 0;

    console.log(`  ${chalk.gray('Tools:')} ${toolsCount}`);
    console.log(`  ${chalk.gray('Resources:')} ${resourcesCount}`);
    console.log(`  ${chalk.gray('Prompts:')} ${promptsCount}`);

    // Show detailed tool information if available
    if (server.capabilities?.tools?.length) {
      console.log();
      console.log(chalk.blue.bold('🔧 Available Tools'));
      for (const tool of server.capabilities.tools) {
        console.log(`  ${chalk.cyan(tool.name)}: ${chalk.gray(tool.description || 'No description')}`);
      }
    }
    console.log();
    
    // NimbleTools runtime configuration (if available)
    const runtime = server._meta?.['ai.nimblebrain.mcp/v1'];
    if (runtime) {
      console.log(chalk.blue.bold('🚀 Runtime Configuration'));

      // Resource configuration
      if (runtime.resources) {
        if (runtime.resources.limits) {
          console.log(`  ${chalk.gray('Memory Limit:')} ${runtime.resources.limits.memory || 'Default'}`);
          console.log(`  ${chalk.gray('CPU Limit:')} ${runtime.resources.limits.cpu || 'Default'}`);
        }
        if (runtime.resources.requests) {
          console.log(`  ${chalk.gray('Memory Request:')} ${runtime.resources.requests.memory || 'Default'}`);
          console.log(`  ${chalk.gray('CPU Request:')} ${runtime.resources.requests.cpu || 'Default'}`);
        }
      }

      // Scaling configuration
      if (runtime.scaling) {
        console.log(`  ${chalk.gray('Auto-scaling:')} ${runtime.scaling.enabled ? 'Enabled' : 'Disabled'}`);
        if (runtime.scaling.enabled) {
          console.log(`  ${chalk.gray('Min Replicas:')} ${runtime.scaling.minReplicas || 1}`);
          console.log(`  ${chalk.gray('Max Replicas:')} ${runtime.scaling.maxReplicas || 3}`);
        }
      }

      // Health check configuration
      if (runtime.container?.healthCheck) {
        console.log(`  ${chalk.gray('Health Check Path:')} ${runtime.container.healthCheck.path || '/health'}`);
      }

      console.log();
    }
    
    // Transport information (if available)
    if (server.transport) {
      console.log(chalk.blue.bold('📦 Transport Information'));
      console.log(`  ${chalk.gray('Type:')} ${server.transport.type}`);

      if (server.transport.runtime) {
        console.log(`  ${chalk.gray('Runtime:')} ${server.transport.runtime}`);
      }
      if (server.transport.command) {
        console.log(`  ${chalk.gray('Command:')} ${server.transport.command}`);
      }
      if (server.transport.args?.length) {
        console.log(`  ${chalk.gray('Arguments:')} ${server.transport.args.join(' ')}`);
      }

      console.log();
    }
    
    // Footer info
    console.log(chalk.cyan('💡 Use `ntcli registry list` to browse all available servers'));
    
  } catch (error) {
    spinner.fail('❌ Failed to fetch server details');

    if (error instanceof RegistryApiError) {
      console.error(chalk.red(`   ${error.message}`));

      if (error.isNotFoundError()) {
        console.log(chalk.yellow(`   💡 Server '${serverId}' not found in registry`));
        console.log(chalk.cyan('   💡 Use `ntcli registry list` to see available servers'));
      } else if (error.isServerError()) {
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