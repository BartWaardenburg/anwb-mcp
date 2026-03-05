# anwb-mcp

[![npm version](https://img.shields.io/npm/v/anwb-mcp.svg)](https://www.npmjs.com/package/anwb-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://modelcontextprotocol.io)
[![CI](https://github.com/bartwaardenburg/anwb-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/bartwaardenburg/anwb-mcp/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/BartWaardenburg/c4d8758ff995f9d070ba1a7c6e6adccb/raw/anwb-mcp-coverage.json)](https://bartwaardenburg.github.io/anwb-mcp/)

A community-built [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for ANWB traffic information, route planning, and location search in the Netherlands. Get real-time traffic incidents, calculate routes with turn-by-turn directions, and search for locations — all through natural language via any MCP-compatible AI client.

> **Note:** This is an unofficial, community-maintained project and is not affiliated with or endorsed by ANWB. This server uses publicly accessible ANWB API endpoints — no API key required.

## Quick Start (Non-Developers)

You do not need to clone this repo.

1. Make sure Node.js 20+ is installed (your AI app will run `npx` on your machine)
2. Add the server to your AI app as an MCP server (copy/paste config below)
3. Ask questions in plain language (see [Example Usage](#example-usage))

### Add To Claude Desktop (Also Works In Cowork)

Cowork runs inside Claude Desktop and uses the same connected MCP servers and permissions.

1. Open your Claude Desktop MCP config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add this server entry (or merge it into your existing `mcpServers`):

```json
{
  "mcpServers": {
    "anwb-mcp": {
      "command": "npx",
      "args": ["-y", "anwb-mcp"]
    }
  }
}
```

3. Restart Claude Desktop

### Add To Other AI Apps

Most MCP apps have a screen like "Add MCP Server" where you can fill in:

- Command: `npx`
- Args: `-y anwb-mcp`

If your app wants JSON, paste this and adapt the top-level key name to your client (common ones are `mcpServers`, `servers`, or `context_servers`):

```json
{
  "<servers-key>": {
    "anwb-mcp": {
      "command": "npx",
      "args": ["-y", "anwb-mcp"]
    }
  }
}
```

### Troubleshooting

- Error: `npx: command not found` or server fails to start
  - Fix: install Node.js 20+ and restart your app.
- Empty results or connection errors
  - The ANWB API may be temporarily unavailable. Wait a moment and retry.

## Features

- **6 tools** across 3 categories covering traffic, routing, and location search
- **Location search** — find addresses, cities, streets, and points of interest with coordinates
- **Route planning** — calculate routes by car, caravan, bike (regular or e-bike), or on foot with distance, duration, turn-by-turn directions, toll info, and alternative routes
- **EV route planning** — plan electric vehicle routes with battery consumption, charging stops, and cost savings vs fuel
- **EV car database** — browse 1500+ electric vehicle models with battery specs for EV route planning
- **Road avoidance** — avoid toll roads, motorways, ferries, or unpaved roads
- **Traffic incidents** — real-time jams, road closures, roadworks, and speed camera locations on Dutch highways
- **Traffic summary** — compact overview of current traffic conditions across all highways
- **No API key required** — uses publicly accessible ANWB endpoints
- **Input validation** via Zod schemas on every tool for safe, predictable operations
- **Response caching** with configurable TTL (60s for routes and incidents, 300s for locations)
- **Rate limit handling** with exponential backoff and `Retry-After` header support
- **Toolset filtering** to expose only the tool categories you need
- **Docker support** for containerized deployments via GHCR
- **Actionable error messages** with context-aware recovery suggestions

## Supported Clients

<details>
<summary><strong>Advanced setup and supported clients (expand)</strong></summary>

This MCP server is not tied to one coding agent. It works with any MCP-compatible client or agent runtime that can start a stdio MCP server.

| Client / runtime | Docs |
|---|---|
| Claude Code | [MCP in Claude Code](https://docs.anthropic.com/en/docs/claude-code/mcp) |
| Anthropic API (Messages API) | [Remote MCP servers](https://docs.anthropic.com/en/docs/agents-and-tools/remote-mcp-servers) |
| Codex CLI (OpenAI) | [Codex CLI docs](https://developers.openai.com/codex/cli) |
| Gemini CLI (Google) | [Gemini CLI MCP server docs](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html) |
| VS Code (Copilot) | [Use MCP servers in VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) |
| Claude Desktop | [MCP in Claude Desktop](https://docs.anthropic.com/en/docs/claude-desktop/mcp) |
| Cursor | [Cursor docs](https://cursor.com/docs) |
| Windsurf | [Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp) |
| Cline | [Cline MCP docs](https://docs.cline.bot/mcp/) |
| Zed | [Zed context servers docs](https://zed.dev/docs/assistant/context-servers) |
| Any other MCP host | Use command/args from [Generic MCP Server Config](#generic-mcp-server-config) |

## Setup (Power Users)

If Quick Start worked in your client, you can skip this section.

### Generic MCP Server Config

Use this in any MCP host that supports stdio servers:

- **Command:** `npx`
- **Args:** `["-y", "anwb-mcp"]`
- **Optional env vars:** `ANWB_CACHE_TTL`, `ANWB_MAX_RETRIES`, `ANWB_TOOLSETS` (see [Configuration](#configuration))

Host key mapping:

| Host | Top-level key | Notes |
|---|---|---|
| VS Code | `servers` | Add `"type": "stdio"` on the server object |
| Claude Desktop / Cursor / Windsurf / Cline | `mcpServers` | Same command/args block |
| Zed | `context_servers` | Same command/args block |
| Codex CLI (TOML) | `mcp_servers` | Uses TOML, shown below |

### Claude Code

```bash
claude mcp add --scope user anwb-mcp -- npx -y anwb-mcp
```

### Codex CLI (OpenAI)

```bash
codex mcp add anwb-mcp -- npx -y anwb-mcp
```

### Gemini CLI (Google)

```bash
gemini mcp add anwb-mcp -- npx -y anwb-mcp
```

### VS Code (Copilot)

Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) > `MCP: Add Server` > **Command (stdio)**, or use `.vscode/mcp.json` with top-level key `servers` and the canonical command/args block from [Generic MCP Server Config](#generic-mcp-server-config).

### Docker

```bash
docker run -i --rm ghcr.io/bartwaardenburg/anwb-mcp
```

### Codex CLI (TOML config alternative)

```toml
[mcp_servers.anwb-mcp]
command = "npx"
args = ["-y", "anwb-mcp"]
```

</details>

## Configuration

No API key is required. The following optional environment variables are available:

| Variable | Description | Default |
|---|---|---|
| `ANWB_CACHE_TTL` | Cache TTL in seconds (set to `0` to disable). Routes/incidents use 60s, locations use 300s. | unset |
| `ANWB_MAX_RETRIES` | Maximum retry attempts for rate-limited (429) requests with exponential backoff. | `3` |
| `ANWB_TOOLSETS` | Comma-separated list of tool categories to enable (see [Toolset Filtering](#toolset-filtering)). | All toolsets |

## Available Tools

### Locations

| Tool | Description |
|---|---|
| `find_locations` | Search for locations, addresses, streets, cities, and POIs. Returns coordinates useful for route planning. Supports filtering by geographic area and index set. |

### Routes

| Tool | Description |
|---|---|
| `calculate_route` | Calculate a route between two or more locations by car, caravan, bike (regular/e-bike), or on foot. Returns distance, duration, turn-by-turn directions, toll info (car/caravan), and alternative routes. Supports avoiding toll roads, motorways, ferries, and unpaved roads. |
| `calculate_ev_route` | Plan an electric vehicle route with battery consumption, charging stops, and charging station recommendations. Requires EV car model ID, battery capacity, and state of charge. |
| `list_ev_cars` | Browse available electric vehicle models from the ANWB database. Filter by make (brand) or search by model name. Returns car IDs for use with `calculate_ev_route`. |

### Incidents

| Tool | Description |
|---|---|
| `get_traffic_incidents` | Get current traffic incidents on Dutch highways — jams, closures, roadworks, and speed cameras. Filter by road and/or category. |
| `get_traffic_summary` | Get a compact summary of traffic conditions — total counts of jams, closures, roadworks, and radars across all highways. |

## Toolset Filtering

Reduce context window usage by enabling only the tool categories you need. Set the `ANWB_TOOLSETS` environment variable to a comma-separated list:

```bash
ANWB_TOOLSETS=routes,incidents
```

| Toolset | Tools included |
|---|---|
| `locations` | Location and address search |
| `routes` | Route calculation, EV routing, and EV car database |
| `incidents` | Traffic incidents and summary |

When not set, all toolsets are enabled. Invalid names are ignored; if all names are invalid, all toolsets are enabled as a fallback.

## Example Usage

Once connected, you can interact with the ANWB API using natural language:

- "Search for locations near Amsterdam"
- "Find the coordinates of Eindhoven Centraal"
- "Calculate a route from Amsterdam to Eindhoven"
- "Plan a bike route from Utrecht Centraal to De Uithof"
- "How long does it take to walk from Dam Square to Vondelpark?"
- "What is the fastest route from Utrecht to Den Haag?"
- "Are there any traffic jams on the A2?"
- "Show me all current roadworks"
- "Give me a traffic summary"
- "What speed cameras are active on the A1?"
- "Plan a route from Ede to Zwolle avoiding tolls"
- "Calculate a caravan route from Amsterdam to the Veluwe"
- "Plan an e-bike route from Utrecht to Amersfoort"
- "What electric vehicles are available from Tesla?"
- "Plan an EV route from Amsterdam to Maastricht with a Tesla Model 3"
- "How long does it take to drive from Rotterdam to Groningen avoiding motorways?"

## Community

- Support: [SUPPORT.md](SUPPORT.md)
- Security reporting: [SECURITY.md](SECURITY.md)
- Contributing guidelines: [CONTRIBUTING.md](CONTRIBUTING.md)
- Bug reports and feature requests: [Issues](https://github.com/bartwaardenburg/anwb-mcp/issues)

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

### Project Structure

```
src/
  index.ts              # Entry point (stdio transport)
  server.ts             # MCP server setup and toolset filtering
  anwb-client.ts        # ANWB API HTTP client with caching and retry
  cache.ts              # TTL-based in-memory response cache
  types.ts              # TypeScript interfaces for ANWB API responses
  tool-result.ts        # Error formatting with recovery suggestions
  update-checker.ts     # NPM update notifications
  tools/
    locations.ts        # Location and address search
    routes.ts           # Route calculation with directions
    incidents.ts        # Traffic incidents and summary
```

## Requirements

- Node.js >= 20

## License

MIT - see [LICENSE](LICENSE) for details.
