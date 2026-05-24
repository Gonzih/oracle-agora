export interface TradeRecommendation {
  market: string;
  marketQuestion: string;
  signal_strength: number; // 0-1 composite signal quality
  recommended_position: "YES" | "NO";
  current_price: number; // market price for the outcome (0-1)
  fair_value: number; // our estimated fair probability (0-1)
  edge: number; // fair_value - current_price (positive = +EV)
  kelly_fraction: number; // optimal bet fraction of bankroll
  usdc_amount: number; // dollar amount to stake
  confidence: number; // 0-1 overall recommendation confidence
  rationale: string; // human-readable reasoning
  timestamp: string;
}

export interface AgentRunResult {
  runId: string;
  timestamp: string;
  marketsScanned: number;
  recommendationsGenerated: number;
  recommendations: TradeRecommendation[];
  skipped: Array<{ marketId: string; reason: string }>;
}
