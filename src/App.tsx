import React, { useState, useEffect } from 'react';
import './App.css';
import Header from '../components/Header';
import DeployTokenPage from '@pages/DeployTokenPage';
import LiquidityPoolsPage from '@pages/LiquidityPoolsPage';
import SwapRouterPage from '@pages/SwapRouterPage';
import MyTokensPage from '@pages/MyTokensPage';
import TokenDetailsPage from '@pages/TokenDetailsPage';
import { AppContext, AppContextType } from '../context/AppContext';
import { MaxDexClient } from '../lib/maxDexClient';

export type PageType = 'deploy' | 'pools' | 'swap' | 'tokens' | 'details';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('deploy');
  const [wallet, setWallet] = useState<any>(null);
  const [deployedTokens, setDeployedTokens] = useState<any[]>([]);
  const [pools, setPools] = useState<any[]>([]);
  const [selectedTokenForDetails, setSelectedTokenForDetails] = useState<string | null>(null);
  const [dexClient, setDexClient] = useState<MaxDexClient | null>(null);

  // Load saved data from localStorage
  useEffect(() => {
    const savedTokens = localStorage.getItem('MAX_deployed');
    if (savedTokens) {
      try {
        setDeployedTokens(JSON.parse(savedTokens));
      } catch (e) {
        console.error('Failed to parse saved tokens:', e);
      }
    }
    
    const savedPools = localStorage.getItem('MAX_pools');
    if (savedPools) {
      try {
        setPools(JSON.parse(savedPools));
      } catch (e) {
        console.error('Failed to parse saved pools:', e);
      }
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    if (deployedTokens.length > 0) {
      localStorage.setItem('MAX_deployed', JSON.stringify(deployedTokens));
    }
  }, [deployedTokens]);

  useEffect(() => {
    if (pools.length > 0) {
      localStorage.setItem('MAX_pools', JSON.stringify(pools));
    }
  }, [pools]);

  const contextValue: AppContextType = {
    wallet,
    setWallet,
    deployedTokens,
    setDeployedTokens,
    pools,
    setPools,
    currentPage,
    setCurrentPage,
    selectedTokenForDetails,
    setSelectedTokenForDetails,
    dexClient,
    setDexClient,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="app">
        <Header />
        <main className="main-container">
          {currentPage === 'deploy' && <DeployTokenPage />}
          {currentPage === 'pools' && <LiquidityPoolsPage />}
          {currentPage === 'swap' && <SwapRouterPage />}
          {currentPage === 'tokens' && <MyTokensPage />}
          {currentPage === 'details' && <TokenDetailsPage />}
        </main>
      </div>
    </AppContext.Provider>
  );
};

export default App;
