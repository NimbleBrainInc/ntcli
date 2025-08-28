import chalk from 'chalk';
import { ConfigManager } from '../../lib/config-manager.js';

/**
 * Show current domain configuration
 */
export async function handleDomainShow(options: { verbose?: boolean } = {}): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const domain = configManager.getDomain();
    const isDefault = domain === 'nimbletools.ai';
    
    console.log(chalk.blue.bold('🌐 Domain Configuration'));
    console.log();
    
    console.log(`  ${chalk.gray('Current Domain:')} ${chalk.cyan(domain)} ${isDefault ? chalk.gray('(default)') : ''}`);
    console.log(`  ${chalk.gray('Protocol:')} ${configManager.isInsecure() ? chalk.yellow('HTTP (insecure)') : chalk.green('HTTPS (secure)')}`);
    
    if (options.verbose) {
      console.log();
      console.log(chalk.blue('🔗 API Endpoints:'));
      console.log(`  ${chalk.gray('Management API:')} ${configManager.getManagementApiUrl()}`);
      console.log(`  ${chalk.gray('MCP Runtime:')} ${configManager.getMcpApiUrl()}`);
      console.log(`  ${chalk.gray('Auth Domain:')} ${configManager.getClerkDomain()}`);
      
      console.log();
      console.log(chalk.blue('📋 Domain Examples:'));
      console.log(`  ${chalk.gray('Production:')} ntcli domain set nimbletools.ai`);
      console.log(`  ${chalk.gray('Local Development:')} ntcli domain set localhost:3000`);
      console.log(`  ${chalk.gray('Custom:')} ntcli domain set dev.mycompany.com`);
      console.log(`  ${chalk.gray('Insecure HTTP:')} ntcli domain set myapi.com --insecure`);
    }
    
    console.log();
    console.log(chalk.cyan('💡 Commands:'));
    console.log(chalk.cyan('   ntcli domain set <domain>    # Change domain'));
    if (!options.verbose) {
      console.log(chalk.cyan('   ntcli domain show --verbose  # Show detailed info'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to show domain configuration'));
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}