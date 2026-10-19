export const accountsEnabled = import.meta.env.VITE_ENTRE_ACCOUNTS === "1";
export const sharedEnabled = import.meta.env.DEV || accountsEnabled;
