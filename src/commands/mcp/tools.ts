import chalk from 'chalk';
import ora from 'ora';
import { MCPCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { NimbleBrainApiClient, ApiError } from '../../lib/api/client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';
import { WorkspaceStorage } from '../../lib/workspace-storage.js';
import { MCPClient, MCPError } from '../../lib/mcp/client.js';

/**
 * List tools available on an MCP server
 */
export async function handleMCPTools(
  serverId: string,
  options: MCPCommandOptions = {}
): Promise<void> {
  const spinner = ora(`🔧 Fetching tools from MCP server ${serverId}...`).start();
  
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

    // Always show the MCP endpoint URL for debugging
    console.error(`🔧 MCP Endpoint: ${mcpEndpoint}`);

    // Connect to MCP server
    // Get workspace token for MCP client
    const workspaceToken = workspaceStorage.getWorkspaceToken(finalWorkspaceId);
    if (!workspaceToken) {
      spinner.fail('❌ No valid workspace token for MCP connection');
      process.exit(1);
    }

    const mcpClient = new MCPClient(mcpEndpoint, workspaceToken);
    
    // Initialize the MCP connection
    spinner.text = `🔌 Initializing MCP connection...`;
    await mcpClient.initialize();
    
    // List tools
    spinner.text = `🔧 Fetching available tools...`;
    const toolsResponse = await mcpClient.listTools();
    const tools = toolsResponse.result.tools;
    
    spinner.succeed(`🔧 Found ${tools.length} tool${tools.length === 1 ? '' : 's'}`);
    
    console.log();
    
    if (tools.length === 0) {
      console.log(chalk.gray('   No tools available on this MCP server'));
      console.log(chalk.cyan('   💡 Check that the server implements tools correctly'));
      return;
    }
    
    // Display tools
    console.log(chalk.blue.bold('🛠️  Available Tools'));
    console.log(chalk.gray(`   Server: ${server.name || serverId} (${mcpEndpoint})`));
    console.log();
    
    for (const tool of tools) {
      console.log(`  ${chalk.cyan('●')} ${chalk.white.bold(tool.name)}`);
      
      if (tool.description) {
        console.log(`    ${chalk.gray(tool.description)}`);
      }
      
      if (options.verbose && tool.inputSchema) {
        console.log(`    ${chalk.blue('Schema:')}`);
        
        if (tool.inputSchema.properties) {
          const properties = tool.inputSchema.properties;
          const required = tool.inputSchema.required || [];
          
          for (const [propName, propSchema] of Object.entries(properties)) {
            const isRequired = required.includes(propName);
            const requiredIndicator = isRequired ? chalk.red('*') : ' ';
            const propType = (propSchema as any).type || 'unknown';
            
            console.log(`      ${requiredIndicator} ${chalk.cyan(propName)}: ${chalk.gray(propType)}`);
            if ((propSchema as any).description) {
              console.log(`        ${chalk.gray((propSchema as any).description)}`);
            }
          }
        } else {
          console.log(`      ${chalk.gray('No parameters')}`);
        }
      }
      
      console.log();
    }
    
    if (!options.verbose) {
      console.log(chalk.gray('Use --verbose to see parameter schemas'));
      console.log();
    }
    
    console.log(chalk.cyan('💡 Usage examples:'));
    if (tools.length > 0) {
      const firstTool = tools[0]!;
      console.log(chalk.cyan(`   ntcli mcp call ${serverId} ${firstTool.name}                 # Call tool without args`));
      console.log(chalk.cyan(`   ntcli mcp call ${serverId} ${firstTool.name} --arg value     # Call tool with arguments`));
    }
    
  } catch (error) {
    spinner.fail('❌ Failed to fetch tools');
    
    if (error instanceof MCPError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.data) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.data, null, 2)}`));
      }
      
      if (error.isErrorCode(-32603)) {
        console.log(chalk.yellow('   💡 Check that the MCP server is running and accessible'));
      } else if (error.isErrorCode(-32601)) {
        console.log(chalk.yellow('   💡 The server may not support the tools/list method'));
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