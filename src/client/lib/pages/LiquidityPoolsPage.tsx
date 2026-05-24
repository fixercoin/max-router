import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { PublicKey } from '@solana/web3.js';
import { saveTransaction, getExplorerUrl } from '../transactionUtils';

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
    if (!dexClient || pools.length === 0) return;

    try {
      const updatedPools = [];
      for (const pool of pools) {
        try {
          const poolPubkey = new PublicKey(pool.poolAddress);
          const poolData = await dexClient.fetchPoolReserves(poolPubkey);
          if (poolData) {
            updatedPools.push({
              ...pool,
              reserveA: poolData.reserveA?.toNumber?.() || poolData.reserveA || 0,
              reserveB: poolData.reserveB?.toNumber?.() || poolData.reserveB || 0,
              totalLp: poolData.lpSupply?.toNumber?.() || poolData.lpSupply || 0,
              totalVolume: poolData.totalVolume?.toNumber?.() || 0,
            });
          } else {
            updatedPools.push(pool);
          }
        } catch (e) {
          console.error(`Failed to fetch pool ${pool.poolAddress}:`, e);
          updatedPools.push(pool);
        }
      }
      if (updatedPools.length > 0) {
        setPools(updatedPools);
        localStorage.setItem('MAX_pools', JSON.stringify(updatedPools));
      }
    } catch (e) {
      console.error("Failed to load pools:", e);
    }
  }, [dexClient, pools, setPools]);

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

    setPoolStatus('Creating pool on MAX DEX...');

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
        `Pool created: ${symbolA}/${symbolB} | Fee: ${feeBps / 100}%\n` +
        `Pool Address: ${poolAddress.toString()}`
      );
      setTokenAMint('');
      setTokenBMint('');

      setTimeout(() => {
        loadPoolsFromChain();
      }, 2000);
    } catch (e: any) {
      setPoolStatus(`Pool creation failed: ${e.message}`);
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

    setLiquidityStatus('Requesting transaction signature...');

    try {
      const tokenAPubkey = new PublicKey(selectedPool.tokenA);
      const tokenBPubkey = new PublicKey(selectedPool.tokenB);
      const poolPubkey = new PublicKey(selectedPool.poolAddress);

      const tokenAData = deployedTokens.find((t) => t.mint === selectedPool.tokenA);
      const tokenBData = deployedTokens.find((t) => t.mint === selectedPool.tokenB);

      const rawAmountA = amountA * Math.pow(10, tokenAData?.decimals || 6);
      const rawAmountB = amountB * Math.pow(10, tokenBData?.decimals || 6);

      const txHash = await dexClient.addLiquidity(poolPubkey, rawAmountA, rawAmountB, tokenAPubkey, tokenBPubkey);

      const explorerUrl = getExplorerUrl(txHash, 'devnet');

      saveTransaction({
        id: Date.now().toString(),
        hash: txHash,
        type: 'add-liquidity',
        fromToken: selectedPool.symbolA,
        toToken: selectedPool.symbolB,
        amount: `${amountA}/${amountB}`,
        status: 'confirmed',
        timestamp: Date.now(),
        explorerUrl
      });

      setLiquidityStatus(`Liquidity added successfully!\n${explorerUrl}`);
      setAddAmountA('');
      setAddAmountB('');

      await loadPoolsFromChain();
    } catch (e: any) {
      setLiquidityStatus(`Add liquidity failed: ${e.message}`);
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

    setSwapStatus('Swapping...');

    try {
      const tokenInPubkey = new PublicKey(selectedPool.tokenA);
      const tokenOutPubkey = new PublicKey(selectedPool.tokenB);
      const poolPubkey = new PublicKey(selectedPool.poolAddress);
      
      const tokenInData = deployedTokens.find((t) => t.mint === selectedPool.tokenA);
      const rawAmount = amount * Math.pow(10, tokenInData?.decimals || 6);
      
      await dexClient.swap(poolPubkey, tokenInPubkey, tokenOutPubkey, rawAmount, 0);
      
      setSwapStatus(`Swap completed successfully!`);
      setSwapAmount('');
      
      await loadPoolsFromChain();
    } catch (e: any) {
      setSwapStatus(`Swap failed: ${e.message}`);
    }
  };

  const handleRemoveLiquidity = async (lpAmount: number) => {
    if (!wallet || !dexClient || !selectedPool) {
      alert('Select a pool first');
      return;
    }

    setLiquidityStatus('Requesting transaction signature...');

    try {
      const poolPubkey = new PublicKey(selectedPool.poolAddress);
      const rawLpAmount = lpAmount * Math.pow(10, 9);

      const txHash = await dexClient.removeLiquidity(poolPubkey, rawLpAmount);

      const explorerUrl = getExplorerUrl(txHash, 'devnet');

      saveTransaction({
        id: Date.now().toString(),
        hash: txHash,
        type: 'remove-liquidity',
        fromToken: selectedPool.symbolA,
        toToken: selectedPool.symbolB,
        amount: lpAmount.toString(),
        status: 'confirmed',
        timestamp: Date.now(),
        explorerUrl
      });

      setLiquidityStatus(`Liquidity removed successfully!\n${explorerUrl}`);
      await loadPoolsFromChain();
    } catch (e: any) {
      setLiquidityStatus(`Remove liquidity failed: ${e.message}`);
    }
  };

  return (
    <div className="liquidity-pools-single-column">
      <div className="main-card">
        <div className="card-header">
          <span className="card-title">LIQUIDITY POOLS</span>
        </div>

        <div className="section-divider">
          <div className="section-title">CREATE LIQUIDITY POOL</div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>TOKEN A MINT ADDRESS</label>
            <input
              type="text"
              value={tokenAMint}
              onChange={(e) => setTokenAMint(e.target.value)}
              placeholder="Your token mint address"
            />
          </div>
          <div className="form-group">
            <label>TOKEN B MINT ADDRESS</label>
            <input
              type="text"
              value={tokenBMint}
              onChange={(e) => setTokenBMint(e.target.value)}
              placeholder="USDC or SOL mint address"
            />
          </div>
          <div className="form-group">
            <label>FEE BPS 100 = 1 PERCENT</label>
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

        {poolStatus && (
          <div className="status-area">
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{poolStatus}</pre>
          </div>
        )}

        <div className="section-divider">
          <div className="section-title">SELECT POOL</div>
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
              <option value="">SELECT A POOL</option>
              {pools.map((p, idx) => (
                <option key={idx} value={p.poolAddress}>
                  {p.symbolA} / {p.symbolB} - Fee: {p.fee / 100}%
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pool Details Card */}
        <div className="pool-details-card">
          <div className="card-header">
            <span className="card-title">POOL DETAILS</span>
          </div>
          <div className="card-content-placeholder">
            Pool details will appear here
          </div>
        </div>

        {selectedPool && (
          <>
            <div className="section-divider">
              <div className="section-title">POOL STATISTICS</div>
            </div>
            <div className="status-area">
              Reserve A: {selectedPool.reserveA / 1e6} {selectedPool.symbolA}<br />
              Reserve B: {selectedPool.reserveB / 1e6} {selectedPool.symbolB}<br />
              Total LP Supply: {selectedPool.totalLp / 1e9}<br />
              Total Volume: {selectedPool.totalVolume / 1e6 || 0}<br />
              Your LP Tokens: {selectedPool.userLpBalance / 1e9 || 0}
            </div>

            <div className="section-divider">
              <div className="section-title">ADD LIQUIDITY</div>
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
              <div className="section-title">SWAP TOKENS</div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>SWAP {selectedPool.symbolA} TO {selectedPool.symbolB}</label>
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

            {swapStatus && (
              <div className="status-area">
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{swapStatus}</pre>
              </div>
            )}

            <div className="section-divider">
              <div className="section-title">REMOVE LIQUIDITY</div>
            </div>

            <button 
              className="action-button remove-btn" 
              onClick={() => handleRemoveLiquidity((selectedPool.userLpBalance || 0) / 1e9)}
            >
              REMOVE ALL LIQUIDITY
            </button>
          </>
        )}

        {liquidityStatus && (
          <div className="status-area">
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{liquidityStatus}</pre>
          </div>
        )}

        <div className="section-divider">
          <div className="section-title">ALL POOLS</div>
        </div>

        <div className="all-pools-area">
          {pools.length === 0 ? (
            'No liquidity pools yet'
          ) : (
            pools.map((p, idx) => (
              <div key={idx} style={{ marginBottom: '8px' }}>
                Pool #{idx + 1}: <strong>{p.symbolA}/{p.symbolB}</strong> | 
                Fee: {p.fee / 100}% | 
                Reserves: {p.reserveA / 1e6} {p.symbolA} / {p.reserveB / 1e6} {p.symbolB}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .liquidity-pools-single-column {
          width: 100%;
          padding: 20px;
          background: linear-gradient(135deg, #0f1419 0%, #151d28 100%);
          border-radius: 16px;
          min-height: 600px;
        }

        .main-card {
          max-width: 800px;
          margin: 0 auto;
          background: rgba(12, 17, 26, 0.8);
          border-radius: 12px;
          border: 1px solid #232a36;
          padding: 24px;
          backdrop-filter: blur(10px);
        }

        .card-header {
          padding-bottom: 16px;
          margin-bottom: 16px;
          border-bottom: 2px solid #232a36;
        }

        .card-title {
          font-size: 18px;
          font-weight: 700;
          color: #6c9bd2;
          letter-spacing: 1px;
        }

        .section-divider {
          margin: 24px 0 16px 0;
          padding-top: 8px;
          border-top: 1px solid #232a36;
        }

        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #8e9bae;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-row {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .form-group {
          flex: 1;
          min-width: 180px;
        }

        .form-group label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #8e9bae;
          text-transform: uppercase;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          background: #0a0e15;
          border: 1px solid #232a36;
          border-radius: 8px;
          color: #e6edf5;
          font-size: 14px;
          transition: all 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #6c9bd2;
          box-shadow: 0 0 0 2px rgba(108, 155, 210, 0.1);
        }

        .form-group small {
          display: block;
          margin-top: 6px;
          font-size: 10px;
          color: #5a6e8a;
        }

        .action-button {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #6c9bd2 0%, #4a7aab 100%);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 8px;
        }

        .action-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(108, 155, 210, 0.3);
        }

        .remove-btn {
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
        }

        .remove-btn:hover {
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }

        .status-area {
          margin-top: 16px;
          padding: 12px;
          background: #0c111a;
          border-radius: 8px;
          border: 1px solid #1e2a3a;
          font-size: 12px;
          color: #e6edf5;
          line-height: 1.5;
          word-break: break-all;
        }

        .all-pools-area {
          margin-top: 16px;
          padding: 12px;
          background: #0c111a;
          border-radius: 8px;
          border: 1px solid #1e2a3a;
          font-size: 12px;
          color: #8e9bae;
          line-height: 1.6;
        }

        /* Pool Details Card */
        .pool-details-card {
          margin: 20px 0;
          background: #0c111a;
          border-radius: 12px;
          border: 1px solid #1e2a3a;
          overflow: hidden;
        }

        .pool-details-card .card-header {
          padding: 16px 20px;
          margin-bottom: 0;
          background: linear-gradient(135deg, #0f1419 0%, #0c111a 100%);
          border-bottom: 1px solid #1e2a3a;
        }

        .pool-details-card .card-title {
          font-size: 14px;
          font-weight: 600;
        }

        .card-content-placeholder {
          padding: 40px 20px;
          text-align: center;
          color: #5a6e8a;
          font-size: 14px;
          letter-spacing: 0.5px;
        }

        @media (max-width: 768px) {
          .liquidity-pools-single-column {
            padding: 12px;
          }

          .main-card {
            padding: 16px;
          }

          .form-row {
            flex-direction: column;
            gap: 12px;
          }

          .form-group {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default LiquidityPoolsPage;
