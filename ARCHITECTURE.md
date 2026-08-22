# Architecture

## MVP Components
- **Express Web App** (`src/server.js`): page routes + form handlers
- **AI Analysis Service** (`src/services/analysisService.js`):
  - Attempts GitHub Copilot SDK inference
  - Initializes Microsoft Agent Framework context
  - Falls back to deterministic heuristic when AI call fails
- **Recommendation Service** (`src/services/recommendationService.js`): fatigue-aware task ranking
- **Storage Service** (`src/services/storage.js`): JSON persistence for tasks, fatigue logs, and learning profile

## Learning Loop
- User edits AI estimate on task detail
- Edit updates `learningProfile` (duration multiplier, difficulty bias, focus bias)
- Future task analysis applies that profile

## Reliability
- AI failure-safe fallback keeps app usable for non-technical users
- Server-side clamping/validation for all numeric inputs
