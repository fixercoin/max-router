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
    const { getMint } = await import("@solana/spl-token");

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
    const mintAccount = await getMint(connection, mintPubkey);

    if (!metadataAccount) {
      return {
        mint: mint,
        name: "Unknown Token",
        symbol: "???",
        decimals: Number(mintAccount.decimals),
        fetched: false,
        timestamp: new Date().toISOString(),
      };
    }

    const buffer = metadataAccount.data;
    let offset = 0;
    offset += 1;
    offset += 32;
    offset += 32;

    const nameLength = buffer.readUInt32LE(offset);
    offset += 4;
    const name = buffer.slice(offset, offset + nameLength).toString('utf8');
    offset += nameLength;

    const symbolLength = buffer.readUInt32LE(offset);
    offset += 4;
    const symbol = buffer.slice(offset, offset + symbolLength).toString('utf8');

    return {
      mint: mint,
      name: name.trim(),
      symbol: symbol.trim(),
      decimals: Number(mintAccount.decimals),
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
      .map((account) => {
        const data = account.account.data;
        const ownerOffset = 32;
        const ownerPubkey = new PublicKey(data.slice(ownerOffset, ownerOffset + 32));

        const amountOffset = 64;
        const amount = data.readBigUInt64LE(amountOffset);

        return {
          owner: ownerPubkey.toString(),
          address: account.pubkey.toString(),
          balance: amount.toString(),
        };
      });
  } catch (error) {
    console.error(`Failed to fetch token holders for ${mint}:`, error);
    return [];
  }
}
