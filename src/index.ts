/**
 * ORACLE — Prediction Market Intelligence Agent
 *
 * Narrative-to-reality arbitrage: the crowd lives inside a mythology that lags
 * reality. ORACLE detects where collective belief is mispricing current reality,
 * surfaces it as actionable intelligence, and executes via USDC on Arc testnet.
 *
 * Pipeline (runs every 15 minutes):
 *   1. Fetch smart money signals via poly-scout (MCP)
 *   2. Reason: does consensus + price divergence = +EV bet?
 *   3. Size with Kelly criterion
 *   4. Execute: Circle USDC wallet → Arc testnet
 */

import cron from "node-cron";
import { SignalAggregator } from "./signals/index.js";
import { OracleAgent } from "./agent/index.js";
import { CircleClient, CircleMockClient } from "./circle/index.js";
import { ArcClient } from "./arc/index.js";
import type { TradeRecommendation } from "./agent/types.js";
import type { CircleWallet } from "./circle/types.js";

const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? "*/15 * * * *";
const RUN_ONCE = process.argv.includes("--once");

// ---- Orchestrator ----

class OracleOrchestrator {
  private signals: SignalAggregator;
  private agent: OracleAgent;
  private circle: CircleClient | CircleMockClient;
  private arc: ArcClient;
  private wallet: CircleWallet | null = null;
  private totalRuns = 0;
  private totalRecommendations = 0;

  constructor() {
    this.signals = new SignalAggregator();
    this.agent = new OracleAgent();
    this.circle = CircleClient.fromEnv() ?? new CircleMockClient();
    this.arc = new ArcClient();
  }

  async initialize(): Promise<void> {
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║          ORACLE — Prediction Market Intelligence      ║");
    console.log("║          Narrative-to-Reality Arbitrage Engine        ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    // Initialize all layers in parallel
    await Promise.allSettled([
      this.signals.initialize(),
      this.arc.connect(),
    ]);

    // Create or load execution wallet
    try {
      this.wallet = await this.circle.createWallet();
      await this.circle.requestTestnetUsdc(this.wallet.address);
    } catch (err) {
      console.error("[oracle] Wallet setup failed:", (err as Error).message);
    }

    // Print Arc chain info
    if (this.arc.isConnected()) {
      const chainInfo = await this.arc.getChainInfo();
      console.log(`\n[arc] Network: ${chainInfo.networkName} | Chain ID: ${chainInfo.chainId} | Block: ${chainInfo.latestBlock}\n`);
    }
  }

  async runCycle(): Promise<void> {
    this.totalRuns++;
    const cycleStart = Date.now();

    console.log(`\n${"─".repeat(60)}`);
    console.log(`[oracle] Cycle #${this.totalRuns} — ${new Date().toISOString()}`);
    console.log(`${"─".repeat(60)}`);

    // Step 1: Fetch signals
    const signals = await this.signals.fetchSignals();
    console.log(`[oracle] Received ${signals.length} aggregated signal(s)`);

    // Step 2: Agent reasoning
    const runResult = await this.agent.reason(signals);

    // Step 3: Execute recommendations
    for (const rec of runResult.recommendations) {
      await this.executeRecommendation(rec);
    }

    this.totalRecommendations += runResult.recommendationsGenerated;

    const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
    console.log(
      `\n[oracle] Cycle complete in ${elapsed}s — ${runResult.recommendationsGenerated} trade(s) executed | cumulative: ${this.totalRecommendations}`
    );

    // Print full recommendation JSON for the last cycle
    if (runResult.recommendations.length > 0) {
      console.log("\n[oracle] Recommendations JSON:");
      console.log(JSON.stringify(runResult, null, 2));
    }
  }

  private async executeRecommendation(rec: TradeRecommendation): Promise<void> {
    if (!this.wallet) {
      console.log(`[oracle] No wallet available — skipping execution for ${rec.market}`);
      return;
    }

    const balance = await this.circle.getUsdcBalance(this.wallet.id);
    if (balance < rec.usdc_amount) {
      console.warn(
        `[oracle] Insufficient balance ($${balance}) for $${rec.usdc_amount} bet on ${rec.market}`
      );
      return;
    }

    // Polymarket smart contract address (testnet) — placeholder for real integration
    const polymarketVault = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

    // Execute: Circle USDC transfer to Polymarket vault
    await this.circle.initiateTransfer({
      walletId: this.wallet.id,
      destinationAddress: polymarketVault,
      usdcAmount: rec.usdc_amount.toFixed(2),
    });

    // Log intent on Arc
    await this.arc.logTradeIntent({
      walletAddress: this.wallet.address,
      marketId: rec.market,
      position: rec.recommended_position,
      usdcAmount: rec.usdc_amount,
    });
  }

  async shutdown(): Promise<void> {
    await this.signals.shutdown();
    console.log("\n[oracle] Shutdown complete");
  }
}

// ---- Entry point ----

async function main(): Promise<void> {
  const oracle = new OracleOrchestrator();

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n[oracle] Received SIGINT — shutting down...");
    await oracle.shutdown();
    process.exit(0);
  });

  await oracle.initialize();

  if (RUN_ONCE) {
    // Single run mode for demo/testing
    await oracle.runCycle();
    await oracle.shutdown();
  } else {
    // Run immediately, then on schedule
    await oracle.runCycle();

    console.log(`\n[oracle] Scheduled on cron: "${CRON_SCHEDULE}" (${cronDescription(CRON_SCHEDULE)})`);
    console.log("[oracle] Press Ctrl+C to stop\n");

    cron.schedule(CRON_SCHEDULE, async () => {
      try {
        await oracle.runCycle();
      } catch (err) {
        console.error("[oracle] Cycle error:", (err as Error).message);
      }
    });
  }
}

function cronDescription(schedule: string): string {
  if (schedule === "*/15 * * * *") return "every 15 minutes";
  if (schedule === "*/5 * * * *") return "every 5 minutes";
  if (schedule === "0 * * * *") return "every hour";
  return schedule;
}

main().catch((err) => {
  console.error("[oracle] Fatal error:", err);
  process.exit(1);
});
