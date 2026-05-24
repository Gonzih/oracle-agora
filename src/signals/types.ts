export interface WalletPosition {
  address: string;
  marketId: string;
  outcome: string; // 'YES' | 'NO'
  entryPrice: number; // 0-1
  size: number; // USDC
  roi?: number;
}

export interface SmartWallet {
  address: string;
  tradeCount: number;
  totalVolume: number;
  roiProxy: number; // estimated ROI 0-1+
  positions: WalletPosition[];
}

export interface ConsensusSignal {
  marketId: string;
  marketQuestion: string;
  outcome: 'YES' | 'NO';
  walletCount: number; // how many smart wallets agree
  avgEntryPrice: number; // what price smart money paid (historical)
  currentMarketPrice: number; // current market price for YES outcome
  totalVolume: number; // USDC committed
  confidence: number; // 0-1 derived from wallet count + ROI
}

export interface LateMoneySignal {
  marketId: string;
  volumeSpikeMultiplier: number; // vs 7-day avg
  netBias: 'YES' | 'NO' | 'NEUTRAL';
  walletConcentration: number; // 0-1, higher = fewer whales
  confidenceScore: number; // 0-1
}

export interface AggregatedSignal {
  marketId: string;
  marketQuestion: string;
  consensus: ConsensusSignal;
  lateMoney?: LateMoneySignal;
  compositeScore: number; // 0-1 combined signal strength
  timestamp: string;
}
