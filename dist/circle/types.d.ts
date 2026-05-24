export interface CircleWallet {
    id: string;
    address: string;
    blockchain: string;
    accountType: "EOA" | "SCA";
    state: "LIVE" | "FROZEN";
    walletSetId: string;
    custodyType: "DEVELOPER";
    createDate: string;
    updateDate: string;
}
export interface TokenBalance {
    token: {
        name: string;
        symbol: string;
        isNative: boolean;
        decimals: number;
        tokenAddress?: string;
    };
    amount: string;
    updateDate: string;
}
export interface WalletBalance {
    walletId: string;
    address: string;
    blockchain: string;
    tokenBalances: TokenBalance[];
}
export interface TransferResult {
    id: string;
    walletId: string;
    state: "PENDING" | "CONFIRMED" | "COMPLETE" | "FAILED";
    txHash?: string;
    amounts: string[];
    destinationAddress: string;
    createDate: string;
    updateDate: string;
}
export interface CircleConfig {
    apiKey: string;
    entitySecret: string;
    walletSetId?: string;
    sandbox?: boolean;
}
//# sourceMappingURL=types.d.ts.map