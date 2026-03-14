import { useEffect, useRef } from "react";

export function useVimNavigation(selector = "[data-vim-nav='true']") {
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(selector)
      ).filter((node) => !node.hasAttribute("disabled"));

      if (nodes.length === 0) return;

      const currentIndex = nodes.findIndex((node) => node === document.activeElement);
      const focusAt = (index: number) => {
        const node = nodes[(index + nodes.length) % nodes.length];
        node?.focus();
      };

      if (event.key === "j" || event.key === "l") {
        event.preventDefault();
        focusAt(currentIndex + 1);
      }

      if (event.key === "k" || event.key === "h") {
        event.preventDefault();
        focusAt(currentIndex <= 0 ? nodes.length - 1 : currentIndex - 1);
      }

      if (event.key === "g") {
        if (lastKeyRef.current === "g") {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
          focusAt(0);
          lastKeyRef.current = null;
          return;
        }
        lastKeyRef.current = "g";
        window.setTimeout(() => {
          lastKeyRef.current = null;
        }, 500);
      }

      if (event.key === "G") {
        event.preventDefault();
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        focusAt(nodes.length - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selector]);
}
