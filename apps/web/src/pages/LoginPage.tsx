import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Shield, Lock, ChevronRight, Terminal } from "lucide-react";
import { useWallet } from "@/components/wallet/useWallet";
import { signInWithWallet, isAuthenticated } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function LoginPage() {
  const navigate = useNavigate();
  const { connectWallet, isConnected, address, account } = useWallet();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [step, setStep] = useState<"connect" | "sign" | "complete">("connect");

  // Check if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/terminal");
    }
  }, [navigate]);

  // Handle wallet connection
  const handleConnect = async () => {
    try {
      await connectWallet();
      setStep("sign");
    } catch (error) {
      toast.error("Failed to connect wallet");
      console.error(error);
    }
  };

  // Handle authentication
  const handleAuthenticate = async () => {
    if (!isConnected || !account || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsAuthenticating(true);
    try {
      await signInWithWallet();
      toast.success("Authentication successful!");
      setStep("complete");
      
      // Redirect after short delay
      setTimeout(() => {
        navigate("/terminal");
      }, 1000);
    } catch (error) {
      console.error("Authentication failed:", error);
      toast.error("Authentication failed. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 scanlines">
      {/* Background grid */}
      <div className="absolute inset-0 grid-lines opacity-50" />
      
      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-terminal-magenta/20 rounded-full blur-[128px]" />
      
      <div className="relative w-full max-w-lg">
        {/* Terminal card */}
        <div className="terminal-panel overflow-hidden">
          {/* Header */}
          <div className="terminal-header">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Authentication Terminal
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-terminal-red" />
              <div className="w-2 h-2 rounded-full bg-terminal-yellow" />
              <div className="w-2 h-2 rounded-full bg-terminal-green" />
            </div>
          </div>
          
          {/* Content */}
          <div className="p-8 space-y-8">
            {/* Logo */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                <div className="relative">
                  <Zap className="h-10 w-10 text-primary" />
                  <div className="absolute inset-0 blur-xl bg-primary/50" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight">
                  <span className="text-primary">HYPER</span>
                  <span className="text-foreground">X</span>
                </h1>
              </div>
              <p className="font-mono text-sm text-muted-foreground">
                Starknet Perpetual Futures Trading Terminal
              </p>
            </div>

            {/* Progress steps */}
            <div className="flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${step === "connect" ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm border ${step === "connect" ? "border-primary bg-primary/10" : step === "sign" || step === "complete" ? "border-terminal-green bg-terminal-green/10 text-terminal-green" : "border-border"}`}>
                  {step === "sign" || step === "complete" ? "✓" : "1"}
                </div>
                <span className="font-mono text-xs hidden sm:block">Connect</span>
              </div>
              
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              
              <div className={`flex items-center gap-2 ${step === "sign" ? "text-primary" : step === "complete" ? "text-terminal-green" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm border ${step === "sign" ? "border-primary bg-primary/10" : step === "complete" ? "border-terminal-green bg-terminal-green/10" : "border-border"}`}>
                  {step === "complete" ? "✓" : "2"}
                </div>
                <span className="font-mono text-xs hidden sm:block">Verify</span>
              </div>
              
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              
              <div className={`flex items-center gap-2 ${step === "complete" ? "text-terminal-green" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm border ${step === "complete" ? "border-terminal-green bg-terminal-green/10" : "border-border"}`}>
                  3
                </div>
                <span className="font-mono text-xs hidden sm:block">Access</span>
              </div>
            </div>

            {/* Action area */}
            <div className="space-y-4">
              {step === "connect" && (
                <div className="space-y-4">
                  <Button
                    onClick={handleConnect}
                    className="w-full h-14 btn-terminal-primary text-base"
                  >
                    <Shield className="mr-2 h-5 w-5" />
                    Connect Starknet Wallet
                  </Button>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex-1 h-px bg-border" />
                    <span className="font-mono uppercase">Supported Wallets</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  
                  <div className="flex justify-center gap-6">
                    <span className="font-mono text-xs text-muted-foreground">Argent X</span>
                    <span className="font-mono text-xs text-muted-foreground">Braavos</span>
                    <span className="font-mono text-xs text-muted-foreground">Cartridge</span>
                  </div>
                </div>
              )}

              {step === "sign" && (
                <div className="space-y-4">
                  <div className="p-4 rounded bg-secondary/50 border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="status-dot active" />
                      <span className="font-mono text-sm text-foreground">Wallet Connected</span>
                    </div>
                    <code className="font-mono text-xs text-muted-foreground break-all">
                      {address}
                    </code>
                  </div>
                  
                  <Button
                    onClick={handleAuthenticate}
                    disabled={isAuthenticating}
                    className="w-full h-14 btn-terminal-primary text-base"
                  >
                    {isAuthenticating ? (
                      <>
                        <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Verifying Signature...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-5 w-5" />
                        Sign & Authenticate
                      </>
                    )}
                  </Button>
                  
                  <p className="text-center font-mono text-xs text-muted-foreground">
                    You will be asked to sign a message to verify wallet ownership
                  </p>
                </div>
              )}

              {step === "complete" && (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-terminal-green/10 flex items-center justify-center">
                    <Shield className="h-8 w-8 text-terminal-green" />
                  </div>
                  <h3 className="font-mono text-lg text-foreground">Authentication Complete</h3>
                  <p className="font-mono text-sm text-muted-foreground">
                    Redirecting to terminal...
                  </p>
                </div>
              )}
            </div>

            {/* Security note */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span className="font-mono">Secure connection • End-to-end encrypted</span>
            </div>
          </div>
          
          {/* Bottom decoration */}
          <div className="h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        </div>
        
        {/* Footer */}
        <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
          By connecting, you agree to the Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
