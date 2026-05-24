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
import type { CircleWallet, WalletBalance, TransferResult, CircleConfig } from "./types.js";
export declare class CircleClient {
    private config;
    private cachedPublicKey;
    constructor(config: CircleConfig);
    static fromEnv(): CircleClient | null;
    private getEntityPublicKey;
    private buildEntitySecretCiphertext;
    private authHeaders;
    createWalletSet(name: string): Promise<string>;
    createWallet(walletSetId?: string): Promise<CircleWallet>;
    getBalance(walletId: string): Promise<WalletBalance>;
    getUsdcBalance(walletId: string): Promise<number>;
    initiateTransfer(params: {
        walletId: string;
        destinationAddress: string;
        usdcAmount: string;
    }): Promise<TransferResult>;
    requestTestnetUsdc(address: string): Promise<void>;
}
export declare class CircleMockClient {
    private mockWallets;
    private mockBalances;
    createWallet(): Promise<CircleWallet>;
    getUsdcBalance(walletId: string): Promise<number>;
    initiateTransfer(params: {
        walletId: string;
        destinationAddress: string;
        usdcAmount: string;
    }): Promise<TransferResult>;
    requestTestnetUsdc(address: string): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map