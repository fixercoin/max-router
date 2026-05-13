import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccount } from "@solana/spl-token";
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

  // 1. Initialize DEX
  async initializeDex(): Promise<string> {
    const dexKeypair = Keypair.generate();
    this.dexState = dexKeypair.publicKey;
    
    const tx = await this.program.methods
      .initializeDex(this.provider.wallet.publicKey)
      .accounts({
        authority: this.provider.wallet.publicKey,
        dexState: this.dexState,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([dexKeypair])
      .rpc();
    
    console.log("✅ DEX Initialized:", this.dexState.toString());
    return tx;
  }

  // 2. Deploy Token
  async deployToken(name: string, symbol: string, decimals: number): Promise<PublicKey> {
    if (!this.dexState) {
      const [address] = await PublicKey.findProgramAddress(
        [Buffer.from("dex_state")],
        DEX_PROGRAM_ID
      );
      this.dexState = address;
    }
    
    const mintKeypair = Keypair.generate();
    const metadataKeypair = Keypair.generate();
    
    await this.program.methods
      .deployToken(name, symbol, decimals)
      .accounts({
        authority: this.provider.wallet.publicKey,
        mint: mintKeypair.publicKey,
        tokenMetadata: metadataKeypair.publicKey,
        dexState: this.dexState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKeypair, metadataKeypair])
      .rpc();
    
    console.log("✅ Token Deployed:", mintKeypair.publicKey.toString());
    return mintKeypair.publicKey;
  }

  // 3. Mint Tokens
  async mintTokens(mint: PublicKey, amount: number): Promise<string> {
    const tokenAccount = await getAssociatedTokenAddress(mint, this.provider.wallet.publicKey);
    const metadataAddress = await this.getTokenMetadataAddress(mint);
    
    const tx = await this.program.methods
      .mintTokens(new anchor.BN(amount))
      .accounts({
        authority: this.provider.wallet.publicKey,
        mint: mint,
        tokenAccount: tokenAccount,
        tokenMetadata: metadataAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log("✅ Minted:", amount, "tokens");
    return tx;
  }

  // 4. Create Pool (ADD THIS)
  async createPool(tokenA: PublicKey, tokenB: PublicKey, feeBps: number): Promise<PublicKey> {
    if (!this.dexState) {
      const [address] = await PublicKey.findProgramAddress(
        [Buffer.from("dex_state")],
        DEX_PROGRAM_ID
      );
      this.dexState = address;
    }
    
    const poolKeypair = Keypair.generate();
    const tokenAVault = Keypair.generate();
    const tokenBVault = Keypair.generate();
    const lpMint = Keypair.generate();
    
    await this.program.methods
      .createPool(feeBps)
      .accounts({
        authority: this.provider.wallet.publicKey,
        pool: poolKeypair.publicKey,
        tokenA: tokenA,
        tokenB: tokenB,
        tokenAVault: tokenAVault.publicKey,
        tokenBVault: tokenBVault.publicKey,
        lpMint: lpMint.publicKey,
        dexState: this.dexState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([poolKeypair, tokenAVault, tokenBVault, lpMint])
      .rpc();
    
    console.log("✅ Pool Created:", poolKeypair.publicKey.toString());
    return poolKeypair.publicKey;
  }

  // 5. Add Liquidity (ADD THIS)
  async addLiquidity(
    pool: PublicKey, 
    amountA: number, 
    amountB: number, 
    tokenA: PublicKey, 
    tokenB: PublicKey
  ): Promise<string> {
    const poolAccount = await this.program.account.poolAccount.fetch(pool);
    const userTokenA = await getAssociatedTokenAddress(tokenA, this.provider.wallet.publicKey);
    const userTokenB = await getAssociatedTokenAddress(tokenB, this.provider.wallet.publicKey);
    const userLpToken = await getAssociatedTokenAddress(poolAccount.lpMint, this.provider.wallet.publicKey);
    
    const tx = await this.program.methods
      .addLiquidity(new anchor.BN(amountA), new anchor.BN(amountB))
      .accounts({
        user: this.provider.wallet.publicKey,
        userTokenA: userTokenA,
        userTokenB: userTokenB,
        userLpToken: userLpToken,
        pool: pool,
        poolTokenAVault: poolAccount.tokenAVault,
        poolTokenBVault: poolAccount.tokenBVault,
        lpMint: poolAccount.lpMint,
        poolAuthority: this.getPoolAuthorityAddress(pool),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Liquidity Added");
    return tx;
  }

  // 6. Remove Liquidity (ADD THIS)
  async removeLiquidity(pool: PublicKey, lpAmount: number): Promise<string> {
    const poolAccount = await this.program.account.poolAccount.fetch(pool);
    const userTokenA = await getAssociatedTokenAddress(poolAccount.tokenA, this.provider.wallet.publicKey);
    const userTokenB = await getAssociatedTokenAddress(poolAccount.tokenB, this.provider.wallet.publicKey);
    const userLpToken = await getAssociatedTokenAddress(poolAccount.lpMint, this.provider.wallet.publicKey);
    
    const tx = await this.program.methods
      .removeLiquidity(new anchor.BN(lpAmount))
      .accounts({
        user: this.provider.wallet.publicKey,
        userTokenA: userTokenA,
        userTokenB: userTokenB,
        userLpToken: userLpToken,
        pool: pool,
        poolTokenAVault: poolAccount.tokenAVault,
        poolTokenBVault: poolAccount.tokenBVault,
        lpMint: poolAccount.lpMint,
        poolAuthority: this.getPoolAuthorityAddress(pool),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Liquidity Removed");
    return tx;
  }

  // 7. Swap (ADD THIS)
  async swap(
    pool: PublicKey,
    tokenIn: PublicKey,
    tokenOut: PublicKey,
    amountIn: number,
    minAmountOut: number
  ): Promise<string> {
    const poolAccount = await this.program.account.poolAccount.fetch(pool);
    const userTokenIn = await getAssociatedTokenAddress(tokenIn, this.provider.wallet.publicKey);
    const userTokenOut = await getAssociatedTokenAddress(tokenOut, this.provider.wallet.publicKey);
    
    const tx = await this.program.methods
      .swap(new anchor.BN(amountIn), new anchor.BN(minAmountOut))
      .accounts({
        user: this.provider.wallet.publicKey,
        userTokenIn: userTokenIn,
        userTokenOut: userTokenOut,
        pool: pool,
        poolTokenAVault: poolAccount.tokenAVault,
        poolTokenBVault: poolAccount.tokenBVault,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        poolAuthority: this.getPoolAuthorityAddress(pool),
        dexState: this.dexState,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Swap Completed");
    return tx;
  }

  // 8. Verify Token (ADD THIS)
  async verifyToken(mint: PublicKey): Promise<string> {
    const metadataAddress = await this.getTokenMetadataAddress(mint);
    
    const tx = await this.program.methods
      .verifyToken()
      .accounts({
        authority: this.provider.wallet.publicKey,
        tokenMetadata: metadataAddress,
        dexState: this.dexState,
      })
      .rpc();
    
    console.log("✅ Token Verified");
    return tx;
  }

  // Helper: Get Token Metadata Address
  async getTokenMetadataAddress(mint: PublicKey): Promise<PublicKey> {
    const [address] = await PublicKey.findProgramAddress(
      [Buffer.from("token_metadata"), mint.toBuffer()],
      DEX_PROGRAM_ID
    );
    return address;
  }

  // Helper: Get Pool Authority PDA
  getPoolAuthorityAddress(pool: PublicKey): PublicKey {
    const [address] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), pool.toBuffer()],
      DEX_PROGRAM_ID
    );
    return address;
  }

  // Get DEX State
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

  // Get Pool Account
  async getPoolAccount(pool: PublicKey): Promise<any> {
    return this.program.account.poolAccount.fetch(pool);
  }

  // Get Token Metadata
  async getTokenMetadata(mint: PublicKey): Promise<any> {
    const metadataAddress = await this.getTokenMetadataAddress(mint);
    return this.program.account.tokenMetadata.fetch(metadataAddress);
  }
}

// Wallet Connection
export async function connectWallet(): Promise<any> {
  if (!window.solana) {
    throw new Error("Please install Phantom wallet");
  }
  const resp = await window.solana.connect();
  return window.solana;
}
