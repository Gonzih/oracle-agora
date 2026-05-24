/**
 * CircleClient — Developer-Controlled Wallets API (sandbox)
 *
 * Wraps Circle's W3S API for:
 *   - Wallet creation on ETH-SEPOLIA
 *   - USDC balance checks
 *   - Simulated USDC transfers representing trade execution
 *
 * Uses RSA-OAEP to encrypt the entity secret with Circle's public key
 * for each authenticated request (as required by the developer wallet API).
 *
 * Docs: https://developers.circle.com/w3s/docs
 */

import axios from "axios";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import type { CircleWallet, WalletBalance, TransferResult, CircleConfig } from "./types.js";

const SANDBOX_BASE = "https://api-sandbox.circle.com/v1/w3s";

export class CircleClient {
  private config: CircleConfig;
  private cachedPublicKey: string | null = null;

  constructor(config: CircleConfig) {
    this.config = { sandbox: true, ...config };
  }

  static fromEnv(): CircleClient | null {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey || !entitySecret) {
      console.warn("[circle] CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET not set — mock mode enabled");
      return null;
    }

    return new CircleClient({
      apiKey,
      entitySecret,
      walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      sandbox: true,
    });
  }

  // --- Entity Secret Encryption ---

  private async getEntityPublicKey(): Promise<string> {
    if (this.cachedPublicKey) return this.cachedPublicKey;

    const response = await axios.get(`${SANDBOX_BASE}/config/entity/publicKey`, {
      headers: this.authHeaders(),
    });
    this.cachedPublicKey = response.data.data.publicKey as string;
    return this.cachedPublicKey;
  }

  private async buildEntitySecretCiphertext(): Promise<string> {
    const publicKeyPem = await this.getEntityPublicKey();
    const secretBytes = Buffer.from(this.config.entitySecret, "hex");

    const encrypted = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      secretBytes
    );

    return encrypted.toString("base64");
  }

  private authHeaders() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  // --- Wallet Set (prerequisite for wallet creation) ---

  async createWalletSet(name: string): Promise<string> {
    const entitySecretCiphertext = await this.buildEntitySecretCiphertext();
    const response = await axios.post(
      `${SANDBOX_BASE}/developer/walletSets`,
      {
        idempotencyKey: uuidv4(),
        name,
        entitySecretCiphertext,
      },
      { headers: this.authHeaders() }
    );
    const walletSetId = response.data.data.walletSet.id as string;
    console.log(`[circle] Created wallet set: ${walletSetId}`);
    return walletSetId;
  }

  // --- Wallet Creation ---

  async createWallet(walletSetId?: string): Promise<CircleWallet> {
    const wsId = walletSetId ?? this.config.walletSetId;
    if (!wsId) {
      throw new Error("walletSetId required — set CIRCLE_WALLET_SET_ID or pass it explicitly");
    }

    const entitySecretCiphertext = await this.buildEntitySecretCiphertext();

    const response = await axios.post(
      `${SANDBOX_BASE}/developer/wallets`,
      {
        idempotencyKey: uuidv4(),
        walletSetId: wsId,
        blockchains: ["ETH-SEPOLIA"],
        count: 1,
        accountType: "EOA",
        entitySecretCiphertext,
      },
      { headers: this.authHeaders() }
    );

    const wallet = response.data.data.wallets[0] as CircleWallet;
    console.log(`[circle] Created wallet: ${wallet.id} (${wallet.address}) on ${wallet.blockchain}`);
    return wallet;
  }

  // --- Balance Check ---

  async getBalance(walletId: string): Promise<WalletBalance> {
    const response = await axios.get(`${SANDBOX_BASE}/developer/wallets/${walletId}/balances`, {
      headers: this.authHeaders(),
    });

    const data = response.data.data;
    return {
      walletId,
      address: data.wallet?.address ?? "",
      blockchain: data.wallet?.blockchain ?? "",
      tokenBalances: data.tokenBalances ?? [],
    };
  }

  async getUsdcBalance(walletId: string): Promise<number> {
    const balance = await this.getBalance(walletId);
    const usdc = balance.tokenBalances.find(
      (b) => b.token.symbol === "USDC" || b.token.name.includes("USD Coin")
    );
    return usdc ? parseFloat(usdc.amount) : 0;
  }

  // --- Transfer (simulated trade execution) ---

  async initiateTransfer(params: {
    walletId: string;
    destinationAddress: string;
    usdcAmount: string;
  }): Promise<TransferResult> {
    const entitySecretCiphertext = await this.buildEntitySecretCiphertext();

    const response = await axios.post(
      `${SANDBOX_BASE}/developer/transactions/transfer`,
      {
        idempotencyKey: uuidv4(),
        walletId: params.walletId,
        destinationAddress: params.destinationAddress,
        amounts: [params.usdcAmount],
        tokenId: "5797fbd6-3795-519d-84ca-ec4c5f80c3b1", // USDC on ETH-SEPOLIA
        feeLevel: "MEDIUM",
        entitySecretCiphertext,
      },
      { headers: this.authHeaders() }
    );

    const tx = response.data.data as TransferResult;
    console.log(`[circle] Transfer initiated: ${tx.id} — ${params.usdcAmount} USDC → ${params.destinationAddress} (${tx.state})`);
    return tx;
  }

  // --- Faucet helper (testnet only) ---

  async requestTestnetUsdc(address: string): Promise<void> {
    console.log(
      `[circle] To fund ${address} with testnet USDC, visit: https://faucet.circle.com/`
    );
    console.log(`[circle] Enter address ${address} and select ETH-SEPOLIA to receive 20 USDC`);
  }
}

