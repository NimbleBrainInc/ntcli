import chalk from 'chalk';
import ora from 'ora';
import { MCPCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';
import { MCPClient, MCPError } from '../../lib/mcp/client.js';

/**
 * Call a tool on an MCP server
 */
export async function handleMCPCall(
  serverId: string,
  toolName: string,
  args: string[] = [],
  options: MCPCommandOptions & { 
    arg?: string[];
    json?: string;
  } = {}
): Promise<void> {
  const spinner = ora(`🔧 Calling tool ${toolName} on MCP server ${serverId}...`).start();
  
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
    
    // Get server details
    const serverResponse = await apiClient.getWorkspaceServer(finalWorkspaceId, serverId);
    const server = serverResponse;
    
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
    const mcpEndpoint = `${apiClient.getMcpBaseUrl()}/${workspaceUuid}/${serverId}/mcp`;

    // Parse arguments
    let toolArgs: Record<string, any> = {};
    
    if (options.json) {
      try {
        toolArgs = JSON.parse(options.json);
      } catch (error) {
        spinner.fail('❌ Invalid JSON arguments');
        console.log(chalk.red('   Failed to parse JSON arguments'));
        console.log(chalk.yellow(`   Example: --json '{"param1": "value1", "param2": 123}'`));
        process.exit(1);
      }
    } else if (options.arg && options.arg.length > 0) {
      // Parse key=value arguments
      for (const arg of options.arg) {
        const [key, ...valueParts] = arg.split('=');
        if (!key || valueParts.length === 0) {
          spinner.fail('❌ Invalid argument format');
          console.log(chalk.red(`   Invalid argument: ${arg}`));
          console.log(chalk.yellow('   Use format: --arg key=value'));
          process.exit(1);
        }
        const value = valueParts.join('='); // Handle values with = in them
        
        // Try to parse as JSON, fallback to string
        try {
          toolArgs[key] = JSON.parse(value);
        } catch {
          toolArgs[key] = value;
        }
      }
    } else if (args.length > 0) {
      // Parse positional key=value arguments
      for (const arg of args) {
        const [key, ...valueParts] = arg.split('=');
        if (!key || valueParts.length === 0) {
          spinner.fail('❌ Invalid argument format');
          console.log(chalk.red(`   Invalid argument: ${arg}`));
          console.log(chalk.yellow('   Use format: key=value'));
          process.exit(1);
        }
        const value = valueParts.join('=');
        
        // Try to parse as JSON, fallback to string
        try {
          toolArgs[key] = JSON.parse(value);
        } catch {
          toolArgs[key] = value;
        }
      }
    }

    // Get workspace token for MCP client
    const workspaceToken = workspaceStorage.getWorkspaceToken(finalWorkspaceId);
    if (!workspaceToken) {
      spinner.fail('❌ No valid workspace token for MCP connection');
      process.exit(1);
    }

    // Connect to MCP server
    const mcpClient = new MCPClient(mcpEndpoint, workspaceToken);
    
    // Initialize the MCP connection
    spinner.text = `🔌 Initializing MCP connection...`;
    await mcpClient.initialize();
    
    // Call the tool
    spinner.text = `🔧 Calling tool ${toolName}...`;
    const startTime = Date.now();
    const callResponse = await mcpClient.callTool(toolName, toolArgs);
    const duration = Date.now() - startTime;
    
    spinner.succeed(`🔧 Tool ${toolName} executed in ${duration}ms`);
    
    console.log();
    console.log(chalk.blue.bold('📋 Tool Call Result'));
    console.log(`  ${chalk.gray('Server:')} ${server.name || serverId}`);
    console.log(`  ${chalk.gray('Tool:')} ${chalk.cyan(toolName)}`);
    console.log(`  ${chalk.gray('Duration:')} ${duration}ms`);
    
    if (Object.keys(toolArgs).length > 0) {
      console.log(`  ${chalk.gray('Arguments:')}`);
      for (const [key, value] of Object.entries(toolArgs)) {
        console.log(`    ${chalk.cyan(key)}: ${chalk.white(JSON.stringify(value))}`);
      }
    }
    
    console.log();
    
    // Display result
    if (callResponse.result.isError) {
      console.log(chalk.red.bold('❌ Tool Error'));
    } else {
      console.log(chalk.green.bold('✅ Tool Success'));
    }
    
    console.log();
    
    if (callResponse.result.content && callResponse.result.content.length > 0) {
      for (const content of callResponse.result.content) {
        if (content.type === 'text') {
          // Try to pretty-print JSON, fallback to raw text
          try {
            const parsed = JSON.parse(content.text);
            console.log(JSON.stringify(parsed, null, 2));
          } catch {
            console.log(content.text);
          }
        }
      }
    } else {
      console.log(chalk.gray('(No output)'));
    }
    
    console.log();
    console.log(chalk.cyan('💡 Next steps:'));
    console.log(chalk.cyan(`   ntcli mcp tools ${serverId}     # See all available tools`));
    
  } catch (error) {
    spinner.fail('❌ Failed to call tool');
    
    if (error instanceof MCPError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.data) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.data, null, 2)}`));
      }
      
      if (error.isErrorCode(-32602)) {
        console.log(chalk.yellow('   💡 Check the tool parameters - they may be invalid'));
        console.log(chalk.cyan(`   💡 Use \`ntcli mcp tools ${serverId} --verbose\` to see parameter schemas`));
      } else if (error.isErrorCode(-32601)) {
        console.log(chalk.yellow(`   💡 Tool '${toolName}' not found on this server`));
        console.log(chalk.cyan(`   💡 Use \`ntcli mcp tools ${serverId}\` to see available tools`));
      } else if (error.isErrorCode(-32603)) {
        console.log(chalk.yellow('   💡 Check that the MCP server is running and accessible'));
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