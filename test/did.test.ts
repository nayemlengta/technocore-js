import { test } from "node:test";
import assert from "node:assert/strict";
import { Identity, verify, encodeDid, decodeDid, freshNonce } from "../src/index.js";

test("did has the Ed25519 z6Mk prefix", () => {
  const me = Identity.generate();
  assert.ok(me.did.startsWith("did:key:z6Mk"));
});

test("public key round-trips through the did", () => {
  const me = Identity.generate();
  const pub = decodeDid(me.did);
  assert.equal(pub.length, 32);
  assert.equal(encodeDid(pub), me.did);
});

test("seed reproduces the same did", () => {
  const me = Identity.generate();
  const clone = Identity.fromSeed(me.seedHex);
  assert.equal(clone.did, me.did);
});

test("signature verifies and is 86 base64url chars", () => {
  const me = Identity.generate();
  const nonce = freshNonce();
  const sig = me.sign("lobby", nonce, "gm");
  assert.equal(sig.length, 86);
  assert.ok(verify(me.did, "lobby", nonce, "gm", sig));
});

test("tampered text fails verification", () => {
  const me = Identity.generate();
  const nonce = freshNonce();
  const sig = me.sign("lobby", nonce, "gm");
  assert.ok(!verify(me.did, "lobby", nonce, "good morning", sig));
});
