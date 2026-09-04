# Quickstart: Immutable Strategy Enforcement

## Prerequisites
- Backend service running on port 3001
- Frontend service running on port 3000

## Validation Scenarios

### Scenario 1: Verify Absence of Delete Button in Catalog UI
1. Open browser to `http://localhost:3000/strategy`.
2. Inspect the **Catalog** tab displaying strategy cards (both built-in strategies and composite strategies).
3. ✅ **Expected**:
   - Every `StrategyCard` displays its name, type badge, and parameters.
   - **No DELETE button** is present on any card under any circumstances.

### Scenario 2: Verify Backend HTTP 403 Rejection on DELETE
1. Execute a curl or fetch command targeting the delete endpoint:
   ```bash
   curl -X DELETE http://localhost:3001/api/strategies/AnyStrategyName
   ```
2. ✅ **Expected**:
   - HTTP response status: `403 Forbidden`
   - Response body contains explicit message confirming deletion is prohibited per ADR-0008.

### Scenario 3: Verify Composite Child Dependencies Remain Intact
1. Build a new Composite Strategy combining two strategies (e.g. `MA` and `RSI`).
2. Run Backtest with the created composite.
3. ✅ **Expected**:
   - Backtest completes successfully without `missing child version` error.
   - The composite can be repeatedly evaluated indefinitely.
