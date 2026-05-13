import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getTokenMetadata, getTokenHolders } from '../solanaService';
import { PublicKey } from '@solana/web3.js';
import './Page.css';

const TokenDetailsPage: React.FC = () => {
  const { deployedTokens, setCurrentPage, selectedTokenForDetails, dexClient, pools } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [supply, setSupply] = useState<any>(null);
  const [holders, setHolders] = useState<any[]>([]);
  const [programMetadata, setProgramMetadata] = useState<any>(null);
  const [poolsWithToken, setPoolsWithToken] = useState<any[]>([]);

  const loadTokenDetails = useCallback(async () => {
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
  }, [selectedTokenForDetails]);

  // NEW: Load metadata from your MAX DEX program
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

  // NEW: Find pools containing this token
  const findPoolsWithToken = useCallback(() => {
    const tokenPools = pools.filter(
      (p) => p.tokenA === selectedTokenForDetails || p.tokenB === selectedTokenForDetails
    );
    setPoolsWithToken(tokenPools);
  }, [pools, selectedTokenForDetails]);

  useEffect(() => {
    loadTokenDetails();
    loadProgramMetadata();
    findPoolsWithToken();
  }, [loadTokenDetails, loadProgramMetadata, findPoolsWithToken]);

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
            {/* Basic Token Info */}
            {tokenData && (
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #232A36' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                  {tokenData.symbol} - {tokenData.name}
                </div>
                <div style={{ fontSize: '11px', color: '#8E9BAE', wordBreak: 'break-all', marginBottom: '8px' }}>
                  🔑 Mint: {selectedTokenForDetails}
                </div>
                
                {/* MAX DEX Program Metadata */}
                {programMetadata && (
                  <div style={{ marginTop: '8px', padding: '8px', background: '#0A0E15', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#6C9BD2', marginBottom: '4px' }}>
                      ✓ MAX DEX Verified Token
                    </div>
                    <div style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <span style={{ color: '#A0AEC0' }}>Creator:</span>{' '}
                        <span style={{ color: '#6FCF97', fontSize: '10px' }}>
                          {programMetadata.creator.toString().slice(0, 12)}...
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#A0AEC0' }}>Verified:</span>{' '}
                        <span style={{ color: programMetadata.isVerified ? '#6FCF97' : '#F59E0B' }}>
                          {programMetadata.isVerified ? '✓ Yes' : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#A0AEC0' }}>Total Supply:</span>{' '}
                        <span style={{ color: '#6FCF97' }}>
                          {(programMetadata.totalSupply / Math.pow(10, tokenData.decimals)).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#A0AEC0' }}>Circulating:</span>{' '}
                        <span style={{ color: '#6FCF97' }}>
                          {(programMetadata.circulatingSupply / Math.pow(10, tokenData.decimals)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div style={{ fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
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

            {/* On-Chain Supply */}
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

            {/* Pools with this token - NEW */}
            {poolsWithToken.length > 0 && (
              <div style={{ marginBottom: '16px', padding: '12px', background: '#0A0E15', borderRadius: '12px', border: '1px solid #1E2A3A' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#6C9BD2', marginBottom: '8px' }}>
                  💧 Liquidity Pools
                </div>
                {poolsWithToken.map((pool, idx) => (
                  <div key={idx} style={{ fontSize: '11px', marginBottom: '8px', padding: '6px', background: '#0C111A', borderRadius: '6px' }}>
                    <div>Pool: {pool.symbolA}/{pool.symbolB}</div>
                    <div>Fee: {pool.fee / 100}%</div>
                    <div>Liquidity: {(pool.reserveA / 1e6).toFixed(2)} {pool.symbolA} / {(pool.reserveB / 1e6).toFixed(2)} {pool.symbolB}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Token Holders */}
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

            {/* Auto-burn info from your program */}
            {programMetadata?.autoBurnEnabled && (
              <div style={{ marginBottom: '16px', padding: '12px', background: '#0A0E15', borderRadius: '12px', border: '1px solid #1E2A3A' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#6C9BD2', marginBottom: '8px' }}>
                  🔥 Auto-Burn Mechanism
                </div>
                <div style={{ fontSize: '11px' }}>
                  <div>Status: <span style={{ color: '#6FCF97' }}>Active</span></div>
                  <div>Total Burned: {(programMetadata.burnedAmount / Math.pow(10, tokenData?.decimals || 6)).toLocaleString()} {tokenData?.symbol}</div>
                  <div>End Date: {new Date(programMetadata.autoBurnEndTimestamp * 1000).toLocaleDateString()}</div>
                </div>
              </div>
            )}

            <div style={{ fontSize: '11px', color: '#8E9BAE', paddingTop: '12px', borderTop: '1px solid #232A36' }}>
              <div style={{ marginBottom: '6px' }}>📈 Trade History: Coming soon</div>
              <div style={{ marginBottom: '6px' }}>
                💧 Liquidity Volume: Check pool section above
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenDetailsPage;
