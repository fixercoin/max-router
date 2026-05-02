# MAX Router API Documentation

## Overview

MAX Router is a Solana DEX aggregator that finds the best routes across all major DEXs.

**Base URL:** `https://fixorium.com.pk/max/v1`

**Program ID:** `Fg1s6RyhV1otJ6M862xiTNy9D292haSM1YMtn6RcoMWb`

**Fee:** 0.01% (1 basis point)

## Authentication

All API requests require an API key in the header:
X-API-Key: your_api_key_here

text

## Get Your API Key

```bash
curl -X POST https://fixorium.com.pk/max/v1/developers \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "YOUR_WALLET_ADDRESS",
    "email": "developer@example.com",
    "companyName": "Your Company"
  }'
Response:

json
{
  "success": true,
  "apiKey": "max_abc123def456...",
  "apiSecret": "secret_key_here",
  "fee": {
    "bps": 1,
    "percentage": "0.01%",
    "recipient": "F9RJSJ4Fr2mLsQrZjemeg3PVMjG2KgjF9t5shZLHMnwG"
  }
}
Get Quote
bash
curl "https://fixorium.com.pk/max/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000" \
  -H "X-API-Key: your_api_key"
Response:

json
{
  "success": true,
  "quote": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "inAmount": "1000000",
    "outAmount": "999900",
    "fee": {
      "bps": 1,
      "percentage": "0.01%",
      "amount": "100",
      "recipient": "F9RJSJ4Fr2mLsQrZjemeg3PVMjG2KgjF9t5shZLHMnwG"
    }
  }
}
Build Swap Transaction
bash
curl -X POST https://fixorium.com.pk/max/v1/swap \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "userPublicKey": "END_USER_WALLET_ADDRESS",
    "quoteResponse": { ... },
    "wrapAndUnwrapSol": true
  }'
List API Keys
bash
curl "https://fixorium.com.pk/max/v1/keys" \
  -H "X-API-Key: your_api_key"
