/**
 * "Frontend calls match contracts" - machine-verified.
 *
 *  1. The committed ABI modules in lib/web3/abi must equal the freshly
 *     compiled artifacts (no drift after a contract change).
 *  2. Every `functionName: "..."` the hooks / components / API routes pass to
 *     wagmi/viem must exist on the ABI they pass alongside it (source scan).
 *  3. An explicit per-hook list of full signatures (name + input types) so a
 *     changed parameter list is caught even when the name still exists.
 */
import { expect } from "chai"
import * as fs from "fs"
import * as path from "path"
import type { Abi, AbiFunction, AbiEvent } from "viem"
import { ABIS, ERC20_ABI, type AbiName } from "../lib/web3/abis"
import { FRONTEND_CONTRACTS, readArtifactAbi } from "../scripts/syncAbis"

const ROOT = path.resolve(__dirname, "..")

const ABI_BY_IDENTIFIER: Record<string, Abi> = {
  ESCROW_ABI: ABIS.MatDAO_Escrow as unknown as Abi,
  IPNFT_ABI: ABIS.MatDAO_IPNFT as unknown as Abi,
  SWAP_ABI: ABIS.MatDAO_Swap as unknown as Abi,
  MOCK_USDC_ABI: ABIS.MockUSDC as unknown as Abi,
  MOCK_IPT_ABI: ABIS.MockIPT as unknown as Abi,
  SWAP_ROUTER_ABI: ABIS.SwapRouter as unknown as Abi,
  ERC20_ABI: ERC20_ABI as unknown as Abi,
  // app/api/vdr/route.ts builds its own minimal ABI with parseAbi
  ERC20_READ_ABI: ERC20_ABI as unknown as Abi,
}

function signature(item: AbiFunction | AbiEvent): string {
  return `${item.name}(${item.inputs.map((i) => i.type).join(",")})`
}

function functionSignatures(abi: Abi): Set<string> {
  return new Set(abi.filter((i): i is AbiFunction => i.type === "function").map(signature))
}

function functionNames(abi: Abi): Set<string> {
  return new Set(abi.filter((i): i is AbiFunction => i.type === "function").map((i) => i.name))
}

function eventSignatures(abi: Abi): Set<string> {
  return new Set(abi.filter((i): i is AbiEvent => i.type === "event").map(signature))
}

/** Files that talk to contracts from the frontend / API layer. */
const SCANNED_FILES = [
  ...fs.readdirSync(path.join(ROOT, "lib/web3/hooks")).map((f) => `lib/web3/hooks/${f}`),
  "lib/web3/tx.ts",
  ...fs.readdirSync(path.join(ROOT, "components/project")).map((f) => `components/project/${f}`),
  "app/api/vdr/route.ts",
  "app/milestone-escrow/page.tsx",
].filter((f) => /\.(ts|tsx)$/.test(f))

interface CallSite {
  file: string
  line: number
  abiIdentifier: string | null
  functionNames: string[]
}

/**
 * Finds every `functionName:` occurrence and resolves the ABI identifier used
 * in the same object literal (directly via `abi: X` or through a spread
 * `...cfg` where `const cfg = { ..., abi: X, ... }`).
 */
function scanCallSites(relFile: string): CallSite[] {
  // Neutralise template-literal placeholders (`0x${string}`) so brace matching works.
  const src = fs.readFileSync(path.join(ROOT, relFile), "utf8").replace(/\$\{[^}]*\}/g, (s) => "_".repeat(s.length))
  const spreadDefs = new Map<string, string>()
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\{[^}]*?abi:\s*(\w+)/g)) spreadDefs.set(m[1], m[2])

  const sites: CallSite[] = []
  for (const m of src.matchAll(/functionName:\s*([^\n]+)/g)) {
    // SCREAMING_CASE strings are UI constants in ternaries (e.g. "USDC_TO_IPT"), not function names
    const names = Array.from(m[1].matchAll(/"(\w+)"/g), (x) => x[1]).filter((n) => !/^[A-Z][A-Z0-9_]*$/.test(n))
    if (names.length === 0) continue
    // walk back to the opening brace of the enclosing object literal ...
    let depth = 0
    let start = m.index!
    for (let i = m.index! - 1; i >= 0; i--) {
      const c = src[i]
      if (c === "}") depth++
      else if (c === "{") {
        if (depth === 0) {
          start = i
          break
        }
        depth--
      }
    }
    // ... and forward to its matching closing brace
    depth = 0
    let end = src.length
    for (let i = start; i < src.length; i++) {
      const c = src[i]
      if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    const objectText = src.slice(start, end)
    let abiIdentifier: string | null = null
    const direct = /abi:\s*(\w+)/.exec(objectText)
    if (direct) abiIdentifier = direct[1]
    else {
      const spread = /\.\.\.(\w+)/.exec(objectText)
      if (spread && spreadDefs.has(spread[1])) abiIdentifier = spreadDefs.get(spread[1])!
    }
    const line = src.slice(0, m.index!).split("\n").length
    sites.push({ file: relFile, line, abiIdentifier, functionNames: names })
  }
  return sites
}

