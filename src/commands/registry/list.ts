import chalk from 'chalk';
import ora from 'ora';
import { RegistryCommandOptions } from '../../types/index.js';
import { RegistryClient, RegistryApiError } from '../../lib/api/registry-client.js';

/**
 * List servers from the registry
 */
export async function handleRegistryList(
  options: RegistryCommandOptions = {}
): Promise<void> {
  const spinner = ora('📦 Fetching registry servers...').start();

  try {
    // Initialize registry client
    const registryClient = new RegistryClient();

    spinner.text = '🔍 Searching registry...';

    // Fetch servers from registry
    const params: { cursor?: string; limit?: number } = {};
    if (options.limit !== undefined) {
      params.limit = options.limit;
    }
    const response = await registryClient.listServers(params);

    let servers = response.servers || [];
    const total = servers.length;
    
    spinner.succeed(`📦 Registry servers (${servers.length}${response.hasMore ? '+' : ''}):`)
    
    if (servers.length === 0) {
      console.log(chalk.gray('   No servers found'));
      return;
    }
    
    console.log();
    for (const server of servers) {
      // Server name with version
      const serverName = server.name || 'Unknown Server';
      const serverVersion = server.version || '0.0.0';
      const featured = server._meta?.['ai.nimblebrain.mcp/v1']?.registry?.showcase?.featured;
      const featuredIcon = featured ? '⭐ ' : '';
      console.log(`${featuredIcon}${chalk.cyan(serverName)} ${chalk.gray('v' + serverVersion)}`);

      // Description
      const description = server.description || 'No description available';
      console.log(`  ${chalk.white(description)}`);

      // Author and categories
      const author = server.author || 'unknown';
      const categories = server._meta?.['ai.nimblebrain.mcp/v1']?.registry?.categories || [];
      const categoryStr = categories.length > 0 ? categories.join(', ') : 'uncategorized';
      console.log(`  ${chalk.gray('by ' + author)} • ${chalk.blue(categoryStr)}`)
      
      // Capabilities
      const capabilities = [];
      if (server.capabilities?.tools?.length) {
        capabilities.push(`${server.capabilities.tools.length} tools`);
      }
      if (server.capabilities?.resources?.length) {
        capabilities.push(`${server.capabilities.resources.length} resources`);
      }
      if (server.capabilities?.prompts?.length) {
        capabilities.push(`${server.capabilities.prompts.length} prompts`);
      }
      if (capabilities.length > 0) {
        console.log(`  ${chalk.cyan('Capabilities:')} ${capabilities.join(', ')}`);
      }
      
      if (options.verbose) {
        if (server.license) {
          console.log(`  ${chalk.gray('License: ' + server.license)}`);
        }

        const repoUrl = typeof server.repository === 'object' && server.repository !== null && 'url' in server.repository
          ? server.repository.url
          : typeof server.repository === 'string' ? server.repository : undefined;
        if (repoUrl && typeof repoUrl === 'string') {
          console.log(`  ${chalk.gray('Repository: ' + repoUrl)}`);
        }
        if (server.homepage) {
          console.log(`  ${chalk.gray('Homepage: ' + server.homepage)}`);
        }

        // Runtime info from NimbleTools metadata
        const runtime = server._meta?.['ai.nimblebrain.mcp/v1'];
        if (runtime?.resources) {
          if (runtime.resources.limits) {
            const memory = runtime.resources.limits.memory || 'N/A';
            const cpu = runtime.resources.limits.cpu || 'N/A';
            console.log(`  ${chalk.gray('Resource limits: ' + memory + ' memory, ' + cpu + ' CPU')}`)
          }
        }
      }
      
      console.log();
    }
    
    // Show summary info
    console.log(chalk.gray(`   Registry URL: https://registry.nimbletools.ai`));

    if (!options.verbose) {
      console.log(chalk.gray('   💡 Use --verbose for deployment details'));
    }

    if (response.hasMore) {
      console.log(chalk.cyan('   💡 More servers available. Use --limit to see more'));
    }

    console.log(chalk.cyan('   💡 Use `ntcli registry show <server-name>` for detailed information'));
    
  } catch (error) {
    spinner.fail('❌ Failed to fetch registry servers');

    if (error instanceof RegistryApiError) {
      console.error(chalk.red(`   ${error.message}`));

      if (error.isServerError()) {
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