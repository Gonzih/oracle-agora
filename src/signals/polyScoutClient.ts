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

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ConsensusSignal, LateMoneySignal, SmartWallet } from "./types.js";

const CONNECT_TIMEOUT_MS = 30_000;

export class PolyScoutClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: "npx",
      args: ["--yes", "@gonzih/poly-scout"],
      env: {
        ...process.env,
        ...(process.env.REDIS_URL ? { REDIS_URL: process.env.REDIS_URL } : {}),
      },
    });

    this.client = new Client(
      { name: "oracle", version: "1.0.0" },
      { capabilities: {} }
    );

    await Promise.race([
      this.client.connect(this.transport),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("poly-scout connect timeout")), CONNECT_TIMEOUT_MS)
      ),
    ]);

    this.connected = true;
    console.log("[poly-scout] connected via MCP stdio");
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }

  private async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.client || !this.connected) {
      throw new Error("PolyScoutClient not connected — call connect() first");
    }
    const result = await this.client.callTool({ name, arguments: args });
    return result.content;
  }

  async scanSmartMoney(): Promise<{
    wallets: SmartWallet[];
    consensus: ConsensusSignal[];
  }> {
    const raw = await this.callTool("scan_smart_money");
    return this.parseSmartMoneyResult(raw);
  }

  async getLateMoney(marketId: string, tokenId?: string): Promise<LateMoneySignal> {
    const args: Record<string, unknown> = { market_id: marketId };
    if (tokenId) args.token_id = tokenId;
    const raw = await this.callTool("get_late_money", args);
    return this.parseLateMoneyResult(marketId, raw);
  }

  async getWalletPositions(address: string): Promise<SmartWallet> {
    const raw = await this.callTool("get_wallet_positions", { address });
    return this.parseWalletPositions(address, raw);
  }

  // --- Parsers: transform MCP text/json content into typed structs ---

  private parseSmartMoneyResult(raw: unknown): {
    wallets: SmartWallet[];
    consensus: ConsensusSignal[];
  } {
    // MCP tools return content as array of {type, text} blocks
    const text = this.extractText(raw);
    try {
      const parsed = JSON.parse(text);
      return {
        wallets: (parsed.wallets ?? []) as SmartWallet[],
        consensus: (parsed.consensus ?? []) as ConsensusSignal[],
      };
    } catch {
      // poly-scout may return human-readable text; parse best-effort
      console.warn("[poly-scout] Could not parse scan_smart_money as JSON, using text fallback");
      return this.parseTextualConsensus(text);
    }
  }

  private parseLateMoneyResult(marketId: string, raw: unknown): LateMoneySignal {
    const text = this.extractText(raw);
    try {
      const parsed = JSON.parse(text);
      return {
        marketId,
        volumeSpikeMultiplier: parsed.volume_spike ?? parsed.volumeSpike ?? 1,
        netBias: parsed.net_bias ?? parsed.netBias ?? "NEUTRAL",
        walletConcentration: parsed.wallet_concentration ?? parsed.walletConcentration ?? 0.5,
        confidenceScore: parsed.confidence_score ?? parsed.confidenceScore ?? 0,
      };
    } catch {
      return { marketId, volumeSpikeMultiplier: 1, netBias: "NEUTRAL", walletConcentration: 0.5, confidenceScore: 0 };
    }
  }

  private parseWalletPositions(address: string, raw: unknown): SmartWallet {
    const text = this.extractText(raw);
    try {
      const parsed = JSON.parse(text);
      return parsed as SmartWallet;
    } catch {
      return { address, tradeCount: 0, totalVolume: 0, roiProxy: 0, positions: [] };
    }
  }

  private extractText(raw: unknown): string {
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) {
      return raw
        .filter((b): b is { type: string; text: string } => typeof b === "object" && b !== null && "text" in b)
        .map((b) => b.text)
        .join("\n");
    }
    return JSON.stringify(raw);
  }

  private parseTextualConsensus(text: string): {
    wallets: SmartWallet[];
    consensus: ConsensusSignal[];
  } {
    // Best-effort extraction from human-readable poly-scout output
    const lines = text.split("\n").filter(Boolean);
    const consensus: ConsensusSignal[] = [];

    for (const line of lines) {
      const marketMatch = line.match(/market[:\s]+(.+?)\s+outcome[:\s]+(YES|NO)/i);
      if (marketMatch) {
        consensus.push({
          marketId: marketMatch[1].trim(),
          marketQuestion: marketMatch[1].trim(),
          outcome: marketMatch[2].toUpperCase() as "YES" | "NO",
          walletCount: 1,
          avgEntryPrice: 0.5,
          currentMarketPrice: 0.5,
          totalVolume: 0,
          confidence: 0.3,
        });
      }
    }

    return { wallets: [], consensus };
  }
}
