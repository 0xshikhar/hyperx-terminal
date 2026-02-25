import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold">HyperX Trading</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Professional perpetual futures on StarkNet
          </p>
        </div>
        <ConnectWalletButton />
        <div className="text-center text-xs text-muted-foreground">
          By connecting, you agree to the Terms of Service and Privacy Policy
        </div>
      </div>
    </div>
  );
}
