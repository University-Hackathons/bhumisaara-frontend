import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import { mintedTokenId } from "../lib/mintReceipt.ts";
import { readLanguage, saveLanguage, translate } from "../lib/language.ts";
import { accountQueryKey } from "../lib/accountQueryKey.ts";

const base = path.dirname(fileURLToPath(import.meta.url));
const topic = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";
const word = (number) => number.toString(16).padStart(64, "0");

test("confirmed mint parses its actual full-width ID and rejects unreadable receipts", () => {
  assert.equal(mintedTokenId({ logs: [{ topics: [topic], data: `0x${word(42)}${word(50)}` }] }), "42");
  assert.throws(() => mintedTokenId({ logs: [{ topics: [topic], data: "0xdead" }] }), /token ID could not be read/);
  assert.equal(mintedTokenId({ logs: [{ topics: [topic], data: `0x${word(9007199254740992)}${word(50)}` }] }), "9007199254740992");
  assert.throws(() => mintedTokenId({ logs: [] }), /token ID could not be read/);
});

test("account switching gives distinct cache keys and Sinhala/Tamil switch their main journey labels", () => {
  assert.notDeepEqual(accountQueryKey("1", ["orders"]), accountQueryKey("2", ["orders"]));
  assert.equal(translate("si", "My Orders"), "මගේ ඇණවුම්");
  assert.equal(translate("ta", "My Orders"), "என் ஆர்டர்கள்");
  assert.equal(translate("en", "My Orders"), "My Orders");
  assert.notEqual(translate("si", "Submit Application"), "Submit Application");
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  saveLanguage(storage, "si");
  assert.equal(readLanguage(storage), "si");
  saveLanguage(storage, "ta");
  assert.equal(readLanguage(storage), "ta");
});

test("401 clears both tokens and user and immediately signals session expiry", async () => {
  const values = new Map([["user", JSON.stringify({ userId: 1 })], ["token", "old"], ["refreshToken", "old-refresh"]]);
  const events = [];
  const localStorage = { getItem: (key) => values.get(key) ?? null, removeItem: (key) => values.delete(key) };
  const window = { dispatchEvent: (event) => events.push(event.type) };
  class Event { constructor(type) { this.type = type; } }
  function load(relative, dependencies = {}) {
    const source = fs.readFileSync(path.join(base, "..", relative), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const mod = { exports: {} };
    vm.runInNewContext(code, { module: mod, exports: mod.exports, require: (id) => dependencies[id], localStorage, window, Event, process }, { filename: relative });
    return mod.exports;
  }
  const session = load("lib/session.ts");
  let cancelled = 0, cleared = 0, destination = "";
  session.finishSession({ cancelQueries: async () => { cancelled++; }, clear: () => { cleared++; } },
    () => { destination = "/auth"; });
  assert.equal(cancelled, 1);
  assert.equal(cleared, 1);
  assert.equal(destination, "/auth");
  values.set("user", JSON.stringify({ userId: 1 }));
  values.set("token", "old");
  values.set("refreshToken", "old-refresh");
  const handlers = {};
  const axios = { create: () => ({ interceptors: { request: { use() {} }, response: { use: (yes, no) => { handlers.no = no; } } } }) };
  load("utils/axiosInstance.ts", { axios: { default: axios, ...axios }, "@/lib/session": session,
    "@/lib/chainRecovery": { savePendingChainRecord() {}, clearPendingChainRecord() {} } });
  await assert.rejects(handlers.no({ response: { status: 401 }, config: { method: "get" } }));
  assert.equal(values.size, 0);
  assert.deepEqual(events, ["bhumisaara:session-expired"]);
});
