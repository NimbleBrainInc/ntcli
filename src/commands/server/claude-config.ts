import chalk from 'chalk';
import ora from 'ora';
import { ServerCommandOptions } from '../../types/index.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { ManagementClient, ManagementApiError } from '../../lib/api/management-client.js';
import { WorkspaceManager } from '../../lib/workspace/workspace-manager.js';
import { ConfigManager } from '../../lib/config-manager.js';

/**
 * Generate Claude Desktop MCP configuration for a server
 */
export async function handleServerClaudeConfig(
  serverId: string,
  options: ServerCommandOptions & {
    insecure?: boolean;
    copy?: boolean;
  } = {}
): Promise<void> {
  const spinner = ora(`🔧 Generating Claude Desktop config for ${serverId}...`).start();
  
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
    
    // Get token manager
    const tokenManager = new TokenManager();

    // Get authenticated API client for workspace
    const authResult = await workspaceManager.getAuthenticatedClient(workspaceId);
    if (!authResult) {
      spinner.fail('❌ No valid workspace token');
      console.log(chalk.yellow('   Please create a new workspace with `ntcli workspace create <name>`'));
      process.exit(1);
    }

    const { client: apiClient, workspaceId: finalWorkspaceId } = authResult;
    
    // Get server details to verify it exists
    spinner.text = `🔍 Checking server ${serverId}...`;
    try {
      await apiClient.getWorkspaceServer(finalWorkspaceId, serverId);
    } catch (error) {
      if (error instanceof ManagementApiError && error.isNotFoundError()) {
        spinner.fail('❌ Server not found');
        console.log(chalk.red(`   Server '${serverId}' not found in workspace`));
        console.log(chalk.cyan('   💡 Use `ntcli server list` to see deployed servers'));
        process.exit(1);
      }
      throw error;
    }
    
    // Extract UUID from workspace ID for API calls
    const extractWorkspaceUuid = (workspaceId: string): string => {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(workspaceId)) return workspaceId;
      const parts = workspaceId.split('-');
      if (parts.length >= 5) return parts.slice(-5).join('-');
      return workspaceId;
    };
    
    // Get workspace token (if available)
    const configManagerForToken = new ConfigManager();
    const workspace = configManagerForToken.getWorkspace(finalWorkspaceId);
    const workspaceToken = workspace?.access_token || '';
    
    // Construct MCP endpoint URL
    const workspaceUuid = extractWorkspaceUuid(finalWorkspaceId);
    const configManager = new ConfigManager();
    const mcpEndpoint = `${configManager.getMcpApiUrl()}/${workspaceUuid}/${serverId}/mcp`;
    
    // Build args array - use npx with @nimbletools/mcp-http-bridge package
    const args = [
      '@nimbletools/mcp-http-bridge',
      '--endpoint',
      mcpEndpoint,
      '--token',
      workspaceToken
    ];
    
    // Add insecure flag if requested
    if (options.insecure) {
      args.push('--insecure');
    }
    
    // Generate config
    const config = {
      mcpServers: {
        [serverId]: {
          command: 'npx',
          args: args,
          auth: null,
          oauth: false
        }
      }
    };
    
    spinner.succeed(`✅ Claude Desktop config generated for ${serverId}`);

    // Warn if no token is available
    if (!workspaceToken) {
      console.log();
      console.log(chalk.yellow('⚠️  Warning: No workspace token available'));
      console.log(chalk.yellow('   The configuration will return 401 Unauthorized when used.'));
      console.log(chalk.yellow('   Please refresh your workspace token:'));
      console.log(chalk.cyan('   ntcli token refresh'));
    }

    console.log();
    console.log(chalk.green.bold('📋 Claude Desktop MCP Configuration:'));
    console.log();
    console.log(JSON.stringify(config, null, 2));
    console.log();
    
    // Show helpful info
    console.log(chalk.blue.bold('💡 Usage Instructions:'));
    console.log(`   1. Copy the JSON configuration above`);
    console.log(`   2. Add it to your Claude Desktop config file:`);
    console.log(chalk.cyan(`      ~/.config/claude/claude_desktop_config.json (Linux)`));
    console.log(chalk.cyan(`      ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)`));
    console.log(chalk.cyan(`      %APPDATA%\\Claude\\claude_desktop_config.json (Windows)`));
    console.log(`   3. Restart Claude Desktop to load the new server`);
    console.log();
    
    if (!options.insecure) {
      console.log(chalk.yellow('⚠️  Note: Add --insecure flag if you\'re connecting to development servers with self-signed certificates'));
    }
    
    console.log(chalk.gray(`   Workspace: ${activeWorkspace.workspace_name} (${finalWorkspaceId})`));
    console.log(chalk.gray(`   MCP Endpoint: ${mcpEndpoint}`));
    console.log(chalk.gray(`   Package: @nimbletools/mcp-http-bridge`));
    
    if (options.copy) {
      console.log();
      console.log(chalk.cyan('💡 Use --copy flag with pbcopy to copy to clipboard (macOS):'));
      console.log(chalk.gray('   ntcli server claude-config ' + serverId + ' | pbcopy'));
    }
    
  } catch (error) {
    spinner.fail('❌ Failed to generate Claude Desktop config');
    
    if (error instanceof ManagementApiError) {
      const userMessage = error.getUserMessage();
      console.error(chalk.red(`   ${userMessage}`));
      
      if (options.verbose && error.details) {
        console.error(chalk.gray(`   Details: ${JSON.stringify(error.details, null, 2)}`));
      }
      
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