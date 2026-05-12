import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// Your program's discriminators (calculated from your Anchor program)
// These are the first 8 bytes of SHA256("global:instruction_name")
export const INSTRUCTION_DISCRIMINATORS = {
  initializeDex: Buffer.from([47, 160, 204, 110, 67, 45, 199, 174]),   // global:initializeDex
  deployToken: Buffer.from([105, 21, 224, 158, 156, 94, 210, 114]),     // global:deployToken
  mintTokens: Buffer.from([141, 136, 106, 171, 120, 35, 244, 107]),      // global:mintTokens
  createPool: Buffer.from([245, 23, 79, 197, 168, 41, 127, 15]),         // global:createPool
  addLiquidity: Buffer.from([181, 112, 176, 38, 32, 96, 165, 98]),       // global:addLiquidity
  removeLiquidity: Buffer.from([167, 181, 201, 21, 237, 182, 60, 6]),    // global:removeLiquidity
  swap: Buffer.from([248, 198, 158, 145, 225, 117, 135, 200]),            // global:swap
  verifyToken: Buffer.from([165, 24, 37, 91, 224, 42, 206, 11]),          // global:verifyToken
};

export function encodeInstructionData(instructionName: string, ...args: any[]): Buffer {
  const discriminator = INSTRUCTION_DISCRIMINATORS[instructionName];
  if (!discriminator) throw new Error(`Unknown instruction: ${instructionName}`);
  
  let data = Buffer.from(discriminator);
  
  // Encode parameters based on instruction
  switch(instructionName) {
    case 'initializeDex':
      // args[0] = dexAuthority (PublicKey)
      data = Buffer.concat([data, args[0].toBuffer()]);
      break;
      
    case 'deployToken':
      // args[0] = name (string), args[1] = symbol (string), args[2] = decimals (u8)
      data = Buffer.concat([
        data,
        encodeString(args[0]),  // name
        encodeString(args[1]),  // symbol
        Buffer.from([args[2]])  // decimals
      ]);
      break;
      
    case 'mintTokens':
      // args[0] = amount (u64)
      data = Buffer.concat([data, encodeU64(args[0])]);
      break;
      
    case 'createPool':
      // args[0] = feeBps (u16)
      data = Buffer.concat([data, encodeU16(args[0])]);
      break;
      
    case 'addLiquidity':
      // args[0] = amountA (u64), args[1] = amountB (u64)
      data = Buffer.concat([data, encodeU64(args[0]), encodeU64(args[1])]);
      break;
      
    case 'removeLiquidity':
      // args[0] = lpAmount (u64)
      data = Buffer.concat([data, encodeU64(args[0])]);
      break;
      
    case 'swap':
      // args[0] = amountIn (u64), args[1] = minAmountOut (u64)
      data = Buffer.concat([data, encodeU64(args[0]), encodeU64(args[1])]);
      break;
  }
  
  return data;
}

function encodeString(str: string): Buffer {
  const strBuffer = Buffer.from(str, 'utf8');
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32LE(strBuffer.length);
  return Buffer.concat([lenBuffer, strBuffer]);
}

function encodeU16(value: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value);
  return buf;
}

function encodeU64(value: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  const bigVal = BigInt(value);
  buf.writeBigUInt64LE(bigVal);
  return buf;
}
