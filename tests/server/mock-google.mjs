// Private test provider. Production always uses Google's fixed HTTPS endpoints.
import { createHash } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
export function mockGoogleCode(authorizationUrl, overrides = {}) {
  const url = new URL(authorizationUrl);
  return Buffer.from(
    JSON.stringify({
      nonce: url.searchParams.get("nonce"),
      challenge: url.searchParams.get("code_challenge"),
      sub: "google-person",
      email: "person@gmail.com",
      ...overrides,
    }),
  ).toString("base64url");
}
export async function mockGoogle(publicOrigin, now = Date.now) {
  const { privateKey, publicKey } = await generateKeyPair("RS256"),
    other = await generateKeyPair("RS256"),
    jwk = await exportJWK(publicKey),
    used = new Set();
  const clientId = "afinia-test.apps.googleusercontent.com",
    clientSecret = "fixture-only-client-secret";
  return {
    clientId,
    clientSecret,
    publicOrigin,
    fetch: async (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (url.href === "https://www.googleapis.com/oauth2/v3/certs")
        return new Response(
          JSON.stringify({
            keys: [{ ...jwk, kid: "fixture-key", alg: "RS256", use: "sig" }],
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "max-age=3600",
            },
          },
        );
      if (url.href !== "https://oauth2.googleapis.com/token")
        throw Error("Unexpected provider endpoint");
      const body = new URLSearchParams(String(init.body)),
        code = body.get("code");
      if (used.has(code)) return new Response("{}", { status: 400 });
      used.add(code);
      const c = JSON.parse(Buffer.from(code, "base64url").toString("utf8"));
      if (
        body.get("client_id") !== clientId ||
        body.get("client_secret") !== clientSecret ||
        body.get("redirect_uri") !==
          publicOrigin + "/api/auth/google-callback" ||
        createHash("sha256")
          .update(body.get("code_verifier") || "")
          .digest("base64url") !== c.challenge
      )
        return new Response("{}", { status: 400 });
      if (c.fail) throw Error("Simulated provider failure");
      const payload = {
        iss: "https://accounts.google.com",
        aud: clientId,
        sub: c.sub,
        nonce: c.nonce,
        email: c.email,
        email_verified: true,
        iat: Math.floor(now() / 1000),
        exp: Math.floor(now() / 1000) + 3600,
        ...c.claims,
      };
      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
        .sign(c.wrongKey ? other.privateKey : privateKey);
      return new Response(
        JSON.stringify({
          id_token: token,
          access_token: "fixture-never-return-to-browser",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  };
}
