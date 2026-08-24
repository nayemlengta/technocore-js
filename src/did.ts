/**
 * Ed25519 `did:key` identities using Node's built-in crypto — no dependencies.
 *
 *   did = "did:key:z" + base58btc(0xED01 || rawPublicKey32)
 *
 * Messages are signed over the exact bytes `"{room}|{nonce}|{text}"`; signatures
 * travel as unpadded base64url.
 */
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign as edSign,
  verify as edVerify,
  KeyObject,
} from "node:crypto";
import { base58Encode, base58Decode } from "./base58.js";

const MULTICODEC_ED25519 = Buffer.from([0xed, 0x01]);
// DER wrappers for raw Ed25519 keys (RFC 8410).
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex"); // + 32-byte seed
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex"); // + 32-byte public key

function rawPublicKey(key: KeyObject): Buffer {
  const der = key.export({ type: "spki", format: "der" }) as Buffer;
  return der.subarray(der.length - 32);
}
function rawSeed(key: KeyObject): Buffer {
  const der = key.export({ type: "pkcs8", format: "der" }) as Buffer;
  return der.subarray(der.length - 32);
}
function privateKeyFromSeed(seed: Buffer): KeyObject {
  return createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: "der", type: "pkcs8" });
}
function publicKeyFromRaw(raw: Buffer): KeyObject {
  return createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: "der", type: "spki" });
}

export function encodeDid(rawPub: Uint8Array): string {
  return "did:key:z" + base58Encode(Buffer.concat([MULTICODEC_ED25519, Buffer.from(rawPub)]));
}

export function decodeDid(did: string): Buffer {
  if (!did.startsWith("did:key:z")) throw new Error("not a did:key identifier");
  const decoded = Buffer.from(base58Decode(did.slice("did:key:z".length)));
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) throw new Error("did:key is not an Ed25519 key");
  return decoded.subarray(2);
}

let nonceCounter = 0n;
/** A strictly-increasing nonce (nanosecond wall-clock plus a per-process counter). */
export function freshNonce(): string {
  const ns = BigInt(Date.now()) * 1_000_000n + (nonceCounter++ % 1_000_000n);
  return ns.toString();
}

export class Identity {
  private constructor(private readonly key: KeyObject, readonly did: string) {}

  static generate(): Identity {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    return new Identity(privateKey, encodeDid(rawPublicKey(publicKey)));
  }

  static fromSeed(seedHex: string): Identity {
    const priv = privateKeyFromSeed(Buffer.from(seedHex, "hex"));
    return new Identity(priv, encodeDid(rawPublicKey(createPublicKey(priv))));
  }

  /** The 32-byte private seed as hex. Keep it secret; never publish it. */
  get seedHex(): string {
    return rawSeed(this.key).toString("hex");
  }

  sign(room: string, nonce: string, text: string): string {
    return edSign(null, Buffer.from(`${room}|${nonce}|${text}`, "utf8"), this.key).toString("base64url");
  }
}

export function verify(did: string, room: string, nonce: string, text: string, signature: string): boolean {
  try {
    const pub = publicKeyFromRaw(decodeDid(did));
    return edVerify(null, Buffer.from(`${room}|${nonce}|${text}`, "utf8"), pub, Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}
