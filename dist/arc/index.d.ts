/**
 * ArcClient — Arc testnet JSON-RPC wrapper
 *
 * Arc (by The Canteen) is an EVM-compatible testnet used for prediction market
 * infrastructure. ORACLE uses it to verify on-chain state and log trade intents.
 *
 * Primary endpoint: https://rpc.arc.canteen.xyz
 * Fallback: https://arc-testnet.drpc.org
 *
 * Standard JSON-RPC 2.0 interface (same as any EVM chain).
 */
import type { BlockInfo, ChainInfo } from "./types.js";
export declare class ArcClient {
    private rpcUrl;
    private requestId;
    private connected;
    constructor(rpcUrl?: string);
    connect(): Promise<void>;
    isConnected(): boolean;
    private rpc;
    getBlockNumber(): Promise<number>;
    getChainId(): Promise<number>;
    getBlock(blockNumber?: number | "latest"): Promise<BlockInfo | null>;
    getChainInfo(): Promise<ChainInfo>;
    /**
     * Log a trade intent on-chain (just a reference call — no actual contract interaction)
     * In a full implementation, this would call the Arc prediction market contract.
     */
    logTradeIntent(params: {
        walletAddress: string;
        marketId: string;
        position: "YES" | "NO";
        usdcAmount: number;
    }): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map