# Quickstart: Strategy Registry Plugin System

## Testing Validation Scenarios

### Scenario 1: Successful Registration and Analysis
1. Instantiate `StrategyRegistry`.
2. Instantiate a mock `IStrategy` with `getName()` = `"MA-20"` and `getType()` = `"MA"`.
3. Call `registry.register(mockStrategy)`.
4. Call `registry.get("MA-20")` → returns `mockStrategy`.
5. Call `registry.analyze("MA-20", mockCandles)` → returns mock `ISignal`.

### Scenario 2: Duplicate Registration Protection
1. Call `registry.register(mockStrategy)`.
2. Attempt to call `registry.register(duplicateMockStrategy)` with same name/key.
3. ✅ Expected: Throws `Error: Strategy collision: strategy 'MA-20' or key 'MA:MA-20' is already registered`.

### Scenario 3: Non-existent Strategy Analysis
1. Call `registry.analyze("UnknownStrategy", mockCandles)`.
2. ✅ Expected: Throws `Error: Strategy 'UnknownStrategy' not found in registry`.
