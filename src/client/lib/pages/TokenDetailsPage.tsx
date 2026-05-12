import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getTokenMetadata, getTokenHolders } from '../lib/solanaService';
import './Page.css';

const TokenDetailsPage: React.FC = () => {
  const { deployedTokens, setCurrentPage, selectedTokenForDetails } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [supply, setSupply] = useState<any>(null);
  const [holders, setHolders] = useState<any[]>([]);

  useEffect(() => {
    loadTokenDetails();
  }, [selectedTokenForDetails]);

  const loadTokenDetails = async () => {
    if (!selectedTokenForDetails) return;
    setLoading(true);

    try {
      const supplyData = await getTokenMetadata(selectedTokenForDetails);
      setSupply(supplyData);

      const holdersData = await getTokenHolders(selectedTokenForDetails);
      setHolders(holdersData);
    } catch (e) {
      console.error('Failed to load details:', e);
    }

    setLoading(false);
  };

  const tokenData = deployedTokens.find((t) => t.mint === selectedTokenForDetails);

  if (!selectedTokenForDetails) {
    return <div className="dex-card">No token selected</div>;
  }

  return (
    <div className="dex-card">
      <div className="card-header">
        <span className="card-title">TOKEN DETAILS</span>
        <button
          className="action-button back-button"
          onClick={() => setCurrentPage('tokens')}
        >
          ← BACK
        </button>
      </div>

      <div className="status-area" style={{ maxHeight: '500px', whiteSpace: 'normal' }}>
        {loading ? (
          '⏳ Loading token details...'
        ) : (
          <div style={{ padding: '8px', color: '#E6EDF5' }}>
            {tokenData && (
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #232A36' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                  {tokenData.symbol} - {tokenData.name}
                </div>
                <div style={{ fontSize: '11px', color: '#8E9BAE', wordBreak: 'break-all', marginBottom: '8px' }}>
                  🔑 {selectedTokenForDetails}
                </div>
                <div style={{ fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <span style={{ color: '#A0AEC0' }}>Decimals:</span>{' '}
                    <span style={{ color: '#6FCF97' }}>{tokenData.decimals}</span>
                  </div>
                  <div>
                    <span style={{ color: '#A0AEC0' }}>Initial Supply:</span>{' '}
                    <span style={{ color: '#6FCF97' }}>
                      {(tokenData.totalSupply / Math.pow(10, tokenData.decimals)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {supply && (
              <div style={{ marginBottom: '16px', padding: '12px', background: '#0A0E15', borderRadius: '12px', border: '1px solid #1E2A3A' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#6C9BD2', marginBottom: '8px' }}>
                  📊 Current On-Chain Supply
                </div>
                <div style={{ fontSize: '13px', color: '#E6EDF5' }}>
                  {(supply.amount / Math.pow(10, supply.decimals)).toLocaleString()} {tokenData?.symbol || 'tokens'}
                </div>
                <div style={{ fontSize: '11px', color: '#8E9BAE', marginTop: '4px' }}>
                  Decimals: {supply.decimals}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px', padding: '12px', background: '#0A0E15', borderRadius: '12px', border: '1px solid #1E2A3A' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#6C9BD2', marginBottom: '8px' }}>
                👥 Token Holders ({holders.length})
              </div>
              {holders.length > 0 ? (
                <>
                  {holders.slice(0, 10).map((h, i) => {
                    const parsed = h.account.data?.parsed?.info;
                    const amount = parsed?.tokenAmount?.uiAmount || 0;
                    const addr = h.pubkey.slice(0, 8);
                    return (
                      <div
                        key={i}
                        style={{
                          fontSize: '11px',
                          padding: '6px',
                          background: '#0C111A',
                          borderRadius: '8px',
                          marginBottom: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{i + 1}. {addr}…</span>
                        <span style={{ color: '#6FCF97' }}>{amount.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {holders.length > 10 && (
                    <div style={{ fontSize: '11px', color: '#8E9BAE', textAlign: 'center', marginTop: '8px' }}>
                      +{holders.length - 10} more holders
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '11px', color: '#8E9BAE' }}>No holders found</div>
              )}
            </div>

            <div style={{ fontSize: '11px', color: '#8E9BAE', paddingTop: '12px', borderTop: '1px solid #232A36' }}>
              <div style={{ marginBottom: '6px' }}>📈 Trade History: Coming soon</div>
              <div style={{ marginBottom: '6px' }}>
                💧 Liquidity Volume: Coming soon (integrate your DEX pool data)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenDetailsPage;
