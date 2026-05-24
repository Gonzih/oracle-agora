"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolyScoutClient = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const CONNECT_TIMEOUT_MS = 30_000;
class PolyScoutClient {
    client = null;
    transport = null;
    connected = false;
    async connect() {
        this.transport = new stdio_js_1.StdioClientTransport({
            command: "npx",
            args: ["--yes", "@gonzih/poly-scout"],
            env: {
                ...process.env,
                ...(process.env.REDIS_URL ? { REDIS_URL: process.env.REDIS_URL } : {}),
            },
        });
        this.client = new index_js_1.Client({ name: "oracle", version: "1.0.0" }, { capabilities: {} });
        await Promise.race([
            this.client.connect(this.transport),
            new Promise((_, reject) => setTimeout(() => reject(new Error("poly-scout connect timeout")), CONNECT_TIMEOUT_MS)),
        ]);
        this.connected = true;
        console.log("[poly-scout] connected via MCP stdio");
    }
    async disconnect() {
        if (this.client && this.connected) {
            await this.client.close();
            this.connected = false;
        }
    }
    async callTool(name, args = {}) {
        if (!this.client || !this.connected) {
            throw new Error("PolyScoutClient not connected — call connect() first");
        }
        const result = await this.client.callTool({ name, arguments: args });
        return result.content;
    }
    async scanSmartMoney() {
        const raw = await this.callTool("scan_smart_money");
        return this.parseSmartMoneyResult(raw);
    }
    async getLateMoney(marketId, tokenId) {
        const args = { market_id: marketId };
        if (tokenId)
            args.token_id = tokenId;
        const raw = await this.callTool("get_late_money", args);
        return this.parseLateMoneyResult(marketId, raw);
    }
    async getWalletPositions(address) {
        const raw = await this.callTool("get_wallet_positions", { address });
        return this.parseWalletPositions(address, raw);
    }
    // --- Parsers: transform MCP text/json content into typed structs ---
    parseSmartMoneyResult(raw) {
        // MCP tools return content as array of {type, text} blocks
        const text = this.extractText(raw);
        try {
            const parsed = JSON.parse(text);
            return {
                wallets: (parsed.wallets ?? []),
                consensus: (parsed.consensus ?? []),
            };
        }
        catch {
            // poly-scout may return human-readable text; parse best-effort
            console.warn("[poly-scout] Could not parse scan_smart_money as JSON, using text fallback");
            return this.parseTextualConsensus(text);
        }
    }
    parseLateMoneyResult(marketId, raw) {
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
        }
        catch {
            return { marketId, volumeSpikeMultiplier: 1, netBias: "NEUTRAL", walletConcentration: 0.5, confidenceScore: 0 };
        }
    }
    parseWalletPositions(address, raw) {
        const text = this.extractText(raw);
        try {
            const parsed = JSON.parse(text);
            return parsed;
        }
        catch {
            return { address, tradeCount: 0, totalVolume: 0, roiProxy: 0, positions: [] };
        }
    }
    extractText(raw) {
        if (typeof raw === "string")
            return raw;
        if (Array.isArray(raw)) {
            return raw
                .filter((b) => typeof b === "object" && b !== null && "text" in b)
                .map((b) => b.text)
                .join("\n");
        }
        return JSON.stringify(raw);
    }
    parseTextualConsensus(text) {
        // Best-effort extraction from human-readable poly-scout output
        const lines = text.split("\n").filter(Boolean);
        const consensus = [];
        for (const line of lines) {
            const marketMatch = line.match(/market[:\s]+(.+?)\s+outcome[:\s]+(YES|NO)/i);
            if (marketMatch) {
                consensus.push({
                    marketId: marketMatch[1].trim(),
                    marketQuestion: marketMatch[1].trim(),
                    outcome: marketMatch[2].toUpperCase(),
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
exports.PolyScoutClient = PolyScoutClient;
//# sourceMappingURL=polyScoutClient.js.map