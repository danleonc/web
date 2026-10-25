export type ImageRef = { id: string; description: string };
export const validImageRef = (v: unknown): v is ImageRef =>
  !!v &&
  typeof v === "object" &&
  "id" in v &&
  typeof v.id === "string" &&
  /^[a-f0-9-]{36}$/.test(v.id) &&
  "description" in v &&
  typeof v.description === "string" &&
  v.description.length <= 180;
export const maxImageBytes = 350 * 1024;

// Originals and delivered images have different budgets: users choose a photo; we resize it.
export const maxOriginalImageBytes = 40 * 1024 * 1024;
export const originalImageLimits = {
  maxPixels: 120_000_000,
  maxDimension: 20_000,
};
export const compressionSizes = [1280, 1024, 800, 640, 480, 320, 256] as const;
