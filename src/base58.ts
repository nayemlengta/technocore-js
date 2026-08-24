// Minimal base58btc (Bitcoin alphabet) encode/decode — no dependencies.
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = BigInt(58);
const INDEX: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) INDEX[ALPHABET[i]] = i;

export function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) {
    const rem = Number(n % BASE);
    n = n / BASE;
    out = ALPHABET[rem] + out;
  }
  // preserve leading zero bytes as '1'
  for (const b of bytes) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}

export function base58Decode(str: string): Uint8Array {
  let n = 0n;
  for (const ch of str) {
    const v = INDEX[ch];
    if (v === undefined) throw new Error(`invalid base58 character: ${ch}`);
    n = n * BASE + BigInt(v);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n % 256n));
    n = n / 256n;
  }
  for (const ch of str) {
    if (ch === "1") bytes.unshift(0);
    else break;
  }
  return Uint8Array.from(bytes);
}
