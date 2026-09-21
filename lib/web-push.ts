import {
  createCipheriv,
  createECDH,
  createHash,
  createHmac,
  createPrivateKey,
  createSign,
  randomBytes
} from "node:crypto";

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type VapidConfig = {
  publicKey: string;
  privateJwk: JsonWebKey;
  subject: string;
};

function b64url(value: Buffer | string) {
  const buffer = typeof value === "string" ? Buffer.from(value) : value;
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function hkdfExtract(salt: Buffer, ikm: Buffer) {
  return createHmac("sha256", salt).update(ikm).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  if (length > 32) throw new Error("HKDF length is too large.");
  return createHmac("sha256", prk)
    .update(info)
    .update(Buffer.from([1]))
    .digest()
    .subarray(0, length);
}

function vapidToken(endpoint: string, config: VapidConfig) {
  const audience = new URL(endpoint).origin;
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64url(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: config.subject
  }));
  const unsigned = `${header}.${payload}`;
  const key = createPrivateKey({ key: config.privateJwk, format: "jwk" });
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${b64url(signature)}`;
}

function encryptPayload(subscription: StoredPushSubscription, payload: Buffer) {
  const clientPublicKey = fromB64url(subscription.p256dh);
  const authSecret = fromB64url(subscription.auth);
  if (clientPublicKey.length !== 65 || clientPublicKey[0] !== 4) {
    throw new Error("Niepoprawny klucz urządzenia push.");
  }

  const serverECDH = createECDH("prime256v1");
  serverECDH.generateKeys();
  const serverPublicKey = serverECDH.getPublicKey();
  const sharedSecret = serverECDH.computeSecret(clientPublicKey);

  const keyPrk = hkdfExtract(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    clientPublicKey,
    serverPublicKey
  ]);
  const ikm = hkdfExpand(keyPrk, keyInfo, 32);

  const salt = randomBytes(16);
  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  const record = Buffer.concat([payload, Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
    encrypted
  ]);
}

export async function sendWebPush(
  subscription: StoredPushSubscription,
  message: Record<string, unknown>,
  config: VapidConfig
) {
  const body = encryptPayload(subscription, Buffer.from(JSON.stringify(message), "utf8"));
  const token = vapidToken(subscription.endpoint, config);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token}, k=${config.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal"
    },
    body,
    cache: "no-store"
  });

  return {
    ok: response.ok,
    status: response.status,
    body: response.ok ? "" : await response.text().catch(() => "")
  };
}

export function hashPushSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
