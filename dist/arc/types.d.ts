export interface BlockInfo {
    number: number;
    hash: string;
    timestamp: number;
    gasLimit: string;
    gasUsed: string;
    transactionCount: number;
}
export interface ChainInfo {
    chainId: number;
    networkName: string;
    latestBlock: number;
    rpcEndpoint: string;
}
export interface JsonRpcRequest {
    jsonrpc: "2.0";
    method: string;
    params: unknown[];
    id: number;
}
export interface JsonRpcResponse<T = unknown> {
    jsonrpc: "2.0";
    result?: T;
    error?: {
        code: number;
        message: string;
    };
    id: number;
}
//# sourceMappingURL=types.d.ts.map