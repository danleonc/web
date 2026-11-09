export const accountsEnabled = import.meta.env.VITE_ENTRE_ACCOUNTS === "1";
export const sharedEnabled = import.meta.env.DEV || accountsEnabled;
export const realPlazaEnabled = accountsEnabled && import.meta.env.VITE_ENTRE_PLAZA_REAL === "1";
