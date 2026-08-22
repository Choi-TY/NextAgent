# EasyStart

Personal productivity web app with:
- Task input + due date + memo
- Fatigue-aware recommendation sorting
- AI-powered difficulty/time/focus analysis via GitHub Models API (gpt-4o-mini)
- Editable AI estimates with learning loop
- Dashboard: todo list + fatigue input + analysis results all in one page
- Azure deployment-ready configuration

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub personal access token — enables real AI analysis via GitHub Models API. If not set, the app falls back to heuristic analysis. | *(none — heuristic fallback)* |
| `DATA_FILE` | Absolute path to the JSON data file for persistent storage. Set this to a path on a mounted persistent volume when deploying to Azure App Service or similar. | `data/app-data.json` (relative to project root) |
| `PORT` | HTTP port | `3000` |

### Running locally

```bash
cp .env.example .env   # fill in GITHUB_TOKEN
npm start
```

See also:
- `QUICK_START.md`
- `ARCHITECTURE.md`
- `API_CONTRACTS.md`
- `DEBUGGING.md`
- `DEPLOYMENT_AZURE.md`
