import chalk from 'chalk';
import ora from 'ora';
import { MCPCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';
import { MCPClient, MCPError } from '../../lib/mcp/client.js';

/**
 * Connect to and initialize an MCP server
 */
export async function handleMCPConnect(
  serverId: string,
  options: MCPCommandOptions = {}
): Promise<void> {
  const spinner = ora(`🔌 Connecting to MCP server ${serverId}...`).start();
  
  try {
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
    
    // Check authentication
    const tokenManager = new TokenManager();
    const isAuthenticated = await tokenManager.isAuthenticated();
    if (!isAuthenticated) {
      spinner.fail('❌ Authentication required');
      console.log(chalk.yellow('   Please run `ntcli auth login` first'));
      process.exit(1);
    }

    // Get authenticated API client for workspace
    const authResult = await workspaceManager.getAuthenticatedClient(workspaceId);
    if (!authResult) {
      spinner.fail('❌ No valid workspace token');
      console.log(chalk.yellow('   Please create a new workspace with `ntcli workspace create <name>`'));
      process.exit(1);
    }

    const { client: apiClient, workspaceId: finalWorkspaceId } = authResult;
    const workspaceStorage = new WorkspaceStorage();
    
    // Extract UUID from workspace ID for API calls
    const extractWorkspaceUuid = (workspaceId: string): string => {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(workspaceId)) return workspaceId;
      const parts = workspaceId.split('-');
      if (parts.length >= 5) return parts.slice(-5).join('-');
      return workspaceId;
    };
    
    // Construct MCP endpoint URL
    const workspaceUuid = extractWorkspaceUuid(workspaceId);
    const mcpEndpoint = `${apiClient.getBaseUrl()}/v1/workspaces/${workspaceUuid}/servers/${serverId}/mcp`;
    
    if (process.env.NTCLI_DEBUG) {
      console.error(`🔧 MCP Endpoint: ${mcpEndpoint}`);
    }
    
    // Get server details
    spinner.text = `🔍 Finding MCP server ${serverId}...`;
    const serverResponse = await apiClient.getWorkspaceServer(workspaceId, serverId);
    const server = serverResponse;

    // Connect to MCP server
    spinner.text = `🔌 Initializing MCP connection...`;
    // Get workspace token for MCP client
    const workspaceToken = workspaceStorage.getWorkspaceToken(finalWorkspaceId);
    if (!workspaceToken) {
      spinner.fail('❌ No valid workspace token for MCP connection');
      process.exit(1);
    }

    const mcpClient = new MCPClient(mcpEndpoint, workspaceToken);
    
    // Initialize the MCP connection
    const initResponse = await mcpClient.initialize();
    
    spinner.succeed(`🔌 Connected to MCP server: ${serverId}`);
    
    console.log();
    console.log(chalk.green.bold('✅ MCP Connection Established!'));
    console.log();
    
    // Server info
    console.log(chalk.blue.bold('📡 Server Information'));
    console.log(`  ${chalk.gray('Server ID:')} ${chalk.cyan(serverId)}`);
    console.log(`  ${chalk.gray('Name:')} ${server.name || serverId}`);
    console.log(`  ${chalk.gray('Status:')} ${getStatusColor(server.status)}${server.status}`);
    console.log(`  ${chalk.gray('MCP Endpoint:')} ${chalk.cyan(mcpEndpoint)}`);
    console.log();
    
    // MCP Server info
    const serverInfo = mcpClient.getServerInfo();
    if (serverInfo) {
      console.log(chalk.blue.bold('🔧 MCP Server Details'));
      console.log(`  ${chalk.gray('Name:')} ${serverInfo.name}`);
      console.log(`  ${chalk.gray('Version:')} ${serverInfo.version}`);
    }
    
    // Protocol info
    console.log(`  ${chalk.gray('Protocol Version:')} ${initResponse.result.protocolVersion}`);
    console.log();
    
    // Capabilities
    const capabilities = initResponse.result.capabilities;
    console.log(chalk.blue.bold('🛠️  Server Capabilities'));
    
    if (capabilities.tools) {
      console.log(`  ${chalk.green('✓')} Tools`);
      if (capabilities.tools.listChanged) {
        console.log(`    ${chalk.gray('- Supports dynamic tool list changes')}`);
      }
    } else {
      console.log(`  ${chalk.gray('✗')} Tools (not supported)`);
    }
    
    if (capabilities.resources) {
      console.log(`  ${chalk.green('✓')} Resources`);
      if (capabilities.resources.subscribe) {
        console.log(`    ${chalk.gray('- Supports resource subscriptions')}`);
      }
      if (capabilities.resources.listChanged) {
        console.log(`    ${chalk.gray('- Supports dynamic resource list changes')}`);
      }
    } else {
      console.log(`  ${chalk.gray('✗')} Resources (not supported)`);
    }
    
    if (capabilities.prompts) {
      console.log(`  ${chalk.green('✓')} Prompts`);
      if (capabilities.prompts.listChanged) {
        console.log(`    ${chalk.gray('- Supports dynamic prompt list changes')}`);
      }
    } else {
      console.log(`  ${chalk.gray('✗')} Prompts (not supported)`);
    }
    
    if (capabilities.logging) {
      console.log(`  ${chalk.green('✓')} Logging`);
    }
    
    console.log();
    console.log(chalk.cyan('💡 Next steps:'));
    console.log(chalk.cyan(`   ntcli mcp tools ${serverId}                    # List available tools`));
    console.log(chalk.cyan(`   ntcli mcp call ${serverId} <tool> [args...]    # Call a tool`));
    
  } catch (error) {
    spinner.fail('❌ Failed to connect to MCP server');
    
    if (error instanceof MCPError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.data) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.data, null, 2)}`));
      }
      
      if (error.isErrorCode(-32603)) {
        console.log(chalk.yellow('   💡 Check that the MCP server is running and accessible'));
      } else if (error.isErrorCode(-32601)) {
        console.log(chalk.yellow('   💡 The server may not support the MCP initialize method'));
      }
    } else if (error instanceof ApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (error.isAuthError()) {
        console.log(chalk.yellow('   💡 Try running `ntcli auth login` to refresh your authentication'));
      } else if (error.isNotFoundError()) {
        console.log(chalk.yellow(`   💡 Server '${serverId}' not found in this workspace`));
        console.log(chalk.cyan('   💡 Use `ntcli server list` to see deployed servers'));
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
      return chalk.yellow('◐ ');
    case 'stopped':
      return chalk.gray('○ ');
    case 'error':
      return chalk.red('● ');
    default:
      return chalk.gray('? ');
  }
}