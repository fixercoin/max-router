export async function connectWallet(): Promise<any> {
  const win = window as any;
  if (!win.solana) {
    throw new Error("Please install Phantom wallet");
  }
  await win.solana.connect();
  return win.solana;
}

export async function getTokenMetadata(mint: string): Promise<any> {
  return {
    mint: mint,
    fetched: true,
    timestamp: new Date().toISOString(),
  };
}

export async function getTokenHolders(_mint: string): Promise<any[]> {
  return [];
}
