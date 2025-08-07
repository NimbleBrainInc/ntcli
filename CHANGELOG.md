# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-01-08

### Added
- Initial public release of NimbleTools CLI (ntcli)
- Deploy and manage MCP servers from community registry
- Workspace management with isolated environments
- Token management with JTI-based revocation
- Claude Desktop integration with automatic config generation
- Secret management for deployed servers
- Real-time server logs and monitoring
- MCP client tools for testing servers

### Commands
- `ntcli auth` - Authentication (login/logout/status)
- `ntcli workspace` - Workspace management (create/list/switch/delete/sync)
- `ntcli server` - Server management (deploy/list/info/scale/logs/remove/claude-config)
- `ntcli token` - Token management (create/list/refresh/revoke/show)
- `ntcli mcp` - MCP client (connect/tools/call)
- `ntcli registry` - Browse available servers (list/show)
- `ntcli secrets` - Manage secrets (set/list/unset)
