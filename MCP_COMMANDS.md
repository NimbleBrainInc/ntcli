# MCP commands for common services

```bash
ntcli server deploy ref-tools-mcp
ntcli mcp connect ref-tools-mcp
ntcli mcp tools ref-tools-mcp
ntcli mcp call ref-tools-mcp ref_search_documentation --arg query="Figma Comment REST API"
```

```bash
ntcli server deploy finnhub
ntcli mcp connect finnhub
ntcli mcp call finnhub get_market_news
```

```bash
ntcli server deploy echo
ntcli mcp connect echo
ntcli mcp call echo echo_message message='foobar'
```

```bash
ntcli server deploy nationalparks-mcp
ntcli mcp connect nationalparks-mcp
ntcli mcp tools nationalparks-mcp
ntcli mcp call nationalparks-mcp findParks
```
