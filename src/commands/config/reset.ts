import chalk from 'chalk';
import ora from 'ora';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import inquirer from 'inquirer';

interface ConfigResetOptions {
  force?: boolean;
  verbose?: boolean;
}

/**
 * Reset configuration by deleting the .ntcli directory
 */
export async function handleConfigReset(options: ConfigResetOptions = {}): Promise<void> {
  const configDir = join(homedir(), '.ntcli');
  
  console.log(chalk.yellow.bold('⚠️  Configuration Reset'));
  console.log();
  console.log(chalk.yellow('This will delete ALL local configuration including:'));
  console.log(chalk.red('  • All workspace configurations and tokens'));
  console.log(chalk.red('  • Authentication tokens and sessions'));
  console.log(chalk.red('  • Cached workspace information'));
  console.log(chalk.red('  • Any other stored settings'));
  console.log();
  console.log(chalk.gray(`Config directory: ${configDir}`));
  
  // Check if config directory exists
  if (!existsSync(configDir)) {
    console.log();
    console.log(chalk.green('✅ Configuration is already clean'));
    console.log(chalk.gray('   No .ntcli directory found'));
    return;
  }
  
  // Confirmation prompt unless --force is used
  if (!options.force) {
    console.log();
    try {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to reset all configuration?',
          default: false
        }
      ]);
      
      if (!confirmed) {
        console.log(chalk.yellow('Configuration reset cancelled.'));
        return;
      }
    } catch (error) {
      // Handle Ctrl+C or other prompt cancellation
      console.log(chalk.yellow('\nConfiguration reset cancelled.'));
      return;
    }
  }
  
  const spinner = ora('🗑️  Removing configuration directory...').start();
  
  try {
    // Remove the entire .ntcli directory
    rmSync(configDir, { recursive: true, force: true });
    
    spinner.succeed('✅ Configuration reset successfully');
    
    console.log();
    console.log(chalk.green.bold('🎉 Configuration Reset Complete!'));
    console.log();
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.cyan('  • Run `ntcli auth login` to authenticate'));
    console.log(chalk.cyan('  • Run `ntcli workspace create <name>` to create a workspace'));
    console.log(chalk.cyan('  • Run `ntcli workspace switch <name>` to activate it'));
    
    if (options.verbose) {
      console.log();
      console.log(chalk.gray(`Removed directory: ${configDir}`));
    }
    
  } catch (error) {
    spinner.fail('❌ Failed to reset configuration');
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
      
      if (error.message.includes('ENOENT')) {
        console.log(chalk.yellow('   💡 Configuration directory may not exist'));
      } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
        console.log(chalk.yellow('   💡 Permission denied - try running with appropriate permissions'));
      } else {
        console.log(chalk.yellow('   💡 Make sure no applications are using the configuration files'));
      }
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}