export interface WalletPosition {
    address: string;
    marketId: string;
    outcome: string;
    entryPrice: number;
    size: number;
    roi?: number;
}
export interface SmartWallet {
    address: string;
    tradeCount: number;
    totalVolume: number;
    roiProxy: number;
    positions: WalletPosition[];
}
export interface ConsensusSignal {
    marketId: string;
    marketQuestion: string;
    outcome: 'YES' | 'NO';
    walletCount: number;
    avgEntryPrice: number;
    currentMarketPrice: number;
    totalVolume: number;
    confidence: number;
}
export interface LateMoneySignal {
    marketId: string;
    volumeSpikeMultiplier: number;
    netBias: 'YES' | 'NO' | 'NEUTRAL';
    walletConcentration: number;
    confidenceScore: number;
}
export interface AggregatedSignal {
    marketId: string;
    marketQuestion: string;
    consensus: ConsensusSignal;
    lateMoney?: LateMoneySignal;
    compositeScore: number;
    timestamp: string;
}
//# sourceMappingURL=types.d.ts.map