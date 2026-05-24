"use strict";
/**
 * SignalAggregator
 *
 * Combines smart money consensus + late money spikes into ranked AggregatedSignals.
 * Falls back to demo signals when poly-scout MCP is unavailable (e.g. no npx).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalAggregator = void 0;
const polyScoutClient_js_1 = require("./polyScoutClient.js");
/**
 * Demo signals for illustration when poly-scout returns empty results.
 *
 * Scenario: Smart money is positioned at a HIGHER price than current market
 * (they bought before a dip). They're underwater but holding — high conviction.
 * Our fair-value model should produce a YES edge since we trust their judgment.
 *
 * Signal 1: Fed rate cut — smart money paid 0.62 avg for YES, market dropped to 0.48
 *   → Fair value estimate ≈ 0.57 → +9% edge → bet YES
 *
 * Signal 2: BTC $120k — smart money paid 0.58 avg for YES, market dropped to 0.44
 *   → Fair value estimate ≈ 0.52 → +8% edge → bet YES
 */
const DEMO_SIGNALS = [
    {
        marketId: "0x1234demo",
        marketQuestion: "Will the Fed cut rates before July 2026?",
        consensus: {
            marketId: "0x1234demo",
            marketQuestion: "Will the Fed cut rates before July 2026?",
            outcome: "YES",
            walletCount: 7,
            avgEntryPrice: 0.62, // smart money paid 0.62 for YES
            currentMarketPrice: 0.48, // market has since dropped to 0.48
            totalVolume: 14200,
            confidence: 0.72,
        },
        lateMoney: {
            marketId: "0x1234demo",
            volumeSpikeMultiplier: 3.4,
            netBias: "YES",
            walletConcentration: 0.65,
            confidenceScore: 0.81,
        },
        compositeScore: 0.77,
        timestamp: new Date().toISOString(),
    },
    {
        marketId: "0x5678demo",
        marketQuestion: "Will BTC hit $120k before August 2026?",
        consensus: {
            marketId: "0x5678demo",
            marketQuestion: "Will BTC hit $120k before August 2026?",
            outcome: "YES",
            walletCount: 4,
            avgEntryPrice: 0.58, // smart money paid 0.58 for YES
            currentMarketPrice: 0.44, // market dropped to 0.44
            totalVolume: 8700,
            confidence: 0.61,
        },
        lateMoney: {
            marketId: "0x5678demo",
            volumeSpikeMultiplier: 2.1,
            netBias: "YES",
            walletConcentration: 0.42,
            confidenceScore: 0.58,
        },
        compositeScore: 0.60,
        timestamp: new Date().toISOString(),
    },
];
class SignalAggregator {
    scout;
    scoutAvailable = false;
    constructor() {
        this.scout = new polyScoutClient_js_1.PolyScoutClient();
    }
    async initialize() {
        try {
            await this.scout.connect();
            this.scoutAvailable = true;
            console.log("[signals] poly-scout MCP connected");
        }
        catch (err) {
            console.warn("[signals] poly-scout unavailable, using demo signals:", err.message);
            this.scoutAvailable = false;
        }
    }
    async shutdown() {
        if (this.scoutAvailable) {
            await this.scout.disconnect();
        }
    }
    async fetchSignals() {
        if (!this.scoutAvailable) {
            console.log("[signals] Using demo signals (poly-scout offline)");
            return DEMO_SIGNALS.map((s) => ({ ...s, timestamp: new Date().toISOString() }));
        }
        try {
            const live = await this.fetchLiveSignals();
            if (live.length === 0) {
                console.log("[signals] No live signals available, using demo signals for illustration");
                return DEMO_SIGNALS.map((s) => ({ ...s, timestamp: new Date().toISOString() }));
            }
            return live;
        }
        catch (err) {
            console.error("[signals] Live fetch failed, falling back to demo:", err.message);
            return DEMO_SIGNALS.map((s) => ({ ...s, timestamp: new Date().toISOString() }));
        }
    }
    async fetchLiveSignals() {
        const { consensus } = await this.scout.scanSmartMoney();
        if (consensus.length === 0) {
            console.log("[signals] No consensus markets found");
            return [];
        }
        // For top-5 consensus markets, enrich with late-money signal
        const topConsensus = consensus
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);
        const enriched = await Promise.allSettled(topConsensus.map((c) => this.enrichWithLateMoney(c)));
        return enriched
            .filter((r) => r.status === "fulfilled")
            .map((r) => r.value)
            .sort((a, b) => b.compositeScore - a.compositeScore);
    }
    async enrichWithLateMoney(consensus) {
        let lateMoney;
        try {
            lateMoney = await this.scout.getLateMoney(consensus.marketId);
        }
        catch {
            // late money is optional enrichment
        }
        const compositeScore = this.scoreSignal(consensus, lateMoney);
        return {
            marketId: consensus.marketId,
            marketQuestion: consensus.marketQuestion,
            consensus,
            lateMoney,
            compositeScore,
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * Composite score weights:
     *   40% smart money consensus confidence
     *   30% wallet count (capped at 10 wallets = 1.0)
     *   30% late money confidence (if available)
     */
    scoreSignal(consensus, lateMoney) {
        const walletScore = Math.min(consensus.walletCount / 10, 1.0);
        const lateScore = lateMoney
            ? lateMoney.confidenceScore * Math.min(lateMoney.volumeSpikeMultiplier / 5, 1.0)
            : 0;
        return 0.4 * consensus.confidence + 0.3 * walletScore + 0.3 * lateScore;
    }
}
exports.SignalAggregator = SignalAggregator;
//# sourceMappingURL=index.js.map