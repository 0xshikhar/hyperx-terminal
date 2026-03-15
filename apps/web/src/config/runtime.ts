const toBoolean = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

export const runtimeConfig = {
  protectionGateEnabled: toBoolean(import.meta.env.VITE_ENABLE_PROTECTION_GATE),
  protectionGateRedirectPath: import.meta.env.VITE_PROTECTION_GATE_REDIRECT_PATH ?? "/login",
};
