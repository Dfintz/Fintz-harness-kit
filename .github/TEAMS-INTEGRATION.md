# Teams Integration — v3.0.0 Bi-Directional Approvals

Complete guide to deploying a Microsoft Teams bot agent for interactive harness approvals.

## Architecture Overview

### One-Way Notifications (v2.9.0)
```
Harness Loop → teams-notifier.mjs → Adaptive Card → Teams Channel
(no approval feedback)
```

### Bi-Directional Approvals (v3.0.0)
```
┌─────────────┐
│ Harness     │ Sends approval-needed card
│ Loop        │─────────────────────────────→ Teams Channel
└─────────────┘                               │
    ▲                          Approver        │
    │                          clicks          │
    │                          button ◀────────┘
    │                            │
    └────────────────────────────┘
  teams-agent.mjs receives action
  updates stage-state.mjs
```

## Prerequisites

1. **Azure account** with Azure Bot Service capability
2. **Teams tenant** with bot installation permission
3. **Node.js 18+** for running the teams-agent service
4. **Hosting** for teams-agent (Azure App Service, Heroku, self-hosted)

## Step 1: Create Azure Bot Service

### 1a. Register Bot in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Create new resource → **Bot Services**
3. Fill in:
   - **Bot handle:** (e.g., `harness-approval-bot`)
   - **Subscription:** Your subscription
   - **Resource Group:** Create or select existing
   - **Pricing tier:** Free (F0) for testing, Standard (S1) for production
4. Under **App Registration**:
   - Select **Create new Microsoft App ID**
   - Copy the **App ID** (save this)
5. Click **Create**

### 1b. Retrieve App Password

After bot creation:

1. Go to Bot Service → **Configuration**
2. Click **Manage Microsoft App ID** (opens App Registration)
3. In App Registrations → **Certificates & secrets**
4. Create new client secret:
   - **Description:** `harness-teams-agent`
   - **Expires:** 24 months
5. Copy the **Value** (save this as `HARNESS_TEAMS_BOT_APP_PASSWORD`)

### 1c. Enable Teams Channel

1. Go back to Bot Service → **Channels**
2. Click **Teams** (Microsoft Teams icon)
3. Review and accept the terms
4. The channel auto-configures the Teams bot endpoint

## Step 2: Deploy teams-agent Service

### Option A: Azure App Service (Recommended)

```bash
# 1. Create App Service in the same resource group
az appservice plan create \
  --name harness-bot-plan \
  --resource-group <your-rg> \
  --sku F1

az webapp create \
  --name harness-teams-bot \
  --resource-group <your-rg> \
  --plan harness-bot-plan \
  --runtime "NODE|20"

# 2. Configure environment variables
az webapp config appsettings set \
  --name harness-teams-bot \
  --resource-group <your-rg> \
  --settings \
    HARNESS_TEAMS_BOT_APP_ID=<your-app-id> \
    HARNESS_TEAMS_BOT_APP_PASSWORD=<your-app-password> \
    HARNESS_TEAMS_BOT_PORT=8080 \
    HARNESS_STATE_DIR=/home/site/wwwroot/.github/harness/runs

# 3. Deploy code
cd <harness-kit-repo>
az webapp deployment source config-zip \
  --resource-group <your-rg> \
  --name harness-teams-bot \
  --src-path ./dist.zip
```

### Option B: Self-Hosted / Docker

```bash
# Build Docker image
cat > Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY scripts/harness/teams-agent.mjs ./
COPY scripts/harness/stage-state.mjs ./
CMD ["node", "teams-agent.mjs"]
EOF

docker build -t harness-teams-bot .

# Run locally (for testing)
docker run -p 3978:3978 \
  -e HARNESS_TEAMS_BOT_APP_ID=<your-app-id> \
  -e HARNESS_TEAMS_BOT_APP_PASSWORD=<your-app-password> \
  -e HARNESS_TEAMS_BOT_PORT=3978 \
  harness-teams-bot
```

## Step 3: Configure Harness Kit

### 3a. Set Environment Variables

