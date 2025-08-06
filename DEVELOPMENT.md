# Development Guide

This document contains development and testing information for ntcli.

## Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd ntcli

# Install dependencies
npm install

# Build the project
npm run build

# Link for global usage during development
npm link

# Run in development mode (watch)
npm run dev
```

## Environment Variables

For development/testing environments with self-signed certificates:

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

**⚠️ Security Warning:** Only use `NODE_TLS_REJECT_UNAUTHORIZED=0` for local development with your own API. Never use this in production environments.

## Testing Commands

### MCP Server Testing

Here are example commands for testing MCP functionality with the echo server:

**Basic message:**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 ntcli mcp call echo echo_message message="Hello World"
```

**With uppercase formatting:**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 ntcli mcp call echo echo_message message="Hello World" uppercase=true
```

**Using JSON format:**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 ntcli mcp call echo echo_message --json '{"message": "Hello World", "uppercase": true}'
```

**Using --arg flags:**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 ntcli mcp call echo echo_message --arg message="Hello World" --arg uppercase=true
```

**Finnhub (Stock Market Data):**
```bash
# Get stock quote
NODE_TLS_REJECT_UNAUTHORIZED=0 ntcli mcp call finnhub get_quote --arg symbol=AAPL

# Get company profile  
NODE_TLS_REJECT_UNAUTHORIZED=0 ntcli mcp call finnhub get_company_profile --arg symbol=AAPL

# Search for symbols
NODE_TLS_REJECT_UNAUTHORIZED=0 ntcli mcp call finnhub search_symbols --arg query=Apple
```

### Authentication Testing

```bash
# Test login flow
ntcli auth login --verbose

# Check authentication status
ntcli auth status

# Test with custom port
ntcli auth login --port 8080
```

### Workspace Testing

```bash
# Create test workspace
ntcli workspace create test-workspace --description "Development testing workspace"

# List workspaces with verbose output
ntcli workspace list --verbose

# Test workspace switching
ntcli workspace switch test-workspace

# Test interactive workspace selection
ntcli workspace select
```

### Server Management Testing

```bash
# List registry servers
ntcli registry list --verbose

# Deploy test server
ntcli server deploy echo --verbose

# Check server status
ntcli server info echo --verbose

# Scale server for testing
ntcli server scale echo --replicas 2 --verbose

# View server logs
ntcli server logs echo --lines 50 --verbose
```

### Token Testing

```bash
# Test token refresh with different expiration options
ntcli token refresh --verbose
ntcli token refresh --expires-in 3600 --verbose
ntcli token refresh --no-expiry --verbose

# Show token information
ntcli token show --verbose
```

### Claude Desktop Config Testing

```bash
# Generate config for development
ntcli server claude-config echo --insecure --verbose

# Test with different servers
ntcli server claude-config nationalparks-mcp --verbose
```

## Development Scripts

```bash
# Build and test locally
npm run build && node dist/index.js --help

# Clean build artifacts
npm run clean

# Test CLI with specific command
npm run test-cli -- auth status

# Debug mode
NTCLI_DEBUG=1 ntcli workspace list

# Combined debug and insecure for local testing
NODE_TLS_REJECT_UNAUTHORIZED=0 NTCLI_DEBUG=1 ntcli workspace list
```

## Publishing

```bash
# Dry run to test publishing
npm run publish:dry

# Publish to npm (maintainers only)
npm run publish
```

## Troubleshooting

### Common Development Issues

1. **Build errors**: Make sure you're using Node.js 20+ and TypeScript is properly installed
2. **Authentication failures**: Check your Clerk credentials in environment variables
3. **TLS errors**: Use `NODE_TLS_REJECT_UNAUTHORIZED=0` for local development only
4. **Port conflicts**: Use `--port` flag to specify alternative callback ports

### Debug Mode

Enable debug mode for detailed HTTP request/response logging:

```bash
NTCLI_DEBUG=1 ntcli <command>
```

### Verbose Output

Add `--verbose` flag to any command for detailed output:

```bash
ntcli <command> --verbose
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Ensure all existing tests pass
6. Submit a pull request

## Testing Before Release

Before releasing a new version, test the complete workflow:

```bash
# 1. Clean install
npm ci

# 2. Build
npm run build

# 3. Test authentication
ntcli auth login

# 4. Test workspace creation
ntcli workspace create test-release

# 5. Test server deployment
ntcli server deploy echo

# 6. Test MCP functionality
ntcli mcp tools echo
ntcli mcp call echo echo_message message="Release test"

# 7. Test Claude Desktop config generation
ntcli server claude-config echo --insecure

# 8. Clean up
ntcli server remove echo --force
ntcli workspace delete test-release --force
```