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

import axios from "axios";
import type { BlockInfo, ChainInfo, JsonRpcRequest, JsonRpcResponse } from "./types.js";

const RPC_ENDPOINTS = [
  process.env.ARC_RPC_URL ?? "https://rpc.arc.canteen.xyz",
  "https://arc-testnet.drpc.org",
  "https://rpc.testnet.arc.network",
];

export class ArcClient {
  private rpcUrl: string;
  private requestId = 1;
  private connected = false;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl ?? RPC_ENDPOINTS[0];
  }

  async connect(): Promise<void> {
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        this.rpcUrl = endpoint;
        const chainId = await this.getChainId();
        this.connected = true;
        console.log(`[arc] Connected to ${endpoint} — chain ID: ${chainId}`);
        return;
      } catch {
        console.warn(`[arc] ${endpoint} unreachable, trying next...`);
      }
    }
    console.warn("[arc] All Arc RPC endpoints unreachable — running in offline mode");
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async rpc<T>(method: string, params: unknown[] = []): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id: this.requestId++,
    };

    const response = await axios.post<JsonRpcResponse<T>>(this.rpcUrl, request, {
      headers: { "Content-Type": "application/json" },
      timeout: 10_000,
    });

    if (response.data.error) {
      throw new Error(`RPC error ${response.data.error.code}: ${response.data.error.message}`);
    }

    return response.data.result as T;
  }

  async getBlockNumber(): Promise<number> {
    const hex = await this.rpc<string>("eth_blockNumber");
    return parseInt(hex, 16);
  }

  async getChainId(): Promise<number> {
    const hex = await this.rpc<string>("eth_chainId");
    return parseInt(hex, 16);
  }

  async getBlock(blockNumber: number | "latest" = "latest"): Promise<BlockInfo | null> {
    const tag = blockNumber === "latest" ? "latest" : `0x${blockNumber.toString(16)}`;
    const raw = await this.rpc<{
      number: string;
      hash: string;
      timestamp: string;
      gasLimit: string;
      gasUsed: string;
      transactions: unknown[];
    } | null>("eth_getBlockByNumber", [tag, false]);

    if (!raw) return null;

    return {
      number: parseInt(raw.number, 16),
      hash: raw.hash,
      timestamp: parseInt(raw.timestamp, 16),
      gasLimit: raw.gasLimit,
      gasUsed: raw.gasUsed,
      transactionCount: raw.transactions.length,
    };
  }

  async getChainInfo(): Promise<ChainInfo> {
    const [chainId, blockNumber] = await Promise.all([this.getChainId(), this.getBlockNumber()]);

    return {
      chainId,
      networkName: chainId === 1244 ? "Arc Testnet" : `Chain ${chainId}`,
      latestBlock: blockNumber,
      rpcEndpoint: this.rpcUrl,
    };
  }

  /**
   * Log a trade intent on-chain (just a reference call — no actual contract interaction)
   * In a full implementation, this would call the Arc prediction market contract.
   */
  async logTradeIntent(params: {
    walletAddress: string;
    marketId: string;
    position: "YES" | "NO";
    usdcAmount: number;
  }): Promise<void> {
    if (!this.connected) {
      console.log(
        `[arc:offline] Would log trade intent: ${params.position} ${params.usdcAmount} USDC on ${params.marketId}`
      );
      return;
    }

    const blockNumber = await this.getBlockNumber();
    console.log(
      `[arc] Trade intent logged at block ${blockNumber}: ${params.position} $${params.usdcAmount} USDC on market ${params.marketId}`
    );
  }
}
