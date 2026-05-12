import React, { useState, useEffect } from 'react';
import './App.css';
import Header from '@client/components/Header';
import DeployTokenPage from '@pages/DeployTokenPage';
import LiquidityPoolsPage from '@pages/LiquidityPoolsPage';
import SwapRouterPage from '@pages/SwapRouterPage';
import MyTokensPage from '@pages/MyTokensPage';
import TokenDetailsPage from '@pages/TokenDetailsPage';
import { AppContext, AppContextType } from '@client/context/AppContext';

export type PageType = 'deploy' | 'pools' | 'swap' | 'tokens' | 'details';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('deploy');
  const [wallet, setWallet] = useState<any>(null);
  const [deployedTokens, setDeployedTokens] = useState<any[]>([]);
  const [pools, setPools] = useState<any[]>([]);
  const [selectedTokenForDetails, setSelectedTokenForDetails] = useState<string | null>(null);

  useEffect(() => {
    const savedTokens = localStorage.getItem('MAX_deployed');
    if (savedTokens) setDeployedTokens(JSON.parse(savedTokens));
    const savedPools = localStorage.getItem('MAX_pools');
    if (savedPools) setPools(JSON.parse(savedPools));
  }, []);

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
