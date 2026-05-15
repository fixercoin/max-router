import React, { Fragment } from 'react';
import { useAppContext } from '../../context/AppContext';
import './Page.css';
import './MyTokensPage.css';

const MyTokensPage: React.FC = () => {
  const { deployedTokens, setCurrentPage, setSelectedTokenForDetails } = useAppContext();

  const handleViewToken = (mint: string) => {
    setSelectedTokenForDetails(mint);
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

      <div className="token-list">
        {deployedTokens.length === 0 ? (
          <div className="empty-tokens">— No tokens deployed —</div>
        ) : (
          <div className="token-items">
            {deployedTokens.map((t) => (
              <div key={t.mint} className="token-item">
                <div className="token-info">
                  <div className="token-header">
                    <b>{t.symbol}</b> / {t.name}
                  </div>
                  <div className="token-mint">Mint: {t.mint.slice(0, 28)}…</div>
                  {t.isVerified && (
                    <div className="token-verified">✓ Verified</div>
                  )}
                  {t.circulatingSupply && (
                    <div className="token-supply">
                      Supply: {parseInt(t.circulatingSupply) / Math.pow(10, t.decimals)} {t.symbol}
                    </div>
                  )}
                </div>
                <div className="token-actions">
                  <button
                    className="token-action copy-btn"
                    onClick={() => handleCopyMint(t.mint)}
                  >
                    📋 COPY
                  </button>
                  <button
                    className="token-action view-btn"
                    onClick={() => handleViewToken(t.mint)}
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
