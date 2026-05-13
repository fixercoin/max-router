import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { PublicKey } from '@solana/web3.js';
import './Page.css';

const LiquidityPoolsPage: React.FC = () => {
  const { wallet, dexClient, deployedTokens, pools, setPools } = useAppContext();
  const [tokenAMint, setTokenAMint] = useState('');
  const [tokenBMint, setTokenBMint] = useState('');
  const [feeBps, setFeeBps] = useState(25);
  const [poolStatus, setPoolStatus] = useState('');
  const [selectedPool, setSelectedPool] = useState<any>(null);
  const [addAmountA, setAddAmountA] = useState('');
  const [addAmountB, setAddAmountB] = useState('');
  const [liquidityStatus, setLiquidityStatus] = useState('');
  const [swapAmount, setSwapAmount] = useState('');
  const [swapStatus, setSwapStatus] = useState('');

  const loadPoolsFromChain = useCallback(async () => {
    if (!dexClient) return;

    try {
      const dexState = await dexClient.getDexState();
      // Fetch all pools (you'd need to track pool addresses)
      console.log("DEX State:", dexState);
    } catch (e) {
      console.error("Failed to load pools:", e);
    }
  }, [dexClient]);

  useEffect(() => {
    loadPoolsFromChain();
  }, [loadPoolsFromChain]);

  const handleCreatePool = async () => {
    if (!wallet || !dexClient) {
      alert('Connect wallet and initialize DEX first');
      return;
    }

    if (!tokenAMint || !tokenBMint) {
      alert('Enter both token mint addresses');
      return;
    }

    setPoolStatus('⏳ Creating pool on MAX DEX...');

    try {
      const tokenAPubkey = new PublicKey(tokenAMint);
      const tokenBPubkey = new PublicKey(tokenBMint);
      
      const poolAddress = await dexClient.createPool(tokenAPubkey, tokenBPubkey, feeBps);
      
      const tokenAData = deployedTokens.find((t) => t.mint === tokenAMint);
      const tokenBData = deployedTokens.find((t) => t.mint === tokenBMint);
      const symbolA = tokenAData ? tokenAData.symbol : tokenAMint.slice(0, 6);
      const symbolB = tokenBData ? tokenBData.symbol : tokenBMint.slice(0, 6);

      const newPools = [
        ...pools,
        {
          tokenA: tokenAMint,
          tokenB: tokenBMint,
          symbolA,
          symbolB,
          fee: feeBps,
          poolAddress: poolAddress.toString(),
          reserveA: 0,
          reserveB: 0,
          totalLp: 0,
        },
      ];
      setPools(newPools);
      localStorage.setItem('MAX_pools', JSON.stringify(newPools));

      setPoolStatus(
        `✅ Pool created: ${symbolA}/${symbolB} | Fee: ${feeBps / 100}%<br>` +
        `📊 Pool Address: ${poolAddress.toString()}`
      );
      setTokenAMint('');
      setTokenBMint('');
    } catch (e: any) {
      setPoolStatus(`❌ Pool creation failed: ${e.message}`);
    }
  };

  const handleAddLiquidity = async () => {
    if (!wallet || !dexClient || !selectedPool) {
      alert('Select a pool first');
      return;
    }

    const amountA = parseFloat(addAmountA);
    const amountB = parseFloat(addAmountB);

    if (isNaN(amountA) || isNaN(amountB) || amountA <= 0 || amountB <= 0) {
      alert('Enter valid amounts for both tokens');
      return;
    }

    setLiquidityStatus('⏳ Adding liquidity...');

    try {
      const tokenAPubkey = new PublicKey(selectedPool.tokenA);
      const tokenBPubkey = new PublicKey(selectedPool.tokenB);
      const poolPubkey = new PublicKey(selectedPool.poolAddress);
      
      // Convert to raw amounts with decimals
      const tokenAData = deployedTokens.find((t) => t.mint === selectedPool.tokenA);
      const tokenBData = deployedTokens.find((t) => t.mint === selectedPool.tokenB);
      
      const rawAmountA = amountA * Math.pow(10, tokenAData?.decimals || 6);
      const rawAmountB = amountB * Math.pow(10, tokenBData?.decimals || 6);
      
      await dexClient.addLiquidity(poolPubkey, rawAmountA, rawAmountB, tokenAPubkey, tokenBPubkey);
      
      setLiquidityStatus(`✅ Liquidity added successfully!`);
      setAddAmountA('');
      setAddAmountB('');
      
      // Refresh pool data
      await loadPoolsFromChain();
    } catch (e: any) {
      setLiquidityStatus(`❌ Add liquidity failed: ${e.message}`);
    }
  };

  const handleSwap = async () => {
    if (!wallet || !dexClient || !selectedPool) {
      alert('Select a pool first');
      return;
    }

    const amount = parseFloat(swapAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Enter valid amount');
      return;
    }

    setSwapStatus('⏳ Swapping...');

    try {
      const tokenInPubkey = new PublicKey(selectedPool.tokenA);
      const tokenOutPubkey = new PublicKey(selectedPool.tokenB);
      const poolPubkey = new PublicKey(selectedPool.poolAddress);
      
      const tokenInData = deployedTokens.find((t) => t.mint === selectedPool.tokenA);
      const rawAmount = amount * Math.pow(10, tokenInData?.decimals || 6);
      
      await dexClient.swap(poolPubkey, tokenInPubkey, tokenOutPubkey, rawAmount, 0);
      
      setSwapStatus(`✅ Swap completed successfully!`);
      setSwapAmount('');
      
      // Refresh pool data
      await loadPoolsFromChain();
    } catch (e: any) {
      setSwapStatus(`❌ Swap failed: ${e.message}`);
    }
  };

  const handleRemoveLiquidity = async (lpAmount: number) => {
    if (!wallet || !dexClient || !selectedPool) {
      alert('Select a pool first');
      return;
    }

    setLiquidityStatus('⏳ Removing liquidity...');

    try {
      const poolPubkey = new PublicKey(selectedPool.poolAddress);
      const rawLpAmount = lpAmount * Math.pow(10, 9); // LP tokens have 9 decimals
      
      await dexClient.removeLiquidity(poolPubkey, rawLpAmount);
      
      setLiquidityStatus(`✅ Liquidity removed successfully!`);
      await loadPoolsFromChain();
    } catch (e: any) {
      setLiquidityStatus(`❌ Remove liquidity failed: ${e.message}`);
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
          <label>TOKEN A (MINT ADDRESS)</label>
          <input
            type="text"
            value={tokenAMint}
            onChange={(e) => setTokenAMint(e.target.value)}
            placeholder="Your token mint address"
          />
        </div>
        <div className="form-group">
          <label>TOKEN B (MINT ADDRESS)</label>
          <input
            type="text"
            value={tokenBMint}
            onChange={(e) => setTokenBMint(e.target.value)}
            placeholder="USDC or SOL mint address"
          />
        </div>
        <div className="form-group">
          <label>FEE (BPS - 100 = 1%)</label>
          <input 
            type="number" 
            value={feeBps} 
            onChange={(e) => setFeeBps(parseInt(e.target.value))}
            min="0"
            max="500"
          />
          <small>Recommended: 25 (0.25%)</small>
        </div>
      </div>

      <button className="action-button" onClick={handleCreatePool}>
        CREATE POOL
      </button>

      <div className="status-area" dangerouslySetInnerHTML={{ __html: poolStatus }} />

      <div className="section-divider">
        <div className="card-title">SELECT POOL</div>
      </div>

      <div className="form-row">
        <div className="form-group" style={{ width: '100%' }}>
          <label>CHOOSE POOL</label>
          <select 
            value={selectedPool?.poolAddress || ''} 
            onChange={(e) => {
              const pool = pools.find(p => p.poolAddress === e.target.value);
              setSelectedPool(pool);
            }}
          >
            <option value="">— SELECT A POOL —</option>
            {pools.map((p, idx) => (
              <option key={idx} value={p.poolAddress}>
                {p.symbolA} / {p.symbolB} - Fee: {p.fee / 100}%
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedPool && (
        <>
          <div className="section-divider">
            <div className="card-title">POOL STATISTICS</div>
          </div>
          <div className="status-area">
            📊 Reserve A: {selectedPool.reserveA / 1e6} {selectedPool.symbolA}<br />
            📊 Reserve B: {selectedPool.reserveB / 1e6} {selectedPool.symbolB}<br />
            🔄 Total LP Supply: {selectedPool.totalLp / 1e9}<br />
            💰 Total Volume: {selectedPool.totalVolume / 1e6 || 0}<br />
            📈 Your LP Tokens: {selectedPool.userLpBalance / 1e9 || 0}
          </div>

          <div className="section-divider">
            <div className="card-title">ADD LIQUIDITY</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{selectedPool.symbolA} AMOUNT</label>
              <input
                type="number"
                value={addAmountA}
                onChange={(e) => setAddAmountA(e.target.value)}
                placeholder={`Amount of ${selectedPool.symbolA}`}
              />
            </div>
            <div className="form-group">
              <label>{selectedPool.symbolB} AMOUNT</label>
              <input
                type="number"
                value={addAmountB}
                onChange={(e) => setAddAmountB(e.target.value)}
                placeholder={`Amount of ${selectedPool.symbolB}`}
              />
            </div>
          </div>

          <button className="action-button" onClick={handleAddLiquidity}>
            ADD LIQUIDITY
          </button>

          <div className="section-divider">
            <div className="card-title">SWAP TOKENS</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>SWAP {selectedPool.symbolA} → {selectedPool.symbolB}</label>
              <input
                type="number"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
                placeholder={`Amount of ${selectedPool.symbolA}`}
              />
            </div>
          </div>

          <button className="action-button" onClick={handleSwap}>
            SWAP TOKENS
          </button>

          <div className="status-area" dangerouslySetInnerHTML={{ __html: swapStatus }} />

          <div className="section-divider">
            <div className="card-title">REMOVE LIQUIDITY</div>
          </div>

          <button 
            className="action-button" 
            onClick={() => handleRemoveLiquidity((selectedPool.userLpBalance || 0) / 1e9)}
            style={{ backgroundColor: '#dc2626' }}
          >
            REMOVE ALL LIQUIDITY
          </button>
        </>
      )}

      <div className="status-area" dangerouslySetInnerHTML={{ __html: liquidityStatus }} />

      <div className="section-divider">
        <div className="card-title">ALL POOLS</div>
      </div>

      <div className="status-area">
        {pools.length === 0 ? (
          '— No liquidity pools yet —'
        ) : (
          pools.map((p, idx) => (
            <div key={idx} style={{ marginBottom: '8px' }}>
              🔄 Pool #{idx + 1}: <strong>{p.symbolA}/{p.symbolB}</strong> | 
              Fee: {p.fee / 100}% | 
              Reserves: {p.reserveA / 1e6} {p.symbolA} / {p.reserveB / 1e6} {p.symbolB}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LiquidityPoolsPage;
