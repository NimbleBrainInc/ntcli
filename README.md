# NimbleTools CLI (ntcli)

[![npm version](https://badge.fury.io/js/%40nimbletools%2Fntcli.svg)](https://badge.fury.io/js/%40nimbletools%2Fntcli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Command-line interface for the NimbleTools MCP Platform. Deploy, manage, and integrate Model Context Protocol (MCP) servers with Claude Desktop.

## Features

- 🚀 **Deploy MCP servers** from a community registry to Kubernetes
- 🔧 **Manage workspaces** with isolated environments and access tokens
- 🤖 **Claude Desktop integration** with automatic configuration generation
- 🛠️ **MCP client tools** for testing and interacting with deployed servers
- 🔐 **Secure authentication** with Clerk OAuth and workspace-scoped tokens
- ⚡ **Scale-to-zero** serverless execution with KEDA auto-scaling
- 🎯 **TypeScript** with full type safety and modern ES modules

## Quick Start

```bash
# Install globally
npm install -g @nimbletools/ntcli

# Authenticate and create workspace
ntcli auth login
ntcli workspace create my-project

# Deploy and test an MCP server
ntcli registry list
ntcli server deploy nationalparks-mcp
ntcli secrets set NPS_API_KEY=YOUR_API_KEY
ntcli mcp call nationalparks-mcp search_parks --arg query="Yellowstone"

# Generate Claude Desktop config
ntcli server claude-config nationalparks-mcp
```

👉 **See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions**

## Installation

### NPM (Recommended)

```bash
npm install -g @nimbletools/ntcli
```

### From Source

```bash
git clone https://github.com/nimbletools/ntcli.git
cd ntcli
npm install
npm run build
npm link
```

## Commands

### Authentication

```bash
ntcli auth login              # Authenticate with NimbleTools
ntcli auth status             # Check authentication status
ntcli auth logout             # Clear stored credentials
```

### Workspace Management

```bash
ntcli workspace create <name>          # Create new workspace
ntcli workspace list                   # List all workspaces
ntcli workspace switch <name>          # Switch active workspace
ntcli workspace delete <name>          # Delete workspace
ntcli workspace clear                  # Clear active workspace
ntcli workspace sync                   # Sync local storage with server
ntcli workspace debug                  # Debug workspace storage files
```

### Server Management

```bash
ntcli server deploy <server-id>        # Deploy server from registry
ntcli server list                      # List deployed servers
ntcli server info <server-id>          # Get server details
ntcli server scale <server-id>  3      # Scale server
ntcli server logs <server-id>          # View server logs
ntcli server remove <server-id>        # Remove server
```

### MCP Client

```bash
ntcli mcp connect <server-id>          # Connect to MCP server
ntcli mcp tools <server-id>            # List available tools
ntcli mcp call <server-id> <tool> --arg key=value    # Call MCP tool
```

### Registry & Claude Integration

```bash
ntcli registry list                    # Browse available servers
ntcli registry show <server-id>        # Get server details
ntcli server claude-config <server-id> # Generate Claude Desktop config
```

### Token Management

```bash
ntcli token refresh                    # Refresh workspace token (1 year expiry)
ntcli token create                     # Create new workspace token  
ntcli token list                       # List active workspace tokens
ntcli token revoke <jti>               # Revoke specific token by JTI
ntcli token show                       # Show token information
```

## Claude Desktop Integration

ntcli makes it easy to integrate deployed MCP servers with Claude Desktop:

```bash
# Generate configuration
ntcli server claude-config nationalparks-mcp

# Copy the JSON output to your Claude Desktop config:
# macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
# Linux: ~/.config/claude/claude_desktop_config.json
# Windows: %APPDATA%\Claude\claude_desktop_config.json
```

**Example output:**

```json
{
  "mcpServers": {
    "nationalparks-mcp": {
      "command": "npx",
      "args": [
        "@nimbletools/mcp-http-bridge",
        "--endpoint",
        "https://mcp.nimbletools.ai/{uuid}/nationalparks-mcp/mcp",
        "--token",
        "your-workspace-token"
      ]
    }
  }
}
```

## LangChain Integration

Use deployed MCP servers directly in LangChain applications:

```javascript
import { DynamicTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";

// Create tool from deployed MCP server
const searchParks = new DynamicTool({
  name: "search_parks",
  description: "Search for national parks",
  func: async (query) => {
    const response = await fetch(
      `https://mcp.nimbletools.ai/${workspaceId}/nationalparks-mcp/mcp`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${workspaceToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name: "search_parks", arguments: { query } },
        }),
      }
    );
    return (await response.json()).result?.content?.[0]?.text;
  },
});

// Use with LangChain
const llm = new ChatOpenAI({ modelName: "gpt-4" });
const tools = [searchParks];
```

👉 **See [examples/langchain-example.js](examples/langchain-example.js) for a complete working example**

## Configuration

### Environment Variables

| Variable                     | Description                | Default                        |
| ---------------------------- | -------------------------- | ------------------------------ |
| `CLERK_OAUTH_CLIENT_ID`      | Clerk OAuth Client ID      | Required                       |
| `CLERK_DOMAIN`               | Clerk domain               | Required                       |
| `NTCLI_MANAGEMENT_API_URL`   | Management API base URL    | `https://api.nimbletools.ai`  |
| `NTCLI_MCP_API_URL`          | MCP runtime API base URL   | `https://mcp.nimbletools.ai`  |
| `NTCLI_DEFAULT_PORT`         | OAuth callback server port | `41247`                        |

