# ORACLE Build TODO

## Setup
- [x] Create branch feat/oracle-build
- [x] Write PLAN.md
- [x] Write TODO.md
- [ ] package.json + tsconfig.json + .env.example

## Signal Layer
- [ ] src/signals/types.ts
- [ ] src/signals/polyScoutClient.ts (MCP client)
- [ ] src/signals/index.ts (SignalAggregator)

## Agent Layer
- [ ] src/agent/types.ts
- [ ] src/agent/kelly.ts
- [ ] src/agent/index.ts

## Execution Layer
- [ ] src/circle/types.ts
- [ ] src/circle/index.ts (CircleClient)
- [ ] src/arc/types.ts
- [ ] src/arc/index.ts (ArcClient)

## Orchestrator
- [ ] src/index.ts

## Documentation
- [ ] README.md

## QA
- [ ] npm run build passes
- [ ] git diff --staged reviewed
- [ ] git commit + push + PR + merge
