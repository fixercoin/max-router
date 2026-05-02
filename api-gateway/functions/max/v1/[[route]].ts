export interface Env {
  DEVELOPERS_KV: KVNamespace;
  API_KEYS_KV: KVNamespace;
  USAGE_KV: KVNamespace;
}

const PLATFORM_FEE_BPS = 1;
const FEE_RECIPIENT = "F9RJSJ4Fr2mLsQrZjemeg3PVMjG2KgjF9t5shZLHMnwG";
const MAX_ROUTER_PROGRAM_ID = "Fg1s6RyhV1otJ6M862xiTNy9D292haSM1YMtn6RcoMWb";

// ============================================
// POST /max/v1/developers - Register Developer
// ============================================

export async function onRequestPost_developers(request: Request, env: Env) {
  const { walletAddress, email, companyName } = await request.json();
  
  if (!walletAddress) {
    return Response.json({ error: 'Wallet address required' }, { status: 400 });
  }
  
  const developerId = crypto.randomUUID();
  const apiKey = `max_${crypto.randomUUID().replace(/-/g, '')}`;
  const apiSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const developer = {
    id: developerId,
    walletAddress,
    email: email || '',
    companyName: companyName || '',
    status: 'active',
    createdAt: Date.now(),
  };
  
  const keyData = {
    id: crypto.randomUUID(),
    developerId,
    apiKey,
    apiSecret,
    name: 'Primary Key',
    rateLimitRps: 10,
    status: 'active',
    createdAt: Date.now(),
  };
  
  await env.DEVELOPERS_KV.put(`dev:${developerId}`, JSON.stringify(developer));
  await env.API_KEYS_KV.put(`key:${apiKey}`, JSON.stringify(keyData));
  
  return Response.json({
    success: true,
    message: 'MAX Router API credentials created',
    apiKey,
    apiSecret,
    fee: {
      bps: PLATFORM_FEE_BPS,
      percentage: '0.01%',
      recipient: FEE_RECIPIENT
    },
    programId: MAX_ROUTER_PROGRAM_ID,
    endpoints: {
      quote: 'https://fixorium.com.pk/max/v1/quote',
      swap: 'https://fixorium.com.pk/max/v1/swap',
      dashboard: 'https://fixorium.com.pk/max/dashboard'
    }
  });
}

// ============================================
// GET /max/v1/quote - Get Swap Quote
// ============================================

export async function onRequestGet_quote(request: Request, env: Env) {
  const apiKey = request.headers.get('X-API-Key');
  
  if (!apiKey) {
    return Response.json({ error: 'Missing X-API-Key header' }, { status: 401 });
  }
  
  const keyData = await env.API_KEYS_KV.get(`key:${apiKey}`, 'json');
  if (!keyData || keyData.status !== 'active') {
    return Response.json({ error: 'Invalid or inactive API key' }, { status: 401 });
  }
  
  const url = new URL(request.url);
  const inputMint = url.searchParams.get('inputMint');
  const outputMint = url.searchParams.get('outputMint');
  const amount = url.searchParams.get('amount');
  const slippageBps = parseInt(url.searchParams.get('slippage') || '100');
  
  if (!inputMint || !outputMint || !amount) {
    return Response.json({ 
      error: 'Missing required parameters: inputMint, outputMint, amount' 
    }, { status: 400 });
  }
  
  // Calculate 0.01% fee
  const amountIn = BigInt(amount);
  const feeAmount = (amountIn * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);
  const amountOut = amountIn - feeAmount;
  
  // Track API usage
  const today = new Date().toISOString().slice(0, 10);
  const usageKey = `usage:${apiKey}:${today}`;
  const currentUsage = await env.USAGE_KV.get(usageKey, 'json') || { count: 0 };
  currentUsage.count++;
  await env.USAGE_KV.put(usageKey, JSON.stringify(currentUsage));
  
  return Response.json({
    success: true,
    quote: {
      inputMint,
      outputMint,
      inAmount: amount,
      outAmount: amountOut.toString(),
      fee: {
        bps: PLATFORM_FEE_BPS,
        percentage: '0.01%',
        amount: feeAmount.toString(),
        recipient: FEE_RECIPIENT
      },
      slippageBps,
      programId: MAX_ROUTER_PROGRAM_ID
    }
  });
}

