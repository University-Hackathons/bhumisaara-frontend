export interface PendingChainRecord {
  id: string;
  owner: string;
  url: string;
  payload: Record<string, unknown>;
  hash: string;
}

const KEY = "bhumisaara:pending-chain-records";
const eventName = "bhumisaara:pending-chain-records-updated";

export function pendingChainRecords(): PendingChainRecord[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function currentRecoveryOwner(): string {
  if (typeof window === "undefined") return "";
  try { return String(JSON.parse(localStorage.getItem("user") || "{}").userId || ""); }
  catch { return ""; }
}

export function chainHash(payload: Record<string, unknown>): string | null {
  const value = payload.transactionHash || payload.burnTransactionHash || payload.creditTransferHash;
  return typeof value === "string" && /^0x[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : null;
}

export function isChainRecordUrl(url: string): boolean {
  return /^\/(batches|transfers|distributions|credits\/issue)$/.test(url)
    || /^\/orders\/\d+\/confirm$/.test(url)
    || /^\/redemption-claims\/\d+\/settle$/.test(url);
}

export function savePendingChainRecord(url: string, payload: Record<string, unknown>) {
  const hash = chainHash(payload);
  const owner = currentRecoveryOwner();
  if (!hash || !owner || !isChainRecordUrl(url)) return;
  const id = `${owner}:${url}:${hash}`;
  const records = pendingChainRecords().filter((item) => item.id !== id);
  records.push({ id, owner, url, payload, hash });
  localStorage.setItem(KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(eventName));
}

export function clearPendingChainRecord(url: string, payload: Record<string, unknown>) {
  const hash = chainHash(payload);
  if (!hash || typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(pendingChainRecords().filter(
    (item) => !(item.url === url && item.hash === hash && item.owner === currentRecoveryOwner())
  )));
  window.dispatchEvent(new Event(eventName));
}

export async function retryPendingChainRecord(
  record: PendingChainRecord,
  post: (url: string, payload: Record<string, unknown>) => Promise<unknown>
) {
  await post(record.url, record.payload);
  clearPendingChainRecord(record.url, record.payload);
}

export { eventName as pendingChainRecordsEvent };
