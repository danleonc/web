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
