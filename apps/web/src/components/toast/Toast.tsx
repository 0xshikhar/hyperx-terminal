import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContainerProps {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const toastStyles = {
  success: "border-terminal-green/30 bg-terminal-green/10 text-terminal-green",
  error: "border-terminal-red/30 bg-terminal-red/10 text-terminal-red",
  info: "border-primary/30 bg-primary/10 text-primary",
  warning: "border-terminal-yellow/30 bg-terminal-yellow/10 text-terminal-yellow",
};

// Global toast state
let listeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

const notifyListeners = () => {
  listeners.forEach((listener) => listener([...toasts]));
};

export const toast = {
  success: (title: string, message?: string, duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    toasts = [...toasts, { id, type: "success", title, message, duration }];
    notifyListeners();
    setTimeout(() => toast.dismiss(id), duration);
    return id;
  },
  error: (title: string, message?: string, duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    toasts = [...toasts, { id, type: "error", title, message, duration }];
    notifyListeners();
    setTimeout(() => toast.dismiss(id), duration);
    return id;
  },
  info: (title: string, message?: string, duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    toasts = [...toasts, { id, type: "info", title, message, duration }];
    notifyListeners();
    setTimeout(() => toast.dismiss(id), duration);
    return id;
  },
  warning: (title: string, message?: string, duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    toasts = [...toasts, { id, type: "warning", title, message, duration }];
    notifyListeners();
    setTimeout(() => toast.dismiss(id), duration);
    return id;
  },
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  },
  clear: () => {
    toasts = [];
    notifyListeners();
  },
};

const positionClasses = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
};

export function ToastContainer({ position = "top-right" }: ToastContainerProps) {
  const [localToasts, setLocalToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setLocalToasts(newToasts);
    listeners.push(listener);
    setLocalToasts([...toasts]);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className={cn("fixed z-[100] flex flex-col gap-2 w-full max-w-sm", positionClasses[position])}>
      <AnimatePresence mode="popLayout">
          {localToasts.map((t) => {
            const Icon = toastIcons[t.type];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                transition={{ type: "spring", duration: 0.4 }}
                className={cn(
                  "relative overflow-hidden rounded-lg border p-4 shadow-lg backdrop-blur-sm",
                  toastStyles[t.type]
                )}
              >
                {/* Progress bar */}
                <motion.div
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: (t.duration ?? 5000) / 1000, ease: "linear" }}
                  className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30"
                />

                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-medium">{t.title}</p>
                    {t.message && (
                      <p className="font-mono text-xs opacity-80 mt-1">{t.message}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="shrink-0 p-1 rounded hover:bg-secondary/50 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
      </AnimatePresence>
    </div>
  );
}
