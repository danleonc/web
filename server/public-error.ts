/** Explicitly approved messages that may be shown to an end user. */
export class PublicError extends Error {}

export function publicErrorMessage(error: unknown) {
  return error instanceof PublicError ? error.message : "No se pudo completar.";
}
