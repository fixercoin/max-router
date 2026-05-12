import * as solanaWeb3 from '@solana/web3.js';

export const connection = new solanaWeb3.Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

export const USDC_DEVNET = 'EPjFWaLb3hyccqJ1yckQWNufZi8MWYrrT4yfzJstd6M';
export const SOL_DEVNET = 'So11111111111111111111111111111111111111112';
export const DEX_PROGRAM_ID = '36qH8uWkekoCa8qzFcBCkmZqUr9Y9JzFgtwct7RsJrTk';
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

export async function connectWallet(): Promise<any> {
  if (!window.solana) {
    throw new Error('No wallet extension found');
  }
  const resp = await window.solana.connect();
  return window.solana;
}

export async function getTokenMetadata(mint: string) {
  try {
    const response = await fetch('https://api.devnet.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenSupply',
        params: [mint],
      }),
    });
    const data = await response.json();
    if (data.result) return data.result.value;
    return null;
  } catch (e) {
    console.error('Metadata fetch failed:', e);
    return null;
  }
}

export async function getTokenHolders(mint: string) {
  try {
    const response = await fetch('https://api.devnet.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getProgramAccounts',
        params: [
          TOKEN_PROGRAM_ID,
          {
            encoding: 'jsonParsed',
            filters: [
              { dataSize: 165 },
              { memcmp: { offset: 0, bytes: mint } },
            ],
          },
        ],
      }),
    });
    const data = await response.json();
    if (data.result) return data.result;
    return [];
  } catch (e) {
    console.error('Holders fetch failed:', e);
    return [];
  }
}
