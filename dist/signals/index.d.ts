/**
 * SignalAggregator
 *
 * Combines smart money consensus + late money spikes into ranked AggregatedSignals.
 * Falls back to demo signals when poly-scout MCP is unavailable (e.g. no npx).
 */
import type { AggregatedSignal } from "./types.js";
export declare class SignalAggregator {
    private scout;
    private scoutAvailable;
    constructor();
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    fetchSignals(): Promise<AggregatedSignal[]>;
    private fetchLiveSignals;
    private enrichWithLateMoney;
    /**
     * Composite score weights:
     *   40% smart money consensus confidence
     *   30% wallet count (capped at 10 wallets = 1.0)
     *   30% late money confidence (if available)
     */
    private scoreSignal;
}
//# sourceMappingURL=index.d.ts.map