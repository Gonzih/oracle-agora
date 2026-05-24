# ORACLE — Prediction Market Intelligence Agent
## Agora Hackathon Submission

### Task Restatement
Build a TypeScript autonomous agent that:
1. Pulls smart money signals from @gonzih/poly-scout (MCP server)
2. Reasons about market mispricing using Kelly criterion
3. Executes (simulated) USDC trades via Circle Wallets API on testnet
4. Interacts with Arc testnet via JSON-RPC
5. Runs on a 15-minute cron cycle autonomously

---

### Approaches Considered

**Approach A: Direct Polymarket API integration (skip poly-scout)**
- Pro: Simpler, no MCP complexity
- Con: Misses the "smart money signal" differentiation; poly-scout is the published signal layer

**Approach B: poly-scout as MCP subprocess via `@modelcontextprotocol/sdk` Client**
- Pro: Demonstrates agentic tool-use (agent calling another agent's tools); elegant separation
- Con: Adds MCP protocol overhead; npx spawn latency
- This is the right approach for demonstrating agentic sophistication

**Approach C: Fork poly-scout source and inline its API calls**
- Pro: No MCP overhead
- Con: Doesn't credit poly-scout as signal layer; defeats the narrative

**Decision: Approach B** — MCP client integration shows sophisticated agentic architecture (key judging criterion), cleanly separates signal layer from reasoning layer.

---

### Architecture

```
                    ┌─────────────────────────────────────────┐
                    │           ORACLE Orchestrator           │
                    │         (15-min cron loop)              │
                    └────────────┬────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                   ▼
    ┌─────────────────┐ ┌──────────────┐  ┌──────────────────┐
    │  Signal Layer   │ │ Agent Layer  │  │ Execution Layer  │
    │  (poly-scout    │ │ (reasoning + │  │  Circle Wallets  │
    │   MCP client)   │ │  Kelly bet   │  │  + Arc RPC       │
    └─────────────────┘ │  sizing)     │  └──────────────────┘
           │            └──────────────┘          │
           │                   │                  │
    poly-scout MCP      JSON recommendation    USDC transfer
    scan_smart_money     { market, position,   (testnet simulated)
    get_late_money         kelly_fraction,
    get_wallet_positions   rationale }
```

### Files to Touch
```
package.json
tsconfig.json
.env.example
src/
  signals/
    types.ts          ← SmartMoneySignal, LateMoney interfaces
    polyScoutClient.ts ← MCP client wrapping poly-scout
    index.ts          ← SignalAggregator (combines signals)
  agent/
    types.ts          ← TradeRecommendation interface
    kelly.ts          ← Kelly criterion math
    index.ts          ← OracleAgent reasoning loop
  circle/
    types.ts          ← Wallet, Balance, Transfer interfaces
    index.ts          ← CircleClient (sandbox Wallets API)
  arc/
    types.ts          ← Block, ChainInfo interfaces
    index.ts          ← ArcClient (JSON-RPC wrapper)
  index.ts            ← Orchestrator + cron
README.md
```

### Risks and Unknowns
- poly-scout MCP client: spawning npx is slow; add timeout + error handling
- Circle API: entity secret encryption (RSA-OAEP) required for developer wallets; implement with Node crypto
- Arc RPC endpoint `rpc.arc.canteen.xyz` may not resolve; fall back to `arc-testnet.drpc.org`
- No real API keys available; graceful mock mode when env vars absent
