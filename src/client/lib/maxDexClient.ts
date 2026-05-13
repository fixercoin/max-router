import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import idl from '../../idl.json';

export const DEX_PROGRAM_ID = new PublicKey("36qH8uWkekoCa8qzFcBCkmZqUr9Y9JzFgtwct7RsJrTk");

interface PoolAccount {
  tokenA: PublicKey;
  tokenB: PublicKey;
  lpMint: PublicKey;
  tokenAVault: PublicKey;
  tokenBVault: PublicKey;
  feeAccount: PublicKey;
  feeBps: number;
  authority: PublicKey;
  lpTokenSupply: anchor.BN;
}

export class MaxDexClient {
  program: Program;
  provider: anchor.AnchorProvider;
  dexState: PublicKey | null = null;
  private lastTx: string = '';

  constructor(connection: Connection, wallet: any) {
    this.provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(this.provider);
    this.program = new Program(idl as any, DEX_PROGRAM_ID, this.provider);
  }

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
    
    this.lastTx = tx;
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
    const metadataKeypair = Keypair.generate();
    
    const tx = await this.program.methods
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
    
    this.lastTx = tx;
    return mintKeypair.publicKey;
  }

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
    
    this.lastTx = tx;
    return tx;
  }

  // ========== ADD THESE MISSING METHODS ==========

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
    
    const tx = await this.program.methods
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
    
    this.lastTx = tx;
    return poolKeypair.publicKey;
  }

  async addLiquidity(
    pool: PublicKey,
    amountA: number,
    amountB: number,
    tokenA: PublicKey,
    tokenB: PublicKey
  ): Promise<string> {
    const poolAccount = await this.program.account.poolAccount.fetch(pool) as PoolAccount;
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
    
    this.lastTx = tx;
    return tx;
  }

  async removeLiquidity(pool: PublicKey, lpAmount: number): Promise<string> {
    const poolAccount = await this.program.account.poolAccount.fetch(pool) as PoolAccount;
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
    
    this.lastTx = tx;
    return tx;
  }

  async swap(
    pool: PublicKey,
    tokenIn: PublicKey,
    tokenOut: PublicKey,
    amountIn: number,
    minAmountOut: number
  ): Promise<string> {
    const poolAccount = await this.program.account.poolAccount.fetch(pool) as PoolAccount;
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
    
    this.lastTx = tx;
    return tx;
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

  private async getTokenMetadataAddress(mint: PublicKey): Promise<PublicKey> {
    const [address] = await PublicKey.findProgramAddress(
      [Buffer.from("token_metadata"), mint.toBuffer()],
      DEX_PROGRAM_ID
    );
    return address;
  }

  private getPoolAuthorityAddress(pool: PublicKey): PublicKey {
    const [address] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), pool.toBuffer()],
      DEX_PROGRAM_ID
    );
    return address;
  }

  getLastTransaction(): string {
    return this.lastTx;
  }
}
