export interface TradeRecommendation {
    market: string;
    marketQuestion: string;
    signal_strength: number;
    recommended_position: "YES" | "NO";
    current_price: number;
    fair_value: number;
    edge: number;
    kelly_fraction: number;
    usdc_amount: number;
    confidence: number;
    rationale: string;
    timestamp: string;
}
export interface AgentRunResult {
    runId: string;
    timestamp: string;
    marketsScanned: number;
    recommendationsGenerated: number;
    recommendations: TradeRecommendation[];
    skipped: Array<{
        marketId: string;
        reason: string;
    }>;
}
//# sourceMappingURL=types.d.ts.map