/**
 * OracleAgent — the reasoning loop
 *
 * For each AggregatedSignal:
 *   1. Estimate fair value using smart money positioning
 *   2. Compare to current market price
 *   3. Apply Kelly criterion for bet sizing
 *   4. Generate structured TradeRecommendation if edge > MIN_EDGE
 *   5. Skip if signal is weak or edge is insufficient
 */
import type { AggregatedSignal } from "../signals/types.js";
import type { AgentRunResult } from "./types.js";
export declare class OracleAgent {
    reason(signals: AggregatedSignal[]): Promise<AgentRunResult>;
    private evaluateSignal;
    private buildRationale;
}
//# sourceMappingURL=index.d.ts.map