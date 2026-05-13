import React, { Fragment } from 'react';
import { useAppContext } from '../../context/AppContext';
import './Page.css';

const MyTokensPage: React.FC = () => {
  const { deployedTokens, setCurrentPage, setSelectedTokenForDetails } = useAppContext();

  const handleViewToken = (mint: string) => {
    setSelectedTokenForDetails(mint);
    setCurrentPage('details');
  };

  const handleCopyMint = (mint: string) => {
    navigator.clipboard.writeText(mint);
    alert('Mint copied!');
  };

  return (
    <div className="dex-card">
      <div className="card-header">
        <span className="card-title">DEPLOYED TOKENS</span>
      </div>

      <div className="status-area" style={{ maxHeight: '380px' }}>
        {deployedTokens.length === 0 ? (
          '— No tokens deployed —'
        ) : (
          <div>
            {deployedTokens.map((t, idx) => (
              <div
                key={t.mint}
                style={{
                  background: '#0C111A',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  border: '1px solid #1E2A3A',
                }}
              >
                <span>
                  <b>{t.symbol}</b> / {t.name}
                  <br />
                  <span style={{ fontSize: '11px', color: '#6C809C' }}>
                    Mint: {t.mint.slice(0, 28)}…
                  </span>
                  {t.isVerified && (
                    <span style={{ fontSize: '10px', color: '#4CAF50', marginLeft: '8px' }}>
                      ✓ Verified
                    </span>
                  )}
                  {t.circulatingSupply && (
                    <Fragment>
                      <br />
                      <span style={{ fontSize: '10px', color: '#6C809C' }}>
                        Supply: {parseInt(t.circulatingSupply) / Math.pow(10, t.decimals)} {t.symbol}
                      </span>
                    </Fragment>
                  )}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="copy-mini"
                    onClick={() => handleCopyMint(t.mint)}
                    style={{
                      background: '#1E2A3A',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: '#6C809C'
                    }}
                  >
                    📋 COPY
                  </button>
                  <button
                    className="copy-mini"
                    onClick={() => handleViewToken(t.mint)}
                    style={{
                      background: '#1E2A3A',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: '#6C9BD2'
                    }}
                  >
                    👁 VIEW
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTokensPage;
