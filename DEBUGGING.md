# Debugging Guide

## Typical checks
1. Run tests: `npm test`
2. Run app: `npm start`
3. Open `/tasks/new`, create task, confirm redirect to `/analysis`
4. Open task detail and edit analysis fields
5. Recheck recommendation order from `/`

## Logs and AI fallback
- If Copilot SDK call succeeds, server logs:
  - `[AI] Copilot SDK inference succeeded.`
- If Copilot SDK call fails (CLI not installed/authenticated), server logs:
  - `[AI] Copilot SDK inference failed, using fallback.`
- If GitHub Models API call succeeds, server logs:
  - `[AI] GitHub Models inference succeeded.`
- If GitHub Models API call fails, server logs:
  - `[AI] GitHub Models inference failed, using fallback.`
- If Microsoft Agent Framework init fails, server logs:
  - `[AI] Microsoft Agent Framework unavailable.`
- App continues with deterministic heuristic output.

## Non-technical operator fallback behavior
- Even with AI/network/auth failures, users can:
  - add tasks
  - edit estimates manually
  - get recommendations
