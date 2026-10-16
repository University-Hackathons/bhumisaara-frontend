const transferSingleTopic = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";

export function mintedTokenId(receipt: { logs?: readonly { topics?: readonly string[]; data?: string }[] }): string {
  for (const log of receipt.logs ?? []) {
    if (log.topics?.[0]?.toLowerCase() !== transferSingleTopic) continue;
    const data = log.data ?? "";
    if (!/^0x[0-9a-f]{128,}$/i.test(data)) continue;
    return BigInt(`0x${data.slice(2, 66)}`).toString();
  }
  throw new Error("The mint was confirmed, but its token ID could not be read from the receipt. Keep the transaction hash and contact support before minting again.");
}
