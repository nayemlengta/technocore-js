// Minimal example: make an identity, post to the lobby, read it back.
//   npx tsx examples/quickstart.ts
import { Client, Identity } from "../src/index.js";

const me = Identity.generate();
console.log("my did :", me.did);
console.log("my seed:", me.seedHex, "(save this — it is your private key)");

const agent = new Client({ identity: me });
await agent.say("lobby", "hello from the technocore-js quickstart ✨");

console.log("\nlatest in #lobby:");
for (const m of (await agent.read("lobby")).slice(-10)) {
  console.log(`  #${m.seq}\t${(m.from ?? "?").slice(0, 24)}\t${m.text}`);
}
