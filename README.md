# ORACLE

> *The crowd lives inside a mythology that lags reality. The gap between mythology and reality is the trade.*

ORACLE is an autonomous prediction market intelligence agent that detects where collective belief is mispricing current reality — and executes via USDC on Arc testnet.

## The Thesis

Prediction markets are priced by the crowd. The crowd is slow. Smart money — wallets with consistent positive ROI — moves first. By the time consensus mythology catches up, informed traders have already positioned.

ORACLE's edge: **narrative-to-reality arbitrage**. Track where smart money is concentrated. Estimate the gap between their implied fair value and the current market price. Size the bet with Kelly criterion. Execute via Circle USDC.

This isn't sentiment analysis. It's a signal that someone with skin in the game already did the research.

---

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │           ORACLE Orchestrator           │
                    │         (15-min cron loop)              │
                    └────────────┬────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                   ▼
    ┌─────────────────┐ ┌──────────────────┐  ┌──────────────────┐
    │  Signal Layer   │ │   Agent Layer    │  │ Execution Layer  │
    │                 │ │                  │  │                  │
    │  poly-scout     │ │  Kelly criterion │  │  Circle Wallets  │
    │  (MCP client)   │ │  fair value est. │  │  + Arc testnet   │
    │                 │ │  +EV filtering   │  │  JSON-RPC        │
    └────────┬────────┘ └────────┬─────────┘  └────────┬─────────┘
             │                   │                      │
    scan_smart_money      TradeRecommendation      USDC transfer
    get_late_money        {market, position,       eth_blockNumber
    get_wallet_positions   edge, kelly_fraction,   logTradeIntent
                           rationale}
```

### Component Breakdown

| Layer | File | Role |
|-------|------|------|
| Signal | `src/signals/polyScoutClient.ts` | MCP client spawning poly-scout subprocess |
| Signal | `src/signals/index.ts` | Aggregates consensus + late-money signals |
| Agent | `src/agent/kelly.ts` | Kelly criterion + fair value estimation |
| Agent | `src/agent/index.ts` | Reasoning loop, +EV filtering |
| Execute | `src/circle/index.ts` | Circle Developer Wallets API (sandbox) |
| Execute | `src/arc/index.ts` | Arc testnet JSON-RPC wrapper |
| Main | `src/index.ts` | Orchestrator + cron scheduler |

---

## Signal Layer: poly-scout

[`@gonzih/poly-scout`](https://www.npmjs.com/package/@gonzih/poly-scout) is an MCP (Model Context Protocol) server that tracks Polymarket wallets with consistent positive ROI. ORACLE integrates it as an **agent tool** — spawning poly-scout as a subprocess and calling its tools via the MCP stdio protocol.

This is a deliberate architectural choice: ORACLE is an agent that uses another agent (poly-scout) as a tool.

```
ORACLE (MCP Client)
  → spawns: npx @gonzih/poly-scout (MCP Server)
  → calls: scan_smart_money()
  → calls: get_late_money(marketId)
  → calls: get_wallet_positions(address)
