import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../lib/config-manager.js';

/**
 * Set the domain for all API endpoints
 */
export async function handleDomainSet(domain: string, options: { verbose?: boolean; insecure?: boolean } = {}): Promise<void> {
  if (!domain || domain.trim().length === 0) {
    console.error(chalk.red('❌ Domain cannot be empty'));
    console.log(chalk.yellow('   Please provide a valid domain'));
    console.log(chalk.cyan('   💡 Examples:'));
    console.log(chalk.cyan('     ntcli domain set nimbletools.ai'));
    console.log(chalk.cyan('     ntcli domain set localhost:3000'));
    console.log(chalk.cyan('     ntcli domain set dev.mycompany.com'));
    process.exit(1);
  }

  const spinner = ora('⚙️  Setting domain configuration...').start();

  try {
    const configManager = new ConfigManager();
    const previousDomain = configManager.getDomain();
    
    // Clean and validate the domain
    const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    if (cleanDomain.length === 0) {
      spinner.fail('❌ Invalid domain format');
      console.log(chalk.red('   Domain cannot be empty after cleaning'));
      process.exit(1);
    }

    // Set insecure to false by default unless explicitly set to true
    const isInsecure = options.insecure === true;
    configManager.setDomain(cleanDomain, isInsecure);
    
    spinner.succeed('✅ Domain configuration updated');
    
    console.log();
    console.log(chalk.green.bold('🌐 Domain Configuration'));
    console.log(`  ${chalk.gray('Previous:')} ${previousDomain}`);
    console.log(`  ${chalk.gray('Current:')} ${chalk.cyan(cleanDomain)}`);
    console.log(`  ${chalk.gray('Protocol:')} ${isInsecure ? chalk.yellow('HTTP (insecure)') : chalk.green('HTTPS (secure)')}`);
    
    if (options.verbose) {
      console.log();
      console.log(chalk.blue('🔗 API Endpoints:'));
      console.log(`  ${chalk.gray('Management API:')} ${configManager.getManagementApiUrl()}`);
      console.log(`  ${chalk.gray('MCP Runtime:')} ${configManager.getMcpApiUrl()}`);
      console.log(`  ${chalk.gray('Auth Domain:')} ${configManager.getClerkDomain()}`);
    }
    
    console.log();
    console.log(chalk.cyan('💡 Next steps:'));
    if (cleanDomain !== previousDomain) {
      console.log(chalk.cyan('   • You may need to authenticate again: `ntcli auth login`'));
      console.log(chalk.cyan('   • Existing workspace tokens may not work with the new domain'));
    }
    console.log(chalk.cyan('   • Use `ntcli domain show` to see current configuration'));
    
  } catch (error) {
    spinner.fail('❌ Failed to set domain configuration');
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}