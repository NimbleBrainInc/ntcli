# Quick Start Guide

Get up and running with ntcli in under 5 minutes.

## Prerequisites

- Node.js 20+ installed
- A NimbleTools account (sign up during authentication)

## Installation

```bash
npm install -g @nimbletools/ntcli
```

## Quick Setup

**1. Authenticate**

```bash
ntcli auth login
```

**2. Create and activate a workspace**

```bash
ntcli workspace create my-project --description "My first project"
```

**3. Browse and deploy an MCP server**

```bash
# Browse available servers
ntcli registry list

# Deploy a server (e.g., nationalparks-mcp)
ntcli server deploy nationalparks-mcp
```

**4. Set required API key (for National Parks service)**

```bash
# Set the National Parks Service API key
ntcli secrets set NPS_API_KEY=YOUR_API_KEY
```

> Get your free API key at https://www.nps.gov/subjects/developer/api-documentation.htm

**5. Test the MCP server**

```bash
# List available tools
ntcli mcp tools nationalparks-mcp

# Call a tool
ntcli mcp call nationalparks-mcp find_parks --arg stateCode="WY"
```

**6. Generate Claude Desktop configuration**

```bash
# Generate config for Claude Desktop integration
ntcli server claude-config nationalparks-mcp

# Copy the JSON output to your Claude Desktop config file
```

## Next Steps

- **Create non-expiring tokens**: `ntcli token refresh --no-expiry`
- **Scale servers**: `ntcli server scale nationalparks-mcp 3`
- **View logs**: `ntcli server logs nationalparks-mcp`
- **Manage workspaces**: `ntcli workspace list`, `ntcli workspace switch <name>`

## Need Help?

- `ntcli --help` - Show all available commands
- `ntcli <command> --help` - Help for specific commands
- `ntcli auth status` - Check authentication status
- See [DEVELOPMENT.md](DEVELOPMENT.md) for testing and development

That's it! You now have a complete MCP server running and ready for Claude Desktop integration.
