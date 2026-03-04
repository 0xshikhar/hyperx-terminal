import { AccountSummary } from "@/components/account/AccountSummary";
import { PreferencesCard } from "@/components/account/PreferencesCard";
import { PositionsTabs } from "@/components/positions/PositionsTabs";

export function PortfolioPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Portfolio</h1>
      <AccountSummary />
      <PreferencesCard />
      <PositionsTabs />
    </div>
  );
}
