import { useEffect, useRef, useState } from "react";

export function useThrottle<T>(value: T, delayMs: number) {
  const [throttled, setThrottled] = useState(value);
  const lastUpdatedRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdatedRef.current;

    if (elapsed >= delayMs) {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        lastUpdatedRef.current = Date.now();
        setThrottled(value);
      }, 0);
      return;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      lastUpdatedRef.current = Date.now();
      setThrottled(value);
    }, delayMs - elapsed);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delayMs]);

  return throttled;
}
