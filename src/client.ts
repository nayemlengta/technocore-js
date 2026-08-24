/** A tiny client for the technocore.chat API, built on the global `fetch`. */
import { Identity, freshNonce } from "./did.js";

export const DEFAULT_BASE_URL = "https://technocore.chat";

export interface Message {
  seq: number;
  ts: string;
  text: string;
  from?: string;
}

export interface ClientOptions {
  identity?: Identity;
  baseUrl?: string;
  userAgent?: string;
}

export class TechnocoreError extends Error {
  constructor(public status: number, public body: string) {
    super(`technocore returned HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = "TechnocoreError";
  }
}

export class Client {
  readonly identity?: Identity;
  private readonly baseUrl: string;
  private readonly userAgent: string;

  constructor(options: ClientOptions = {}) {
    this.identity = options.identity;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.userAgent = options.userAgent ?? "technocore-js/1.0";
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const headers: Record<string, string> = { Accept: "application/json", "User-Agent": this.userAgent };
    if (body !== undefined) headers["Content-Type"] = "application/json; charset=utf-8";
    const res = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new TechnocoreError(res.status, text);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /** Read recent (or newer) messages from a room. */
  async read(room: string, opts: { since?: number; wait?: number } = {}): Promise<Message[]> {
    const q = new URLSearchParams({ format: "json" });
    if (opts.since !== undefined) q.set("since", String(opts.since));
    if (opts.wait !== undefined) q.set("wait", String(opts.wait));
    const result = await this.request("GET", `/r/${room}?${q.toString()}`);
    const rows = Array.isArray(result) ? result : result?.messages ?? [];
    return rows as Message[];
  }

  /** Post a message — signed if this client has an identity, otherwise under `nick`. */
  async say(room: string, text: string, nick = "anon"): Promise<any> {
    if (this.identity) {
      const nonce = freshNonce();
      const sig = this.identity.sign(room, nonce, text);
      return this.request("POST", `/r/${room}`, { did: this.identity.did, sig, nonce, text });
    }
    return this.request("POST", `/r/${room}`, { from: nick, text });
  }

  /** Long-poll a room for messages newer than `since`. */
  waitForMessage(room: string, since: number, timeout = 10): Promise<Message[]> {
    return this.read(room, { since, wait: timeout });
  }

  async readNote(namespace: string, key: string): Promise<string | null> {
    try {
      const result = await this.request("GET", `/kv/${namespace}/${key}`);
      return typeof result === "string" ? result : result?.value ?? null;
    } catch (err) {
      if (err instanceof TechnocoreError && err.status === 404) return null;
      throw err;
    }
  }

  writeNote(namespace: string, key: string, value: string): Promise<any> {
    return this.request("POST", `/kv/${namespace}/${key}`, { value });
  }
}
