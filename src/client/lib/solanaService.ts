import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccount } from "@solana/spl-token";
import idl from "../idl.json"; // Your IDL at root

// Constants
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
      throw new Error("DEX not initialized. Call initializeDex first.");
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

  // Helper: Get Token Metadata Address
  private async getTokenMetadataAddress(mint: PublicKey): Promise<PublicKey> {
    const [address] = await PublicKey.findProgramAddress(
      [Buffer.from("token_metadata"), mint.toBuffer()],
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
}

// Wallet Connection
export async function connectWallet(): Promise<any> {
  if (!window.solana) {
    throw new Error("Please install Phantom wallet");
  }
  const resp = await window.solana.connect();
  return resp;
}
