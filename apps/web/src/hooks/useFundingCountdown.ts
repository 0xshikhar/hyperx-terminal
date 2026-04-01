import { useState, useEffect } from "react";

export type FundingCountdownResult = {
  formattedCountdown: string;
  timeRemainingMs: number;
  nextFundingDate: Date;
};

/**
 * Calculates remaining time until next hourly funding epoch (:00:00 UTC).
 * Updates live every 1000ms.
 */
export function useFundingCountdown(intervalHours = 1): FundingCountdownResult {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const intervalMs = intervalHours * 3600 * 1000;
  const nextFundingTimestamp = Math.ceil((now + 1) / intervalMs) * intervalMs;
  const timeRemainingMs = Math.max(0, nextFundingTimestamp - now);

  const totalSeconds = Math.floor(timeRemainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => String(num).padStart(2, "0");
  const formattedCountdown = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return {
    formattedCountdown,
    timeRemainingMs,
    nextFundingDate: new Date(nextFundingTimestamp),
  };
}
