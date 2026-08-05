# Frontend Design System

> **Owner**: Member D | **Status**: Draft — fill during Week 1

## Design Principles
1. [TODO — e.g., "Data-dense dashboard: charts, leaderboard, and loop status visible without navigation"]
2. [TODO — e.g., "Consistent spacing using 4px grid"]
3. [TODO — e.g., "Real-time state always visible: connection status, live indicators"]

## Component Library
| Component | Library | Custom? | Notes |
|-----------|---------|---------|-------|
| CandlestickChart | [TODO — lightweight-charts?] | Yes | MA / Bollinger / SR overlays |
| Leaderboard Table | [TODO] | Yes | Sortable by any metric |
| Strategy Builder | [TODO] | Yes | Drag & combine strategies |
| News Feed | [TODO] | Partial | Sentiment badges |
| Loop Status Panel | [TODO] | Yes | Progress, start/stop/pause |
| [Button / Input / Card / Modal] | [TODO] | No | Common UI primitives |

## Color Palette
| Name | Hex | Usage |
|------|-----|-------|
| Primary | [TODO] | CTA buttons, links |
| Bullish / Success | [TODO] | Positive P&L, BUY signals |
| Bearish / Error | [TODO] | Negative P&L, SELL signals |
| Warning | [TODO] | HOLD signals, connection issues |
| Background | [TODO] | Page background |
| Surface | [TODO] | Card/panel background |
| Text Primary | [TODO] | Main text |
| Text Secondary | [TODO] | Supporting text |

## Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | [TODO] | [TODO] | 700 |
| H2 | [TODO] | [TODO] | 600 |
| Body | [TODO] | [TODO] | 400 |
| Numeric (prices, metrics) | [TODO — monospace] | [TODO] | 500 |

## Spacing System
4px base grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

## Layout Patterns
- **Dashboard**: 4-chart multi-timeframe grid + sidebar panels [TODO: confirm]
- **Strategy Builder**: [TODO]
- **Leaderboard**: full-width table [TODO]

## Routing Structure
| Path | Page | Notes |
|------|------|-------|
| / | Dashboard (charts + leaderboard + loop status) | [TODO] |
| /builder | Strategy composition | [TODO] |
| /news | News feed + sentiment | [TODO] |
| /backtest/[id] | Trade detail for a backtest result | [TODO] |
