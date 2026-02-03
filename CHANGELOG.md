# Changelog

All notable changes to this project will be documented in this file.

## [0.4.4] - 2026-02-02

### Fixed
- Update GitHub repository URLs from nimbletools org to NimbleBrainInc org

## [0.4.3] - 2026-02-02

### Fixed
- Update Studio API URL to api.nimblebrain.ai

## [0.4.2] - 2025-12-29

### Fixed
- Update registry API endpoints from /v0/ to /v0.1/
- Update documentation links from docs.nimbletools.ai to docs.nimblebrain.ai

## [0.4.1] - 2025-10-08

### Fixed
- Update Clerk OAuth configuration for production environment

## [0.4.0] - 2025-10-08

### Changed
- Version bump for production release

## [0.3.0] - 2025-08-28

### Changed
- Refactored authentication system to use dependency injection pattern
- Removed client-side authentication checks - commands now attempt API calls and handle 401s
- Consolidated configuration into single `~/.ntcli/config.json` file
- Changed config directory from `~/.nimbletools/` to `~/.ntcli/`
- Replaced environment variables with domain configuration system

### Added
- `ntcli domain set/show` commands for API endpoint configuration
- `ntcli config show` command to display configuration file
- `--insecure` flag for HTTP protocol support
- ESLint and TypeScript checking with GitHub Actions CI
- Unified ConfigManager for all configuration operations

### Removed
- `NTCLI_DISABLE_AUTH` environment variable and related logic
- `NTCLI_MANAGEMENT_API_URL` and `NTCLI_MCP_API_URL` environment variables
- `ntcli workspace debug` command
- Separate configuration files (tokens.json, user.json, workspaces.json)

### Breaking Changes
- Configuration file location and structure changed
- Environment variables removed
- Users must reconfigure after upgrade

## [0.2.0] - 2025-08-11

### Changed
- Bug fixes and stability improvements

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
