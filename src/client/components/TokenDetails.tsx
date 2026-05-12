import React, { useState, useEffect } from 'react';
import './TokenDetails.css';
import IDLManager, { TokenInfo, TransactionRecord } from '../../lib/idlManager';

export const TokenDetails: React.FC = () => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const idlManager = new IDLManager();

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const mockTokens: TokenInfo[] = [
        {
          mint: '36qH8uWkekoCa8qzFcBCkmZqUr9Y9JzFgtwct7RsJrTk',
          name: 'MAX Token',
          symbol: 'MAX',
          decimals: 6,
          totalSupply: 1_000_000_000,
          circulatingSupply: 800_000_000,
          creator: 'MaxAuthorityPubkey',
          creationTimestamp: 1704067200,
          logoUri: 'https://example.com/max-logo.png',
          description: 'MAX DEX Governance Token',
          holdersCount: 1250,
          isVerified: true,
          autoBurnEnabled: true,
          autoBurnEndTimestamp: 1767139200,
          burnedAmount: 200_000_000,
        },
      ];
      setTokens(mockTokens);
      if (mockTokens.length > 0) {
        setSelectedToken(mockTokens[0]);
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSelect = (token: TokenInfo) => {
    setSelectedToken(token);
    loadTokenTransactions(token.mint);
  };

  const loadTokenTransactions = async (tokenMint: string) => {
    try {
      const mockTransactions: TransactionRecord[] = [
        {
          pool: 'Pool1',
          user: 'User1',
          type: 'Swap',
          amountA: 1000000,
          amountB: 900000,
          fee: 1000,
          timestamp: Date.now() - 3600000,
          hash: 'abc123',
        },
        {
          pool: 'Pool1',
          user: 'User2',
          type: 'AddLiquidity',
          amountA: 500000,
          amountB: 500000,
          fee: 0,
          timestamp: Date.now() - 7200000,
          hash: 'def456',
        },
      ];
      setTransactions(mockTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const filteredTokens = tokens.filter(token =>
    token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.mint.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const calculateBurnProgress = (): number => {
    if (!selectedToken) return 0;
    return (selectedToken.burnedAmount / (selectedToken.totalSupply * 0.2)) * 100;
  };

  return (
    <div className="token-details-container">
      <div className="token-details-header">
        <h1>Token Management Hub</h1>
        <p>Track deployed tokens, holders, and transaction history</p>
      </div>

      <div className="token-details-grid">
        <div className="tokens-list-section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search by name, symbol, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="tokens-list">
            {loading ? (
              <div className="loading">Loading tokens...</div>
            ) : filteredTokens.length > 0 ? (
              filteredTokens.map((token) => (
                <div
                  key={token.mint}
                  className={`token-item ${selectedToken?.mint === token.mint ? 'active' : ''}`}
                  onClick={() => handleTokenSelect(token)}
                >
                  <div className="token-item-header">
                    <div className="token-name">
                      <h3>{token.name}</h3>
                      <span className="token-symbol">{token.symbol}</span>
                    </div>
                    {token.isVerified && <span className="verified-badge">✓ Verified</span>}
                  </div>
                  <div className="token-item-meta">
                    <p className="token-mint">
                      {token.mint.slice(0, 16)}...
                    </p>
                    <p className="token-holders">{formatNumber(token.holdersCount)} holders</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-tokens">No tokens found</div>
            )}
          </div>
        </div>

        {selectedToken && (
          <div className="token-info-section">
            <div className="token-header-card">
              <div className="token-header-content">
                <h2>{selectedToken.name}</h2>
                <div className="token-badges">
                  {selectedToken.isVerified && <span className="badge verified">Verified</span>}
                  {selectedToken.autoBurnEnabled && <span className="badge burn">Auto-Burn Enabled</span>}
                </div>
              </div>
            </div>

            <div className="token-stats-grid">
              <div className="stat-card">
                <label>Symbol</label>
                <value>{selectedToken.symbol}</value>
              </div>

              <div className="stat-card">
                <label>Decimals</label>
                <value>{selectedToken.decimals}</value>
              </div>

              <div className="stat-card">
                <label>Total Supply</label>
                <value>{formatNumber(selectedToken.totalSupply)}</value>
              </div>

              <div className="stat-card">
                <label>Circulating Supply</label>
                <value>{formatNumber(selectedToken.circulatingSupply)}</value>
              </div>

              <div className="stat-card">
                <label>Token Holders</label>
                <value>{formatNumber(selectedToken.holdersCount)}</value>
              </div>

              <div className="stat-card">
                <label>Contract Address</label>
                <code className="address">{selectedToken.mint}</code>
              </div>
            </div>

            <div className="token-metadata-card">
              <h3>Token Metadata</h3>
              <div className="metadata-content">
                <div className="metadata-row">
                  <label>Name:</label>
                  <span>{selectedToken.name}</span>
                </div>
                <div className="metadata-row">
                  <label>Symbol:</label>
                  <span>{selectedToken.symbol}</span>
                </div>
                <div className="metadata-row">
                  <label>Creator:</label>
                  <code>{selectedToken.creator}</code>
                </div>
                <div className="metadata-row">
                  <label>Creation Date:</label>
                  <span>{formatDate(selectedToken.creationTimestamp)}</span>
                </div>
                <div className="metadata-row">
                  <label>Description:</label>
                  <span>{selectedToken.description}</span>
                </div>
                {selectedToken.logoUri && (
                  <div className="metadata-row">
                    <label>Logo:</label>
                    <img src={selectedToken.logoUri} alt={selectedToken.symbol} className="token-logo" />
                  </div>
                )}
              </div>
            </div>

            {selectedToken.autoBurnEnabled && (
              <div className="burn-mechanism-card">
                <h3>Auto-Burn Mechanism</h3>
                <div className="burn-info">
                  <div className="burn-stat">
                    <label>Burn Percentage:</label>
                    <value>{20}%</value>
                  </div>
                  <div className="burn-stat">
                    <label>Burn Duration:</label>
                    <value>730 days</value>
                  </div>
                  <div className="burn-stat">
                    <label>Burned Amount:</label>
                    <value>{formatNumber(selectedToken.burnedAmount)}</value>
                  </div>
                  <div className="burn-stat">
                    <label>End Timestamp:</label>
                    <value>{formatDate(selectedToken.autoBurnEndTimestamp)}</value>
                  </div>
                </div>

                <div className="burn-progress">
                  <div className="progress-label">
                    <span>Burn Progress</span>
                    <span>{calculateBurnProgress().toFixed(2)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(calculateBurnProgress(), 100)}%` }}></div>
                  </div>
                </div>
              </div>
            )}

            <div className="transactions-card">
              <h3>Recent Transactions</h3>
              {transactions.length > 0 ? (
                <div className="transactions-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>User</th>
                        <th>Amount In</th>
                        <th>Amount Out</th>
                        <th>Fee</th>
                        <th>Time</th>
                        <th>Hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr key={idx}>
                          <td><span className={`tx-type ${tx.type.toLowerCase()}`}>{tx.type}</span></td>
                          <td><code>{tx.user.slice(0, 8)}...</code></td>
                          <td>{formatNumber(tx.amountA)}</td>
                          <td>{formatNumber(tx.amountB)}</td>
                          <td>{formatNumber(tx.fee)}</td>
                          <td>{formatDate(Math.floor(tx.timestamp / 1000))}</td>
                          <td>
                            {tx.hash && (
                              <a href={`https://solscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">
                                {tx.hash.slice(0, 8)}...
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-transactions">No transactions yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenDetails;