```bash
# .env or shell profile
export HARNESS_TEAMS_BOT_APP_ID=<from-azure>
export HARNESS_TEAMS_BOT_APP_PASSWORD=<from-azure>
export HARNESS_TEAMS_AGENT_URL=https://harness-teams-bot.azurewebsites.net
export HARNESS_TEAMS_BOT_CHANNEL_ID=<optional-teams-channel-id>
export HARNESS_STATE_DIR=.github/harness/runs

# Pin canonical caller headers for ACL-aware HTTP adapter integrations
# (avoid environment drift between gateways, proxies, and local runs)
export HARNESS_CALLER_ID_HEADER=x-harness-caller-id
export HARNESS_CALLER_ROLE_HEADER=x-harness-caller-role
export HARNESS_CALLER_TEAMS_HEADER=x-ms-groups

# For local testing
export HARNESS_TEAMS_WEBHOOK_URL=https://outlook.webhook.office.com/webhookb2/...
```

### 3c. Canonical Header Mapping (ACL Safety)

When Teams/Open WebUI traffic goes through a reverse proxy or gateway, normalize identity headers
before forwarding to the harness HTTP adapter. Use one canonical mapping per environment and keep
it version-controlled in deployment config.

- `x-harness-caller-id`: stable user identifier
- `x-harness-caller-role`: coarse role label
- `x-ms-groups`: AD/Entra group ids or names (comma/semicolon separated)

If you must use different upstream header names, map them to these canonical values in the gateway,
or override `HARNESS_CALLER_*_HEADER` explicitly and consistently across all services.

### 3b. Update Bot Endpoint in Azure

1. Go to Bot Service → **Configuration**
2. Set **Messaging endpoint** to:
   ```
   https://harness-teams-bot.azurewebsites.net/api/messages
   ```
3. Save

## Step 4: Test the Integration

### Test 1: Send Dry-Run Card

```bash
# Generate approval-needed card (no webhook post)
npm run harness:teams:notify -- \
  approval-needed \
  --loop build-fix \
  --stage architect \
  --run-id test-run-123 \
  --dry-run
```

Expected output: Adaptive Card JSON with interactive buttons (if `HARNESS_TEAMS_AGENT_URL` is set).

### Test 2: Verify Teams Agent Startup

```bash
# Terminal 1: Start teams-agent
npm run harness:teams:agent

# Terminal 2: Health check
curl http://localhost:3978/healthz
```

Expected: `{"ok":true,"version":"3.0.0"}`

### Test 3: Simulate Approval via API

```bash
# Approve a run
curl -X POST http://localhost:3978/teams-agent/action \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "runId": "test-run-123",
    "reason": "looks good",
    "userId": "user@company.com"
  }'
```

Expected: `{"ok":true,"runId":"test-run-123","decision":"approve",...}`

### Test 4: Live Approval Flow

1. Start a harness loop that requires approval:
   ```bash
   npm run harness:feature -- --task "Create a simple file"
   # Loop will hit approval gate
   ```

2. Get the run ID:
   ```bash
   npm run harness:state -- status
   # Look for "runId" in output
   ```

3. Approve via teams-agent API:
   ```bash
   curl -X POST http://localhost:3978/teams-agent/action \
     -H "Content-Type: application/json" \
     -d "{\"action\":\"approve\",\"runId\":\"<run-id>\",\"reason\":\"approved\"}"
   ```

4. Check stage-state updated:
   ```bash
   npm run harness:state -- approvals
   ```

## Teams Bot Commands

Once the bot is installed in Teams, use these commands in any chat:

```
@harness approve --run-id abc123 --reason "lgtm"
@harness reject --run-id abc123 --reason "needs revision"
@harness status
```

## Interactive Approval Buttons

When `HARNESS_TEAMS_AGENT_URL` is set, approval cards show clickable buttons:

- **✅ Approve** — Instantly approves the run via teams-agent
- **❌ Reject** — Instantly rejects the run via teams-agent

Buttons send `Action.OpenUrl` actions to the teams-agent callback endpoint.

## API Reference

### Endpoints

#### `GET /healthz`
Health check.
```bash
curl http://localhost:3978/healthz
```
Response: `{"ok":true,"version":"3.0.0"}`

#### `GET /teams-agent/status`
Get current harness state and recent approvals.
```bash
curl http://localhost:3978/teams-agent/status
```
Response:
```json
{
  "state": { "loop": "...", "stage": "...", "runId": "..." },
  "recentApprovals": [
    { "runId": "...", "status": "approved", "decidedAt": "..." }
  ]
}
```

