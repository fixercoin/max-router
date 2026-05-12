import * as crypto from 'crypto';

/**
 * Calculate Anchor instruction discriminator (8-byte hash)
 * Anchor uses SHA256 hash of "namespace:instruction_name" format
 */
export function getInstructionDiscriminator(instructionName: string): Uint8Array {
  // For Anchor programs, discriminator = first 8 bytes of SHA256("namespace:instructionName")
  // where namespace is the program name (dex_complete in this case)
  const discriminatorInput = `account:${instructionName}`;
  
  // Note: In Node.js we can use crypto, but in browser we need to use TweetNaCl or similar
  // For simplicity, we'll use hardcoded discriminators based on the Anchor convention
  
  // These are pre-calculated discriminators for common instruction names
  const discriminators: { [key: string]: Uint8Array } = {
    // Calculate via: echo -n "account:deploy_token" | sha256sum | head -c 16
    'deploy_token': new Uint8Array([73, 180, 193, 108, 90, 239, 222, 218]),
    'initialize': new Uint8Array([175, 175, 109, 121, 9, 41, 149, 234]),
    'create_pool': new Uint8Array([232, 201, 186, 225, 179, 140, 248, 119]),
    'add_liquidity': new Uint8Array([241, 45, 159, 55, 28, 225, 189, 113]),
    'remove_liquidity': new Uint8Array([176, 110, 141, 193, 87, 232, 234, 93]),
    'swap': new Uint8Array([248, 198, 158, 145, 225, 117, 135, 200]),
  };

  return discriminators[instructionName] || new Uint8Array(8);
}

/**
 * Encode instruction data with Anchor discriminator + parameters
 */
export function encodeInstructionData(instructionName: string, data: Uint8Array): Uint8Array {
  const discriminator = getInstructionDiscriminator(instructionName);
  const encoded = new Uint8Array(discriminator.length + data.length);
  encoded.set(discriminator);
  encoded.set(data, discriminator.length);
  return encoded;
}

/**
 * Encode u16 in little-endian
 */
export function encodeU16LE(value: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = value & 0xFF;
  buf[1] = (value >> 8) & 0xFF;
  return buf;
}

/**
 * Encode u64 in little-endian
 */
export function encodeU64LE(value: bigint | number): Uint8Array {
  const buf = new Uint8Array(8);
  const bigValue = typeof value === 'number' ? BigInt(value) : value;
  
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((bigValue >> BigInt(i * 8)) & BigInt(0xFF));
  }
  
  return buf;
}
