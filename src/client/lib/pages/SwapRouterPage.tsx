import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { USDC_DEVNET, SOL_DEVNET } from '../lib/solanaService';
import './Page.css';

const SwapRouterPage: React.FC = () => {
  const { deployedTokens, pools } = useAppContext();
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
      <button className="action-button" disabled>
        EXECUTE SWAP
      </button>

      <div className="status-area" dangerouslySetInnerHTML={{ __html: swapResult }} />
      <div className="status-area" dangerouslySetInnerHTML={{ __html: swapExecuteStatus }} />
    </div>
  );
};

export default SwapRouterPage;
