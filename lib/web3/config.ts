import { sepolia } from "wagmi/chains"

/**
 * Contract addresses come from NEXT_PUBLIC_* env vars (see .env.local.example).
 * `npm run hh:deploy:sepolia` prints the exact lines to paste.
 *
 * Note: the wagmi config lives in components/providers/WagmiProvider.tsx
 * (RainbowKit's getDefaultConfig). This module only holds constants.
 */
export type Address = `0x${string}`

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000"

function envAddress(value: string | undefined): Address | undefined {
  const v = (value || "").trim()
  return /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined
}

const IPNFT = envAddress(process.env.NEXT_PUBLIC_MATDAO_IPNFT_ADDRESS)
const MOCK_USDC = envAddress(process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS)
const IPT = envAddress(process.env.NEXT_PUBLIC_MATDAO_IPT_ADDRESS)
const ESCROW = envAddress(process.env.NEXT_PUBLIC_MATDAO_ESCROW_ADDRESS)
const SWAP = envAddress(process.env.NEXT_PUBLIC_MATDAO_SWAP_ADDRESS)
const SWAP_ROUTER = envAddress(process.env.NEXT_PUBLIC_SWAP_ROUTER_ADDRESS)

export const CONTRACT_ADDRESSES = {
  /** MatDAO_IPNFT (ERC-721) */
  IPNFT,
  /** MockUSDC (ERC-20, 6 decimals) - the escrow funding token */
  MOCK_USDC,
  /** MockIPT (ERC-20, 18 decimals) - Investment Participation Token */
  IPT,
  /** MatDAO_Escrow */
  ESCROW,
  /** MatDAO_Swap (IPT <-> USDC fixed-rate secondary market) */
  SWAP,
  /** SwapRouter (ETH <-> USDC demo router) */
  SWAP_ROUTER,

  // Backwards-compatible aliases (older call sites)
  MATDAO_IPNFT: IPNFT,
  MATDAO_ESCROW: ESCROW,
} as const

/** The only chain the contracts are deployed to / the UI is configured for. */
export const TARGET_CHAIN = sepolia
export const TARGET_CHAIN_ID = sepolia.id

/** Decimals of the funding token (USDC). IPT decimals are read on-chain. */
export const USDC_DECIMALS = 6

export function explorerAddressUrl(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`
}

export function explorerTxUrl(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`
}

/**
 * Returns the address or throws a readable error when it is not configured.
 */
export function requireAddress(address: Address | string | undefined, label: string): Address {
  const a = envAddress(address)
  if (!a || a === ZERO_ADDRESS) {
    throw new Error(`${label} address is not configured. Set the matching NEXT_PUBLIC_* variable in .env.local.`)
  }
  return a
}

// Export chain for use in components
export { sepolia }
