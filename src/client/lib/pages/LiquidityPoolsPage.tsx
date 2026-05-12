import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { connection, USDC_DEVNET, DEX_PROGRAM_ID } from '../lib/solanaService';
import { encodeInstructionData, encodeU16LE, encodeU64LE } from '../lib/anchorUtils';
import * as solanaWeb3 from '@solana/web3.js';
import './Page.css';

const LiquidityPoolsPage: React.FC = () => {
  const { wallet, deployedTokens, pools, setPools } = useAppContext();
  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState(USDC_DEVNET);
  const [fee, setFee] = useState(30);
  const [poolStatus, setPoolStatus] = useState('');
  const [selectedPoolIdx, setSelectedPoolIdx] = useState('');
  const [addLiqAmount, setAddLiqAmount] = useState('');
  const [removeLpAmount, setRemoveLpAmount] = useState('');
  const [liquidityStatus, setLiquidityStatus] = useState('');

  const handleCreatePool = async () => {
    if (!wallet) {
      alert('Connect wallet');
      return;
    }

    if (!tokenA || !tokenB) {
      alert('Enter token mint addresses');
      return;
    }

    if (!solanaWeb3.PublicKey.isOnCurve(tokenA) || !solanaWeb3.PublicKey.isOnCurve(tokenB)) {
      alert('Invalid token addresses');
      return;
    }

    setPoolStatus('⏳ Creating pool on DEX program...');

    try {
      const poolKeypair = solanaWeb3.Keypair.generate();
      const blockhashData = await connection.getLatestBlockhash('confirmed');

      const transaction = new solanaWeb3.Transaction({
        recentBlockhash: blockhashData.blockhash,
        feePayer: wallet.publicKey,
      });

      // Encode instruction data: fee (u16)
      const feeData = encodeU16LE(fee);
      const instructionData = encodeInstructionData('create_pool', feeData);

      const createPoolIx = new solanaWeb3.TransactionInstruction({
        programId: new solanaWeb3.PublicKey(DEX_PROGRAM_ID),
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: poolKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: new solanaWeb3.PublicKey(tokenA), isSigner: false, isWritable: false },
          { pubkey: new solanaWeb3.PublicKey(tokenB), isSigner: false, isWritable: false },
          { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(instructionData),
      });

      transaction.add(createPoolIx);
      transaction.partialSign(poolKeypair);

      setPoolStatus('⏳ Waiting for wallet signature...');
      const signed = await wallet.signTransaction(transaction);

      setPoolStatus('⏳ Sending transaction...');
      const signature = await connection.sendRawTransaction(signed.serialize());

      setPoolStatus('⏳ Waiting for confirmation...');
      await connection.confirmTransaction(
        {
          signature,
          blockhash: blockhashData.blockhash,
          lastValidBlockHeight: blockhashData.lastValidBlockHeight,
        },
        'confirmed'
      );

      const tokenAData = deployedTokens.find((t) => t.mint === tokenA);
      const tokenBData = deployedTokens.find((t) => t.mint === tokenB);
      const symbolA = tokenAData ? tokenAData.symbol : tokenA.slice(0, 6);
      const symbolB = tokenBData ? tokenBData.symbol : tokenB.slice(0, 6);

      const newPools = [
        ...pools,
        {
          tokenA,
          tokenB,
          symbolA,
          symbolB,
          fee,
          poolAddress: poolKeypair.publicKey.toString(),
          txid: signature,
          reserveA: 0,
          reserveB: 0,
          totalLp: 0,
        },
      ];
      setPools(newPools);
      localStorage.setItem('MAX_pools', JSON.stringify(newPools));

      setPoolStatus(
        `✅ Pool created: ${symbolA}/${symbolB} | fee: ${fee / 100}%<br>🔗 <a href="https://explorer.solana.com/tx/${signature}?cluster=devnet" target="_blank" style="color:#6C9BD2">View Tx</a>`
      );
      setTokenA('');
    } catch (e: any) {
      setPoolStatus(`❌ Pool creation failed: ${e.message}`);
    }
  };

  const handleAddLiquidity = async () => {
    if (!wallet) {
      alert('Connect wallet');
      return;
    }

    const idx = parseInt(selectedPoolIdx);
    const amount = parseFloat(addLiqAmount);

    if (isNaN(idx) || isNaN(amount) || amount <= 0) {
      alert('Select valid pool & amount');
      return;
    }

    const pool = pools[idx];
    if (!pool) {
      alert('Pool not found');
      return;
    }

    setLiquidityStatus('⏳ Adding liquidity...');

    try {
      const blockhashData = await connection.getLatestBlockhash('confirmed');
      const transaction = new solanaWeb3.Transaction({
        recentBlockhash: blockhashData.blockhash,
        feePayer: wallet.publicKey,
      });

      // Encode instruction data: amount (u64)
      const amountBigInt = BigInt(Math.floor(amount * 1e9));
      const amountData = encodeU64LE(amountBigInt);
      const addLiquidityInstructionData = encodeInstructionData('add_liquidity', amountData);

      const addLiquidityIx = new solanaWeb3.TransactionInstruction({
        programId: new solanaWeb3.PublicKey(DEX_PROGRAM_ID),
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: new solanaWeb3.PublicKey(pool.poolAddress), isSigner: false, isWritable: true },
        ],
        data: Buffer.from(addLiquidityInstructionData),
      });

      transaction.add(addLiquidityIx);

      setLiquidityStatus('⏳ Waiting for wallet signature...');
      const signed = await wallet.signTransaction(transaction);

      setLiquidityStatus('⏳ Sending transaction...');
      const signature = await connection.sendRawTransaction(signed.serialize());

      setLiquidityStatus('⏳ Waiting for confirmation...');
      await connection.confirmTransaction(
        {
          signature,
          blockhash: blockhashData.blockhash,
          lastValidBlockHeight: blockhashData.lastValidBlockHeight,
        },
        'confirmed'
      );

      const lpTokens = pool.totalLp === 0 ? Math.sqrt(amount * amount) : (amount / (pool.reserveA || 1)) * pool.totalLp;
      const updatedPool = { ...pool, reserveA: pool.reserveA + amount, reserveB: pool.reserveB + amount, totalLp: pool.totalLp + lpTokens };
      const updatedPools = [...pools];
      updatedPools[idx] = updatedPool;
      setPools(updatedPools);
      localStorage.setItem('MAX_pools', JSON.stringify(updatedPools));

      setLiquidityStatus(
        `✅ Liquidity added: ${amount} → ${lpTokens.toFixed(6)} LP<br>🔗 <a href="https://explorer.solana.com/tx/${signature}?cluster=devnet" target="_blank" style="color:#6C9BD2">View Tx</a>`
      );
      setAddLiqAmount('');
    } catch (e: any) {
      setLiquidityStatus(`❌ Add liquidity failed: ${e.message}`);
    }
  };

  return (
    <div className="dex-card">
      <div className="card-header">
        <span className="card-title">LIQUIDITY POOLS</span>
      </div>

      <div className="section-divider">
        <div className="card-title">CREATE LIQUIDITY POOL</div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>TOKEN A (MINT)</label>
          <input
            type="text"
            value={tokenA}
            onChange={(e) => setTokenA(e.target.value)}
            placeholder="Your token mint address"
          />
        </div>
        <div className="form-group">
          <label>TOKEN B (DEVNET)</label>
          <select value={tokenB} onChange={(e) => setTokenB(e.target.value)}>
            <option value="">— SELECT TOKEN —</option>
            <option value={USDC_DEVNET}>USDC (Devnet)</option>
            <option value="So11111111111111111111111111111111111111112">SOL (Devnet)</option>
          </select>
        </div>
        <div className="form-group">
          <label>FEE (BPS)</label>
          <input type="number" value={fee} onChange={(e) => setFee(parseInt(e.target.value))} />
        </div>
      </div>

      <button className="action-button" onClick={handleCreatePool}>
        CREATE POOL
      </button>

      <div className="status-area" dangerouslySetInnerHTML={{ __html: poolStatus }} />

      <div className="section-divider">
        <div className="card-title">MANAGE LIQUIDITY</div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>SELECT POOL</label>
          <select value={selectedPoolIdx} onChange={(e) => setSelectedPoolIdx(e.target.value)}>
            <option value="">— SELECT —</option>
            {pools.map((p, idx) => (
              <option key={idx} value={idx}>
                Pool {idx + 1}: {p.symbolA}/{p.symbolB}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>ADD LIQUIDITY (AMOUNT)</label>
          <input
            type="number"
            value={addLiqAmount}
            onChange={(e) => setAddLiqAmount(e.target.value)}
            placeholder="Token amount"
          />
        </div>
        <div className="form-group">
          <label>REMOVE LP TOKENS</label>
          <input
            type="number"
            value={removeLpAmount}
            onChange={(e) => setRemoveLpAmount(e.target.value)}
            placeholder="LP to burn"
          />
        </div>
      </div>

      <button className="action-button" onClick={handleAddLiquidity} style={{ marginBottom: '8px' }}>
        ADD LIQUIDITY
      </button>
      <button className="action-button" disabled>
        REMOVE LIQUIDITY
      </button>

      <div className="status-area" dangerouslySetInnerHTML={{ __html: liquidityStatus }} />

      <div className="section-divider">
        <div className="card-title">EXISTING POOLS</div>
      </div>

      <div className="status-area">
        {pools.length === 0 ? (
          '— No liquidity pools —'
        ) : (
          pools.map((p, idx) => (
            <div key={idx}>
              🔄 {p.symbolA} / {p.symbolB} &nbsp; fee: {p.fee / 100}%
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LiquidityPoolsPage;
