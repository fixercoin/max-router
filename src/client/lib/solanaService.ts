import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import idl from "../../idl.json";

export const DEX_PROGRAM_ID = new PublicKey("36qH8uWkekoCa8qzFcBCkmZqUr9Y9JzFgtwct7RsJrTk");
export const USDC_DEVNET = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

export class MaxDexClient {
  program: Program;
  provider: anchor.AnchorProvider;
  dexState: PublicKey | null = null;

  constructor(connection: Connection, wallet: any) {
    this.provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(this.provider);
    this.program = new Program(idl as any, DEX_PROGRAM_ID, this.provider);
  }

  async initializeDex(): Promise<string> {
    const [dexState] = await PublicKey.findProgramAddress(
      [Buffer.from("dex_state")],
      DEX_PROGRAM_ID
    );
    this.dexState = dexState;
    
    const tx = await this.program.methods
      .initializeDex(this.provider.wallet.publicKey)
      .accounts({
        authority: this.provider.wallet.publicKey,
        dexState: dexState,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ DEX Initialized:", dexState.toString());
    return tx;
  }

  async deployToken(name: string, symbol: string, decimals: number): Promise<PublicKey> {
    if (!this.dexState) {
      const [address] = await PublicKey.findProgramAddress(
        [Buffer.from("dex_state")],
        DEX_PROGRAM_ID
      );
      this.dexState = address;
    }
    
    const mintKeypair = Keypair.generate();
    const [tokenMetadata] = await PublicKey.findProgramAddress(
      [Buffer.from("token_metadata"), mintKeypair.publicKey.toBuffer()],
      DEX_PROGRAM_ID
    );
    
    await this.program.methods
      .deployToken(name, symbol, decimals)
      .accounts({
        authority: this.provider.wallet.publicKey,
        mint: mintKeypair.publicKey,
        tokenMetadata: tokenMetadata,
        dexState: this.dexState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKeypair])
      .rpc();
    
    console.log("✅ Token Deployed:", mintKeypair.publicKey.toString());
    return mintKeypair.publicKey;
  }

  async mintTokens(mint: PublicKey, amount: number): Promise<string> {
    const tokenAccount = await getAssociatedTokenAddress(mint, this.provider.wallet.publicKey);
    const [tokenMetadata] = await PublicKey.findProgramAddress(
      [Buffer.from("token_metadata"), mint.toBuffer()],
      DEX_PROGRAM_ID
    );
    
    const tx = await this.program.methods
      .mintTokens(new anchor.BN(amount))
      .accounts({
        authority: this.provider.wallet.publicKey,
        mint: mint,
        tokenAccount: tokenAccount,
        tokenMetadata: tokenMetadata,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log("✅ Minted:", amount, "tokens");
    return tx;
  }

  async createPool(tokenA: PublicKey, tokenB: PublicKey, feeBps: number): Promise<PublicKey> {
    if (!this.dexState) {
      const [address] = await PublicKey.findProgramAddress(
        [Buffer.from("dex_state")],
        DEX_PROGRAM_ID
      );
      this.dexState = address;
    }
    
    const [pool] = await PublicKey.findProgramAddress(
      [Buffer.from("pool"), tokenA.toBuffer(), tokenB.toBuffer()],
      DEX_PROGRAM_ID
    );
    
    const [poolAuthority] = await PublicKey.findProgramAddress(
      [Buffer.from("pool_authority"), pool.toBuffer()],
      DEX_PROGRAM_ID
    );

    const lpMintKeypair = Keypair.generate();
    const tokenAVaultKeypair = Keypair.generate();
    const tokenBVaultKeypair = Keypair.generate();
    
    await this.program.methods
      .createPool(feeBps)
      .accounts({
        authority: this.provider.wallet.publicKey,
        pool: pool,
        tokenA: tokenA,
        tokenB: tokenB,
        tokenAVault: tokenAVaultKeypair.publicKey,
        tokenBVault: tokenBVaultKeypair.publicKey,
        lpMint: lpMintKeypair.publicKey,
        poolAuthority: poolAuthority,
        dexState: this.dexState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([lpMintKeypair, tokenAVaultKeypair, tokenBVaultKeypair])
      .rpc();
    
    console.log("✅ Pool Created:", pool.toString());
    return pool;
  }

  async addLiquidity(
    pool: PublicKey,
    amountA: number,
    amountB: number,
    tokenA: PublicKey,
    tokenB: PublicKey
  ): Promise<string> {
    const poolAccount = await this.program.account.poolAccount.fetch(pool) as any;
    const userTokenA = await getAssociatedTokenAddress(tokenA, this.provider.wallet.publicKey);
    const userTokenB = await getAssociatedTokenAddress(tokenB, this.provider.wallet.publicKey);
    const userLpToken = await getAssociatedTokenAddress(poolAccount.lpMint as PublicKey, this.provider.wallet.publicKey);
    const poolAuthority = this.getPoolAuthorityAddress(pool);

    const tx = await this.program.methods
      .addLiquidity(new anchor.BN(amountA), new anchor.BN(amountB))
      .accounts({
        user: this.provider.wallet.publicKey,
        userTokenA: userTokenA,
        userTokenB: userTokenB,
        userLpToken: userLpToken,
        pool: pool,
        poolTokenAVault: poolAccount.tokenAVault as PublicKey,
        poolTokenBVault: poolAccount.tokenBVault as PublicKey,
        lpMint: poolAccount.lpMint as PublicKey,
        poolAuthority: poolAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();
    
    console.log("✅ Liquidity Added");
    return tx;
  }

  async removeLiquidity(pool: PublicKey, lpAmount: number): Promise<string> {
    const poolAccount = await this.program.account.poolAccount.fetch(pool) as any;
    const userTokenA = await getAssociatedTokenAddress(poolAccount.tokenA as PublicKey, this.provider.wallet.publicKey);
    const userTokenB = await getAssociatedTokenAddress(poolAccount.tokenB as PublicKey, this.provider.wallet.publicKey);
    const userLpToken = await getAssociatedTokenAddress(poolAccount.lpMint as PublicKey, this.provider.wallet.publicKey);
    const poolAuthority = this.getPoolAuthorityAddress(pool);

    const tx = await this.program.methods
      .removeLiquidity(new anchor.BN(lpAmount))
      .accounts({
        user: this.provider.wallet.publicKey,
        userTokenA: userTokenA,
        userTokenB: userTokenB,
        userLpToken: userLpToken,
        pool: pool,
        poolTokenAVault: poolAccount.tokenAVault as PublicKey,
        poolTokenBVault: poolAccount.tokenBVault as PublicKey,
        lpMint: poolAccount.lpMint as PublicKey,
        poolAuthority: poolAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();
    
    console.log("✅ Liquidity Removed");
    return tx;
  }

  async swap(
    pool: PublicKey,
    tokenIn: PublicKey,
    tokenOut: PublicKey,
    amountIn: number,
    minAmountOut: number
  ): Promise<string> {
    if (!this.dexState) {
      const [address] = await PublicKey.findProgramAddress(
        [Buffer.from("dex_state")],
        DEX_PROGRAM_ID
      );
      this.dexState = address;
    }

    const poolAccount = await this.program.account.poolAccount.fetch(pool) as any;
    const userTokenIn = await getAssociatedTokenAddress(tokenIn, this.provider.wallet.publicKey);
    const userTokenOut = await getAssociatedTokenAddress(tokenOut, this.provider.wallet.publicKey);
    const poolAuthority = this.getPoolAuthorityAddress(pool);

    const tx = await this.program.methods
      .swap(new anchor.BN(amountIn), new anchor.BN(minAmountOut))
      .accounts({
        user: this.provider.wallet.publicKey,
        userTokenIn: userTokenIn,
        userTokenOut: userTokenOut,
        pool: pool,
        poolTokenAVault: poolAccount.tokenAVault as PublicKey,
        poolTokenBVault: poolAccount.tokenBVault as PublicKey,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        poolAuthority: poolAuthority,
        dexState: this.dexState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();
    
    console.log("✅ Swap Completed");
    return tx;
  }

  async verifyToken(mint: PublicKey): Promise<string> {
    if (!this.dexState) {
      const [address] = await PublicKey.findProgramAddress(
        [Buffer.from("dex_state")],
        DEX_PROGRAM_ID
      );
      this.dexState = address;
    }

    const [tokenMetadata] = await PublicKey.findProgramAddress(
      [Buffer.from("token_metadata"), mint.toBuffer()],
      DEX_PROGRAM_ID
    );

    const tx = await this.program.methods
      .verifyToken()
      .accounts({
        authority: this.provider.wallet.publicKey,
        tokenMetadata: tokenMetadata,
        dexState: this.dexState,
      })
      .rpc();
    
    console.log("✅ Token Verified");
    return tx;
  }

  async getTokenMetadataAddress(mint: PublicKey): Promise<PublicKey> {
    const [address] = await PublicKey.findProgramAddress(
      [Buffer.from("token_metadata"), mint.toBuffer()],
      DEX_PROGRAM_ID
    );
    return address;
  }

  private getPoolAuthorityAddress(pool: PublicKey): PublicKey {
    const [address] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority"), pool.toBuffer()],
      DEX_PROGRAM_ID
    );
    return address;
  }

  async getPoolAddress(tokenA: PublicKey, tokenB: PublicKey): Promise<PublicKey> {
    const [address] = await PublicKey.findProgramAddress(
      [Buffer.from("pool"), tokenA.toBuffer(), tokenB.toBuffer()],
      DEX_PROGRAM_ID
    );
    return address;
  }

  async getDexState(): Promise<any> {
    if (!this.dexState) {
      const [address] = await PublicKey.findProgramAddress(
        [Buffer.from("dex_state")],
        DEX_PROGRAM_ID
      );
      this.dexState = address;
    }
    return this.program.account.dexState.fetch(this.dexState);
  }

  async getPoolAccount(pool: PublicKey): Promise<any> {
    return this.program.account.poolAccount.fetch(pool);
  }

  async getTokenMetadata(mint: PublicKey): Promise<any> {
    const metadataAddress = await this.getTokenMetadataAddress(mint);
    return this.program.account.tokenMetadata.fetch(metadataAddress);
  }
}

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
