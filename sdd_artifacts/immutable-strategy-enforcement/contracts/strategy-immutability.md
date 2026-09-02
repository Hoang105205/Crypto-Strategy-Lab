# Contract: Strategy Immutability API

## Endpoints

### DELETE /api/strategies/:name
Attempts to delete a strategy by name.

- **Status**: Permanently Prohibited / Guarded
- **Headers**:
  - `Authorization: Bearer <supabase_jwt>` (Optional/Enforced)
- **Response**:
  - `403 Forbidden`
  ```json
  {
    "statusCode": 403,
    "message": "Strategy deletion is permanently prohibited per ADR-0008 (Immutable Snapshots)",
    "error": "Forbidden"
  }
  ```

---

### PUT / PATCH /api/strategies/:name
Attempts to modify an existing strategy in-place.

- **Status**: Not Implemented / Disallowed
- **Response**:
  - `404 Not Found` or `405 Method Not Allowed`
  - In-place mutation is architecturally disallowed. Clients must use `POST /api/strategies/composite` to register new versions or composites.

---

### GET /api/strategies
Returns all available strategies (system built-in + user-created).

- **Response `200 OK`**:
  ```json
  [
    {
      "name": "MovingAverage",
      "type": "MA",
      "parameters": { "fastPeriod": 20, "slowPeriod": 50 },
      "isSystem": true,
      "canDelete": false
    },
    {
      "name": "MyComposite",
      "type": "COMPOSITE",
      "parameters": {},
      "isSystem": false,
      "canDelete": false
    }
  ]
  ```
  *(Note: `canDelete` is always strictly `false` across all strategies)*
