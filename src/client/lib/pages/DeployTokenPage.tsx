import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { MaxDexClient } from '../lib/maxDexClient';
import { Connection, PublicKey } from '@solana/web3.js';
import './Page.css';

const DeployTokenPage: React.FC = () => {
  const { wallet, deployedTokens, setDeployedTokens, dexClient, setDexClient } = useAppContext();
  const [tokenName, setTokenName] = useState('MAX Token');
  const [tokenSymbol, setTokenSymbol] = useState('MAX');
  const [tokenDecimals, setTokenDecimals] = useState(6);
  const [tokenSupply, setTokenSupply] = useState(100,000,000); // ADD THIS LINE
  const [status, setStatus] = useState('⚡ Ready — Solana Devnet');

  // Initialize DEX first
  const initializeDex = async () => {
    if (!wallet) {
      alert('Connect wallet first');
      return false;
    }

    setStatus('⏳ Initializing DEX...');

    try {
      const connection = new Connection('https://api.devnet.solana.com');
      const client = new MaxDexClient(connection, wallet);
      
      await client.initializeDex();
      setDexClient(client);
      setStatus('✅ DEX Initialized! Ready to deploy token.');
      return true;
    } catch (e: any) {
      // If DEX already initialized, try to get existing state
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
      // Initialize DEX if not already done
      let client = dexClient;
      if (!client) {
        const connection = new Connection('https://api.devnet.solana.com');
        client = new MaxDexClient(connection, wallet);
        setDexClient(client);
      }

      // Deploy token using YOUR program
      setStatus('⏳ Deploying token via MAX DEX program...');
      const mintAddress = await client.deployToken(tokenName, tokenSymbol, tokenDecimals);
      
      // Mint initial supply (convert to raw amount with decimals)
      const initialSupply = tokenSupply * Math.pow(10, tokenDecimals);
      setStatus('⏳ Minting initial supply...');
      await client.mintTokens(mintAddress, initialSupply);

      // Get token metadata from your program
      const metadataAddress = await client.getTokenMetadataAddress(mintAddress);
      const metadata = await client.program.account.tokenMetadata.fetch(metadataAddress);

      // Save to deployed tokens
      const newTokens = [
        ...deployedTokens,
        {
          mint: mintAddress.toString(),
          name: tokenName,
          symbol: tokenSymbol,
          decimals: tokenDecimals,
          totalSupply: tokenSupply,
          circulatingSupply: metadata.circulatingSupply.toString(),
          metadataAddress: metadataAddress.toString(),
        },
      ];
      setDeployedTokens(newTokens);
      localStorage.setItem('MAX_deployed', JSON.stringify(newTokens));

      setStatus(
        `✅ Token deployed via MAX DEX!<br>` +
        `📄 Mint: ${mintAddress.toString()}<br>` +
        `📋 Metadata: ${metadataAddress.toString()}<br>` +
        `💰 Supply: ${tokenSupply.toLocaleString()} ${tokenSymbol}<br>` +
        `🔗 <a href="https://explorer.solana.com/address/${mintAddress.toString()}?cluster=devnet" target="_blank" style="color:#6C9BD2">View Token on Explorer</a>`
      );
      
      // Reset form
      setTokenName('MAX Token');
      setTokenSymbol('MAX');
      setTokenDecimals(6);
      setTokenSupply(10000000);
      
    } catch (e: any) {
      setStatus(`❌ ${e.message}`);
      console.error('Deployment error:', e);
    }
  };

  return (
    <div className="dex-card">
      <div className="card-header">
        <span className="card-title">DEPLOY TOKEN ON MAX DEX</span>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>TOKEN NAME</label>
          <input
            type="text"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="Example: MAX Power"
          />
        </div>
        <div className="form-group">
          <label>SYMBOL</label>
          <input
            type="text"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value)}
            placeholder="MAX"
          />
        </div>
        <div className="form-group">
          <label>DECIMALS</label>
          <input
            type="number"
            value={tokenDecimals}
            onChange={(e) => setTokenDecimals(parseInt(e.target.value))}
            min="0"
            max="9"
          />
        </div>
        <div className="form-group">
          <label>TOTAL SUPPLY (in tokens)</label>
          <input
            type="number"
            value={tokenSupply}
            onChange={(e) => setTokenSupply(parseInt(e.target.value))}
            min="1"
          />
        </div>
      </div>

      {/* Show Initialize DEX button if DEX not ready */}
      {!dexClient && (
        <button className="action-button" onClick={initializeDex} style={{ marginBottom: '10px' }}>
          INITIALIZE DEX FIRST
        </button>
      )}

      <button 
        className="action-button" 
        onClick={handleDeployToken}
        disabled={!dexClient && !status.includes('already initialized')}
      >
        DEPLOY TOKEN ON MAX DEX
      </button>

      <div className="status-area" dangerouslySetInnerHTML={{ __html: status }} />
    </div>
  );
};

export default DeployTokenPage;
