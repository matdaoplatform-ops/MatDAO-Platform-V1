/**
 * Deploys the full MatDAO contract set and seeds demo state.
 *
 *   npm run hh:deploy:local     (hardhat in-process network)
 *   npm run hh:deploy:sepolia   (needs PRIVATE_KEY + SEPOLIA_RPC_URL in .env / .env.local)
 *
 * Writes deployments/<network>.json and prints the NEXT_PUBLIC_* lines for
 * .env.local. Uses hardhat-ethers (ethers v6).
 */
import { ethers, network } from "hardhat"
import * as fs from "fs"
import * as path from "path"

const USDC = (n: string) => ethers.parseUnits(n, 6)
const IPT = (n: string) => ethers.parseUnits(n, 18)

async function main() {
  console.log("Starting MatDAO deployment and seeding on network:", network.name, "\n")

  const signers = await ethers.getSigners()
  if (signers.length === 0) {
    throw new Error("No signers found. Set PRIVATE_KEY (and SEPOLIA_RPC_URL) in .env or .env.local")
  }
  const [deployer] = signers
  const balance = await ethers.provider.getBalance(deployer.address)
  console.log("Deployer:", deployer.address, "| balance:", ethers.formatEther(balance), "ETH")

  // 1. MockUSDC (deployer receives INITIAL_SUPPLY = 1,000,000 USDC)
  console.log("\n[1/6] Deploying MockUSDC...")
  const mockUSDC = await (await ethers.getContractFactory("MockUSDC")).deploy()
  await mockUSDC.waitForDeployment()
  const mockUSDCAddress = await mockUSDC.getAddress()
  console.log("  MockUSDC:", mockUSDCAddress)

  // 2. MatDAO_IPNFT
  console.log("\n[2/6] Deploying MatDAO_IPNFT...")
  const ipnft = await (await ethers.getContractFactory("MatDAO_IPNFT")).deploy()
  await ipnft.waitForDeployment()
  const ipNFTAddress = await ipnft.getAddress()
  console.log("  MatDAO_IPNFT:", ipNFTAddress)

  // 3. MockIPT (18 decimals, owner-mint) - 100,000 IPT to the deployer
  console.log("\n[3/6] Deploying MockIPT...")
  const iptInitialSupply = IPT("100000")
  const mockIPT = await (await ethers.getContractFactory("MockIPT")).deploy(iptInitialSupply)
  await mockIPT.waitForDeployment()
  const iptAddress = await mockIPT.getAddress()
  console.log("  MockIPT:", iptAddress, "| minted", ethers.formatUnits(iptInitialSupply, 18), "IPT to deployer")

  // 4. MatDAO_Escrow
  console.log("\n[4/6] Deploying MatDAO_Escrow...")
  const milestoneDescriptions = ["Lab Validation", "Prototype Development", "Pilot Testing", "Commercial Scale-Up"]
  const milestoneAmounts = [USDC("45000"), USDC("45000"), USDC("45000"), USDC("45000")]
  const escrow = await (await ethers.getContractFactory("MatDAO_Escrow")).deploy(
    mockUSDCAddress,
    iptAddress,
    deployer.address, // researcher (deployer for demo)
    deployer.address, // MatDAO treasury (deployer for demo)
    milestoneDescriptions,
    milestoneAmounts,
  )
  await escrow.waitForDeployment()
  const escrowAddress = await escrow.getAddress()
  console.log("  MatDAO_Escrow:", escrowAddress)

  // 5. MatDAO_Swap - 1 IPT = 1 USDC
  console.log("\n[5/6] Deploying MatDAO_Swap...")
  const exchangeRate = USDC("1")
  const swap = await (await ethers.getContractFactory("MatDAO_Swap")).deploy(mockUSDCAddress, iptAddress, exchangeRate)
  await swap.waitForDeployment()
  const swapAddress = await swap.getAddress()
  console.log("  MatDAO_Swap:", swapAddress)

  // 6. SwapRouter (ETH <-> USDC demo)
  console.log("\n[6/6] Deploying SwapRouter...")
  const router = await (await ethers.getContractFactory("SwapRouter")).deploy()
  await router.waitForDeployment()
  const routerAddress = await router.getAddress()
  console.log("  SwapRouter:", routerAddress)

  // --- Seeding -------------------------------------------------------------
  console.log("\nSeeding demo state...")

  const usdcBalance = await mockUSDC.balanceOf(deployer.address)
  console.log("  Deployer MockUSDC balance (constructor supply):", ethers.formatUnits(usdcBalance, 6), "USDC")

  // Mint an IP-NFT for the "Water Hyacinth Biochar" demo project (token id 1)
  const tokenURI = "ipfs://QmXyZ123456789abcdefghijklmnopqrstuv" // placeholder CID
  const legalHash = ethers.keccak256(ethers.toUtf8Bytes("Chula TTO IPAA Agreement - Water Hyacinth Biochar Project"))
  const mintTx = await ipnft.mintIP(deployer.address, tokenURI, legalHash)
  await mintTx.wait()
  const tokenId = (await ipnft.getNextTokenId()) - 1n
  console.log("  IP-NFT minted: tokenId", tokenId.toString(), "| researcher", deployer.address)

  // Fund the escrow to the FULL goal so approve/claim work out of the box
  const [, goal] = await escrow.getFundingProgress()
  await (await mockUSDC.approve(escrowAddress, goal)).wait()
  await (await escrow.fundProject(goal)).wait()
  const [current, , percentage] = await escrow.getFundingProgress()
  console.log("  Escrow funded:", ethers.formatUnits(current, 6), "/", ethers.formatUnits(goal, 6), "USDC (", percentage.toString(), "% )")

  // Swap liquidity: 10,000 USDC + 10,000 IPT
  const swapLiquidityUSDC = USDC("10000")
  const swapLiquidityIPT = IPT("10000")
  await (await mockUSDC.approve(swapAddress, swapLiquidityUSDC)).wait()
  await (await mockIPT.approve(swapAddress, swapLiquidityIPT)).wait()
  await (await swap.addLiquidity(swapLiquidityUSDC, swapLiquidityIPT)).wait()
  const [swapUsdc, swapIpt, rate] = await swap.getLiquidityStatus()
  console.log("  Swap liquidity:", ethers.formatUnits(swapUsdc, 6), "USDC /", ethers.formatUnits(swapIpt, 18), "IPT @", ethers.formatUnits(rate, 6), "USDC per IPT")

  // Router liquidity: 1,000 USDC + a little ETH (skip ETH on low balances)
  const routerUSDC = USDC("1000")
  const routerETH = network.name === "hardhat" || network.name === "localhost" ? ethers.parseEther("1") : ethers.parseEther("0.01")
  if (balance > routerETH * 3n) {
    await (await mockUSDC.approve(routerAddress, routerUSDC)).wait()
    await (await router.addLiquidity(mockUSDCAddress, routerUSDC, { value: routerETH })).wait()
    console.log("  Router liquidity:", ethers.formatUnits(routerUSDC, 6), "USDC +", ethers.formatEther(routerETH), "ETH")
  } else {
    console.log("  Router liquidity skipped (deployer ETH balance too low)")
  }

  const [totalGoal, platformFee, netRunway] = await escrow.getFinancialBreakdown()
  console.log("\nFinancial breakdown: goal", ethers.formatUnits(totalGoal, 6), "| fee", ethers.formatUnits(platformFee, 6), "| runway", ethers.formatUnits(netRunway, 6), "USDC")

  // --- Output --------------------------------------------------------------
  const chainId = Number((await ethers.provider.getNetwork()).chainId)
  const deployment = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      MockUSDC: mockUSDCAddress,
      MatDAO_IPNFT: ipNFTAddress,
      MockIPT: iptAddress,
      MatDAO_Escrow: escrowAddress,
      MatDAO_Swap: swapAddress,
      SwapRouter: routerAddress,
    },
    seed: { ipnftTokenId: tokenId.toString(), tokenURI, legalHash },
  }
  const deploymentsDir = path.join(__dirname, "..", "deployments")
  fs.mkdirSync(deploymentsDir, { recursive: true })
  const outFile = path.join(deploymentsDir, `${network.name}.json`)
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2) + "\n")

  const envLines = [
    `NEXT_PUBLIC_MOCK_USDC_ADDRESS=${mockUSDCAddress}`,
    `NEXT_PUBLIC_MATDAO_IPNFT_ADDRESS=${ipNFTAddress}`,
    `NEXT_PUBLIC_MATDAO_IPT_ADDRESS=${iptAddress}`,
    `NEXT_PUBLIC_MATDAO_ESCROW_ADDRESS=${escrowAddress}`,
    `NEXT_PUBLIC_MATDAO_SWAP_ADDRESS=${swapAddress}`,
    `NEXT_PUBLIC_SWAP_ROUTER_ADDRESS=${routerAddress}`,
  ]
  console.log("\n" + "=".repeat(60))
  console.log("DEPLOYMENT COMPLETE - addresses written to", path.relative(process.cwd(), outFile))
  console.log("=".repeat(60))
  console.log("\nAdd these lines to .env.local:\n")
  console.log(envLines.join("\n"))
  if (chainId === 11155111) {
    console.log("\nEtherscan:")
    for (const [name, addr] of Object.entries(deployment.contracts)) {
      console.log(`  ${name}: https://sepolia.etherscan.io/address/${addr}`)
    }
  }
  console.log("")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
