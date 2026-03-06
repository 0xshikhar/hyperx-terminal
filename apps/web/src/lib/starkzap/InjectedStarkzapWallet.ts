import {
  type Address,
  BaseWallet,
  type Call,
  ChainId,
  type DeployOptions,
  type EnsureReadyOptions,
  type ExecuteOptions,
  type FeeMode,
  type PreflightOptions,
  type PreflightResult,
  type RpcProvider,
  Tx,
  getStakingPreset,
} from "starkzap";
import type { Signature, TypedData } from "starknet";

type AccountLike = {
  address: string;
  getChainId?: () => Promise<string>;
  execute: (calls: Call[]) => Promise<{ transaction_hash: string }>;
  signMessage: (typedData: unknown) => Promise<unknown>;
  estimateInvokeFee?: (tx: Call[]) => Promise<unknown>;
  estimateFee?: (tx: Call[]) => Promise<unknown>;
  provider?: RpcProvider;
  providerOrAccount?: RpcProvider;
  getClassHashAt?: (address: Address) => Promise<string>;
};

function resolveProvider(account: AccountLike): RpcProvider | null {
  if (account.provider) return account.provider;
  if (account.providerOrAccount) return account.providerOrAccount;
  return null;
}

function stringifyUnknownError(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
}

function extractExecuteErrorMessage(error: unknown): string {
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: string }).message;
    if (message) return message;
  }
  const serialized = stringifyUnknownError(error);
  return serialized || "Transaction execution failed";
}

export class InjectedStarkzapWallet extends BaseWallet {
  private readonly account: AccountLike;
  private readonly provider: RpcProvider;
  private readonly chainId: ChainId;
  private readonly feeMode: FeeMode;
  private readonly classHash: string;

  constructor(
    account: AccountLike,
    provider: RpcProvider,
    chainId: ChainId,
    classHash: string,
    feeMode: FeeMode = "user_pays"
  ) {
    super(account.address as unknown as Address, getStakingPreset(chainId));
    this.account = account;
    this.provider = provider;
    this.chainId = chainId;
    this.classHash = classHash;
    this.feeMode = feeMode;
  }

  static async fromAccount(account: AccountLike): Promise<InjectedStarkzapWallet> {
    const provider = resolveProvider(account);
    if (!provider) {
      throw new Error("Wallet provider is unavailable");
    }
    const chainId = ChainId.SEPOLIA;
    const classHash = await provider
      .getClassHashAt(account.address as unknown as Address)
      .catch(() => "");
    return new InjectedStarkzapWallet(account, provider, chainId, classHash);
  }

  async isDeployed(): Promise<boolean> {
    return Boolean(this.classHash);
  }

  async ensureReady(options?: EnsureReadyOptions): Promise<void> {
    void options;
    return;
  }

  async deploy(options?: DeployOptions): Promise<Tx> {
    void options;
    throw new Error("Deploy is not supported for injected wallets in this flow");
  }

  async preflight(options?: PreflightOptions): Promise<PreflightResult> {
    void options;
    return { ok: true };
  }

  async execute(calls: Call[], options?: ExecuteOptions): Promise<Tx> {
    if (options?.feeMode === "sponsored") {
      throw new Error("Sponsored mode is not available with injected wallets yet");
    }

    try {
      const result = await this.account.execute(calls);
      return new Tx(result.transaction_hash, this.provider, this.chainId);
    } catch (error) {
      throw new Error(extractExecuteErrorMessage(error));
    }
  }

  async signMessage(typedData: TypedData): Promise<Signature> {
    const signature = await this.account.signMessage(typedData);
    return signature as Signature;
  }

  getAccount(): never {
    return this.account as never;
  }

  getProvider(): RpcProvider {
    return this.provider;
  }

  getChainId(): ChainId {
    return this.chainId;
  }

  getFeeMode(): FeeMode {
    return this.feeMode;
  }

  getClassHash(): string {
    return this.classHash;
  }

  async estimateFee(calls: Call[]): Promise<never> {
    if (this.account.estimateInvokeFee) {
      return this.account.estimateInvokeFee(calls) as never;
    }
    if (this.account.estimateFee) {
      return this.account.estimateFee(calls) as never;
    }
    throw new Error("Unable to estimate fee for this wallet");
  }

  async disconnect(): Promise<void> {
    return;
  }
}
