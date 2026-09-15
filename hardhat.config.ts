/**
 * Hardhat configuration.
 *
 * TypeScript loading note: the repo's tsconfig.json targets Next.js
 * (`module: esnext`), which makes ts-node emit ESM for every `.ts` file
 * Hardhat loads. Node then evaluates them as ES modules, where deep imports
 * such as `hardhat/config` and extension-less relative imports (`../lib/web3/abis`)
 * do not resolve. To keep `npx hardhat compile|test|run` working without extra
 * environment variables this file:
 *   1. uses import paths that resolve in both CJS and ESM mode, and
 *   2. re-registers ts-node with `tsconfig.hardhat.json` (CommonJS) so that
 *      tests, scripts and lib/web3 modules are compiled as CommonJS.
 * Setting `HARDHAT_TSCONFIG=tsconfig.hardhat.json` (or `TS_NODE_PROJECT`) is
 * equivalent and is what the npm `hh:*` scripts do.
 */
import "@nomicfoundation/hardhat-toolbox"
import { task } from "hardhat/config.js"
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names.js"
import type { HardhatUserConfig } from "hardhat/config"
import * as dotenv from "dotenv"
import * as path from "path"
import { createRequire } from "module"

// `__dirname` only exists when this file is evaluated as CommonJS.
const ROOT = typeof __dirname !== "undefined" ? __dirname : process.cwd()
const localRequire = createRequire(path.join(ROOT, "hardhat.config.ts"))

// Force CommonJS emission for every other .ts file Hardhat loads (see header).
localRequire("ts-node").register({
  project: path.join(ROOT, "tsconfig.hardhat.json"),
  transpileOnly: true,
})

// Accept both conventions: `.env` (hardhat default) and `.env.local` (Next.js).
// `.env.local` wins when a key is present in both.
dotenv.config({ path: path.join(ROOT, ".env") })
dotenv.config({ path: path.join(ROOT, ".env.local"), override: true })

// A malformed PRIVATE_KEY (e.g. a placeholder) would make every hardhat command
// fail at config-load time, so only pass it through when it looks like a key.
const rawPrivateKey = (process.env.PRIVATE_KEY || "").trim()
const privateKey = /^(0x)?[0-9a-fA-F]{64}$/.test(rawPrivateKey)
  ? rawPrivateKey.startsWith("0x")
    ? rawPrivateKey
    : `0x${rawPrivateKey}`
  : undefined
if (rawPrivateKey && !privateKey) {
  console.warn("[hardhat.config] PRIVATE_KEY is set but is not a 32-byte hex key; ignoring it.")
}

// After every compile, copy the frontend-facing ABIs into lib/web3/abi so the
// Next.js app never has to read from the (git-ignored) artifacts directory.
task(TASK_COMPILE).setAction(async (args, hre, runSuper) => {
  await runSuper(args)
  const { syncAbis } = localRequire("./scripts/syncAbis") as typeof import("./scripts/syncAbis")
  const written = syncAbis(hre.config.paths.artifacts, path.join(ROOT, "lib", "web3", "abi"))
  if (written.length > 0) {
    console.log(`Synced ${written.length} ABI(s) to lib/web3/abi`)
  }
})

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: privateKey ? [privateKey] : [],
      chainId: 11155111,
      timeout: 60000, // 60 second timeout
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  mocha: {
    timeout: 60000,
  },
}

export default config
