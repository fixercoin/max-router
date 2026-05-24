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
  const [searchQuery, setSearchQuery] = useState('');

  const allTokens = [
    { symbol: 'USDC', mint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', decimals: 6, price: 1.00, change24h: 0.05, volume: 1250000 },
    { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9, price: 145.20, change24h: 2.5, volume: 890000 },
    ...deployedTokens.map(t => ({
      symbol: t.symbol,
      mint: t.mint,
      decimals: t.decimals,
      price: Math.random() * 100,
      change24h: (Math.random() * 20) - 10,
      volume: Math.random() * 100000,
      logo: t.logo
    }))
  ];

  // Filter tokens based on search query
  const filteredTokens = allTokens.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.mint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Find pool when tokens are selected and fetch real reserves
  useEffect(() => {
    if (fromToken && toToken) {
      const pool = pools.find(
        (p) =>
          (p.tokenA === fromToken.mint && p.tokenB === toToken.mint) ||
          (p.tokenA === toToken.mint && p.tokenB === fromToken.mint)
      );

      if (pool && dexClient) {
        dexClient.fetchPoolReserves(new PublicKey(pool.poolAddress)).then(poolData => {
          if (poolData) {
            const updatedPool = {
              ...pool,
              reserveA: poolData.reserveA?.toNumber?.() || poolData.reserveA || 0,
              reserveB: poolData.reserveB?.toNumber?.() || poolData.reserveB || 0,
              totalLp: poolData.lpSupply?.toNumber?.() || poolData.lpSupply || 0,
            };
            setSelectedPool(updatedPool);
            setEstimatedOutput('ENTER AMOUNT TO ESTIMATE');
          } else {
            setSelectedPool(pool);
            setEstimatedOutput('ENTER AMOUNT TO ESTIMATE');
          }
        }).catch(e => {
          console.error('Failed to fetch pool reserves:', e);
          setSelectedPool(pool);
          setEstimatedOutput('ENTER AMOUNT TO ESTIMATE');
        });
      } else {
        setSelectedPool(pool || null);
        if (!pool) {
          setEstimatedOutput('NO LIQUIDITY POOL FOUND FOR THIS PAIR');
        } else {
          setEstimatedOutput('ENTER AMOUNT TO ESTIMATE');
        }
      }
    }
  }, [fromToken, toToken, pools, dexClient]);

  // Estimate swap output
  const handleEstimateSwap = () => {
    if (!fromToken || !toToken || !selectedPool) {
      setEstimatedOutput('SELECT TOKENS AND ENSURE POOL EXISTS');
      return;
    }

    const amount = parseFloat(swapAmount);
    if (isNaN(amount) || amount <= 0) {
      setEstimatedOutput('ENTER VALID AMOUNT');
      return;
    }

    const isAtoB = selectedPool.tokenA === fromToken.mint;
    const reserveIn = isAtoB ? selectedPool.reserveA : selectedPool.reserveB;
    const reserveOut = isAtoB ? selectedPool.reserveB : selectedPool.reserveA;
    
    const rawAmountIn = amount * Math.pow(10, fromToken.decimals);
    
    const feeBps = selectedPool.fee;
    const feeMultiplier = (10000 - feeBps) / 10000;
    const amountInWithFee = rawAmountIn * feeMultiplier;
    
    const rawAmountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
    const amountOut = rawAmountOut / Math.pow(10, toToken.decimals);
    
    setEstimatedOutput(
      `ESTIMATED OUTPUT: ${amountOut.toFixed(6)} ${toToken.symbol}\n` +
      `FEE: ${feeBps / 100}%\n` +
      `LIQUIDITY: ${(reserveIn / Math.pow(10, fromToken.decimals)).toFixed(2)} ${fromToken.symbol} / ` +
      `${(reserveOut / Math.pow(10, toToken.decimals)).toFixed(2)} ${toToken.symbol}`
    );
    
    return amountOut;
  };

  // Execute swap
  const handleExecuteSwap = async () => {
    if (!wallet || !dexClient) {
      alert('CONNECT WALLET AND INITIALIZE DEX FIRST');
      return;
    }

    if (!fromToken || !toToken || !selectedPool) {
      alert('SELECT TOKENS AND ENSURE POOL EXISTS');
      return;
    }

    const amount = parseFloat(swapAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('ENTER VALID AMOUNT');
      return;
    }

    setSwapStatus('PREPARING SWAP...');

    try {
      const isAtoB = selectedPool.tokenA === fromToken.mint;
      const reserveIn = isAtoB ? selectedPool.reserveA : selectedPool.reserveB;
      const reserveOut = isAtoB ? selectedPool.reserveB : selectedPool.reserveA;

      const rawAmountIn = amount * Math.pow(10, fromToken.decimals);
      const feeMultiplier = (10000 - selectedPool.fee) / 10000;
      const amountInWithFee = rawAmountIn * feeMultiplier;
      const rawAmountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
      const minAmountOut = rawAmountOut * 0.99;

      const poolPubkey = new PublicKey(selectedPool.poolAddress);
      const tokenInPubkey = new PublicKey(fromToken.mint);
      const tokenOutPubkey = new PublicKey(toToken.mint);

      setSwapStatus('REQUESTING TRANSACTION SIGNATURE...');

      const txHash = await dexClient.swap(poolPubkey, tokenInPubkey, tokenOutPubkey, rawAmountIn, minAmountOut);

      setSwapStatus('CONFIRMING TRANSACTION ON BLOCKCHAIN...');

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
        `SWAP EXECUTED SUCCESSFULLY!\n` +
        `SENT: ${amount} ${fromToken.symbol}\n` +
        `RECEIVED: ${outputAmount} ${toToken.symbol}\n` +
        `FEE: ${selectedPool.fee / 100}%\n\n` +
        `VIEW ON EXPLORER: ${explorerUrl}`
      );

      setSwapAmount('');
      setEstimatedOutput('');

    } catch (e: any) {
      setSwapStatus(`SWAP FAILED: ${e.message}`);
      console.error('Swap error:', e);
    }
  };

  return (
    <div className="swap-router-three-columns">
      {/* LEFT COLUMN - TOKENS LIST WITH SEARCH */}
      <div className="left-column">
        <div className="column-header">TOKENS LIST</div>
        
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="SEARCH TOKENS BY NAME OR ADDRESS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="tokens-list">
          {filteredTokens.length === 0 ? (
            <div className="empty-message">NO TOKENS FOUND</div>
          ) : (
            filteredTokens.map((token, idx) => (
              <div key={idx} className="token-item">
                <div className="token-info">
                  {token.logo ? (
                    <img src={token.logo} alt={token.symbol} className="token-logo-small" />
                  ) : (
                    <div className="token-logo-placeholder">{token.symbol.substring(0, 2)}</div>
                  )}
                  <div className="token-details">
                    <div className="token-symbol">{token.symbol}</div>
                    <div className="token-mint">{token.mint.slice(0, 8)}...</div>
                  </div>
                </div>
                <div className="token-stats">
                  <div className="token-price">${token.price?.toFixed(4) || '0.00'}</div>
                  <div className={`token-change ${token.change24h >= 0 ? 'positive' : 'negative'}`}>
                    {token.change24h >= 0 ? '+' : ''}{token.change24h?.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CENTER COLUMN - TOKEN CHART */}
      <div className="center-column">
        <div className="column-header">TOKEN CHART</div>
        
        <div className="chart-container">
          <div className="chart-placeholder">
            <div className="chart-icon"></div>
            <div className="chart-text">CHART WILL APPEAR HERE</div>
            <div className="chart-subtext">SELECT A TOKEN FROM LEFT COLUMN TO VIEW CHART</div>
          </div>
        </div>

        <div className="chart-stats">
          <div className="chart-stat-item">
            <span className="chart-stat-label">24H VOLUME</span>
            <span className="chart-stat-value">$1,250,000</span>
          </div>
          <div className="chart-stat-item">
            <span className="chart-stat-label">MARKET CAP</span>
            <span className="chart-stat-value">$45,200,000</span>
          </div>
          <div className="chart-stat-item">
            <span className="chart-stat-label">TOTAL SUPPLY</span>
            <span className="chart-stat-value">1,000,000</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - SWAP */}
      <div className="right-column">
        <div className="column-header">SWAP TOKENS</div>
        
        <div className="swap-container">
          <div className="swap-section">
            <label className="swap-label">FROM TOKEN</label>
            <select 
              className="swap-select"
              value={fromToken?.mint || ''} 
              onChange={(e) => {
                const token = allTokens.find(t => t.mint === e.target.value);
                setFromToken(token);
              }}
            >
              <option value="">SELECT TOKEN</option>
              {allTokens.map((t) => (
                <option key={t.mint} value={t.mint}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>

          <div className="swap-arrow"></div>

          <div className="swap-section">
            <label className="swap-label">TO TOKEN</label>
            <select 
              className="swap-select"
              value={toToken?.mint || ''} 
              onChange={(e) => {
                const token = allTokens.find(t => t.mint === e.target.value);
                setToToken(token);
              }}
            >
              <option value="">SELECT TOKEN</option>
              {allTokens.map((t) => (
                <option key={t.mint} value={t.mint}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>

          <div className="swap-section">
            <label className="swap-label">AMOUNT</label>
            <input
              type="number"
              className="swap-input"
              value={swapAmount}
              onChange={(e) => setSwapAmount(e.target.value)}
              placeholder="0.0"
              step="any"
            />
          </div>

          <div className="swap-buttons">
            <button className="estimate-btn" onClick={handleEstimateSwap}>
              ESTIMATE OUTPUT
            </button>
            <button 
              className="swap-btn" 
              onClick={handleExecuteSwap}
              disabled={!selectedPool || !swapAmount}
            >
              EXECUTE SWAP
            </button>
          </div>

          {selectedPool && (
            <div className="pool-info">
              <div className="pool-info-row">
                <span className="pool-info-label">POOL:</span>
                <span className="pool-info-value">{selectedPool.symbolA}/{selectedPool.symbolB}</span>
              </div>
              <div className="pool-info-row">
                <span className="pool-info-label">LIQUIDITY:</span>
                <span className="pool-info-value">
                  {(selectedPool.reserveA / 1e6).toFixed(2)} {selectedPool.symbolA} / {(selectedPool.reserveB / 1e6).toFixed(2)} {selectedPool.symbolB}
                </span>
              </div>
              <div className="pool-info-row">
                <span className="pool-info-label">FEE:</span>
                <span className="pool-info-value">{selectedPool.fee / 100}%</span>
              </div>
            </div>
          )}

          {estimatedOutput && (
            <div className="estimated-output">
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{estimatedOutput}</pre>
            </div>
          )}

          {swapStatus && (
            <div className="swap-status">
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{swapStatus}</pre>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .swap-router-three-columns {
          display: flex;
          width: 100%;
          min-height: 100vh;
          background: linear-gradient(135deg, #0f1419 0%, #151d28 100%);
          margin: 0;
          padding: 0;
        }

        .left-column,
        .center-column,
        .right-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: rgba(12, 17, 26, 0.9);
          padding: 24px;
          overflow-y: auto;
          min-height: 100vh;
        }

        .left-column {
          border-right: 1px solid #232a36;
        }

        .center-column {
          border-right: 1px solid #232a36;
        }

        .column-header {
          font-size: 20px;
          font-weight: 700;
          color: #6c9bd2;
          margin-bottom: 24px;
          padding-bottom: 12px;
          border-bottom: 2px solid #6c9bd2;
          letter-spacing: 1px;
          text-align: center;
        }

        /* Search Styles */
        .search-container {
          margin-bottom: 20px;
        }

        .search-input {
          width: 100%;
          padding: 12px;
          background: #0a0e15;
          border: 1px solid #232a36;
          border-radius: 8px;
          color: #e6edf5;
          font-size: 13px;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: #6c9bd2;
          box-shadow: 0 0 0 2px rgba(108, 155, 210, 0.1);
        }

        .search-input::placeholder {
          color: #5a6e8a;
          letter-spacing: 0.5px;
        }

        /* Tokens List */
        .tokens-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
          overflow-y: auto;
        }

        .token-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #0a0e15;
          border: 1px solid #232a36;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .token-item:hover {
          border-color: #6c9bd2;
          background: #0f1419;
          transform: translateX(4px);
        }

        .token-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .token-logo-small {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }

        .token-logo-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6c9bd2 0%, #4a7aab 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: white;
        }

        .token-details {
          display: flex;
          flex-direction: column;
        }

        .token-symbol {
          font-size: 14px;
          font-weight: 700;
          color: #6c9bd2;
        }

        .token-mint {
          font-size: 10px;
          color: #5a6e8a;
        }

        .token-stats {
          text-align: right;
        }

        .token-price {
          font-size: 13px;
          font-weight: 600;
          color: #e6edf5;
        }

        .token-change {
          font-size: 11px;
          font-weight: 600;
        }

        .token-change.positive {
          color: #6fcf97;
        }

        .token-change.negative {
          color: #dc2626;
        }

        /* Chart Styles */
        .chart-container {
          flex: 1;
          min-height: 400px;
          background: #0a0e15;
          border: 1px solid #232a36;
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .chart-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 400px;
        }

        .chart-icon {
          width: 80px;
          height: 80px;
          border: 3px solid #232a36;
          border-radius: 50%;
          margin-bottom: 20px;
          position: relative;
        }

        .chart-icon::before {
          content: '';
          position: absolute;
          top: 20px;
          left: 20px;
          width: 40px;
          height: 40px;
          border-left: 3px solid #6c9bd2;
          border-bottom: 3px solid #6c9bd2;
        }

        .chart-text {
          font-size: 16px;
          font-weight: 700;
          color: #6c9bd2;
          margin-bottom: 8px;
        }

        .chart-subtext {
          font-size: 12px;
          color: #5a6e8a;
        }

        .chart-stats {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: #0a0e15;
          border: 1px solid #232a36;
          border-radius: 12px;
        }

        .chart-stat-item {
          flex: 1;
          text-align: center;
        }

        .chart-stat-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: #5a6e8a;
          margin-bottom: 4px;
          letter-spacing: 1px;
        }

        .chart-stat-value {
          font-size: 14px;
          font-weight: 700;
          color: #6c9bd2;
        }

        /* Swap Styles */
        .swap-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .swap-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .swap-label {
          font-size: 11px;
          font-weight: 700;
          color: #8e9bae;
          letter-spacing: 1px;
        }

        .swap-select {
          width: 100%;
          padding: 12px;
          background: #0a0e15;
          border: 1px solid #232a36;
          border-radius: 8px;
          color: #e6edf5;
          font-size: 13px;
          cursor: pointer;
        }

        .swap-select:focus {
          outline: none;
          border-color: #6c9bd2;
        }

        .swap-input {
          width: 100%;
          padding: 12px;
          background: #0a0e15;
          border: 1px solid #232a36;
          border-radius: 8px;
          color: #e6edf5;
          font-size: 14px;
        }

        .swap-input:focus {
          outline: none;
          border-color: #6c9bd2;
        }

        .swap-arrow {
          text-align: center;
          font-size: 20px;
          color: #6c9bd2;
        }

        .swap-arrow::after {
          content: '↓';
        }

        .swap-buttons {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .estimate-btn {
          flex: 1;
          padding: 12px;
          background: rgba(108, 155, 210, 0.1);
          border: 1px solid #6c9bd2;
          border-radius: 8px;
          color: #6c9bd2;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 1px;
        }

        .estimate-btn:hover {
          background: rgba(108, 155, 210, 0.2);
        }

        .swap-btn {
          flex: 1;
          padding: 12px;
          background: linear-gradient(135deg, #6c9bd2 0%, #4a7aab 100%);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 1px;
        }

        .swap-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(108, 155, 210, 0.3);
        }

        .swap-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pool-info {
          padding: 12px;
          background: #0c111a;
          border: 1px solid #1e2a3a;
          border-radius: 8px;
        }

        .pool-info-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 11px;
        }

        .pool-info-label {
          color: #8e9bae;
        }

        .pool-info-value {
          color: #e6edf5;
          font-weight: 500;
        }

        .estimated-output {
          padding: 12px;
          background: #0c111a;
          border: 1px solid #1e2a3a;
          border-radius: 8px;
          font-size: 11px;
          color: #e6edf5;
          line-height: 1.5;
        }

        .swap-status {
          padding: 12px;
          background: #0c111a;
          border: 1px solid #1e2a3a;
          border-radius: 8px;
          font-size: 11px;
          color: #e6edf5;
          line-height: 1.5;
        }

        .empty-message {
          text-align: center;
          padding: 40px;
          color: #5a6e8a;
          font-size: 13px;
        }

        /* Scrollbar */
        .left-column::-webkit-scrollbar,
        .center-column::-webkit-scrollbar,
        .right-column::-webkit-scrollbar,
        .tokens-list::-webkit-scrollbar {
          width: 6px;
        }

        .left-column::-webkit-scrollbar-track,
        .center-column::-webkit-scrollbar-track,
        .right-column::-webkit-scrollbar-track,
        .tokens-list::-webkit-scrollbar-track {
          background: #0c111a;
          border-radius: 3px;
        }

        .left-column::-webkit-scrollbar-thumb,
        .center-column::-webkit-scrollbar-thumb,
        .right-column::-webkit-scrollbar-thumb,
        .tokens-list::-webkit-scrollbar-thumb {
          background: #232a36;
          border-radius: 3px;
        }

        .left-column::-webkit-scrollbar-thumb:hover,
        .center-column::-webkit-scrollbar-thumb:hover,
        .right-column::-webkit-scrollbar-thumb:hover,
        .tokens-list::-webkit-scrollbar-thumb:hover {
          background: #6c9bd2;
        }

        @media (max-width: 1024px) {
          .swap-router-three-columns {
            flex-direction: column;
          }

          .left-column {
            border-right: none;
            border-bottom: 1px solid #232a36;
          }

          .center-column {
            border-right: none;
            border-bottom: 1px solid #232a36;
          }

          .left-column,
          .center-column,
          .right-column {
            min-height: auto;
          }
        }

        @media (max-width: 768px) {
          .left-column,
          .center-column,
          .right-column {
            padding: 16px;
          }

          .column-header {
            font-size: 18px;
          }

          .swap-buttons {
            flex-direction: column;
          }

          .chart-stats {
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default SwapRouterPage;
