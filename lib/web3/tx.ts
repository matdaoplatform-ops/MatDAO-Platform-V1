/**
 * Framework-agnostic helpers shared by the wagmi hooks and API routes:
 * readable error mapping, network assertions, ERC-20 allowance handling and
 * receipt waiting. No React in here so it can be unit-tested and reused
 * server-side.
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionExecutionError,
  UserRejectedRequestError,
  TransactionExecutionError,
  type Abi,
  type Hash,
  type PublicClient,
  type TransactionReceipt,
} from "viem"
import { ERC20_ABI } from "./abis"
import { TARGET_CHAIN, TARGET_CHAIN_ID, ZERO_ADDRESS, type Address } from "./config"

/** Minimal shape of wagmi's `writeContractAsync`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WriteContractFn = (variables: any) => Promise<Hash>

export interface WriteRequest {
  address: Address
  abi: Abi | readonly unknown[]
  functionName: string
  args?: readonly unknown[]
  value?: bigint
}

export class Web3UserError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "Web3UserError"
  }
}

/**
 * Convert any viem/wagmi/wallet error into an Error with a human-readable
 * message. Already-readable errors are returned as-is.
 */
export function toReadableError(err: unknown): Error {
  if (err instanceof Web3UserError) return err

  if (err instanceof BaseError) {
    // User cancelled in the wallet
    if (err.walk((e) => e instanceof UserRejectedRequestError)) {
      return new Web3UserError("Transaction rejected in wallet.", { cause: err })
    }
    // Contract revert with a reason string / custom error
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError) as
      | ContractFunctionRevertedError
      | null
    if (revert) {
      const reason = revert.reason || revert.data?.errorName || revert.shortMessage
      return new Web3UserError(mapRevertReason(reason), { cause: err })
    }
    if (err instanceof ContractFunctionExecutionError || err instanceof TransactionExecutionError) {
      // e.g. "The contract function "mintIP" reverted with the following reason: ..."
      const m = /reason:\s*(.+)$/m.exec(err.shortMessage)
      if (m) return new Web3UserError(mapRevertReason(m[1].trim()), { cause: err })
    }
    if (/chain mismatch|does not match the target chain|unsupported chain/i.test(err.shortMessage)) {
      return new Web3UserError(wrongNetworkMessage(), { cause: err })
    }
    return new Web3UserError(err.shortMessage || err.message, { cause: err })
  }

  if (err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === 4001) {
    return new Web3UserError("Transaction rejected in wallet.", { cause: err })
  }
  if (err instanceof Error) return err
  return new Error(typeof err === "string" ? err : "Unknown web3 error")
}

function mapRevertReason(reason: string): string {
  const r = reason.replace(/^execution reverted:?\s*/i, "").trim()
  if (/ownable: caller is not the owner/i.test(r)) {
    return "Connected wallet is not the contract owner (admin). Switch to the MatDAO admin wallet."
  }
  if (/erc20: insufficient allowance/i.test(r)) return "Token allowance too low - approve the contract first."
  if (/erc20: transfer amount exceeds balance/i.test(r)) return "Insufficient token balance."
  if (/only researcher can claim/i.test(r)) return "Only the project researcher can claim this milestone."
  return r ? `Transaction would fail: ${r}` : "Transaction would fail (no revert reason returned)."
}

export function wrongNetworkMessage(): string {
  return `Wrong network: switch your wallet to ${TARGET_CHAIN.name} (chain id ${TARGET_CHAIN_ID}).`
}

/**
 * Throws a readable error unless a wallet is connected on the target chain.
 */
export function assertWalletReady(
  account: Address | undefined,
  chainId: number | undefined,
  publicClient: PublicClient | undefined,
): asserts account is Address {
  if (!account) throw new Web3UserError("Connect a wallet first.")
  if (chainId !== TARGET_CHAIN_ID) throw new Web3UserError(wrongNetworkMessage())
  if (!publicClient) throw new Web3UserError("RPC client unavailable - check the wagmi provider configuration.")
}

export function isZeroAddress(address: string | undefined): boolean {
  return !address || address.toLowerCase() === ZERO_ADDRESS
}

/**
 * Waits for a transaction to be mined and throws if it reverted.
 */
export async function waitForReceipt(publicClient: PublicClient, hash: Hash): Promise<TransactionReceipt> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== "success") {
    throw new Web3UserError(`Transaction ${hash} reverted on-chain.`)
  }
  return receipt
}

/**
 * Simulates the call first (surfaces revert reasons before the wallet pops
 * up), then sends it. Returns the tx hash.
 */
export async function simulateAndWrite(
  publicClient: PublicClient,
  writeContractAsync: WriteContractFn,
  account: Address,
  request: WriteRequest,
): Promise<Hash> {
  try {
    await publicClient.simulateContract({
      account,
      address: request.address,
      abi: request.abi as Abi,
      functionName: request.functionName,
      args: request.args as unknown[] | undefined,
      value: request.value,
    })
  } catch (e) {
    throw toReadableError(e)
  }
  try {
    return await writeContractAsync({
      account,
      address: request.address,
      abi: request.abi,
      functionName: request.functionName,
      args: request.args,
      value: request.value,
      chainId: TARGET_CHAIN_ID,
    })
  } catch (e) {
    throw toReadableError(e)
  }
}

export interface EnsureAllowanceParams {
  publicClient: PublicClient
  writeContractAsync: WriteContractFn
  token: Address
  owner: Address
  spender: Address
  amount: bigint
  /** Called with progress messages (for toasts). */
  onStatus?: (message: string) => void
}

/**
 * Makes sure `spender` may pull `amount` of `token` from `owner`.
 * Skips the approve transaction entirely when the current allowance is
 * already sufficient; otherwise sends approve() and waits for it to be mined.
 * Returns the approve tx hash, or null if no approval was needed.
 */
export async function ensureAllowance({
  publicClient,
  writeContractAsync,
  token,
  owner,
  spender,
  amount,
  onStatus,
}: EnsureAllowanceParams): Promise<Hash | null> {
  const [allowance, balance] = await Promise.all([
    publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "allowance", args: [owner, spender] }),
    publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [owner] }),
  ])
  if (balance < amount) {
    throw new Web3UserError("Insufficient token balance for this amount.")
  }
  if (allowance >= amount) return null

  onStatus?.("Approve token spend in your wallet...")
  const hash = await simulateAndWrite(publicClient, writeContractAsync, owner, {
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, amount],
  })
  onStatus?.("Waiting for approval to be mined...")
  await waitForReceipt(publicClient, hash)
  return hash
}

/**
 * Parses a user-typed decimal amount safely (never throws on "", "1e5", "abc").
 * Returns null when the input is not a positive finite decimal.
 */
export function safeParseUnits(input: string | number, decimals: number): bigint | null {
  const raw = String(input ?? "").trim()
  if (!/^\d*\.?\d*$/.test(raw) || raw === "" || raw === ".") return null
  const [whole = "0", frac = ""] = raw.split(".")
  if (frac.length > decimals) return null
  const value = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0")
  return value > 0n ? value : null
}
