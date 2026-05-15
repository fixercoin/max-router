import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { MaxDexClient } from '../maxDexClient';
import { Connection } from '@solana/web3.js';
import './Page.css';

const DeployTokenPage: React.FC = () => {
  const { wallet, deployedTokens, setDeployedTokens, dexClient, setDexClient } = useAppContext();
  const [tokenName, setTokenName] = useState('MAX Token');
  const [tokenSymbol, setTokenSymbol] = useState('MAX');
  const [tokenDecimals, setTokenDecimals] = useState(6);
  const [tokenSupply, setTokenSupply] = useState(100000000);
  const [status, setStatus] = useState('⚡ Ready — Solana Devnet');
  
  // Dropdown states for preset configurations
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('devnet');
  const [selectedTokenStandard, setSelectedTokenStandard] = useState<string>('spl');
  const [selectedMintAuthority, setSelectedMintAuthority] = useState<string>('wallet');

  // Preset configurations
  const presets = {
    custom: { name: 'MAX Token', symbol: 'MAX', supply: 100000000, decimals: 6 },
    meme: { name: 'Doge MAX', symbol: 'DOGEMAX', supply: 1000000000, decimals: 9 },
    utility: { name: 'Utility MAX', symbol: 'UMAX', supply: 50000000, decimals: 6 },
    governance: { name: 'Governance MAX', symbol: 'GMAX', supply: 10000000, decimals: 6 }
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      const config = presets[preset as keyof typeof presets];
      setTokenName(config.name);
      setTokenSymbol(config.symbol);
      setTokenSupply(config.supply);
      setTokenDecimals(config.decimals);
    }
  };

  // Initialize DEX first
  const initializeDex = async () => {
    if (!wallet) {
      alert('Connect wallet first');
      return false;
    }

    setStatus('⏳ Initializing DEX...');

    try {
      const connection = new Connection(selectedNetwork === 'devnet' 
        ? 'https://api.devnet.solana.com'
        : 'https://api.mainnet-beta.solana.com'
      );
      const client = new MaxDexClient(connection, wallet);
      
      await client.initializeDex();
      setDexClient(client);
      setStatus('✅ DEX Initialized! Ready to deploy token.');
      return true;
    } catch (e: any) {
      if (e.message.includes('already in use')) {
        setStatus('✅ DEX already initialized. Ready to deploy token.');
        return true;
      }
      setStatus(`❌ DEX Init failed: ${e.message}`);
      return false;
    }
  };

  const handleDeployToken = async () => {
    if (!wallet) {
      alert('Connect wallet first');
      return;
    }

    setStatus('⏳ Preparing token deployment...');

    try {
      let client = dexClient;
      if (!client) {
        const connection = new Connection(selectedNetwork === 'devnet' 
          ? 'https://api.devnet.solana.com'
          : 'https://api.mainnet-beta.solana.com'
        );
        client = new MaxDexClient(connection, wallet);
        setDexClient(client);
      }

      setStatus('⏳ Deploying token via MAX DEX program...');
      const mintAddress = await client.deployToken(tokenName, tokenSymbol, tokenDecimals);
      
      const initialSupply = tokenSupply * Math.pow(10, tokenDecimals);
      setStatus('⏳ Minting initial supply...');
      await client.mintTokens(mintAddress, initialSupply);

      const metadataAddress = await client.getTokenMetadataAddress(mintAddress);
      const metadata = await client.program.account.tokenMetadata.fetch(metadataAddress) as any;

      const newTokens = [
        ...deployedTokens,
        {
          mint: mintAddress.toString(),
          name: tokenName,
          symbol: tokenSymbol,
          decimals: tokenDecimals,
          totalSupply: tokenSupply,
          circulatingSupply: (metadata.circulatingSupply as any).toString(),
          metadataAddress: metadataAddress.toString(),
          network: selectedNetwork,
          standard: selectedTokenStandard,
        },
      ];
      setDeployedTokens(newTokens);
      localStorage.setItem('MAX_deployed', JSON.stringify(newTokens));

      setStatus(
        `✅ Token deployed via MAX DEX!<br>` +
        `📄 Mint: ${mintAddress.toString()}<br>` +
        `📋 Metadata: ${metadataAddress.toString()}<br>` +
        `💰 Supply: ${tokenSupply.toLocaleString()} ${tokenSymbol}<br>` +
        `🌐 Network: ${selectedNetwork.toUpperCase()}<br>` +
        `🔗 <a href="https://explorer.solana.com/address/${mintAddress.toString()}?cluster=${selectedNetwork}" target="_blank" style="color:#6C9BD2">View Token on Explorer</a>`
      );
      
      setTokenName('MAX Token');
      setTokenSymbol('MAX');
      setTokenDecimals(6);
      setTokenSupply(10000000);
      setSelectedPreset('custom');
      
    } catch (e: any) {
      setStatus(`❌ ${e.message}`);
      console.error('Deployment error:', e);
    }
  };

  const handleQuickFill = (type: string) => {
    switch(type) {
      case 'small':
        setTokenSupply(10000);
        break;
      case 'medium':
        setTokenSupply(1000000);
        break;
      case 'large':
        setTokenSupply(1000000000);
        break;
    }
  };

  return (
    <div className="deploy-token-two-column-layout">
      {/* Left Column - Dropdowns */}
      <div className="left-column">
        <div className="dropdowns-container">
          <h3 className="column-title">⚙️ Deployment Settings</h3>
          
          {/* Status Card */}
          <div className="status-card">
            <div className="status-header">
              <span className="status-icon">📡</span>
              <span className="status-title">Connection Status</span>
            </div>
            <div className="status-content" dangerouslySetInnerHTML={{ __html: status }} />
          </div>

          {/* Dropdown 1 */}
          <div className="dropdown-group">
            <label className="dropdown-label">Token Preset</label>
            <select 
              className="dropdown-select"
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              <option value="custom">🎨 Custom Token</option>
              <option value="meme">🐸 Meme Token</option>
              <option value="utility">⚡ Utility Token</option>
              <option value="governance">🏛️ Governance Token</option>
            </select>
          </div>

          {/* Dropdown 2 */}
          <div className="dropdown-group">
            <label className="dropdown-label">Network</label>
            <select 
              className="dropdown-select"
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
            >
              <option value="devnet">🌐 Devnet (Test)</option>
              <option value="mainnet-beta">🚀 Mainnet (Production)</option>
            </select>
          </div>

          {/* Dropdown 3 */}
          <div className="dropdown-group">
            <label className="dropdown-label">Token Standard</label>
            <select 
              className="dropdown-select"
              value={selectedTokenStandard}
              onChange={(e) => setSelectedTokenStandard(e.target.value)}
            >
              <option value="spl">🪙 SPL Token</option>
              <option value="spl2022">✨ SPL Token 2022</option>
            </select>
          </div>

          {/* Dropdown 4 */}
          <div className="dropdown-group">
            <label className="dropdown-label">Mint Authority</label>
            <select 
              className="dropdown-select"
              value={selectedMintAuthority}
              onChange={(e) => setSelectedMintAuthority(e.target.value)}
            >
              <option value="wallet">👛 Current Wallet</option>
              <option value="multisig">🔐 Multi-sig (Coming Soon)</option>
              <option value="timelock">⏰ Time-lock (Coming Soon)</option>
            </select>
          </div>

          {/* Quick Supply Options */}
          <div className="quick-options">
            <label className="dropdown-label">Quick Supply Options</label>
            <div className="supply-buttons">
              <button onClick={() => handleQuickFill('small')} className="supply-btn">10K</button>
              <button onClick={() => handleQuickFill('medium')} className="supply-btn">1M</button>
              <button onClick={() => handleQuickFill('large')} className="supply-btn">1B</button>
            </div>
          </div>

          {/* Info Card */}
          <div className="info-card-left">
            <div className="info-icon">ℹ️</div>
            <div className="info-text">
              <strong>Deployment Info</strong><br />
              • Fee: ~0.05 SOL<br />
              • Time: ~30 seconds<br />
              • Includes metadata<br />
              • Verified by MAX DEX
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Form Cards */}
      <div className="right-column">
        <div className="cards-container">
          <h3 className="column-title">📝 Token Configuration</h3>
          
          {/* Token Details Card */}
          <div className="config-card">
            <div className="card-header-right">
              <span className="card-icon">🪙</span>
              <span className="card-title">Token Details</span>
            </div>
            <div className="card-content">
              <div className="form-field">
                <label className="field-label">TOKEN NAME</label>
                <input
                  type="text"
                  className="field-input"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="Example: MAX Power"
                />
              </div>
              <div className="form-field">
                <label className="field-label">SYMBOL</label>
                <input
                  type="text"
                  className="field-input"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  placeholder="MAX"
                />
              </div>
              <div className="form-row-two">
                <div className="form-field half">
                  <label className="field-label">DECIMALS</label>
                  <input
                    type="number"
                    className="field-input"
                    value={tokenDecimals}
                    onChange={(e) => setTokenDecimals(parseInt(e.target.value))}
                    min="0"
                    max="9"
                  />
                </div>
                <div className="form-field half">
                  <label className="field-label">TOTAL SUPPLY</label>
                  <input
                    type="number"
                    className="field-input"
                    value={tokenSupply}
                    onChange={(e) => setTokenSupply(parseInt(e.target.value))}
                    min="1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Summary Card */}
          <div className="config-card">
            <div className="card-header-right">
              <span className="card-icon">📊</span>
              <span className="card-title">Configuration Summary</span>
            </div>
            <div className="card-content">
              <div className="summary-row">
                <span className="summary-label">Token Name:</span>
                <span className="summary-value">{tokenName}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Symbol:</span>
                <span className="summary-value">{tokenSymbol}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Decimals:</span>
                <span className="summary-value">{tokenDecimals}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Total Supply:</span>
                <span className="summary-value highlight">{tokenSupply.toLocaleString()} {tokenSymbol}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Network:</span>
                <span className="summary-value">{selectedNetwork.toUpperCase()}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Standard:</span>
                <span className="summary-value">{selectedTokenStandard.toUpperCase()}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Estimated Cost:</span>
                <span className="summary-value">~0.05 SOL</span>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="config-card">
            <div className="card-header-right">
              <span className="card-icon">⚡</span>
              <span className="card-title">Deployment Actions</span>
            </div>
            <div className="card-content">
              {!dexClient && (
                <button className="action-button initialize-btn" onClick={initializeDex}>
                  🔧 INITIALIZE DEX FIRST
                </button>
              )}
              <button 
                className="action-button deploy-btn" 
                onClick={handleDeployToken}
                disabled={!dexClient && !status.includes('already initialized')}
              >
                🚀 DEPLOY TOKEN ON MAX DEX
              </button>
              <div className="warning-text">
                ⚠️ Make sure you have enough SOL for deployment fees
              </div>
            </div>
          </div>

          {/* Recent Deployments Card (if any) */}
          {deployedTokens.length > 0 && (
            <div className="config-card">
              <div className="card-header-right">
                <span className="card-icon">📜</span>
                <span className="card-title">Recent Deployments</span>
              </div>
              <div className="card-content">
                <div className="recent-list">
                  {deployedTokens.slice(-3).reverse().map((token, idx) => (
                    <div key={idx} className="recent-item">
                      <div className="recent-symbol">{token.symbol}</div>
                      <div className="recent-details">
                        <div>{token.name}</div>
                        <div className="recent-supply">{token.totalSupply.toLocaleString()} supply</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .deploy-token-two-column-layout {
          display: flex;
          gap: 20px;
          width: 100%;
          height: 100%;
          min-height: 600px;
          padding: 20px;
          background: linear-gradient(135deg, #0f1419 0%, #151d28 100%);
          border-radius: 16px;
        }

        /* Left Column */
        .left-column {
          flex: 0 0 320px;
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
          gap: 20px;
        }

        .column-title {
          font-size: 16px;
          font-weight: 600;
          color: #6c9bd2;
          margin: 0 0 8px 0;
          padding-bottom: 12px;
          border-bottom: 2px solid #232a36;
        }

        /* Status Card */
        .status-card {
          background: #0c111a;
          border-radius: 10px;
          border: 1px solid #1e2a3a;
          overflow: hidden;
        }

        .status-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: linear-gradient(135deg, #0f1419 0%, #0c111a 100%);
          border-bottom: 1px solid #1e2a3a;
        }

        .status-icon {
          font-size: 18px;
        }

        .status-title {
          font-size: 12px;
          font-weight: 600;
          color: #8e9bae;
          text-transform: uppercase;
        }

        .status-content {
          padding: 12px;
          font-size: 12px;
          color: #e6edf5;
          line-height: 1.5;
        }

        /* Dropdown Styles */
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

        /* Quick Options */
        .quick-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .supply-buttons {
          display: flex;
          gap: 8px;
        }

        .supply-btn {
          flex: 1;
          padding: 8px;
          background: #0c111a;
          border: 1px solid #232a36;
          border-radius: 6px;
          color: #8e9bae;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .supply-btn:hover {
          border-color: #6c9bd2;
          color: #6c9bd2;
        }

        /* Info Card */
        .info-card-left {
          background: rgba(108, 155, 210, 0.05);
          border: 1px solid #232a36;
          border-radius: 10px;
          padding: 12px;
          display: flex;
          gap: 12px;
        }

        .info-icon {
          font-size: 20px;
        }

        .info-text {
          font-size: 11px;
          color: #8e9bae;
          line-height: 1.6;
        }

        .info-text strong {
          color: #6c9bd2;
        }

        /* Right Column */
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

        /* Config Cards */
        .config-card {
          background: #0c111a;
          border-radius: 12px;
          border: 1px solid #1e2a3a;
          overflow: hidden;
          transition: all 0.2s;
        }

        .config-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          border-color: #6c9bd2;
        }

        .card-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 20px;
          background: linear-gradient(135deg, #0f1419 0%, #0c111a 100%);
          border-bottom: 1px solid #1e2a3a;
        }

        .card-icon {
          font-size: 18px;
        }

        .card-title {
          font-size: 14px;
          font-weight: 600;
          color: #6c9bd2;
        }

        .card-content {
          padding: 20px;
        }

        /* Form Fields */
        .form-field {
          margin-bottom: 16px;
        }

        .form-field:last-child {
          margin-bottom: 0;
        }

        .field-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #8e9bae;
          text-transform: uppercase;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }

        .field-input {
          width: 100%;
          padding: 10px 12px;
          background: #0a0e15;
          border: 1px solid #232a36;
          border-radius: 8px;
          color: #e6edf5;
          font-size: 14px;
          transition: all 0.2s;
        }

        .field-input:focus {
          outline: none;
          border-color: #6c9bd2;
          box-shadow: 0 0 0 2px rgba(108, 155, 210, 0.1);
        }

        .form-row-two {
          display: flex;
          gap: 12px;
        }

        .form-field.half {
          flex: 1;
        }

        /* Summary Rows */
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #1e2a3a;
        }

        .summary-row:last-child {
          border-bottom: none;
        }

        .summary-label {
          font-size: 12px;
          color: #8e9bae;
        }

        .summary-value {
          font-size: 13px;
          color: #e6edf5;
          font-weight: 500;
        }

        .summary-value.highlight {
          color: #6fcf97;
          font-weight: 700;
        }

        /* Action Buttons */
        .action-button {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .initialize-btn {
          background: rgba(108, 155, 210, 0.1);
          border: 1px solid #6c9bd2;
          color: #6c9bd2;
        }

        .initialize-btn:hover {
          background: rgba(108, 155, 210, 0.2);
          transform: translateY(-1px);
        }

        .deploy-btn {
          background: linear-gradient(135deg, #6c9bd2 0%, #4a7aab 100%);
          color: white;
        }

        .deploy-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(108, 155, 210, 0.3);
        }

        .deploy-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .warning-text {
          text-align: center;
          font-size: 11px;
          color: #f39c12;
          margin-top: 8px;
        }

        /* Recent Deployments */
        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .recent-item {
          display: flex;
          gap: 12px;
          padding: 10px;
          background: #0a0e15;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .recent-item:hover {
          background: #0f1419;
        }

        .recent-symbol {
          font-size: 18px;
          font-weight: 700;
          color: #6c9bd2;
        }

        .recent-details {
          flex: 1;
        }

        .recent-details div:first-child {
          font-size: 12px;
          color: #e6edf5;
          margin-bottom: 4px;
        }

        .recent-supply {
          font-size: 10px;
          color: #8e9bae;
        }

        /* Scrollbar */
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

        /* Responsive */
        @media (max-width: 1024px) {
          .deploy-token-two-column-layout {
            flex-direction: column;
          }

          .left-column {
            flex: none;
            max-height: 400px;
          }

          .right-column {
            flex: none;
          }
        }

        @media (max-width: 768px) {
          .deploy-token-two-column-layout {
            padding: 12px;
            gap: 12px;
          }

          .form-row-two {
            flex-direction: column;
            gap: 16px;
          }

          .summary-row {
            flex-direction: column;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
};

export default DeployTokenPage;
