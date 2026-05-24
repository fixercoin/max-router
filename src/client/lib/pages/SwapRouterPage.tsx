import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { PublicKey } from '@solana/web3.js';
import { saveTransaction, getExplorerUrl } from '../transactionUtils';

const SwapRouterPage: React.FC = () => {
  const { wallet, dexClient, deployedTokens, pools, setPools } = useAppContext();
  const [fromToken, setFromToken] = useState<any>(null);
  const [toToken, setToToken] = useState<any>(null);
  const [swapAmount, setSwapAmount] = useState('');
  const [estimatedOutput, setEstimatedOutput] = useState('');
  const [swapStatus, setSwapStatus] = useState('');
  const [selectedPool, setSelectedPool] = useState<any>(null);

  const allTokens = [
    { symbol: 'USDC', mint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', decimals: 6 },
    { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
    ...deployedTokens.map(t => ({
      symbol: t.symbol,
      mint: t.mint,
      decimals: t.decimals
    }))
  ];

  // Find pool when tokens are selected and fetch real reserves
  useEffect(() => {
    if (fromToken && toToken) {
      const pool = pools.find(
        (p) =>
          (p.tokenA === fromToken.mint && p.tokenB === toToken.mint) ||
          (p.tokenA === toToken.mint && p.tokenB === fromToken.mint)
      );

      if (pool && dexClient) {
        // Fetch real pool data from chain
        dexClient.fetchPoolReserves(new PublicKey(pool.poolAddress)).then(poolData => {
          if (poolData) {
            const updatedPool = {
              ...pool,
              reserveA: poolData.reserveA?.toNumber?.() || poolData.reserveA || 0,
              reserveB: poolData.reserveB?.toNumber?.() || poolData.reserveB || 0,
              totalLp: poolData.lpSupply?.toNumber?.() || poolData.lpSupply || 0,
            };
            setSelectedPool(updatedPool);
            setEstimatedOutput('Enter amount to estimate');
          } else {
            setSelectedPool(pool);
            setEstimatedOutput('Enter amount to estimate');
          }
        }).catch(e => {
          console.error('Failed to fetch pool reserves:', e);
          setSelectedPool(pool);
          setEstimatedOutput('Enter amount to estimate');
        });
      } else {
        setSelectedPool(pool || null);
        if (!pool) {
          setEstimatedOutput('❌ No liquidity pool found for this pair');
        } else {
          setEstimatedOutput('Enter amount to estimate');
        }
      }
    }
  }, [fromToken, toToken, pools, dexClient]);

  // Estimate swap output
  const handleEstimateSwap = () => {
    if (!fromToken || !toToken || !selectedPool) {
      setEstimatedOutput('❌ Select tokens and ensure pool exists');
      return;
    }

    const amount = parseFloat(swapAmount);
    if (isNaN(amount) || amount <= 0) {
      setEstimatedOutput('❌ Enter valid amount');
      return;
    }

    const isAtoB = selectedPool.tokenA === fromToken.mint;
    const reserveIn = isAtoB ? selectedPool.reserveA : selectedPool.reserveB;
    const reserveOut = isAtoB ? selectedPool.reserveB : selectedPool.reserveA;
    
    // Convert to raw amounts with decimals
    const rawAmountIn = amount * Math.pow(10, fromToken.decimals);
    
    // Calculate output using x*y=k formula with fee
    const feeBps = selectedPool.fee;
    const feeMultiplier = (10000 - feeBps) / 10000;
    const amountInWithFee = rawAmountIn * feeMultiplier;
    
    const rawAmountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
    const amountOut = rawAmountOut / Math.pow(10, toToken.decimals);
    
    setEstimatedOutput(
      `↻ Estimated Output: ${amountOut.toFixed(6)} ${toToken.symbol}\n` +
      `📊 Fee: ${feeBps / 100}%\n` +
      `💧 Liquidity: ${(reserveIn / Math.pow(10, fromToken.decimals)).toFixed(2)} ${fromToken.symbol} / ` +
      `${(reserveOut / Math.pow(10, toToken.decimals)).toFixed(2)} ${toToken.symbol}`
    );
    
    return amountOut;
  };

  // Execute swap
  const handleExecuteSwap = async () => {
    if (!wallet || !dexClient) {
      alert('Connect wallet and initialize DEX first');
      return;
    }

    if (!fromToken || !toToken || !selectedPool) {
      alert('Select tokens and ensure pool exists');
      return;
    }

    const amount = parseFloat(swapAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Enter valid amount');
      return;
    }

    setSwapStatus('⏳ Preparing swap...');

    try {
      const isAtoB = selectedPool.tokenA === fromToken.mint;
      const reserveIn = isAtoB ? selectedPool.reserveA : selectedPool.reserveB;
      const reserveOut = isAtoB ? selectedPool.reserveB : selectedPool.reserveA;

      // Calculate minimum amount out with 1% slippage tolerance
      const rawAmountIn = amount * Math.pow(10, fromToken.decimals);
      const feeMultiplier = (10000 - selectedPool.fee) / 10000;
      const amountInWithFee = rawAmountIn * feeMultiplier;
      const rawAmountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
      const minAmountOut = rawAmountOut * 0.99; // 1% slippage tolerance

      const poolPubkey = new PublicKey(selectedPool.poolAddress);
      const tokenInPubkey = new PublicKey(fromToken.mint);
      const tokenOutPubkey = new PublicKey(toToken.mint);

      setSwapStatus('⏳ Requesting transaction signature...');

      const txHash = await dexClient.swap(poolPubkey, tokenInPubkey, tokenOutPubkey, rawAmountIn, minAmountOut);

      setSwapStatus('⏳ Confirming transaction on blockchain...');

      // Refresh pool data
      const updatedPool = await dexClient.program.account.poolAccount.fetch(poolPubkey);
      const updatedPools = pools.map(p =>
        p.poolAddress === selectedPool.poolAddress
          ? {
              ...p,
              reserveA: updatedPool.reserveA,
              reserveB: updatedPool.reserveB,
              totalVolume: updatedPool.totalVolume,
              totalFeesCollected: updatedPool.totalFeesCollected
            }
          : p
      );
      setPools(updatedPools);

      const outputAmount = ((rawAmountOut / Math.pow(10, toToken.decimals))).toFixed(6);
      const explorerUrl = getExplorerUrl(txHash, 'devnet');

      // Save transaction to history
      saveTransaction({
        id: Date.now().toString(),
        hash: txHash,
        type: 'swap',
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        amount: amount.toString(),
        status: 'confirmed',
        timestamp: Date.now(),
        explorerUrl
      });

      setSwapStatus(
        `✅ Swap executed successfully!\n` +
        `📤 Sent: ${amount} ${fromToken.symbol}\n` +
        `📥 Received: ${outputAmount} ${toToken.symbol}\n` +
        `💰 Fee: ${selectedPool.fee / 100}%\n\n` +
        `🔗 View on Explorer: ${explorerUrl}`
      );

      setSwapAmount('');
      setEstimatedOutput('');

    } catch (e: any) {
      setSwapStatus(`❌ Swap failed: ${e.message}`);
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
          <label>FROM TOKEN</label>
          <select 
            value={fromToken?.mint || ''} 
            onChange={(e) => {
              const token = allTokens.find(t => t.mint === e.target.value);
              setFromToken(token);
            }}
          >
            <option value="">— SELECT TOKEN —</option>
            {allTokens.map((t) => (
              <option key={t.mint} value={t.mint}>
                {t.symbol} ({t.mint.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>TO TOKEN</label>
          <select 
            value={toToken?.mint || ''} 
            onChange={(e) => {
              const token = allTokens.find(t => t.mint === e.target.value);
              setToToken(token);
            }}
          >
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
            step="any"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className="action-button" onClick={handleEstimateSwap}>
          ESTIMATE OUTPUT
        </button>
        <button 
          className="action-button" 
          onClick={handleExecuteSwap}
          disabled={!selectedPool || !swapAmount}
        >
          EXECUTE SWAP
        </button>
      </div>

      {selectedPool && (
        <div className="status-area" style={{ marginBottom: '10px', background: '#0C111A' }}>
          🔄 Pool: {selectedPool.symbolA}/{selectedPool.symbolB}<br />
          💧 Liquidity: {(selectedPool.reserveA / 1e6).toFixed(2)} {selectedPool.symbolA} / {(selectedPool.reserveB / 1e6).toFixed(2)} {selectedPool.symbolB}<br />
          💰 Fee: {selectedPool.fee / 100}%<br />
          📊 24h Volume: {(selectedPool.totalVolume / 1e6 || 0).toFixed(2)}
        </div>
      )}

      <div className="status-area" style={{ whiteSpace: 'pre-line' }}>
        {estimatedOutput}
      </div>
      
      <div className="status-area" style={{ whiteSpace: 'pre-line', marginTop: '10px' }}>
        {swapStatus && (
          <>
            {swapStatus.split('\n\n')[0]}
            {swapStatus.includes('View on Explorer') && (
              <div style={{ marginTop: '10px' }}>
                <a
                  href={swapStatus.split('\n').find(l => l.includes('View on Explorer'))?.replace('🔗 View on Explorer: ', '') || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="explorer-link"
                  style={{ color: '#6C9BD2', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  {swapStatus.split('\n').find(l => l.includes('View on Explorer'))}
                </a>
              </div>
            )}
            {!swapStatus.includes('View on Explorer') && swapStatus}
          </>
        )}
      </div>
    </div>
  );
};

export default SwapRouterPage;
