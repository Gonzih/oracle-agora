/**
 * poly-scout MCP client
 *
 * Spawns @gonzih/poly-scout as a stdio MCP subprocess and calls its tools:
 *   - scan_smart_money   → consensus across top-ROI wallets
 *   - get_late_money     → 48h volume spike detection
 *   - get_wallet_positions → per-wallet position breakdown
 *
 * This demonstrates agentic tool-use: ORACLE (agent) calling poly-scout (tool).
 */
import type { ConsensusSignal, LateMoneySignal, SmartWallet } from "./types.js";
export declare class PolyScoutClient {
    private client;
    private transport;
    private connected;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    private callTool;
    scanSmartMoney(): Promise<{
        wallets: SmartWallet[];
        consensus: ConsensusSignal[];
    }>;
    getLateMoney(marketId: string, tokenId?: string): Promise<LateMoneySignal>;
    getWalletPositions(address: string): Promise<SmartWallet>;
    private parseSmartMoneyResult;
    private parseLateMoneyResult;
    private parseWalletPositions;
    private extractText;
    private parseTextualConsensus;
}
//# sourceMappingURL=polyScoutClient.d.ts.map