#### `POST /teams-agent/notify`
Queue a notification to Teams (called by harness after stage-complete).
```bash
curl -X POST http://localhost:3978/teams-agent/notify \
  -H "Content-Type: application/json" \
  -d '{
    "template": "approval-needed",
    "loop": "build-fix",
    "stage": "architect",
    "runId": "abc123"
  }'
```
Response: `{"ok":true,"notification":{...}}`

#### `POST /teams-agent/action`
Handle approval/rejection (from card buttons or CLI).
```bash
curl -X POST http://localhost:3978/teams-agent/action \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "runId": "abc123",
    "reason": "approved via card",
    "userId": "user@company.com"
  }'
```
Response: `{"ok":true,"decision":"approve",...}`

#### `POST /api/messages`
Teams Bot Framework webhook (Teams → bot).
Receives message activities and routes approval commands to stage-state.

## Troubleshooting

### Bot Not Responding in Teams

**Symptoms:** Messages to bot are ignored; no response.

**Diagnosis:**
1. Verify Teams Agent is running: `curl http://<bot-url>/healthz`
2. Check Bot Service → Configuration → Messaging endpoint
3. Verify app credentials match Azure Bot Service
4. Check firewall/network access to bot endpoint

**Fix:**
```bash
# Restart teams-agent
npm run harness:teams:agent

# Verify connectivity
curl -X POST https://harness-teams-bot.azurewebsites.net/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"ping"}'
```

### Approval Not Recorded in stage-state

**Symptoms:** Approval action succeeds, but `npm run harness:state -- approvals` is empty.

**Diagnosis:**
1. Verify `HARNESS_STATE_DIR` points to correct `.github/harness/runs`
2. Check file permissions on `approvals.jsonl`
3. Look for error logs in teams-agent output

**Fix:**
```bash
# Check stage-state path
echo $HARNESS_STATE_DIR
ls -la .github/harness/runs/

# Manually test approval write
node -e "
  import { writeApproval } from './scripts/harness/stage-state.mjs';
  writeApproval({ runId: 'test', status: 'approved' });
"
```

### Buttons Not Appearing in Approval Card

**Symptoms:** Card shows CLI commands, no ✅ Approve / ❌ Reject buttons.

**Cause:** `HARNESS_TEAMS_AGENT_URL` env var not set.

**Fix:**
```bash
export HARNESS_TEAMS_AGENT_URL=https://harness-teams-bot.azurewebsites.net

# Re-run card generation
npm run harness:teams:notify -- approval-needed --run-id test --dry-run
```

## Production Deployment Checklist

- [ ] Azure Bot Service registered and credentials saved
- [ ] Teams Agent deployed and publicly reachable
- [ ] Messaging endpoint configured in Bot Service
- [ ] All env vars set (APP_ID, APP_PASSWORD, AGENT_URL, STATE_DIR)
- [ ] Health check passes: `curl <bot-url>/healthz`
- [ ] Test approval flow end-to-end
- [ ] Add teams-agent to systemd/container orchestration for auto-restart
- [ ] Monitor approvals log: `npm run harness:state -- approvals`
- [ ] Set up log aggregation (Azure Monitor, CloudWatch, etc.)

## Architecture Decisions

### Why Adaptive Cards instead of buttons in card body?
Adaptive Card `Action.Submit` buttons require authentication to call back; `Action.OpenUrl` is simpler for initial rollout. Power Automate (Phase 4) will add proactive messaging and richer workflows.

### Why separate teams-agent service?
Keeps the core harness loop independent from Teams infrastructure. Teams Agent is stateless and can be scaled/restarted without affecting loop execution. Approval decisions are persisted to `stage-state.mjs`, which is the single source of truth.

### Why no database?
File-based state (`approvals.jsonl`) keeps operational complexity low and enables simple backup/auditing. For high-volume approval systems, migrate to a database later (MongoDB, PostgreSQL) without changing the approval API.

## See Also

- [v2.9.0 Teams Notifier Brief](./.github/harness/memory/briefs/v2.9.0-teams-notifier-2026-08-03.md)
- [Stage State Module](./scripts/harness/stage-state.mjs)
- [Teams Agent Source](./scripts/harness/teams-agent.mjs)
- [Microsoft Bot Framework Docs](https://docs.microsoft.com/en-us/azure/bot-service/)
- [Adaptive Cards Schema](https://adaptivecards.io/schemas/adaptive-card.json)
