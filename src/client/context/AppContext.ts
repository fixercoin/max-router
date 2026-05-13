import React from 'react';
import { PageType } from '../../App';
import { MaxDexClient } from '../lib/maxDexClient';

export interface AppContextType {
  wallet: any;
  setWallet: (wallet: any) => void;
  deployedTokens: any[];
  setDeployedTokens: (tokens: any[]) => void;
  pools: any[];
  setPools: (pools: any[]) => void;
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  selectedTokenForDetails: string | null;
  setSelectedTokenForDetails: (mint: string | null) => void;
  // ADD THESE:
  dexClient: MaxDexClient | null;
  setDexClient: (client: MaxDexClient | null) => void;
}

export const AppContext = React.createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
