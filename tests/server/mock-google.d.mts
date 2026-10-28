import type { GoogleConfig } from "../../server/google.ts";
export function mockGoogleCode(authorizationUrl: string | URL, overrides?: Record<string, unknown>): string;
export function mockGoogle(publicOrigin: string, now?: () => number): Promise<GoogleConfig>;
