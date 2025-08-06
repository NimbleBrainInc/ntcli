import chalk from 'chalk';
import ora from 'ora';
import { NimbleBrainApiClient, ApiError } from '../lib/api/client.js';

/**
 * Health check response from the API
 */
interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

interface HealthOptions {
  debug?: boolean;
  verbose?: boolean;
}

/**
 * Perform health check against the API
 */
export async function handleHealthCheck(options: HealthOptions = {}): Promise<void> {
  const spinner = ora('🏥 Checking API health...').start();
  
  try {
    // Initialize API client (no auth needed for health check)
    const apiClient = new NimbleBrainApiClient();
    
    // Make request to /health endpoint
    const healthUrl = `${apiClient.getBaseUrl()}/health`;
    
    if (options.debug || options.verbose) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Making request to: ${healthUrl}`));
      spinner.start();
    }
    
    const startTime = Date.now();
    const response = await fetch(healthUrl);
    const responseTime = Date.now() - startTime;
    
    if (options.debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Response status: ${response.status} ${response.statusText}`));
      console.log(chalk.gray(`[DEBUG] Response time: ${responseTime}ms`));
      console.log(chalk.gray(`[DEBUG] Response headers:`));
      for (const [key, value] of response.headers.entries()) {
        console.log(chalk.gray(`  ${key}: ${value}`));
      }
      spinner.start();
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const responseText = await response.text();
    if (options.debug) {
      spinner.stop();
      console.log(chalk.gray(`[DEBUG] Raw response body: ${responseText}`));
      spinner.start();
    }
    
    const healthData = JSON.parse(responseText) as HealthResponse;
    
    spinner.succeed('✅ API is healthy');
    
    console.log();
    console.log(chalk.green.bold('🏥 Health Check Results'));
    console.log();
    console.log(`${chalk.gray('Status:')} ${getStatusColor(healthData.status)}`);
    console.log(`${chalk.gray('Service:')} ${chalk.cyan(healthData.service)}`);
    console.log(`${chalk.gray('Timestamp:')} ${chalk.gray(new Date(healthData.timestamp).toLocaleString())}`);
    console.log(`${chalk.gray('Endpoint:')} ${chalk.gray(healthUrl)}`);
    
    if (options.verbose || options.debug) {
      console.log(`${chalk.gray('Response Time:')} ${chalk.cyan(responseTime + 'ms')}`);
      console.log(`${chalk.gray('API Base URL:')} ${chalk.gray(apiClient.getBaseUrl())}`);
    }
    
    if (options.debug) {
      console.log();
      console.log(chalk.yellow.bold('🔍 Debug Information'));
      console.log(`${chalk.gray('Raw Response:')} ${chalk.dim(responseText)}`);
    }
    
  } catch (error) {
    spinner.fail('❌ Health check failed');
    
    if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
      
      if (error.message.includes('fetch')) {
        console.log(chalk.yellow('   💡 Check your internet connection and API URL'));
      } else if (error.message.includes('HTTP 5')) {
        console.log(chalk.yellow('   💡 The API server may be experiencing issues'));
      } else if (error.message.includes('HTTP 4')) {
        console.log(chalk.yellow('   💡 The health endpoint may not be available'));
      }
    } else {
      console.error(chalk.red('   An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}

/**
 * Get colored status indicator
 */
function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'ok':
      return chalk.green(status);
    case 'degraded':
    case 'warning':
      return chalk.yellow(status);
    case 'unhealthy':
    case 'error':
    case 'down':
      return chalk.red(status);
    default:
      return chalk.white(status);
  }
}