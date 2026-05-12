import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { connectWallet } from '../lib/solanaService';
import './Header.css';

const Header: React.FC = () => {
  const { wallet, setWallet } = useAppContext();
  const [walletStatus, setWalletStatus] = useState<string>('');

  const handleConnectWallet = async () => {
    try {
      const w = await connectWallet();
      setWallet(w);
      setWalletStatus(`${w.publicKey.toString().slice(0, 28)}... (devnet)`);
    } catch (e: any) {
      setWalletStatus(e.message || 'Connection failed');
    }
  };

  return (
    <header className="fixed-header">
      <div className="brand">
        <h1>MAX</h1>
      </div>
      <div className="wallet-section">
        <button
          className="connect-wallet"
          onClick={handleConnectWallet}
        >
          {wallet ? 'WALLET ACTIVE' : 'CONNECT WALLET'}
        </button>
        {walletStatus && <div className="wallet-status">{walletStatus}</div>}
      </div>
    </header>
  );
};

export default Header;
