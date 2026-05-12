import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { connection, USDC_DEVNET, SOL_DEVNET, DEX_PROGRAM_ID } from '../lib/solanaService';
import { encodeInstructionData, encodeU64LE } from '../lib/anchorUtils';
import * as solanaWeb3 from '@solana/web3.js';
import './Page.css';

const SwapRouterPage: React.FC = () => {
  const { wallet, deployedTokens, pools } = useAppContext();
  const [fromMint, setFromMint] = useState('');
  const [toMint, setToMint] = useState('');
  const [swapAmount, setSwapAmount] = useState('');
  const [swapResult, setSwapResult] = useState('↻ Select tokens and amount');
  const [swapExecuteStatus, setSwapExecuteStatus] = useState('');

  const allTokens = [
    { symbol: 'USDC', mint: USDC_DEVNET },
    { symbol: 'SOL', mint: SOL_DEVNET },
    ...deployedTokens,
  ];

  const handleEstimateSwap = () => {
    if (!fromMint || !toMint || !swapAmount) {
      setSwapResult('Enter mint addresses & amount');
      return;
    }

    const amount = parseFloat(swapAmount);
    const pool = pools.find(
      (p) =>
        (p.tokenA === fromMint && p.tokenB === toMint) ||
        (p.tokenA === toMint && p.tokenB === fromMint)
    );

    if (!pool) {
      setSwapResult('No pool for this pair');
      return;
    }

    const isAtoB = pool.tokenA === fromMint;
    const reserveIn = isAtoB ? pool.reserveA : pool.reserveB;
    const reserveOut = isAtoB ? pool.reserveB : pool.reserveA;
    const amountOut =
      (amount * (10000 - pool.fee)) / 10000 / (reserveIn + (amount * (10000 - pool.fee)) / 10000) * reserveOut;

    setSwapResult(`↻ ESTIMATED: ${amountOut.toFixed(6)} tokens (fee ${pool.fee / 100}%)`);
  };

  const handleExecuteSwap = async () => {
    if (!wallet) {
      alert('Connect wallet');
      return;
    }

    if (!fromMint || !toMint || !swapAmount) {
      setSwapExecuteStatus('Enter all swap details');
      return;
    }

    const amount = parseFloat(swapAmount);
    const pool = pools.find(
      (p) =>
        (p.tokenA === fromMint && p.tokenB === toMint) ||
        (p.tokenA === toMint && p.tokenB === fromMint)
    );

    if (!pool) {
      setSwapExecuteStatus('No pool found for this pair');
      return;
    }

    setSwapExecuteStatus('⏳ Executing swap...');

    try {
      const isAtoB = pool.tokenA === fromMint;
      const reserveIn = isAtoB ? pool.reserveA : pool.reserveB;
      const reserveOut = isAtoB ? pool.reserveB : pool.reserveA;
      const amountOut =
        (amount * (10000 - pool.fee)) / 10000 / (reserveIn + (amount * (10000 - pool.fee)) / 10000) * reserveOut;

      const blockhashData = await connection.getLatestBlockhash('confirmed');
      const transaction = new solanaWeb3.Transaction({
        recentBlockhash: blockhashData.blockhash,
        feePayer: wallet.publicKey,
      });

      // Encode swap instruction: amount_in (u64) + minimum_amount_out (u64)
      const amountInData = encodeU64LE(BigInt(Math.floor(amount * 1e9)));
      const minimumOutData = encodeU64LE(BigInt(Math.floor(amountOut * 1e9)));
      const swapData = Buffer.concat([amountInData, minimumOutData]);
      const swapInstructionData = encodeInstructionData('swap', new Uint8Array(swapData));

      const swapIx = new solanaWeb3.TransactionInstruction({
        programId: new solanaWeb3.PublicKey(DEX_PROGRAM_ID),
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: new solanaWeb3.PublicKey(pool.poolAddress), isSigner: false, isWritable: true },
          { pubkey: new solanaWeb3.PublicKey(fromMint), isSigner: false, isWritable: false },
          { pubkey: new solanaWeb3.PublicKey(toMint), isSigner: false, isWritable: false },
        ],
        data: swapInstructionData,
      });

      transaction.add(swapIx);

      setSwapExecuteStatus('⏳ Waiting for wallet signature...');
      const signed = await wallet.signTransaction(transaction);

      setSwapExecuteStatus('⏳ Sending swap transaction...');
      const signature = await connection.sendRawTransaction(signed.serialize());

      setSwapExecuteStatus('⏳ Waiting for confirmation...');
      await connection.confirmTransaction(
        {
          signature,
          blockhash: blockhashData.blockhash,
          lastValidBlockHeight: blockhashData.lastValidBlockHeight,
        },
        'confirmed'
      );

      setSwapExecuteStatus(
        `✅ Swap executed! Sent: ${amount} | Received: ${amountOut.toFixed(6)}<br>🔗 <a href="https://explorer.solana.com/tx/${signature}?cluster=devnet" target="_blank" style="color:#6C9BD2">View Tx</a>`
      );
      setFromMint('');
      setToMint('');
      setSwapAmount('');
      setSwapResult('↻ Swap cleared — enter new pair');
    } catch (e: any) {
      setSwapExecuteStatus(`❌ Swap failed: ${e.message}`);
      console.error('Swap error:', e);
    }
  };

  return (
    <div className="dex-card">
      <div className="card-header">
        <span className="card-title">SMART SWAP ROUTER</span>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>FROM TOKEN (SYMBOL/MINT)</label>
          <select value={fromMint} onChange={(e) => setFromMint(e.target.value)}>
            <option value="">— SELECT TOKEN —</option>
            {allTokens.map((t) => (
              <option key={t.mint} value={t.mint}>
                {t.symbol} ({t.mint.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>TO TOKEN (SYMBOL/MINT)</label>
          <select value={toMint} onChange={(e) => setToMint(e.target.value)}>
            <option value="">— SELECT TOKEN —</option>
            {allTokens.map((t) => (
              <option key={t.mint} value={t.mint}>
                {t.symbol} ({t.mint.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>AMOUNT</label>
          <input
            type="number"
            value={swapAmount}
            onChange={(e) => setSwapAmount(e.target.value)}
            placeholder="0.0"
          />
        </div>
      </div>

      <button className="action-button" onClick={handleEstimateSwap}>
        ESTIMATE OUTPUT
      </button>
      <button className="action-button" onClick={handleExecuteSwap}>
        EXECUTE SWAP
      </button>

      <div className="status-area" dangerouslySetInnerHTML={{ __html: swapResult }} />
      <div className="status-area" dangerouslySetInnerHTML={{ __html: swapExecuteStatus }} />
    </div>
  );
};

export default SwapRouterPage;
