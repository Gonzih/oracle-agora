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

import { v4 as uuidv4 } from "uuid";
import { kellyBet, estimateFairValue } from "./kelly.js";
import type { AggregatedSignal } from "../signals/types.js";
import type { TradeRecommendation, AgentRunResult } from "./types.js";

const BANKROLL_USDC = parseFloat(process.env.ORACLE_BANKROLL_USDC ?? "100");
const KELLY_MULTIPLIER = parseFloat(process.env.KELLY_MULTIPLIER ?? "0.5");
const MIN_EDGE = parseFloat(process.env.MIN_EDGE ?? "0.05");
const MIN_SIGNAL_SCORE = 0.35;

export class OracleAgent {
  async reason(signals: AggregatedSignal[]): Promise<AgentRunResult> {
    const runId = uuidv4();
    const timestamp = new Date().toISOString();
    const recommendations: TradeRecommendation[] = [];
    const skipped: Array<{ marketId: string; reason: string }> = [];

    console.log(`\n[agent] Run ${runId} — analyzing ${signals.length} signal(s)`);

    for (const signal of signals) {
      const result = this.evaluateSignal(signal);
      if (result.type === "recommend") {
        recommendations.push(result.recommendation);
        console.log(
          `[agent] ✓ ${signal.marketQuestion.slice(0, 60)} → ${result.recommendation.recommended_position} @ ${result.recommendation.current_price} (edge +${(result.recommendation.edge * 100).toFixed(1)}%, $${result.recommendation.usdc_amount})`
        );
      } else {
        skipped.push({ marketId: signal.marketId, reason: result.reason });
        console.log(`[agent] ✗ ${signal.marketQuestion.slice(0, 60)} — skipped: ${result.reason}`);
      }
    }

    return {
      runId,
      timestamp,
      marketsScanned: signals.length,
      recommendationsGenerated: recommendations.length,
      recommendations,
      skipped,
    };
  }

  private evaluateSignal(
    signal: AggregatedSignal
  ):
    | { type: "recommend"; recommendation: TradeRecommendation }
    | { type: "skip"; reason: string } {
    // Gate 1: signal quality
    if (signal.compositeScore < MIN_SIGNAL_SCORE) {
      return { type: "skip", reason: `composite score ${signal.compositeScore.toFixed(2)} < ${MIN_SIGNAL_SCORE}` };
    }

    // Gate 2: wallet count (need at least 2 agreeing smart wallets)
    if (signal.consensus.walletCount < 2) {
      return { type: "skip", reason: "only 1 smart wallet positioned — insufficient consensus" };
    }

    const targetOutcome = signal.consensus.outcome;
    const currentPrice = signal.consensus.currentMarketPrice ?? signal.consensus.avgEntryPrice;

    // Estimate fair value using smart money + late money
    const fairValue = estimateFairValue(currentPrice, signal, targetOutcome);

    // Kelly sizing
    const kelly = kellyBet({
      fairValue,
      marketPrice: currentPrice,
      bankrollUsdc: BANKROLL_USDC,
      kellyMultiplier: KELLY_MULTIPLIER,
    });

    // Gate 3: minimum edge
    if (kelly.edge < MIN_EDGE) {
      return {
        type: "skip",
        reason: `edge ${(kelly.edge * 100).toFixed(1)}% < minimum ${(MIN_EDGE * 100).toFixed(0)}%`,
      };
    }

    // Gate 4: must be willing to stake at least $0.50
    if (kelly.usdcAmount < 0.5) {
      return { type: "skip", reason: "Kelly bet size < $0.50 — too small to execute" };
    }

    const rationale = this.buildRationale(signal, kelly, fairValue);

    return {
      type: "recommend",
      recommendation: {
        market: signal.marketId,
        marketQuestion: signal.marketQuestion,
        signal_strength: signal.compositeScore,
        recommended_position: kelly.direction,
        current_price: currentPrice,
        fair_value: Math.round(fairValue * 1000) / 1000,
        edge: Math.round(kelly.edge * 1000) / 1000,
        kelly_fraction: Math.round(kelly.fraction * 1000) / 1000,
        usdc_amount: kelly.usdcAmount,
        confidence: Math.min(signal.compositeScore * (kelly.edge / 0.1), 1.0),
        rationale,
        timestamp: signal.timestamp,
      },
    };
  }

  private buildRationale(
    signal: AggregatedSignal,
    kelly: { edge: number; direction: string; fraction: number },
    fairValue: number
  ): string {
    const parts: string[] = [];

    parts.push(
      `${signal.consensus.walletCount} smart wallets with consistent positive ROI positioned ${signal.consensus.outcome} at avg price ${signal.consensus.avgEntryPrice.toFixed(3)}.`
    );

    const mktPrice = signal.consensus.currentMarketPrice ?? signal.consensus.avgEntryPrice;
    parts.push(
      `Fair value estimated at ${(fairValue * 100).toFixed(1)}% vs current market price ${(mktPrice * 100).toFixed(1)}% (smart money avg entry: ${(signal.consensus.avgEntryPrice * 100).toFixed(1)}%).`
    );

    if (signal.lateMoney) {
      const { volumeSpikeMultiplier, netBias } = signal.lateMoney;
      if (volumeSpikeMultiplier > 1.5) {
        parts.push(
          `Late money: ${volumeSpikeMultiplier.toFixed(1)}x volume spike in last 48h, directional bias ${netBias}.`
        );
      }
    }

    parts.push(
      `Edge: +${(kelly.edge * 100).toFixed(1)}%. Kelly fraction: ${(kelly.fraction * 100).toFixed(1)}% of bankroll. Composite signal score: ${(signal.compositeScore * 100).toFixed(0)}/100.`
    );

    return parts.join(" ");
  }
}
