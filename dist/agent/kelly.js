"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.kellyBet = kellyBet;
exports.estimateFairValue = estimateFairValue;
function kellyBet(params) {
    const { fairValue, marketPrice, bankrollUsdc, kellyMultiplier = 0.5, maxFraction = 0.2 } = params;
    const yesEdge = fairValue - marketPrice;
    const noEdge = (1 - fairValue) - (1 - marketPrice); // = -yesEdge
    let direction;
    let price;
    let edge;
    let q;
    if (yesEdge >= 0) {
        // Bet YES
        direction = "YES";
        price = marketPrice;
        edge = yesEdge;
        q = fairValue;
    }
    else {
        // Bet NO (at price = 1 - marketPrice)
        direction = "NO";
        price = 1 - marketPrice;
        edge = Math.abs(noEdge);
        q = 1 - fairValue;
    }
    // Kelly fraction for binary outcome: f* = (q - p) / (1 - p)
    // where p = market price, q = fair probability
    let fraction = (q - price) / (1 - price);
    fraction = Math.max(0, fraction); // no negative bets
    fraction = fraction * kellyMultiplier; // fractional Kelly
    fraction = Math.min(fraction, maxFraction); // cap exposure
    const usdcAmount = Math.round(fraction * bankrollUsdc * 100) / 100;
    return { fraction, edge, usdcAmount, direction };
}
function estimateFairValue(marketPrice, signal, targetOutcome) {
    /**
     * Fair value estimation:
     * We blend three inputs:
     *   1. Market price (baseline, weight decreases with signal strength)
     *   2. Smart money avg entry price (where informed traders positioned)
     *   3. Composite signal strength (how much to trust smart money)
     *
     * The idea: if 7 wallets with strong ROI all paid 0.38 for YES,
     * and the market is now at 0.45, smart money saw value at 0.38 →
     * our fair value is closer to what they paid than the current price.
     */
    const smartMoneyPrice = targetOutcome === "YES"
        ? signal.consensus.avgEntryPrice
        : 1 - signal.consensus.avgEntryPrice;
    const signalWeight = Math.min(signal.compositeScore, 0.7); // cap at 70%
    const marketWeight = 1 - signalWeight;
    let fairValue = marketWeight * marketPrice + signalWeight * smartMoneyPrice;
    // Late money directional nudge (±3% max)
    if (signal.lateMoney) {
        const { netBias, volumeSpikeMultiplier } = signal.lateMoney;
        const nudge = Math.min(volumeSpikeMultiplier / 100, 0.03);
        if (netBias === targetOutcome) {
            fairValue += nudge;
        }
        else if (netBias !== "NEUTRAL") {
            fairValue -= nudge;
        }
    }
    return Math.max(0.01, Math.min(0.99, fairValue));
}
//# sourceMappingURL=kelly.js.map