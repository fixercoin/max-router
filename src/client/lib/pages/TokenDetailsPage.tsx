import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getTokenMetadata, getTokenHolders } from '../solanaService';
import { getTransactionsByToken } from '../transactionUtils';
import { PublicKey } from '@solana/web3.js';


const TokenDetailsPage: React.FC = () => {
  const { deployedTokens, selectedTokenForDetails, dexClient, pools } = useAppContext();
  const [holders, setHolders] = useState<any[]>([]);
  const [programMetadata, setProgramMetadata] = useState<any>(null);
  const [poolsWithToken, setPoolsWithToken] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  
  // Dropdown states
  const [selectedInfoType, setSelectedInfoType] = useState<string>('basic');
  const [selectedPool, setSelectedPool] = useState<string>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('24h');
  const [selectedHolderSort, setSelectedHolderSort] = useState<string>('amount');

  const loadTokenDetails = useCallback(async () => {
    if (!selectedTokenForDetails) return;

    try {
      await getTokenMetadata(selectedTokenForDetails);
      const holdersData = await getTokenHolders(selectedTokenForDetails);
      setHolders(holdersData);
    } catch (e) {
      console.error('Failed to load details:', e);
    }
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

  // Filter holders based on selected sort
  const sortedHolders = [...holders].sort((a, b) => {
    const amountA = a.account.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
    const amountB = b.account.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
    return selectedHolderSort === 'amount' ? amountB - amountA : 0;
  });

  // Filter pools based on selection
  const filteredPools = selectedPool === 'all' 
    ? poolsWithToken 
    : poolsWithToken.filter(p => p.id === selectedPool);

  const getInfoContent = () => {
    switch(selectedInfoType) {
      case 'basic':
        return tokenData && (
          <div className="info-card">
            <h3 className="card-title">📋 Basic Information</h3>
            <div className="card-content">
              <div className="info-row">
                <span className="info-label">Symbol</span>
                <span className="info-value">{tokenData.symbol}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Name</span>
                <span className="info-value">{tokenData.name || 'Unknown Token'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Decimals</span>
                <span className="info-value">{tokenData.decimals}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Total Supply</span>
                <span className="info-value">{(tokenData.totalSupply / Math.pow(10, tokenData.decimals)).toLocaleString()}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Mint Address</span>
                <span className="info-value mono">{selectedTokenForDetails}</span>
              </div>
            </div>
          </div>
        );
      case 'dex':
        return programMetadata && (
          <div className="info-card">
            <h3 className="card-title">✓ MAX DEX Verification</h3>
            <div className="card-content">
              <div className="info-row">
                <span className="info-label">Status</span>
                <span className="info-value verified">✅ Verified</span>
              </div>
              <div className="info-row">
                <span className="info-label">Total Supply</span>
                <span className="info-value">{(programMetadata.totalSupply / Math.pow(10, tokenData?.decimals || 6)).toLocaleString()}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Circulating</span>
                <span className="info-value">{(programMetadata.circulatingSupply / Math.pow(10, tokenData?.decimals || 6)).toLocaleString()}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Creator</span>
                <span className="info-value mono">{programMetadata.creator.toString()}</span>
              </div>
            </div>
          </div>
        );
      case 'stats':
        return (
          <div className="info-card">
            <h3 className="card-title">📊 Statistics</h3>
            <div className="card-content">
              <div className="info-row">
                <span className="info-label">Price</span>
                <span className="info-value">$0.50</span>
              </div>
              <div className="info-row">
                <span className="info-label">24h Change</span>
                <span className="info-value positive">+2.5%</span>
              </div>
              <div className="info-row">
                <span className="info-label">24h Volume</span>
                <span className="info-value">${volume24h.toFixed(2)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Total Liquidity</span>
                <span className="info-value">${totalLiquidity.toFixed(2)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Holders Count</span>
                <span className="info-value">{holders.length}</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="two-column-layout">
      {/* Left Column - Dropdowns */}
      <div className="left-column">
        <div className="dropdowns-container">
          <h3 className="column-title">⚙️ Token Information</h3>
          
          {/* Dropdown 1 */}
          <div className="dropdown-group">
            <label className="dropdown-label">Information Type</label>
            <select 
              className="dropdown-select"
              value={selectedInfoType}
              onChange={(e) => setSelectedInfoType(e.target.value)}
            >
              <option value="basic">📋 Basic Information</option>
              <option value="dex">✓ MAX DEX Verification</option>
              <option value="stats">📊 Statistics</option>
            </select>
          </div>

          {/* Dropdown 2 */}
          <div className="dropdown-group">
            <label className="dropdown-label">Liquidity Pool Filter</label>
            <select 
              className="dropdown-select"
              value={selectedPool}
              onChange={(e) => setSelectedPool(e.target.value)}
            >
              <option value="all">All Pools ({poolsWithToken.length})</option>
              {poolsWithToken.map((pool, idx) => (
                <option key={idx} value={pool.id || idx}>
                  {pool.symbolA}/{pool.symbolB} - {pool.fee/100}% fee
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown 3 */}
          <div className="dropdown-group">
            <label className="dropdown-label">Timeframe</label>
            <select 
              className="dropdown-select"
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Dropdown 4 */}
          <div className="dropdown-group">
            <label className="dropdown-label">Sort Holders By</label>
            <select 
              className="dropdown-select"
              value={selectedHolderSort}
              onChange={(e) => setSelectedHolderSort(e.target.value)}
            >
              <option value="amount">Highest Balance</option>
              <option value="address">Address (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Right Column - Cards */}
      <div className="right-column">
        <div className="cards-container">
          <h3 className="column-title">📦 Token Data</h3>
          
          {/* Card 1: Dynamic Info Card based on dropdown */}
          {getInfoContent()}

          {/* Card 2: Price Chart */}
          <div className="info-card">
            <h3 className="card-title">📈 Price Chart ({selectedTimeframe})</h3>
            <div className="card-content">
              <div className="chart-container">
                <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="chart-svg">
                  <polyline
                    points={chartData.map((d, i) => `${(i / chartData.length) * 100},${50 - ((d.price - Math.min(...chartData.map(c => c.price))) / (Math.max(...chartData.map(c => c.price)) - Math.min(...chartData.map(c => c.price)) || 1)) * 50}`).join(' ')}
                    fill="none"
                    stroke="#6C9BD2"
                    strokeWidth="0.5"
                  />
                </svg>
              </div>
              <div className="chart-stats">
                <span>Low: ${Math.min(...chartData.map(d => d.price)).toFixed(4)}</span>
                <span>High: ${Math.max(...chartData.map(d => d.price)).toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Liquidity Pools */}
          <div className="info-card">
            <h3 className="card-title">💧 Liquidity Pools ({filteredPools.length})</h3>
            <div className="card-content">
              {filteredPools.length > 0 ? (
                <div className="pools-list">
                  {filteredPools.map((pool, idx) => (
                    <div key={idx} className="pool-item">
                      <div className="pool-name">{pool.symbolA}/{pool.symbolB}</div>
                      <div className="pool-details">
                        <span>💰 Fee: {pool.fee / 100}%</span>
                        <span>💵 TVL: ${((pool.reserveA + pool.reserveB) / 1e6).toFixed(2)}</span>
                        <span>📊 Reserve A: {(pool.reserveA / 1e6).toFixed(2)}</span>
                        <span>📊 Reserve B: {(pool.reserveB / 1e6).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No liquidity pools found</p>
              )}
            </div>
          </div>

          {/* Card 4: Recent Transactions */}
          <div className="info-card">
            <h3 className="card-title">🔄 Recent Transactions</h3>
            <div className="card-content">
              {transactions.length > 0 ? (
                <div className="transactions-list">
                  {transactions.slice(0, 5).map((tx, idx) => (
                    <div key={idx} className="transaction-item">
                      <div className="tx-header">
                        <span className="tx-type">{tx.type.replace('-', ' ').toUpperCase()}</span>
                        <span className="tx-time">{new Date(tx.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div className="tx-details">
                        {tx.fromToken && <span>From: {tx.fromToken}</span>}
                        {tx.toToken && <span>To: {tx.toToken}</span>}
                        {tx.amount && <span>Amount: {tx.amount}</span>}
                      </div>
                      {tx.explorerUrl && (
                        <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="tx-link">
                          View on Explorer ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No transactions yet</p>
              )}
            </div>
          </div>

          {/* Card 5: Top Holders */}
          <div className="info-card">
            <h3 className="card-title">👥 Top Holders</h3>
            <div className="card-content">
              {sortedHolders.length > 0 ? (
                <div className="holders-list">
                  {sortedHolders.slice(0, 10).map((h, i) => {
                    const parsed = h.account.data?.parsed?.info;
                    const amount = parsed?.tokenAmount?.uiAmount || 0;
                    const percentage = tokenData?.totalSupply 
                      ? (amount / (tokenData.totalSupply / Math.pow(10, tokenData.decimals))) * 100 
                      : 0;
                    return (
                      <div key={i} className="holder-item">
                        <div className="holder-rank">#{i + 1}</div>
                        <div className="holder-address mono">{h.pubkey.slice(0, 8)}...{h.pubkey.slice(-6)}</div>
                        <div className="holder-amount">{amount.toLocaleString()} {tokenData?.symbol}</div>
                        <div className="holder-percentage">({percentage.toFixed(2)}%)</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state">No holders found</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .two-column-layout {
          display: flex;
          gap: 20px;
          width: 100%;
          height: 100%;
          min-height: 600px;
          padding: 20px;
          background: linear-gradient(135deg, #0f1419 0%, #151d28 100%);
          border-radius: 16px;
        }

        /* Left Column Styles */
        .left-column {
          flex: 0 0 280px;
          background: rgba(12, 17, 26, 0.8);
          border-radius: 12px;
          border: 1px solid #232a36;
          overflow-y: auto;
          backdrop-filter: blur(10px);
        }

        .dropdowns-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .column-title {
          font-size: 16px;
          font-weight: 600;
          color: #6c9bd2;
          margin: 0 0 8px 0;
          padding-bottom: 12px;
          border-bottom: 2px solid #232a36;
        }

        .dropdown-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .dropdown-label {
          font-size: 12px;
          font-weight: 500;
          color: #8e9bae;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .dropdown-select {
          padding: 10px 12px;
          background: #0c111a;
          border: 1px solid #232a36;
          border-radius: 8px;
          color: #e6edf5;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .dropdown-select:hover {
          border-color: #6c9bd2;
        }

        .dropdown-select:focus {
          outline: none;
          border-color: #6c9bd2;
          box-shadow: 0 0 0 2px rgba(108, 155, 210, 0.1);
        }

        /* Right Column Styles */
        .right-column {
          flex: 1;
          background: rgba(12, 17, 26, 0.8);
          border-radius: 12px;
          border: 1px solid #232a36;
          overflow-y: auto;
          backdrop-filter: blur(10px);
        }

        .cards-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Card Styles */
        .info-card {
          background: #0c111a;
          border-radius: 12px;
          border: 1px solid #1e2a3a;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .info-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          border-color: #6c9bd2;
        }

        .card-title {
          font-size: 14px;
          font-weight: 600;
          color: #6c9bd2;
          margin: 0;
          padding: 16px 20px;
          background: linear-gradient(135deg, #0f1419 0%, #0c111a 100%);
          border-bottom: 1px solid #1e2a3a;
        }

        .card-content {
          padding: 16px 20px;
        }

        /* Info Row Styles */
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #1e2a3a;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          font-size: 12px;
          color: #8e9bae;
          font-weight: 500;
        }

        .info-value {
          font-size: 13px;
          color: #e6edf5;
          font-weight: 600;
          text-align: right;
        }

        .info-value.verified {
          color: #6fcf97;
        }

        .info-value.positive {
          color: #6fcf97;
        }

        .mono {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          word-break: break-all;
        }

        /* Chart Styles */
        .chart-container {
          width: 100%;
          height: 120px;
          margin-bottom: 12px;
        }

        .chart-svg {
          width: 100%;
          height: 100%;
        }

        .chart-stats {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #8e9bae;
          padding-top: 8px;
          border-top: 1px solid #1e2a3a;
        }

        /* Pools List Styles */
        .pools-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .pool-item {
          padding: 12px;
          background: #0a0e15;
          border-radius: 8px;
          border-left: 3px solid #6c9bd2;
        }

        .pool-name {
          font-size: 13px;
          font-weight: 600;
          color: #e6edf5;
          margin-bottom: 8px;
        }

        .pool-details {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 11px;
          color: #8e9bae;
        }

        /* Transactions List Styles */
        .transactions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .transaction-item {
          padding: 12px;
          background: #0a0e15;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .transaction-item:hover {
          background: #0f1419;
        }

        .tx-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .tx-type {
          font-size: 11px;
          font-weight: 700;
          color: #6c9bd2;
          text-transform: uppercase;
        }

        .tx-time {
          font-size: 10px;
          color: #8e9bae;
        }

        .tx-details {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 11px;
          color: #e6edf5;
          margin-bottom: 8px;
        }

        .tx-link {
          display: inline-block;
          font-size: 10px;
          color: #6c9bd2;
          text-decoration: none;
          font-weight: 600;
        }

        .tx-link:hover {
          text-decoration: underline;
        }

        /* Holders List Styles */
        .holders-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .holder-item {
          display: grid;
          grid-template-columns: 40px 1fr auto auto;
          gap: 12px;
          align-items: center;
          padding: 10px;
          background: #0a0e15;
          border-radius: 8px;
          font-size: 11px;
        }

        .holder-rank {
          font-weight: 700;
          color: #6c9bd2;
        }

        .holder-address {
          font-family: 'Courier New', monospace;
          color: #8e9bae;
        }

        .holder-amount {
          color: #6fcf97;
          font-weight: 500;
        }

        .holder-percentage {
          color: #8e9bae;
          font-size: 10px;
        }

        .empty-state {
          text-align: center;
          color: #8e9bae;
          font-size: 13px;
          padding: 20px;
        }

        /* Scrollbar Styles */
        .left-column::-webkit-scrollbar,
        .right-column::-webkit-scrollbar {
          width: 6px;
        }

        .left-column::-webkit-scrollbar-track,
        .right-column::-webkit-scrollbar-track {
          background: #0c111a;
          border-radius: 3px;
        }

        .left-column::-webkit-scrollbar-thumb,
        .right-column::-webkit-scrollbar-thumb {
          background: #232a36;
          border-radius: 3px;
        }

        .left-column::-webkit-scrollbar-thumb:hover,
        .right-column::-webkit-scrollbar-thumb:hover {
          background: #6c9bd2;
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .two-column-layout {
            flex-direction: column;
          }

          .left-column {
            flex: none;
            height: auto;
            max-height: 400px;
          }

          .right-column {
            flex: none;
          }
        }

        @media (max-width: 768px) {
          .two-column-layout {
            padding: 12px;
            gap: 12px;
          }

          .holder-item {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .tx-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
};

export default TokenDetailsPage;
