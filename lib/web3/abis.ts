/**
 * Single source of truth for contract ABIs used by the frontend.
 *
 * The modules under ./abi are generated from the Hardhat artifacts by
 * scripts/syncAbis.ts (automatically after `npx hardhat compile`) and are
 * committed so the Next.js build never depends on the git-ignored artifacts
 * directory. They are `as const`, so viem/wagmi infer function names, argument
 * and return types.
 *
 * test/abiContract.test.ts asserts that every function the hooks/components
 * call exists in these ABIs and that they match the compiled contracts.
 */
import { MatDAO_Escrow_ABI } from "./abi/MatDAO_Escrow"
import { MatDAO_IPNFT_ABI } from "./abi/MatDAO_IPNFT"
import { MatDAO_Swap_ABI } from "./abi/MatDAO_Swap"
import { MockUSDC_ABI } from "./abi/MockUSDC"
import { MockIPT_ABI } from "./abi/MockIPT"
import { SwapRouter_ABI } from "./abi/SwapRouter"

export const ESCROW_ABI = MatDAO_Escrow_ABI
export const IPNFT_ABI = MatDAO_IPNFT_ABI
export const SWAP_ABI = MatDAO_Swap_ABI
export const MOCK_USDC_ABI = MockUSDC_ABI
export const MOCK_IPT_ABI = MockIPT_ABI
export const SWAP_ROUTER_ABI = SwapRouter_ABI

/**
 * Generic ERC-20 surface (approve / allowance / balanceOf / decimals / ...).
 * MockIPT is a plain OpenZeppelin ERC20 + Burnable + Ownable, so its ABI is a
 * strict superset of IERC20 and works for any ERC-20 token address.
 */
export const ERC20_ABI = MockIPT_ABI

export const ABIS = {
  MatDAO_Escrow: ESCROW_ABI,
  MatDAO_IPNFT: IPNFT_ABI,
  MatDAO_Swap: SWAP_ABI,
  MockUSDC: MOCK_USDC_ABI,
  MockIPT: MOCK_IPT_ABI,
  SwapRouter: SWAP_ROUTER_ABI,
} as const

export type AbiName = keyof typeof ABIS
