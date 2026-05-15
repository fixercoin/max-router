import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getTokenMetadata, getTokenHolders } from '../solanaService';
import { getTransactionsByToken } from '../transactionUtils';
import { PublicKey } from '@solana/web3.js';
import './Page.css';

const TokenDetailsPage: React.FC = () => {
  const { deployedTokens, selectedTokenForDetails, dexClient, pools } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [holders, setHolders] = useState<any[]>([]);
  const [programMetadata, setProgramMetadata] = useState<any>(null);
  const [poolsWithToken, setPoolsWithToken] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  const loadTokenDetails = useCallback(async () => {
    if (!selectedTokenForDetails) return;
    setLoading(true);

    try {
      await getTokenMetadata(selectedTokenForDetails);

      const holdersData = await getTokenHolders(selectedTokenForDetails);
      setHolders(holdersData);
    } catch (e) {
      console.error('Failed to load details:', e);
    }

    setLoading(false);
  }, [selectedTokenForDetails]);

  const loadProgramMetadata = useCallback(async () => {
    if (!dexClient || !selectedTokenForDetails) return;

    try {
      const mintPubkey = new PublicKey(selectedTokenForDetails);
      const metadataAddress = await dexClient.getTokenMetadataAddress(mintPubkey);
      const metadata = await dexClient.program.account.tokenMetadata.fetch(metadataAddress);
      setProgramMetadata(metadata);
    } catch (e) {
      console.log("No program metadata found (token not deployed via MAX DEX)");
    }
  }, [dexClient, selectedTokenForDetails]);

  const findPoolsWithToken = useCallback(() => {
    const tokenPools = pools.filter(
      (p) => p.tokenA === selectedTokenForDetails || p.tokenB === selectedTokenForDetails
    );
    setPoolsWithToken(tokenPools);
  }, [pools, selectedTokenForDetails]);

  const loadTransactionHistory = useCallback(() => {
    if (!selectedTokenForDetails) return;
    const txs = getTransactionsByToken(selectedTokenForDetails);
    setTransactions(txs);
    
    // Generate mock price chart data based on transaction times
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const mockChart = [];
    for (let i = 0; i < 24; i++) {
      const timestamp = dayAgo + (i * 60 * 60 * 1000);
      const basePrice = 0.5;
      const variance = Math.sin(i / 4) * 0.1 + (Math.random() - 0.5) * 0.05;
      mockChart.push({
        time: new Date(timestamp).getHours(),
        price: Math.max(0.01, basePrice + variance)
      });
    }
    setChartData(mockChart);
  }, [selectedTokenForDetails]);

  useEffect(() => {
    loadTokenDetails();
    loadProgramMetadata();
    findPoolsWithToken();
    loadTransactionHistory();
  }, [loadTokenDetails, loadProgramMetadata, findPoolsWithToken, loadTransactionHistory]);

  const tokenData = deployedTokens.find((t) => t.mint === selectedTokenForDetails);

  if (!selectedTokenForDetails) {
    return <div className="dex-card">No token selected</div>;
  }

  const totalLiquidity = poolsWithToken.reduce((sum, p) => {
    const isTokenA = p.tokenA === selectedTokenForDetails;
    return sum + (isTokenA ? p.reserveA : p.reserveB) / Math.pow(10, tokenData?.decimals || 6);
  }, 0);

  const volume24h = transactions.filter(t => 
    Date.now() - t.timestamp < 24 * 60 * 60 * 1000
  ).reduce((sum, t) => {
    return sum + (parseFloat(t.amount?.split('/')[0] || t.amount || '0'));
  }, 0);

  return (
    <div className="token-details-wrapper">
      <div className="token-details-container">
        <div className="token-details-header">
          <div className="token-header-info">
            <h1 className="token-symbol">{tokenData?.symbol || 'UNKNOWN'}</h1>
            <p className="token-name">{tokenData?.name || 'Unknown Token'}</p>
          </div>
        </div>

        {loading ? (
          <div className="token-loading">⏳ Loading token details...</div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="token-stats-grid">
              <div className="stat-card">
                <div className="stat-label">Price (USD)</div>
                <div className="stat-value">$0.50</div>
                <div className="stat-change positive">+2.5%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">24h Volume</div>
                <div className="stat-value">${volume24h.toFixed(2)}</div>
                <div className="stat-change positive">+5.2%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Liquidity</div>
                <div className="stat-value">${totalLiquidity.toFixed(2)}</div>
                <div className="stat-change">{poolsWithToken.length} pools</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Holders</div>
                <div className="stat-value">{holders.length}</div>
                <div className="stat-change">{(holders.length > 0 ? holders[0].account.data?.parsed?.info?.tokenAmount?.uiAmount || 0 : 0).toFixed(0)}</div>
              </div>
            </div>

            {/* Price Chart */}
            <div className="token-chart-container">
              <div className="chart-header">
                <h3 className="chart-title">24h Price Movement</h3>
                <div className="chart-timeframe">
                  <button className="timeframe-btn active">24H</button>
                  <button className="timeframe-btn">7D</button>
                  <button className="timeframe-btn">1M</button>
                </div>
              </div>
              <div className="chart-canvas">
                <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="chart-svg">
                  <polyline
                    points={chartData.map((d, i) => `${(i / chartData.length) * 100},${50 - ((d.price - Math.min(...chartData.map(c => c.price))) / (Math.max(...chartData.map(c => c.price)) - Math.min(...chartData.map(c => c.price)) || 1)) * 50}`).join(' ')}
                    fill="none"
                    stroke="#6C9BD2"
                    strokeWidth="0.5"
                  />
                </svg>
              </div>
              <div className="chart-legend">
                <span>Low: ${Math.min(...chartData.map(d => d.price)).toFixed(4)}</span>
                <span>High: ${Math.max(...chartData.map(d => d.price)).toFixed(4)}</span>
              </div>
            </div>

            {/* Token Info Sections */}
            <div className="token-sections">
              {/* Basic Info */}
              {tokenData && (
                <div className="info-section">
                  <h3 className="section-title">📋 Token Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Symbol</span>
                      <span className="info-value">{tokenData.symbol}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Decimals</span>
                      <span className="info-value">{tokenData.decimals}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Total Supply</span>
                      <span className="info-value">{(tokenData.totalSupply / Math.pow(10, tokenData.decimals)).toLocaleString()}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Mint Address</span>
                      <span className="info-value mono">{selectedTokenForDetails.slice(0, 12)}...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Program Metadata */}
              {programMetadata && (
                <div className="info-section">
                  <h3 className="section-title">✓ MAX DEX Verification</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Status</span>
                      <span className="info-value verified">Verified</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Total Supply</span>
                      <span className="info-value">{(programMetadata.totalSupply / Math.pow(10, tokenData?.decimals || 6)).toLocaleString()}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Circulating</span>
                      <span className="info-value">{(programMetadata.circulatingSupply / Math.pow(10, tokenData?.decimals || 6)).toLocaleString()}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Creator</span>
                      <span className="info-value mono">{programMetadata.creator.toString().slice(0, 12)}...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Liquidity Pools */}
              {poolsWithToken.length > 0 && (
                <div className="info-section">
                  <h3 className="section-title">💧 Liquidity Pools ({poolsWithToken.length})</h3>
                  <div className="pools-list">
                    {poolsWithToken.map((pool, idx) => (
                      <div key={idx} className="pool-item">
                        <div className="pool-name">{pool.symbolA}/{pool.symbolB}</div>
                        <div className="pool-details">
                          <span>Fee: {pool.fee / 100}%</span>
                          <span>TVL: ${((pool.reserveA + pool.reserveB) / 1e6).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction History */}
              <div className="info-section">
                <h3 className="section-title">📊 Recent Transactions ({transactions.length})</h3>
                {transactions.length > 0 ? (
                  <div className="tx-list">
                    {transactions.slice(0, 10).map((tx, idx) => (
                      <div key={idx} className="tx-item">
                        <div className="tx-type">{tx.type.replace('-', ' ').toUpperCase()}</div>
                        <div className="tx-details">
                          {tx.fromToken && <span>{tx.fromToken}</span>}
                          {tx.amount && <span>{tx.amount}</span>}
                        </div>
                        <div className="tx-time">{new Date(tx.timestamp).toLocaleDateString()}</div>
                        {tx.explorerUrl && (
                          <a 
                            href={tx.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tx-link"
                          >
                            View ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">No transactions yet</p>
                )}
              </div>

              {/* Top Holders */}
              <div className="info-section">
                <h3 className="section-title">👥 Top Holders</h3>
                {holders.length > 0 ? (
                  <div className="holders-list">
                    {holders.slice(0, 5).map((h, i) => {
                      const parsed = h.account.data?.parsed?.info;
                      const amount = parsed?.tokenAmount?.uiAmount || 0;
                      return (
                        <div key={i} className="holder-item">
                          <div className="holder-rank">#{i + 1}</div>
                          <div className="holder-address mono">{h.pubkey.slice(0, 12)}...</div>
                          <div className="holder-amount">{amount.toLocaleString()} {tokenData?.symbol}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="empty-state">No holders found</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .token-details-wrapper {
          width: 100%;
          padding: 0;
        }

        .token-details-container {
          background: linear-gradient(135deg, #0f1419 0%, #151d28 100%);
          border-radius: 16px;
          border: 1px solid #232a36;
          overflow: hidden;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .token-details-header {
          padding: 24px;
          border-bottom: 1px solid #232a36;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .token-header-info {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .token-symbol {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          color: #e6edf5;
        }

        .token-name {
          font-size: 12px;
          color: #8e9bae;
          margin: 4px 0 0 0;
        }

        .token-loading {
          padding: 48px 24px;
          text-align: center;
          color: #8e9bae;
        }

        .token-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid #232a36;
        }

        .stat-card {
          padding: 12px;
          background: #0c111a;
          border-radius: 8px;
          border: 1px solid #1e2a3a;
        }

        .stat-label {
          font-size: 10px;
          color: #8e9bae;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 700;
          color: #e6edf5;
          margin-bottom: 2px;
        }

        .stat-change {
          font-size: 11px;
          color: #8e9bae;
        }

        .stat-change.positive {
          color: #6fcf97;
        }

        .token-chart-container {
          padding: 16px;
          border-bottom: 1px solid #232a36;
          display: none;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .chart-title {
          font-size: 14px;
          font-weight: 600;
          color: #e6edf5;
          margin: 0;
        }

        .chart-timeframe {
          display: flex;
          gap: 8px;
        }

        .timeframe-btn {
          padding: 6px 12px;
          background: transparent;
          border: 1px solid #232a36;
          border-radius: 6px;
          color: #8e9bae;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .timeframe-btn.active {
          background: #232a36;
          color: #6c9bd2;
          border-color: #6c9bd2;
        }

        .chart-canvas {
          width: 100%;
          height: 150px;
          background: #0c111a;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .chart-svg {
          width: 100%;
          height: 100%;
        }

        .chart-legend {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #8e9bae;
        }

        .token-sections {
          padding: 16px;
          display: grid;
          gap: 16px;
          overflow-y: auto;
          flex: 1;
        }

        .info-section {
          background: #0c111a;
          border-radius: 8px;
          border: 1px solid #1e2a3a;
          padding: 12px;
        }

        .section-title {
          font-size: 12px;
          font-weight: 600;
          color: #6c9bd2;
          margin: 0 0 10px 0;
          text-transform: uppercase;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .info-label {
          font-size: 11px;
          color: #8e9bae;
          text-transform: uppercase;
        }

        .info-value {
          font-size: 12px;
          color: #e6edf5;
          font-weight: 500;
          text-align: right;
        }

        .info-value.verified {
          color: #6fcf97;
        }

        .info-value.mono {
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }

        .pools-list {
          display: grid;
          gap: 6px;
        }

        .pool-item {
          padding: 8px;
          background: #0a0e15;
          border-radius: 6px;
          border-left: 2px solid #6c9bd2;
        }

        .pool-name {
          font-size: 11px;
          font-weight: 600;
          color: #e6edf5;
          margin-bottom: 2px;
        }

        .pool-details {
          display: flex;
          gap: 8px;
          font-size: 10px;
          color: #8e9bae;
          flex-wrap: wrap;
        }

        .tx-list {
          display: grid;
          gap: 6px;
        }

        .tx-item {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          padding: 8px;
          background: #0a0e15;
          border-radius: 6px;
          border-bottom: 1px solid #1e2a3a;
        }

        .tx-type {
          font-size: 11px;
          font-weight: 600;
          color: #6c9bd2;
        }

        .tx-details {
          display: flex;
          gap: 6px;
          font-size: 10px;
          color: #e6edf5;
          flex-wrap: wrap;
        }

        .tx-time {
          font-size: 10px;
          color: #8e9bae;
        }

        .tx-link {
          color: #6c9bd2;
          text-decoration: none;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .tx-link:hover {
          text-decoration: underline;
        }

        .holders-list {
          display: grid;
          gap: 6px;
        }

        .holder-item {
          display: grid;
          grid-template-columns: 30px 1fr;
          gap: 8px;
          align-items: center;
          padding: 8px;
          background: #0a0e15;
          border-radius: 6px;
          font-size: 10px;
        }

        .holder-rank {
          font-size: 11px;
          font-weight: 700;
          color: #6c9bd2;
        }

        .holder-address {
          font-size: 10px;
          color: #8e9bae;
          word-break: break-all;
        }

        .holder-amount {
          font-size: 10px;
          color: #6fcf97;
          font-weight: 500;
        }

        .empty-state {
          text-align: center;
          color: #8e9bae;
          font-size: 14px;
          padding: 20px;
        }

        .mono {
          font-family: 'Courier New', monospace;
        }

        @media (max-width: 768px) {
          .token-stats-grid {
            grid-template-columns: 1fr;
          }

          .tx-item {
            grid-template-columns: 1fr;
          }

          .holder-item {
            grid-template-columns: 1fr;
          }

          .chart-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default TokenDetailsPage;
