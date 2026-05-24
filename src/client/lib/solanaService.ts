export async function connectWallet(): Promise<any> {
  const win = window as any;
  if (!win.solana) {
    throw new Error("Please install Phantom wallet");
  }
  await win.solana.connect();
  return win.solana;
}

export async function getTokenMetadata(mint: string): Promise<any> {
  try {
    const { PublicKey, Connection } = await import("@solana/web3.js");

    const connection = new Connection("https://api.mainnet-beta.solana.com");
    const mintPubkey = new PublicKey(mint);

    const metadataPDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAqKEsbLmSQV5Jtecchesffsb").toBuffer(),
        mintPubkey.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAqKEsbLmSQV5Jtecchesffsb")
    )[0];

    const metadataAccount = await connection.getAccountInfo(metadataPDA);

    if (!metadataAccount) {
      return {
        mint: mint,
        name: "Unknown Token",
        symbol: "???",
        decimals: 0,
        fetched: false,
        timestamp: new Date().toISOString(),
      };
    }

    const buffer = metadataAccount.data;
    let offset = 0;
    offset += 1;
    offset += 32;
    offset += 32;

    const nameLength = buffer[offset];
    offset += 4;
    const name = buffer.slice(offset, offset + nameLength).toString('utf8');
    offset += nameLength;

    const symbolLength = buffer[offset];
    offset += 4;
    const symbol = buffer.slice(offset, offset + symbolLength).toString('utf8');

    return {
      mint: mint,
      name: name,
      symbol: symbol,
      decimals: 6,
      fetched: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Failed to fetch metadata for ${mint}:`, error);
    return {
      mint: mint,
      name: "Unknown Token",
      symbol: "???",
      decimals: 0,
      fetched: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

export async function getTokenHolders(mint: string): Promise<any[]> {
  try {
    const { PublicKey, Connection } = await import("@solana/web3.js");

    const connection = new Connection("https://api.mainnet-beta.solana.com");
    const mintPubkey = new PublicKey(mint);
    const tokenProgramId = new PublicKey("TokenkegQfeZyiNwAJsyFbPVwwQQfimJwWCmRJBn1g");

    const tokenAccounts = await connection.getProgramAccounts(tokenProgramId, {
      dataSlice: { offset: 0, length: 165 },
      filters: [
        { dataSize: 165 },
        { memcmp: { offset: 0, bytes: mintPubkey.toBase58() } },
      ],
    });

    return tokenAccounts
      .slice(0, 20)
      .map((account) => ({
        owner: account.pubkey.toString(),
        balance: "0",
        address: account.pubkey.toString(),
      }));
  } catch (error) {
    console.error(`Failed to fetch token holders for ${mint}:`, error);
    return [];
  }
}
