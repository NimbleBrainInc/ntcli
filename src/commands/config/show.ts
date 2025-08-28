import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Show the contents of ~/.ntcli/config.json
 */
export async function handleConfigShow(options: { verbose?: boolean } = {}): Promise<void> {
  try {
    const configPath = join(homedir(), '.ntcli', 'config.json');
    
    console.log(chalk.blue.bold('📋 Configuration File'));
    console.log();
    console.log(`  ${chalk.gray('Path:')} ${configPath}`);
    
    if (!existsSync(configPath)) {
      console.log(`  ${chalk.gray('Exists:')} ${chalk.red('✗')}`);
      console.log();
      console.log(chalk.yellow('⚠️  Configuration file does not exist'));
      console.log(chalk.gray('   Run any command to create the default configuration'));
      return;
    }
    
    console.log(`  ${chalk.gray('Exists:')} ${chalk.green('✓')}`);
    console.log();
    
    try {
      const configContent = readFileSync(configPath, 'utf8');
      const configData = JSON.parse(configContent);
      
      console.log(chalk.blue.bold('📄 Configuration Contents:'));
      console.log();
      console.log(JSON.stringify(configData, null, 2));
      
    } catch (parseError) {
      console.log(chalk.red('❌ Failed to parse configuration file'));
      console.log(chalk.red('   The file may be corrupted or contain invalid JSON'));
      
      if (options.verbose) {
        console.log();
        console.log(chalk.yellow('Raw file contents:'));
        try {
          const rawContent = readFileSync(configPath, 'utf8');
          console.log(rawContent);
        } catch (readError) {
          console.log(chalk.red('   Unable to read file'));
        }
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to show configuration'));
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}