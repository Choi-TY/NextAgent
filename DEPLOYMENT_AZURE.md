# Azure Deployment (App Service + azd)

## Files in this repo
- `azure.yaml`
- `infra/main.bicep`

## One-time setup
```bash
az login
azd auth login
azd env new nextagent-dev
```

## Deploy
```bash
azd up
```

This provisions Linux App Service + Application Insights and deploys this Node.js app.

## Required app settings
- `NODE_ENV=production`
- `PORT` (set by App Service automatically)
- Optional for live Copilot SDK calls: `GITHUB_TOKEN`