describe("ABI contract: frontend <-> compiled contracts", () => {
  it("committed lib/web3/abi modules match the compiled artifacts (run `npm run hh:compile` if this fails)", () => {
    for (const name of FRONTEND_CONTRACTS) {
      const fresh = readArtifactAbi(path.join(ROOT, "artifacts"), name)
      const committed = ABIS[name as AbiName]
      expect(JSON.stringify(committed), `${name} ABI drifted`).to.equal(JSON.stringify(fresh))
    }
  })

  it("every functionName used by hooks/components/routes exists on the ABI passed with it", () => {
    const problems: string[] = []
    let checked = 0
    for (const file of SCANNED_FILES) {
      for (const site of scanCallSites(file)) {
        if (!site.abiIdentifier) {
          problems.push(`${site.file}:${site.line} could not resolve which ABI is used for ${site.functionNames.join("/")}`)
          continue
        }
        const abi = ABI_BY_IDENTIFIER[site.abiIdentifier]
        if (!abi) {
          problems.push(`${site.file}:${site.line} uses unknown ABI identifier ${site.abiIdentifier}`)
          continue
        }
        const names = functionNames(abi)
        for (const fn of site.functionNames) {
          checked++
          if (!names.has(fn)) problems.push(`${site.file}:${site.line} calls ${fn} which is not in ${site.abiIdentifier}`)
        }
      }
    }
    expect(problems, problems.join("\n")).to.deep.equal([])
    expect(checked, "scanner found no call sites - regex out of date?").to.be.greaterThan(30)
  })

  it("no file still uses human-readable string ABIs without parseAbi", () => {
    const offenders: string[] = []
    for (const file of SCANNED_FILES) {
      const src = fs.readFileSync(path.join(ROOT, file), "utf8")
      const m = /const\s+\w*ABI\w*\s*=\s*\[\s*"function /.exec(src)
      if (m && !/parseAbi\(/.test(src)) offenders.push(file)
    }
    expect(offenders, "string ABI arrays without parseAbi").to.deep.equal([])
  })

  it("hooks call the exact signatures the contracts expose", () => {
    const expectations: Array<[hook: string, abi: AbiName, signatures: string[]]> = [
      ["useMintIPNFT", "MatDAO_IPNFT", ["mintIP(address,string,bytes32)"]],
      ["useApproveMilestone", "MatDAO_Escrow", ["approveMilestone(uint256)"]],
      ["useClaimMilestone", "MatDAO_Escrow", ["claimMilestone(uint256)"]],
      ["useClaimDividends", "MatDAO_Escrow", ["claimDividends()", "getClaimableDividends(address)"]],
      ["useToggleProjectFailure", "MatDAO_Escrow", ["toggleProjectFailure()", "isProjectFailed()"]],
      ["useFundProject", "MatDAO_Escrow", ["fundProject(uint256)", "getFundingProgress()", "fundingToken()", "getAllMilestones()", "owner()", "researcher()", "projectFunded()"]],
      ["useRoyaltyDeposit", "MatDAO_Escrow", ["depositRoyalties(uint256)", "totalDividendPool()"]],
      ["useEmergencyRefund", "MatDAO_Escrow", ["claimEmergencyRefund()", "iptToken()", "getEmergencyRefundEstimate(address)"]],
      ["useIPTSwap", "MatDAO_Swap", ["swapUSDCForIPT(uint256)", "swapIPTForUSDC(uint256)", "usdcToken()", "iptToken()", "getQuoteUSDCForIPT(uint256)", "getQuoteIPTForUSDC(uint256)", "getLiquidityStatus()"]],
      ["useSwap", "SwapRouter", ["swapETHForUSDC(address)", "swapUSDCForETH(address,uint256)", "getExchangeRate()", "getQuoteETHForUSDC(uint256)", "getQuoteUSDCForETH(uint256)"]],
      ["LegalRegistryPanel", "MatDAO_IPNFT", ["legalAgreementHashes(uint256)", "getActiveLicenses(uint256)"]],
      ["FinancialBreakdown", "MatDAO_Escrow", ["getFinancialBreakdown()"]],
      ["tx.ensureAllowance", "MockIPT", ["allowance(address,address)", "balanceOf(address)", "approve(address,uint256)", "decimals()"]],
      ["MockUSDC faucet", "MockUSDC", ["faucet()", "faucetCooldownRemaining(address)", "mint(address,uint256)"]],
    ]
    for (const [hook, abiName, sigs] of expectations) {
      const have = functionSignatures(ABIS[abiName] as unknown as Abi)
      for (const sig of sigs) expect(have.has(sig), `${hook}: ${abiName} is missing ${sig}`).to.equal(true)
    }

    const ipnftEvents = eventSignatures(ABIS.MatDAO_IPNFT as unknown as Abi)
    expect(ipnftEvents.has("IPNFTMinted(uint256,address,string,bytes32)"), "IPNFTMinted event shape").to.equal(true)
    const escrowEvents = eventSignatures(ABIS.MatDAO_Escrow as unknown as Abi)
    for (const e of ["ProjectFunded(address,uint256)", "MilestoneApproved(uint256)", "MilestoneClaimed(uint256,uint256)", "EmergencyRefundClaimed(address,uint256)", "DividendClaimed(address,uint256)"]) {
      expect(escrowEvents.has(e), `Escrow event ${e}`).to.equal(true)
    }
  })
})