**Note:** The API has been restructured for improved routing:
- **Management API** (`api.nimbletools.ai`): Workspaces, tokens, secrets, registry, server management
- **MCP Runtime** (`mcp.nimbletools.ai`): MCP protocol operations with simplified paths

## Examples

### Complete Workflow

```bash
# 1. Setup
ntcli auth login
ntcli workspace create data-analysis --description "Data analysis workspace"

# 2. Deploy servers
ntcli server deploy nationalparks-mcp
ntcli secrets set NPS_API_KEY=YOUR_API_KEY
ntcli server deploy weather-mcp --cpu "500m" --memory "1Gi"

# 3. Test functionality
ntcli mcp tools nationalparks-mcp
ntcli mcp call nationalparks-mcp search_parks --arg query="Yellowstone"
ntcli mcp call weather-mcp get_forecast --arg location="New York"

# 4. Scale for production
ntcli server scale nationalparks-mcp --replicas 3 --max-replicas 10

# 5. Generate Claude Desktop configs
ntcli server claude-config nationalparks-mcp > nationalparks-config.json
ntcli server claude-config weather-mcp > weather-config.json

# 6. Use in LangChain applications
cd examples
npm install && npm run langchain

# 7. Monitor and manage
ntcli server logs nationalparks-mcp --lines 100
ntcli workspace list
```

### LangChain Integration

```bash
# Get your workspace info
ntcli workspace list
ntcli token show

# Set environment variables
export NTCLI_WORKSPACE_TOKEN="your-workspace-token"
export OPENAI_API_KEY="your-openai-key"

# Run LangChain example
cd examples
npm install
node langchain-example.js
```

### Advanced Usage

```bash
# Create additional tokens for CI/CD (1 year expiry by default)
ntcli token create

# Custom expiration (24 hours)
ntcli token refresh --expires-in 86400

# Interactive workspace selection
ntcli workspace select

# Verbose output for debugging
ntcli server deploy my-server --verbose --debug

# Copy Claude config to clipboard (macOS)
ntcli server claude-config my-server | pbcopy
```

## Troubleshooting

### Workspace Sync Issues

If your local workspace list doesn't match the server, use these debugging commands:

#### Check Sync Status
```bash
ntcli workspace sync
# or shorthand:
ntcli ws sync
```

**Sample Output:**
```
📊 Sync Summary
  Server workspaces: 2
  Local workspaces: 1
  In sync: 1
  On server only: 1
  Local only: 0

⚠️  Workspaces on server but not locally:
  production-workspace (a1b2c3d4-...)

   💡 To use these workspaces, you need to get access tokens:
   💡 `ntcli token refresh <workspace-name>`
```

#### Fix Server-Only Workspaces
```bash
# Get access token for server workspace
ntcli token refresh production-workspace

# Now you can switch to it
ntcli workspace switch production-workspace
```

#### Debug Storage Files
```bash
ntcli workspace debug
# or shorthand:
ntcli ws debug

# For full file contents:
ntcli ws debug --verbose
```

**Sample Output:**
```
🔍 NimbleTools Configuration Debug

📁 Workspaces File:
  Path: ~/.nimbletools/workspaces.json
  Exists: ✓
  Workspaces count: 2
  Active workspace ID: ws-my-project-12345...

Individual workspaces:
  ✓ my-project (ws-my-project-12345...)
    Token expires: Valid (expires in 120 minutes)
  ✗ old-workspace (ws-old-workspace-67890...)
    Token expires: Expired (expired 2 days ago)
```

### Common Issues

#### "Workspace not found locally"
**Problem:** You see a workspace in `ntcli ws sync` but can't switch to it.

**Solution:** Get an access token for the server workspace:
```bash
ntcli token refresh <workspace-name>
ntcli ws switch <workspace-name>
```

#### "Already authenticated" after logout
**Problem:** `ntcli auth login` says you're already logged in after logout.

**Solution:** Force re-authentication:
```bash
ntcli auth login --force
```

#### Server returns HTML instead of JSON
**Problem:** Getting "Invalid JSON response" errors with HTML content.

**Solution:** This usually indicates an API endpoint issue. Check:
```bash
ntcli health --debug    # Check API connectivity
```

## Architecture

The NimbleTools MCP Platform provides:

- **Cloud-hosted execution** with reliable server deployment
- **Multi-tenant workspaces** with isolated environments
- **Community MCP registry** for server discovery and deployment
- **Secure credential injection** at runtime
- **Production-ready monitoring** and logging

👉 **See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system diagrams and data flow**

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for development setup, testing commands, and contribution guidelines.

```bash
# Quick development setup
git clone https://github.com/nimbletools/ntcli.git
cd ntcli
npm install
npm run build
npm link

# Test
ntcli --help
```

## Support

- 📖 **Documentation**: [docs.nimbletools.ai](https://docs.nimbletools.ai/) | [QUICKSTART.md](QUICKSTART.md) | [DEVELOPMENT.md](DEVELOPMENT.md)
- 🐛 **Issues**: [GitHub Issues](https://github.com/nimbletools/ntcli/issues)
- 💬 **Community**: [NimbleTools Slack](https://join.slack.com/t/nimblebrain-users/shared_invite/zt-2jpyzxgvl-7_kFJQHyJSmJzWXmYK8cMg)
- 🌐 **Website**: [nimbletools.ai](https://www.nimbletools.ai)

## License

MIT License - see [LICENSE](LICENSE) file for details.

