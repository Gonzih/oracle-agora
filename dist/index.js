"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const index_js_1 = require("./signals/index.js");
const index_js_2 = require("./agent/index.js");
const index_js_3 = require("./circle/index.js");
const index_js_4 = require("./arc/index.js");
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? "*/15 * * * *";
const RUN_ONCE = process.argv.includes("--once");
// ---- Orchestrator ----
class OracleOrchestrator {
    signals;
    agent;
    circle;
    arc;
    wallet = null;
    totalRuns = 0;
    totalRecommendations = 0;
    constructor() {
        this.signals = new index_js_1.SignalAggregator();
        this.agent = new index_js_2.OracleAgent();
        this.circle = index_js_3.CircleClient.fromEnv() ?? new index_js_3.CircleMockClient();
        this.arc = new index_js_4.ArcClient();
    }
    async initialize() {
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
        }
        catch (err) {
            console.error("[oracle] Wallet setup failed:", err.message);
        }
        // Print Arc chain info
        if (this.arc.isConnected()) {
            const chainInfo = await this.arc.getChainInfo();
            console.log(`\n[arc] Network: ${chainInfo.networkName} | Chain ID: ${chainInfo.chainId} | Block: ${chainInfo.latestBlock}\n`);
        }
    }
    async runCycle() {
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
        console.log(`\n[oracle] Cycle complete in ${elapsed}s — ${runResult.recommendationsGenerated} trade(s) executed | cumulative: ${this.totalRecommendations}`);
        // Print full recommendation JSON for the last cycle
        if (runResult.recommendations.length > 0) {
            console.log("\n[oracle] Recommendations JSON:");
            console.log(JSON.stringify(runResult, null, 2));
        }
    }
    async executeRecommendation(rec) {
        if (!this.wallet) {
            console.log(`[oracle] No wallet available — skipping execution for ${rec.market}`);
            return;
        }
        const balance = await this.circle.getUsdcBalance(this.wallet.id);
        if (balance < rec.usdc_amount) {
            console.warn(`[oracle] Insufficient balance ($${balance}) for $${rec.usdc_amount} bet on ${rec.market}`);
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
    async shutdown() {
        await this.signals.shutdown();
        console.log("\n[oracle] Shutdown complete");
    }
}
// ---- Entry point ----
async function main() {
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
    }
    else {
        // Run immediately, then on schedule
        await oracle.runCycle();
        console.log(`\n[oracle] Scheduled on cron: "${CRON_SCHEDULE}" (${cronDescription(CRON_SCHEDULE)})`);
        console.log("[oracle] Press Ctrl+C to stop\n");
        node_cron_1.default.schedule(CRON_SCHEDULE, async () => {
            try {
                await oracle.runCycle();
            }
            catch (err) {
                console.error("[oracle] Cycle error:", err.message);
            }
        });
    }
}
function cronDescription(schedule) {
    if (schedule === "*/15 * * * *")
        return "every 15 minutes";
    if (schedule === "*/5 * * * *")
        return "every 5 minutes";
    if (schedule === "0 * * * *")
        return "every hour";
    return schedule;
}
main().catch((err) => {
    console.error("[oracle] Fatal error:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map