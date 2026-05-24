import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

declare global {
  interface Window {
    fixorium?: any;
    solana?: any;
  }
}

interface WalletInfo {
  publicKey: string;
  provider: any;
  isConnected: boolean;
}

const Header: React.FC = () => {
  const { wallet, setWallet, currentPage, setCurrentPage } = useAppContext();
  const [walletStatus, setWalletStatus] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if Fixorium wallet is installed
  const isFixoriumInstalled = (): boolean => {
    return !!window.fixorium || !!window.solana;
  };

  // Get Fixorium provider
  const getProvider = () => {
    return window.fixorium || window.solana;
  };

  // Check if wallet is already connected on page load
  useEffect(() => {
    const checkWalletConnection = async () => {
      const provider = getProvider();
      if (provider && provider.isConnected) {
        try {
          // Try to get connected wallet info
          const accounts = await provider.getAccounts?.();
          if (accounts && accounts.length > 0) {
            const walletInfo: WalletInfo = {
              publicKey: accounts[0],
              provider: provider,
              isConnected: true
            };
            setWallet(walletInfo);
            setWalletStatus(`${accounts[0].slice(0, 28)}...`);
          }
        } catch (error) {
          console.log('Not connected or error checking connection');
        }
      }
    };

    // Listen for Fixorium wallet events
    const handleFixoriumInitialized = () => {
      console.log('Fixorium Wallet detected');
      checkWalletConnection();
    };

    window.addEventListener('fixorium#initialized', handleFixoriumInitialized);
    
    // Check after a short delay for provider to be injected
    setTimeout(checkWalletConnection, 500);
    
    return () => {
      window.removeEventListener('fixorium#initialized', handleFixoriumInitialized);
    };
  }, [setWallet]);

  const handleConnectWallet = async () => {
    if (!isFixoriumInstalled()) {
      setWalletStatus('Fixorium Wallet extension not installed!');
      // Open Chrome Web Store to install Fixorium Wallet
      window.open('https://chrome.google.com/webstore/detail/fixorium-wallet', '_blank');
      return;
    }

    setIsConnecting(true);
    setWalletStatus('Connecting to Fixorium Wallet...');

    try {
      const provider = getProvider();
      
      if (!provider) {
        throw new Error('Fixorium Wallet provider not found');
      }

      // Connect to Fixorium Wallet
      const result = await provider.connect();
      
      let publicKey = '';
      if (result.publicKey) {
        publicKey = typeof result.publicKey === 'object' 
          ? result.publicKey.toBase58?.() || result.publicKey.toString()
          : result.publicKey;
      } else if (result.address) {
        publicKey = result.address;
      } else if (result.toString) {
        publicKey = result.toString();
      }

      if (!publicKey) {
        throw new Error('No public key received from wallet');
      }

      const walletInfo: WalletInfo = {
        publicKey: publicKey,
        provider: provider,
        isConnected: true
      };

      setWallet(walletInfo);
      setWalletStatus(`${publicKey.slice(0, 28)}...`);
      
      console.log('Connected to Fixorium Wallet:', publicKey);
    } catch (error: any) {
      console.error('Connection error:', error);
      
      if (error.message?.includes('rejected')) {
        setWalletStatus('Connection rejected by user');
      } else if (error.message?.includes('timeout')) {
        setWalletStatus('Connection timeout - please approve in wallet');
      } else {
        setWalletStatus(error.message || 'Connection failed');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    setWallet(null);
    setWalletStatus('');
    // Optionally call provider.disconnect() if available
    const provider = getProvider();
    if (provider?.disconnect) {
      provider.disconnect();
    }
  };

  // Format address for display
  const formatAddress = (address: string): string => {
    if (!address) return '';
    if (address.length <= 40) return address;
    return `${address.slice(0, 28)}...`;
  };

  return (
    <header className="fixed-header">
      <div className="brand">
        <h1>MAX</h1>
      </div>
      <nav className="nav-menu">
        <button
          className={`nav-btn ${currentPage === 'deploy' ? 'active' : ''}`}
          onClick={() => setCurrentPage('deploy')}
        >
          Deploy
        </button>
        <button
          className={`nav-btn ${currentPage === 'pools' ? 'active' : ''}`}
          onClick={() => setCurrentPage('pools')}
        >
          Pools
        </button>
        <button
          className={`nav-btn ${currentPage === 'swap' ? 'active' : ''}`}
          onClick={() => setCurrentPage('swap')}
        >
          Swap
        </button>
        <button
          className={`nav-btn ${currentPage === 'tokens' ? 'active' : ''}`}
          onClick={() => setCurrentPage('tokens')}
        >
          Tokens
        </button>
      </nav>
      <div className="wallet-section">
        {wallet ? (
          <>
            <div className="wallet-info">
              <span className="wallet-address">
                {formatAddress(wallet.publicKey)}
              </span>
              <button
                className="disconnect-wallet"
                onClick={handleDisconnectWallet}
              >
                DISCONNECT
              </button>
            </div>
            <div className="wallet-status wallet-connected">
              ✓ Connected to Fixorium
            </div>
          </>
        ) : (
          <>
            <button
              className="connect-wallet"
              onClick={handleConnectWallet}
              disabled={isConnecting}
            >
              {isConnecting ? 'CONNECTING...' : 'CONNECT FIXORIUM WALLET'}
            </button>
            {walletStatus && (
              <div className={`wallet-status ${walletStatus.includes('failed') || walletStatus.includes('rejected') ? 'wallet-error' : ''}`}>
                {walletStatus}
              </div>
            )}
            {!isFixoriumInstalled() && !walletStatus && (
              <div className="wallet-status wallet-warning">
                Fixorium Wallet extension not detected
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
