/**
 * Kelly Criterion for prediction markets
 *
 * In a binary prediction market:
 *   - You bet that outcome X happens at price p (implied probability)
 *   - Your fair-value estimate of the outcome is q
 *   - If you're right, you win (1-p) per dollar staked
 *   - If you're wrong, you lose 1 dollar
 *
 * Kelly fraction: f* = (q - p) / (1 - p)
 *   - Positive f* → bet YES at price p when q > p
 *   - Negative f* → bet NO at price p when q < p
 *
 * We apply a fractional Kelly multiplier (default 0.5) to reduce variance
 * and account for model uncertainty.
 */
export interface KellyResult {
    fraction: number;
    edge: number;
    usdcAmount: number;
    direction: "YES" | "NO";
}
export declare function kellyBet(params: {
    fairValue: number;
    marketPrice: number;
    bankrollUsdc: number;
    kellyMultiplier?: number;
    maxFraction?: number;
}): KellyResult;
export declare function estimateFairValue(marketPrice: number, signal: {
    consensus: {
        avgEntryPrice: number;
        currentMarketPrice?: number;
        walletCount: number;
        confidence: number;
    };
    compositeScore: number;
    lateMoney?: {
        volumeSpikeMultiplier: number;
        netBias: string;
    };
}, targetOutcome: "YES" | "NO"): number;
//# sourceMappingURL=kelly.d.ts.map