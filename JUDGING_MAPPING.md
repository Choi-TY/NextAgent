# Hackathon Judging Mapping

## 1) Copilot SDK + Microsoft Agent Framework usage
- Core analysis flow (`src/services/analysisService.js`) attempts:
  - `@github/copilot-sdk` call for structured task estimation
  - `@microsoft/agents-hosting` agent app initialization
- User-facing fallback protects reliability when AI fails.

## 2) Productivity impact / problem fit
- Fatigue-aware recommendation engine (`src/services/recommendationService.js`)
- "Best task now" highlight on Home (`views/home.ejs`)
- Weekly completion/fatigue + postponed difficulty insights (`/weekly-record`)
- Manual correction loop improves future estimation quality.

## 3) Azure cloud integration/deployment
- `azure.yaml` and `infra/main.bicep` for reproducible Azure deployment
- App Service + Application Insights target architecture
- Deployment runbook in `DEPLOYMENT_AZURE.md`