// ============================================
// POST /max/v1/swap - Build Swap Transaction
// ============================================

export async function onRequestPost_swap(request: Request, env: Env) {
  const apiKey = request.headers.get('X-API-Key');
  
  if (!apiKey) {
    return Response.json({ error: 'Missing X-API-Key header' }, { status: 401 });
  }
  
  const keyData = await env.API_KEYS_KV.get(`key:${apiKey}`, 'json');
  if (!keyData || keyData.status !== 'active') {
    return Response.json({ error: 'Invalid or inactive API key' }, { status: 401 });
  }
  
  const { userPublicKey, quoteResponse, wrapAndUnwrapSol = true } = await request.json();
  
  if (!userPublicKey || !quoteResponse) {
    return Response.json({ 
      error: 'Missing required fields: userPublicKey, quoteResponse' 
    }, { status: 400 });
  }
  
  // Build transaction response
  const response = {
    success: true,
    programId: MAX_ROUTER_PROGRAM_ID,
    swapTransaction: "base64_encoded_transaction_here",
    fee: quoteResponse.fee,
    instructions: [
      {
        programId: MAX_ROUTER_PROGRAM_ID,
        data: "execute_swap_instruction_data"
      }
    ],
    lastValidBlockHeight: Date.now() + 60000,
    computeUnitLimit: 200000
  };
  
  return Response.json(response);
}

// ============================================
// GET /max/v1/keys - List API Keys
// ============================================

export async function onRequestGet_keys(request: Request, env: Env) {
  const apiKey = request.headers.get('X-API-Key');
  const keyData = await env.API_KEYS_KV.get(`key:${apiKey}`, 'json');
  
  if (!keyData) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }
  
  const allKeys = await env.API_KEYS_KV.list({ prefix: `key:` });
  const keys = [];
  
  for (const key of allKeys.keys) {
    const data = await env.API_KEYS_KV.get(key.name, 'json');
    if (data && data.developerId === keyData.developerId) {
      keys.push({
        id: data.id,
        name: data.name,
        apiKey: data.apiKey.slice(0, 12) + '...',
        createdAt: data.createdAt,
        rateLimitRps: data.rateLimitRps,
        status: data.status,
      });
    }
  }
  
  const developer = await env.DEVELOPERS_KV.get(`dev:${keyData.developerId}`, 'json');
  
  return Response.json({
    success: true,
    developer: {
      id: developer.id,
      walletAddress: developer.walletAddress,
      email: developer.email,
    },
    keys,
    platform: {
      name: 'MAX Router',
      website: 'https://fixorium.com.pk',
      apiEndpoint: 'https://fixorium.com.pk/max/v1',
      fee: '0.01%',
      programId: MAX_ROUTER_PROGRAM_ID,
      docs: 'https://fixorium.com.pk/max/docs'
    }
  });
}

// ============================================
// DELETE /max/v1/keys/:keyId - Revoke API Key
// ============================================

export async function onRequestDelete_keys(request: Request, env: Env) {
  const url = new URL(request.url);
  const keyId = url.pathname.split('/').pop();
  const apiKey = request.headers.get('X-API-Key');
  
  const keyData = await env.API_KEYS_KV.get(`key:${apiKey}`, 'json');
  if (!keyData) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }
  
  // Find and delete the key
  const allKeys = await env.API_KEYS_KV.list({ prefix: `key:` });
  for (const key of allKeys.keys) {
    const data = await env.API_KEYS_KV.get(key.name, 'json');
    if (data && data.id === keyId && data.developerId === keyData.developerId) {
      await env.API_KEYS_KV.delete(key.name);
      return Response.json({ success: true, message: 'API key revoked' });
    }
  }
  
  return Response.json({ error: 'API key not found' }, { status: 404 });
}
