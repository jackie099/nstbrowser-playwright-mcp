# nstbrowser-playwright-mcp

MCP server that combines [NSTBrowser](https://www.nstbrowser.io/) profile management with [Playwright](https://playwright.dev/) browser automation via CDP (Chrome DevTools Protocol).

Built on top of the official [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp) package — all browser automation tools are provided by Microsoft's Playwright MCP server, connected to NSTBrowser profiles via CDP.

## Features

- **26 MCP tools** — 20 browser automation tools (from `@playwright/mcp`) + 6 session/profile management tools
- Connect to existing NSTBrowser profiles or create temporary ones
- Multi-session support with session switching
- Full Playwright browser automation: navigation, clicking, typing, screenshots, JavaScript evaluation, drag & drop, form filling, and more
- Console log and network request tracking
- Accessibility snapshots for AI-driven interaction

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [NSTBrowser](https://www.nstbrowser.io/) installed and running
- An NSTBrowser API key

## Installation

```bash
npm install nstbrowser-playwright-mcp
```

Or clone and build from source:

```bash
git clone https://github.com/nicegram/nstbrowser-playwright-mcp.git
cd nstbrowser-playwright-mcp
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NSTBROWSER_API_KEY` | Yes | — | Your NSTBrowser API key |
| `NSTBROWSER_API_ADDRESS` | No | `http://localhost:8848/api/v2` | NSTBrowser API endpoint |

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nstbrowser": {
      "command": "npx",
      "args": ["-y", "nstbrowser-playwright-mcp"],
      "env": {
        "NSTBROWSER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "nstbrowser": {
      "command": "npx",
      "args": ["-y", "nstbrowser-playwright-mcp"],
      "env": {
        "NSTBROWSER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### Session Management

| Tool | Description |
|------|-------------|
| `create_session` | Create a browser session from an existing NSTBrowser profile or a temporary config |
| `list_sessions` | List all active browser sessions |
| `switch_session` | Switch the active session |
| `close_session` | Close a session and disconnect |

### Browser Automation (from `@playwright/mcp`)

These tools are automatically available after creating your first session. They are provided by the official Playwright MCP server and use accessibility snapshot refs (`element`/`ref`) for targeting elements.

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_navigate_back` | Go back in browser history |
| `browser_snapshot` | Get an accessibility snapshot of the page |
| `browser_take_screenshot` | Take a screenshot (PNG or JPEG) |
| `browser_click` | Click an element |
| `browser_type` | Type text into an editable element |
| `browser_fill_form` | Fill multiple form fields at once |
| `browser_press_key` | Press a keyboard key |
| `browser_hover` | Hover over an element |
| `browser_select_option` | Select a dropdown option |
| `browser_drag` | Drag and drop between elements |
| `browser_file_upload` | Upload files |
| `browser_evaluate` | Evaluate JavaScript on page or element |
| `browser_run_code` | Run a Playwright code snippet |
| `browser_wait_for` | Wait for text, text disappearance, or time |
| `browser_tabs` | Manage tabs (list, new, close, select) |
| `browser_console_messages` | Read console messages |
| `browser_network_requests` | List network requests |
| `browser_resize` | Resize the browser window |
| `browser_handle_dialog` | Accept or dismiss dialogs |

### NSTBrowser Management

| Tool | Description |
|------|-------------|
| `nst_get_profiles` | List available NSTBrowser profiles |
| `nst_get_browsers` | List running NSTBrowser instances |

## Usage Examples

### Connect to an existing profile

```
Use create_session with profileId "abc123" to connect to my NSTBrowser profile,
then navigate to https://example.com and take a screenshot.
```

### Create a temporary session

```
Create a temporary browser session and navigate to https://news.ycombinator.com.
Get an accessibility snapshot of the page.
```

### Multi-session workflow

```
Create two sessions - one for GitHub and one for Gmail.
Switch between them to check notifications on both.
```

## How It Works

1. **Session creation** — When you call `create_session`, the server connects to NSTBrowser's API to get a CDP (Chrome DevTools Protocol) WebSocket URL for the requested profile.
2. **Playwright MCP bridge** — The CDP endpoint is passed to `@playwright/mcp`'s `createConnection`, which creates a full Playwright MCP server instance connected to that browser.
3. **Tool proxying** — On the first session creation, browser tools are discovered from the Playwright MCP instance and registered as proxy tools on our server. Tool calls are forwarded to the active session's Playwright MCP client.
4. **Multi-session** — Each session has its own Playwright MCP connection. Switching sessions routes all browser tool calls to the new active session.

## Development

```bash
npm install
npm run build
npm test
npm run lint
```

## License

[MIT](LICENSE)
