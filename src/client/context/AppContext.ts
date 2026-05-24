import React from 'react';
import { PageType } from '../../App';
import { MaxDexClient } from '../lib/maxDexClient';

export interface WalletObject {
  publicKey: string;
  provider: any;
  isConnected: boolean;
}

export interface AppContextType {
  wallet: WalletObject | null;
  setWallet: (wallet: WalletObject | null) => void;
  deployedTokens: any[];
  setDeployedTokens: (tokens: any[]) => void;
  pools: any[];
  setPools: (pools: any[]) => void;
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  selectedTokenForDetails: string | null;
  setSelectedTokenForDetails: (mint: string | null) => void;
  dexClient: MaxDexClient | null;
  setDexClient: (client: MaxDexClient | null) => void;
}

const defaultContextValue: AppContextType = {
  wallet: null,
  setWallet: () => {},
  deployedTokens: [],
  setDeployedTokens: () => {},
  pools: [],
  setPools: () => {},
  currentPage: 'deploy',
  setCurrentPage: () => {},
  selectedTokenForDetails: null,
  setSelectedTokenForDetails: () => {},
  dexClient: null,
  setDexClient: () => {},
};

export const AppContext = React.createContext<AppContextType>(defaultContextValue);

export const useAppContext = () => {
  return React.useContext(AppContext);
};
