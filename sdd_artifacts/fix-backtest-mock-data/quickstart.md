# Quickstart: fix-backtest-mock-data

## Prerequisites
- Database is up and running.
- Prisma client is generated (`npx prisma generate`).

## Setup
No special setup required beyond the standard backend launch:
`npm run start:dev backend`

## Validation Scenarios
### Scenario 1: Fetching valid result
1. Create a dummy BacktestResult in DB or get an existing UUID.
2. Send `GET http://localhost:3001/api/strategies/backtest/[UUID]`
3. ✅ Expected: Returns 200 OK with the actual data from the database.

### Scenario 2: Fetching invalid result
1. Send `GET http://localhost:3001/api/strategies/backtest/non-existent-id`
2. ✅ Expected: Returns 404 Not Found error with standard HttpException JSON.
