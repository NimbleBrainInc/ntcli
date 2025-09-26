import chalk from 'chalk';
import ora from 'ora';
import { ServerCommandOptions, DeployServerRequest } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { RegistryClient, RegistryApiError } from '../../lib/api/registry-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';

/**
 * Deploy a server to the active workspace
 */
export async function handleServerDeploy(
  serverId: string,
  options: ServerCommandOptions & {
    version?: string;
    env?: string[];
    cpu?: string;
    memory?: string;
    minReplicas?: number;
    maxReplicas?: number;
  } = {}
): Promise<void> {
  const spinner = ora(`🚀 Deploying server ${serverId}...`).start();
  const registryClient = new RegistryClient();

  try {
    // Fetch server spec from registry first
    spinner.text = '🔍 Fetching server spec from registry...';
    const serverSpec = await registryClient.getServer(serverId, options.version);

    // Get active workspace
    const workspaceManager = new WorkspaceManager();
    const activeWorkspace = await workspaceManager.getActiveWorkspace();
    
    if (!activeWorkspace) {
      spinner.fail('❌ No active workspace');
      console.log(chalk.yellow('   Please create and activate a workspace first:'));
      console.log(chalk.cyan('   ntcli workspace create my-workspace'));
      console.log(chalk.cyan('   ntcli workspace switch my-workspace'));
      process.exit(1);
    }

    const workspaceId = options.workspace || activeWorkspace.workspace_id;
    
    // Get authenticated API client for this workspace
    const authResult = await workspaceManager.getAuthenticatedClient(workspaceId);
    if (!authResult) {
      spinner.fail('❌ No valid workspace token');
      console.log(chalk.yellow('   This workspace does not have a valid access token.'));
      console.log(chalk.yellow('   Workspace tokens are created when you create a new workspace.'));
      console.log(chalk.cyan('   Please create a new workspace: `ntcli workspace create my-workspace`'));
      process.exit(1);
    }

    const { client: apiClient, workspaceId: finalWorkspaceId } = authResult;

    // Build deployment request with the full MCP server spec
    const deployRequest: any = {
      server: serverSpec,
      name: serverId  // Use serverId as the deployment name
    };

    // Parse and add environment variables to transport
    if (options.env && options.env.length > 0) {
      const environmentVariables: Record<string, string> = {};
      for (const envVar of options.env) {
        const [key, value] = envVar.split('=', 2);
        if (key && value !== undefined) {
          environmentVariables[key] = value;
        } else {
          spinner.fail('❌ Invalid environment variable format');
          console.log(chalk.yellow(`   Expected format: KEY=value, got: ${envVar}`));
          process.exit(1);
        }
      }

      if (Object.keys(environmentVariables).length > 0) {
        // Ensure transport exists and has env property
        if (!deployRequest.server.transport) {
          deployRequest.server.transport = {};
        }
        if (!deployRequest.server.transport.env) {
          deployRequest.server.transport.env = {};
        }
        // Merge provided env vars
        deployRequest.server.transport.env = {
          ...deployRequest.server.transport.env,
          ...environmentVariables
        };
      }
    }

    // Apply runtime overrides from NimbleTools metadata
    if (!deployRequest.server._meta) {
      deployRequest.server._meta = {};
    }
    if (!deployRequest.server._meta['ai.nimblebrain.mcp/v1']) {
      deployRequest.server._meta['ai.nimblebrain.mcp/v1'] = {};
    }
    const runtime = deployRequest.server._meta['ai.nimblebrain.mcp/v1'];

    // Apply resource limits if specified
    if (options.cpu || options.memory) {
      if (!runtime.resources) {
        runtime.resources = {};
      }
      if (!runtime.resources.limits) {
        runtime.resources.limits = {};
      }
      if (options.memory) {
        runtime.resources.limits.memory = options.memory;
      }
      if (options.cpu) {
        runtime.resources.limits.cpu = options.cpu;
      }
    }

    // Apply scaling options if specified
    if (options.minReplicas !== undefined || options.maxReplicas !== undefined) {
      if (!runtime.scaling) {
        runtime.scaling = {};
      }
      if (options.minReplicas !== undefined) {
        runtime.scaling.minReplicas = options.minReplicas;
      }
      if (options.maxReplicas !== undefined) {
        runtime.scaling.maxReplicas = options.maxReplicas;
      }
    }

    // Deploy server
    const response = await apiClient.deployServer(finalWorkspaceId, deployRequest);
    
    if (process.env.NTCLI_DEBUG) {
      console.error(`   Deploy response:`, JSON.stringify(response, null, 2));
    }
    
    if (!response || !response.server_id) {
      spinner.fail('❌ Invalid response from server');
      console.error(chalk.red('   API returned an invalid response'));
      if (process.env.NTCLI_DEBUG) {
        console.error(chalk.gray(`   Response: ${JSON.stringify(response, null, 2)}`));
      }
      process.exit(1);
    }
    
    // The API returns server data directly, not nested under a 'server' property
    const server = response;
    
    spinner.succeed(`🚀 Server deployed: ${server.name || serverId}`);
    
    console.log();
    console.log(chalk.green.bold('✅ Deployment successful!'));
    console.log();
    
    // Server info
    console.log(chalk.blue.bold('📦 Server Details'));
    console.log(`  ${chalk.gray('Name:')} ${server.name || serverId}`);
    console.log(`  ${chalk.gray('Version:')} ${serverSpec.version || 'latest'}`);
    console.log(`  ${chalk.gray('Status:')} ${getStatusColor(server.status || 'unknown')}${server.status || 'unknown'}${chalk.reset()}`);
    
    if (server.service_url) {
      console.log(`  ${chalk.gray('Service URL:')} ${chalk.cyan(server.service_url)}`);
    }
    
    // Environment variables
    if (server.environment_variables && Object.keys(server.environment_variables).length > 0) {
      console.log();
      console.log(chalk.blue.bold('🔧 Environment Variables'));
      for (const [key, value] of Object.entries(server.environment_variables)) {
        console.log(`  ${chalk.cyan(key)}: ${value}`);
      }
    }
    
    console.log();
    if (response.deployment_id) {
      console.log(chalk.gray(`Deployment ID: ${response.deployment_id}`));
    }
    console.log(chalk.gray(`Workspace: ${activeWorkspace.workspace_name || finalWorkspaceId} (${finalWorkspaceId})`));
    console.log();
    
    if (options.wait) {
      console.log(chalk.yellow('⏳ Waiting for deployment to be ready...'));
      console.log(chalk.cyan('   Use `ntcli server info ${serverId}` to check status'));
    } else {
      console.log(chalk.cyan('💡 Use `ntcli server info ${serverId}` to check deployment status'));
      console.log(chalk.cyan('💡 Use `ntcli server list` to see all servers in this workspace'));
    }
    
  } catch (error) {
    spinner.fail('❌ Failed to deploy server');
    
    if (error instanceof RegistryApiError) {
      console.error(chalk.red(`   ${error.message}`));
      if (error.isNotFoundError()) {
        console.log(chalk.yellow(`   💡 Server '${serverId}' not found in registry`));
        console.log(chalk.cyan('   💡 Use `ntcli registry list` to see available servers'));
      }
    } else if (error instanceof ManagementApiError) {
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
      } else if (error.statusCode === 409) {
        console.log(chalk.yellow(`   💡 Server '${serverId}' is already deployed in this workspace`));
        console.log(chalk.cyan('   💡 Use `ntcli server scale ${serverId}` to modify the deployment'));
      } else if (error.statusCode === 503) {
        console.log(chalk.yellow('   💡 Deployment service may be temporarily unavailable. Try again later.'));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`   ${error.message}`));
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
  switch (status) {
    case 'running':
      return chalk.green('● ');
    case 'pending':
    case 'deploying':
      return chalk.yellow('◐ ');
    case 'stopped':
      return chalk.gray('○ ');
    case 'error':
      return chalk.red('● ');
    default:
      return chalk.gray('? ');
  }
}