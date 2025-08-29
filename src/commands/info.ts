import chalk from 'chalk';
import { ConfigManager } from '../lib/config-manager.js';

/**
 * Show NimbleTools platform information and resources
 */
export async function handleInfo(options: { discord?: boolean; docs?: boolean; verbose?: boolean } = {}): Promise<void> {
  try {
    const configManager = new ConfigManager();

    // If specific flags are used, handle them directly
    if (options.discord) {
      console.log(chalk.cyan('🔗 Opening Discord community...'));
      const open = await import('open');
      await open.default('https://www.nimbletools.ai/discord');
      return;
    }

    if (options.docs) {
      console.log(chalk.cyan('🔗 Opening documentation...'));
      const open = await import('open');
      await open.default('https://docs.nimbletools.ai');
      return;
    }

    console.log(chalk.blue.bold('📚 NimbleTools Platform Information'));
    console.log();

    // Platform links
    console.log(chalk.blue.bold('🌐 Links'));
    console.log(`  ${chalk.gray('Documentation:')} ${chalk.cyan('https://docs.nimbletools.ai')}`);
    console.log(`  ${chalk.gray('GitHub:')} ${chalk.cyan('https://github.com/nimbletools/ntcli')}`);
    console.log(`  ${chalk.gray('Discord Community:')} ${chalk.cyan('https://www.nimbletools.ai/discord')}`);
    console.log(`  ${chalk.gray('Website:')} ${chalk.cyan('https://nimbletools.ai')}`);

    if (options.verbose) {
      console.log();
      console.log(chalk.blue.bold('🔧 Current Configuration'));
      console.log(`  ${chalk.gray('Domain:')} ${chalk.cyan(configManager.getDomain())}`);
      console.log(`  ${chalk.gray('Protocol:')} ${configManager.isInsecure() ? chalk.yellow('HTTP') : chalk.green('HTTPS')}`);
      console.log(`  ${chalk.gray('Management API:')} ${chalk.cyan(configManager.getManagementApiUrl())}`);
      console.log(`  ${chalk.gray('MCP Runtime:')} ${chalk.cyan(configManager.getMcpApiUrl())}`);

      const activeWorkspace = configManager.getActiveWorkspace();
      if (activeWorkspace) {
        console.log(`  ${chalk.gray('Active Workspace:')} ${chalk.cyan(activeWorkspace.workspace_name)}`);
      } else {
        console.log(`  ${chalk.gray('Active Workspace:')} ${chalk.gray('None')}`);
      }
    }

    console.log();
    console.log(chalk.blue.bold('💡 Quick Start'));
    console.log(`  ${chalk.gray('Authenticate:')} ${chalk.cyan('ntcli auth login')}`);
    console.log(`  ${chalk.gray('Create workspace:')} ${chalk.cyan('ntcli workspace create my-project')}`);
    console.log(`  ${chalk.gray('Browse servers:')} ${chalk.cyan('ntcli registry list')}`);
    console.log(`  ${chalk.gray('Deploy server:')} ${chalk.cyan('ntcli server deploy <server-id>')}`);

    console.log();
    console.log(chalk.cyan('🔗 Quick Access:'));
    console.log(chalk.cyan('   ntcli info --discord     # Open Discord community'));
    console.log(chalk.cyan('   ntcli info --docs        # Open documentation'));
    console.log(chalk.cyan('   ntcli info --verbose     # Show detailed config'));

  } catch (error) {
    console.error(chalk.red('❌ Failed to show platform information'));

    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }

    process.exit(1);
  }
}