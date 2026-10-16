import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const runtimeRequire = createRequire(import.meta.url);
const testDir = path.dirname(fileURLToPath(import.meta.url));

const values = new Map([["user", JSON.stringify({ userId: 8 })]]);
const localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
const window = { dispatchEvent() {} };
class Event { constructor(type) { this.type = type; } }

function load(relative, dependencies = {}) {
  const source = fs.readFileSync(path.join(testDir, "..", relative), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports, require: (id) => dependencies[id] || runtimeRequire(id),
    localStorage, window, Event, process,
  }, { filename: relative });
  return loadedModule.exports;
}

const recovery = load("lib/chainRecovery.ts");
const handlers = {};
const axiosStub = { create: () => ({ interceptors: {
  request: { use: (yes, no) => { handlers.request = { yes, no }; } },
  response: { use: (yes, no) => { handlers.response = { yes, no }; } },
} }) };
const session = load("lib/session.ts");
load("utils/axiosInstance.ts", { axios: { default: axiosStub, ...axiosStub }, "@/lib/chainRecovery": recovery, "@/lib/session": session });

const hash = "0x" + "a".repeat(64);
const config = { method: "post", url: "/credits/issue", data: JSON.stringify({ transactionHash: hash, creditsKg: 5 }) };

test("failed registry API call preserves confirmed transaction and retry success clears it", async () => {
  await assert.rejects(handlers.response.no({ config, response: { status: 503 } }));
  assert.equal(recovery.pendingChainRecords().length, 1);
  assert.equal(recovery.pendingChainRecords()[0].hash, hash);
  handlers.response.yes({ config });
  assert.equal(recovery.pendingChainRecords().length, 0);
});

test("retry resubmits only the saved API payload after failure", async () => {
  values.set("user", JSON.stringify({ userId: 8 }));
  recovery.savePendingChainRecord("/credits/issue", { transactionHash: hash, creditsKg: 5 });
  const record = recovery.pendingChainRecords()[0];
  let calls = 0;
  const post = async (url, payload) => {
    calls++;
    assert.equal(url, "/credits/issue");
    assert.equal(payload.transactionHash, hash);
    if (calls === 1) throw new Error("database unavailable");
  };
  await assert.rejects(recovery.retryPendingChainRecord(record, post));
  assert.equal(recovery.pendingChainRecords().length, 1);
  await recovery.retryPendingChainRecord(record, post);
  assert.equal(calls, 2);
  assert.equal(recovery.pendingChainRecords().length, 0);
});

test("invalid hashes and other users cannot enter this recovery queue", () => {
  recovery.savePendingChainRecord("/credits/issue", { transactionHash: "0x123" });
  assert.equal(recovery.pendingChainRecords().length, 0);
  recovery.savePendingChainRecord("/credits/issue", { transactionHash: hash });
  values.set("user", JSON.stringify({ userId: 9 }));
  assert.notEqual(recovery.pendingChainRecords()[0].owner, recovery.currentRecoveryOwner());
});

test("expired session after chain confirmation retains the original hash for the same user", async () => {
  values.set("user", JSON.stringify({ userId: 8 }));
  values.set("token", "old-token");
  await assert.rejects(handlers.response.no({ config: { ...config, headers: { Authorization: "Bearer old-token" } }, response: { status: 401 } }));
  assert.equal(values.has("token"), false);
  assert.equal(recovery.pendingChainRecords().find((item) => item.hash === hash)?.owner, "8");
});
