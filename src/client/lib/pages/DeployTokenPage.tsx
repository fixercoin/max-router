import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { connection, TOKEN_PROGRAM_ID } from '../lib/solanaService';
import * as solanaWeb3 from '@solana/web3.js';
import './Page.css';

const DeployTokenPage: React.FC = () => {
  const { wallet, deployedTokens, setDeployedTokens } = useAppContext();
  const [tokenName, setTokenName] = useState('MAX Token');
  const [tokenSymbol, setTokenSymbol] = useState('MAX');
  const [tokenDecimals, setTokenDecimals] = useState(9);
  const [tokenSupply, setTokenSupply] = useState(10000000);
  const [status, setStatus] = useState('⚡ Ready — Solana Devnet');

  const handleDeployToken = async () => {
    if (!wallet) {
      alert('Connect wallet first');
      return;
    }

    setStatus('⏳ Preparing transaction...');

    try {
      if (!window.solana || !window.solana.publicKey) {
        setStatus('❌ Wallet disconnected. Please reconnect.');
        return;
      }

      const mintKeypair = solanaWeb3.Keypair.generate();
      const rent = await connection.getMinimumBalanceForRentExemption(82);

      setStatus('⏳ Getting fresh blockhash...');
      const blockhashData = await connection.getLatestBlockhash('confirmed');

      const transaction = new solanaWeb3.Transaction({
        recentBlockhash: blockhashData.blockhash,
        feePayer: wallet.publicKey,
      });

      transaction.add(
        solanaWeb3.SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          lamports: rent,
          space: 82,
          programId: new solanaWeb3.PublicKey(TOKEN_PROGRAM_ID),
        })
      );

      setStatus('⏳ Waiting for wallet signature... (20 sec timeout)');
      let signed;
      try {
        const signPromise = wallet.signTransaction(transaction);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Wallet signature timeout')), 20000)
        );
        signed = await Promise.race([signPromise, timeoutPromise]);
        signed.partialSign(mintKeypair);
      } catch (walletErr: any) {
        const errorMsg = walletErr.message || 'User rejected';
        setStatus(`❌ Wallet sign failed: ${errorMsg}`);
        return;
      }

      setStatus('⏳ Sending to network...');
      let signature;
      let retries = 0;
      while (retries < 3) {
        try {
          signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 3,
          });
          break;
        } catch (sendErr: any) {
          retries++;
          if (retries < 3 && sendErr.message?.includes('blockhash')) {
            setStatus('⏳ Retrying transaction with fresh blockhash...');
            continue;
          }
          throw sendErr;
        }
      }

      setStatus('⏳ Waiting for confirmation...');
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: blockhashData.blockhash,
          lastValidBlockHeight: blockhashData.lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      const newTokens = [
        ...deployedTokens,
        {
          mint: mintKeypair.publicKey.toString(),
          name: tokenName,
          symbol: tokenSymbol,
          decimals: tokenDecimals,
          totalSupply: tokenSupply,
          txid: signature,
        },
      ];
      setDeployedTokens(newTokens);
      localStorage.setItem('MAX_deployed', JSON.stringify(newTokens));

      setStatus(
        `✅ Token deployed!<br>📄 Mint: ${mintKeypair.publicKey.toString()}<br>🔗 <a href="https://explorer.solana.com/tx/${signature}?cluster=devnet" target="_blank" style="color:#6C9BD2">View Transaction</a>`
      );
    } catch (e: any) {
      setStatus(`❌ ${e.message}`);
      console.error('Deployment error:', e);
    }
  };

  return (
    <div className="dex-card">
      <div className="card-header">
        <span className="card-title">DEPLOY NEW SPL TOKEN</span>
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
          />
        </div>
        <div className="form-group">
          <label>TOTAL SUPPLY</label>
          <input
            type="number"
            value={tokenSupply}
            onChange={(e) => setTokenSupply(parseInt(e.target.value))}
          />
        </div>
      </div>

      <button className="action-button" onClick={handleDeployToken}>
        DEPLOY TOKEN
      </button>

      <div className="status-area" dangerouslySetInnerHTML={{ __html: status }} />
    </div>
  );
};

export default DeployTokenPage;
