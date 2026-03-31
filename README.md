# openclaw-plugin-lark-cli

OpenClaw plugin that lets agents run any [lark-cli](https://github.com/larksuite/cli) command to interact with Lark/Feishu.

## Prerequisites

Install and authenticate lark-cli before using this plugin:

```bash
# Install
npm install -g @larksuite/cli

# Set up app credentials (interactive, one-time)
lark-cli config init

# Authenticate
lark-cli auth login --recommend

# Verify
lark-cli auth status
```

## Installation

```bash
openclaw plugins install openclaw-plugin-lark-cli
```

Or for local development:

```bash
openclaw plugins install --link /path/to/openclaw-plugin-lark-cli
```

## Tool: `lark_cli`

Registers a single `lark_cli` tool that accepts any lark-cli subcommand string.

| Parameter | Type   | Required | Description                                         |
|-----------|--------|----------|-----------------------------------------------------|
| `command` | string | yes      | Subcommand and args (everything after `lark-cli`)   |

### Example agent prompts

- "Check my Lark calendar agenda for today"
- "Send a Lark message to chat oc_xxx saying hello"
- "Create a Lark doc titled 'Meeting Notes' with the content ..."
- "List all records in Lark Base app xxx, table tbl_xxx"
- "Search my Lark messages for keyword 'budget'"

### Example tool calls

```json
{ "command": "calendar +agenda" }
{ "command": "im +messages-send --chat-id oc_xxx --text \"Hello team!\"" }
{ "command": "docs +create --title \"Sprint Notes\" --markdown \"# Sprint\\n- Task 1\"" }
{ "command": "base records list --app-token appXXX --table-id tblXXX" }
{ "command": "auth status" }
```

## Testing

### Step 1: Verify lark-cli authentication

Run these manually in a terminal **before** testing with an agent (interactive login is not supported inside the agent):

```bash
lark-cli auth status
```

If not logged in:
```bash
lark-cli config init          # Enter App ID and App Secret (one-time setup)
lark-cli auth login --recommend   # Browser-based login
lark-cli auth status          # Confirm login succeeded
```

### Step 2: Install the plugin

```bash
# From ClawHub (after publishing)
openclaw plugins install openclaw-plugin-lark-cli

# Or link local development copy
cd ~/work/openclaw-plugin-lark-cli && npm install
openclaw plugins install --link ~/work/openclaw-plugin-lark-cli
```

Restart the OpenClaw gateway (via the Mac app) after installation.

### Step 3: Smoke test — auth status

```bash
openclaw agent --local --session-id test-lark \
  --message "check lark auth status"
```

Expected: agent calls `lark_cli` with `command: "auth status"` and returns login info.

### Step 4: Calendar

```bash
openclaw agent --local --session-id test-lark \
  --message "show my lark calendar agenda for today"
```

Expected: agent calls `lark_cli` with `command: "calendar +agenda"` and returns event list.

### Step 5: Send a message

Get your chat ID first (run manually):
```bash
lark-cli im chats list --format json | head -50
```

Then test via agent (replace `oc_xxx` with a real chat ID):
```bash
openclaw agent --local --session-id test-lark \
  --message "send a lark message as bot to chat oc_xxx with text 'hello from openclaw agent'"
```

Expected: agent calls `lark_cli` with `command: "im +messages-send --as bot --chat-id \"oc_xxx\" --text \"hello from openclaw agent\""` and returns `{ "ok": true, ... }`.

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `lark-cli: command not found` | Binary not in PATH | `export LARK_CLI_BIN=$(which lark-cli)` |
| `not logged in` | Not authenticated | Run `lark-cli auth login --recommend` in terminal |
| Plugin not loaded | Gateway not restarted | Restart via OpenClaw Mac app |
| `Exit code 1` on send | Missing `--as bot` flag | Specify "send as bot" in your prompt |

## Custom lark-cli binary path

If `lark-cli` is not on the default PATH (e.g. in a server environment), set:

```bash
export LARK_CLI_BIN=/path/to/lark-cli
```

## Covered capabilities

| Domain     | Sample commands                                              |
|------------|--------------------------------------------------------------|
| Calendar   | `calendar +agenda`, `calendar events list`                   |
| Messages   | `im +messages-send`, `im messages list`, `im +search`        |
| Docs       | `docs +create`, `docs +read`, `docs +update`                 |
| Drive      | `drive files upload`, `drive files download`                 |
| Base       | `base records list`, `base records create`                   |
| Sheets     | `sheets +read`, `sheets +write`, `sheets +append`            |
| Tasks      | `task +create`, `task +list`                                 |
| Wiki       | `wiki nodes list`, `wiki +create`                            |
| Contact    | `contact users get`, `contact +search`                       |
| Mail       | `mail +list`, `mail +send`, `mail +read`                     |

Run `lark-cli --help` (via the tool) to see all 200+ available commands.
