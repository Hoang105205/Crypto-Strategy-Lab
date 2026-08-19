# Quickstart: Remove Update Strategy API

## Prerequisites
- Backend API running locally (`npm start` or `npm run dev` in `apps/backend`)
- Frontend Web running locally (`npm run dev` in `apps/frontend`)

## Validation Scenarios
### Scenario 1: Backend Endpoint Removed
1. Open terminal and run: `curl -X PUT http://localhost:3001/api/strategies/some-id -d '{"name": "test"}'`
2. ✅ Expected: Server returns `404 Not Found` or `405 Method Not Allowed`.

### Scenario 2: Frontend "Save as New" Flow
1. Open the UI Strategy Builder (`/strategy`).
2. Select an existing strategy from the Catalog.
3. Modify some parameters.
4. Click Save.
5. ✅ Expected: A new strategy is created in the Catalog, and the existing one is unchanged. (Check network tab for POST instead of PUT).
