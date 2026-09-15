'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider as WagmiProviderCore, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const config = getDefaultConfig({
  appName: 'MatDAO Platform',
  // The contracts and deployment tooling target Sepolia.  Restricting the UI
  // to that chain avoids presenting a live-mainnet transaction for a testnet
  // contract address.
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '00000000000000000000000000000000',
  chains: [sepolia],
  // Optional dedicated RPC (Alchemy/Infura) for reads + receipt polling; falls
  // back to the chain's public RPC. Hooks use usePublicClient({ chainId: sepolia.id })
  // so reads/waits work even while the wallet is on the wrong network.
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined),
  },
  ssr: false,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProviderCore config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProviderCore>
  );
}