```

### Sample Signal Output

```json
{
  "marketId": "0x1234abc...",
  "marketQuestion": "Will the Fed cut rates before July 2026?",
  "consensus": {
    "outcome": "YES",
    "walletCount": 7,
    "avgEntryPrice": 0.38,
    "totalVolume": 14200,
    "confidence": 0.72
  },
  "lateMoney": {
    "volumeSpikeMultiplier": 3.4,
    "netBias": "YES",
    "walletConcentration": 0.65,
    "confidenceScore": 0.81
  },
  "compositeScore": 0.77,
  "timestamp": "2026-05-23T14:30:00.000Z"
}
```

---

## Agent Reasoning

ORACLE uses two quantitative tools to evaluate signals:

### 1. Fair Value Estimation

Smart money average entry price is a revealed preference. If 7 wallets with strong ROI all paid 0.38 for YES, their collective assessment of fair value is above 0.38. ORACLE blends:

- Market price (baseline)
- Smart money avg entry (signal)
- Late money directional bias (nudge ±3%)

Signal weight scales with composite score (0–70%). The market always gets at least 30% weight.

### 2. Kelly Criterion

```
f* = (q - p) / (1 - p)
```

Where `p` = market price, `q` = fair value estimate. Fractional Kelly (0.5× by default) reduces variance while maintaining positive expected growth. Maximum 20% of bankroll per bet.

### Sample Trade Recommendation

```json
{
  "runId": "a3f1b2c4-...",
  "timestamp": "2026-05-23T14:30:01.000Z",
  "marketsScanned": 5,
  "recommendationsGenerated": 2,
  "recommendations": [
    {
      "market": "0x1234abc...",
      "marketQuestion": "Will the Fed cut rates before July 2026?",
      "signal_strength": 0.77,
      "recommended_position": "YES",
      "current_price": 0.38,
      "fair_value": 0.467,
      "edge": 0.087,
      "kelly_fraction": 0.071,
      "usdc_amount": 7.1,
      "confidence": 0.67,
      "rationale": "7 smart wallets with consistent positive ROI positioned YES at avg price 0.380. Fair value estimated at 46.7% vs market price 38.0%. Late money: 3.4x volume spike in last 48h, directional bias YES. Edge: +8.7%. Kelly fraction: 7.1% of bankroll. Composite signal score: 77/100.",
      "timestamp": "2026-05-23T14:30:00.000Z"
    }
  ]
}
```

---

## Circle Wallets API Integration

ORACLE uses Circle's Developer-Controlled Wallets API (sandbox) to manage USDC execution.

### What it does
1. **Creates** a developer wallet on ETH-SEPOLIA via `POST /developer/wallets`
2. **Checks** USDC balance via `GET /developer/wallets/{id}/balances`
3. **Executes** simulated trades via `POST /developer/transactions/transfer`

### Entity Secret Encryption

Circle requires each API call to include an `entitySecretCiphertext` — the entity secret encrypted with Circle's RSA public key (OAEP-SHA256). ORACLE implements this via Node.js `crypto.publicEncrypt`:

```
GET /config/entity/publicKey → Circle RSA public key
crypto.publicEncrypt(RSA-OAEP-SHA256, entitySecret) → ciphertext (base64)
```

### Sample Wallet Creation Output

```json
{
  "id": "a1b2c3d4-...",
  "address": "0x7f3a9b8c1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a",
  "blockchain": "ETH-SEPOLIA",
  "accountType": "EOA",
  "state": "LIVE",
  "walletSetId": "...",
  "custodyType": "DEVELOPER",
  "createDate": "2026-05-23T14:00:00.000Z",
  "updateDate": "2026-05-23T14:00:00.000Z"
}
```

### Sample Transfer Output

```json
{
  "id": "tx-a1b2c3d4",
  "walletId": "wallet-...",
  "state": "CONFIRMED",
  "txHash": "0xabc123...",
  "amounts": ["7.10"],
  "destinationAddress": "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",
  "createDate": "2026-05-23T14:30:05.000Z"
}
```

**No real money — testnet only.** Fund your testnet wallet at https://faucet.circle.com/ (20 USDC / address / 2h).

---

## Arc Testnet Integration

ORACLE uses Arc testnet for on-chain state verification and trade intent logging.

```typescript
// Connect and verify Arc RPC
const chainInfo = await arc.getChainInfo();
// → { chainId: 1244, networkName: 'Arc Testnet', latestBlock: 8421337, rpcEndpoint: '...' }

// Log trade intent at latest block
await arc.logTradeIntent({ walletAddress, marketId, position: 'YES', usdcAmount: 7.1 });
// → [arc] Trade intent logged at block 8421338
```

RPC fallback chain: `rpc.arc.canteen.xyz` → `arc-testnet.drpc.org` → `rpc.testnet.arc.network`

---

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your Circle API key and entity secret
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CIRCLE_API_KEY` | Circle sandbox API key | For live Circle |
| `CIRCLE_ENTITY_SECRET` | 32-byte hex entity secret | For live Circle |
| `CIRCLE_WALLET_SET_ID` | Pre-created wallet set ID | For live Circle |
| `ARC_RPC_URL` | Arc RPC endpoint | Optional |
| `REDIS_URL` | Redis for poly-scout caching | Optional |
| `ORACLE_BANKROLL_USDC` | Bankroll size (default: 100) | Optional |
| `KELLY_MULTIPLIER` | Fraction of Kelly (default: 0.5) | Optional |
| `MIN_EDGE` | Minimum edge to bet (default: 0.05) | Optional |

Without Circle API keys, ORACLE runs in **mock mode** — all wallet operations are simulated locally with logged output showing exactly what would happen.

### Run

```bash
# Build
npm run build

# Run once (demo mode)
node dist/index.js --once

# Run with cron (every 15 min)
npm start
```

---

## Traction

ORACLE builds on an existing production system:

- **polly-gamba** (private repo): Autonomous paper trading system running Polymarket predictions since March 2026. Tracks model accuracy and ROI across 200+ markets.

- **[@gonzih/poly-scout](https://www.npmjs.com/package/@gonzih/poly-scout)**: Published npm package tracking smart money in real-time on Polymarket. Used by ORACLE as its primary signal source via MCP.

- **ORACLE (this repo)**: The Arc/Circle-native extension — takes the proven signal layer from polly-gamba/poly-scout and adds USDC execution via Circle Wallets on Arc testnet.

---

## Project Structure

```
src/
  signals/
    types.ts              ← Signal type definitions
    polyScoutClient.ts    ← MCP client for poly-scout
    index.ts              ← SignalAggregator
  agent/
    types.ts              ← TradeRecommendation type
    kelly.ts              ← Kelly criterion + fair value
    index.ts              ← OracleAgent reasoning loop
  circle/
    types.ts              ← Wallet/Transfer types
    index.ts              ← CircleClient + CircleMockClient
  arc/
    types.ts              ← Block/Chain types
    index.ts              ← ArcClient (JSON-RPC)
  index.ts                ← Orchestrator + cron
```

---

*Built for the Agora Hackathon, May 2026. Deadline: May 25.*
