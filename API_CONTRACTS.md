# API / Route Contracts

## Web routes
- `GET /` Home (fatigue input + today recommendations)
- `POST /fatigue` Save fatigue level (1-10)
- `GET /tasks/new` Add task page
- `POST /tasks` Create task and auto-run AI analysis
- `GET /tasks/:id` Task detail + edit form
- `POST /tasks/:id/edit-analysis` Save manual AI-estimate edits
- `POST /tasks/:id/complete` Mark task complete
- `GET /analysis` Fatigue-based ranking + difficulty categories
- `GET /weekly-record` Weekly completion/fatigue summary

## Task analysis payload shape
```json
{
  "difficulty": "easy|medium|hard",
  "estimatedMinutes": 30,
  "focusLevel": "low|medium|high",
  "focusRequired": true,
  "todaySuitabilityScore": 72,
  "reason": "string",
  "source": "copilot-sdk|github-models|heuristic-fallback|user-edited",
  "agentFrameworkLoaded": true
}
```
