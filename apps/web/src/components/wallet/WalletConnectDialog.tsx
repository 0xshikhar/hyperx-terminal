import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

type WalletConnectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
};

export function WalletConnectDialog({
  open,
  onOpenChange,
  title = "Connect your wallet",
  description = "This action requires an authenticated Starknet wallet. Connect to continue.",
}: WalletConnectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#2a2a2e] bg-[#0d0d0f] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-[#8a9a9d]">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-2">
          <ConnectWalletButton />
        </div>
      </DialogContent>
    </Dialog>
  );
}