// --- Mock mode (no API key) ---

export class CircleMockClient {
  private mockWallets: CircleWallet[] = [];
  private mockBalances: Map<string, number> = new Map();

  async createWallet(): Promise<CircleWallet> {
    const wallet: CircleWallet = {
      id: `mock-wallet-${uuidv4().slice(0, 8)}`,
      address: `0x${crypto.randomBytes(20).toString("hex")}`,
      blockchain: "ETH-SEPOLIA",
      accountType: "EOA",
      state: "LIVE",
      walletSetId: "mock-wallet-set",
      custodyType: "DEVELOPER",
      createDate: new Date().toISOString(),
      updateDate: new Date().toISOString(),
    };
    this.mockWallets.push(wallet);
    this.mockBalances.set(wallet.id, 100); // start with 100 USDC
    console.log(`[circle:mock] Created wallet: ${wallet.id} (${wallet.address}) — 100 USDC`);
    return wallet;
  }

  async getUsdcBalance(walletId: string): Promise<number> {
    return this.mockBalances.get(walletId) ?? 0;
  }

  async initiateTransfer(params: {
    walletId: string;
    destinationAddress: string;
    usdcAmount: string;
  }): Promise<TransferResult> {
    const amount = parseFloat(params.usdcAmount);
    const current = this.mockBalances.get(params.walletId) ?? 0;
    this.mockBalances.set(params.walletId, current - amount);

    const txId = `mock-tx-${uuidv4().slice(0, 8)}`;
    console.log(
      `[circle:mock] Transfer ${txId}: ${params.usdcAmount} USDC → ${params.destinationAddress} (CONFIRMED)`
    );
    return {
      id: txId,
      walletId: params.walletId,
      state: "CONFIRMED",
      txHash: `0x${crypto.randomBytes(32).toString("hex")}`,
      amounts: [params.usdcAmount],
      destinationAddress: params.destinationAddress,
      createDate: new Date().toISOString(),
      updateDate: new Date().toISOString(),
    };
  }

  async requestTestnetUsdc(address: string): Promise<void> {
    console.log(`[circle:mock] Would request testnet USDC for ${address} from https://faucet.circle.com/`);
  }
}
