import { ethers } from "hardhat"

export const USDC = (n: string | number) => ethers.parseUnits(String(n), 6)
export const IPT = (n: string | number) => ethers.parseUnits(String(n), 18)
export const DEAD = "0x000000000000000000000000000000000000dEaD"

export const MILESTONE_DESCRIPTIONS = ["Lab Validation", "Prototype", "Pilot", "Scale-Up"]
export const MILESTONE_AMOUNTS = [USDC(45000), USDC(45000), USDC(45000), USDC(45000)]
export const GOAL = MILESTONE_AMOUNTS.reduce((a, b) => a + b, 0n)

/**
 * Deploys the whole demo stack:
 *  - deployer = escrow owner (admin)
 *  - researcher, treasury, investor1, investor2 = separate accounts
 *  - investors are given USDC and IPT so funding / refund / dividend flows work
 */
export async function deployStack() {
  const [deployer, researcher, treasury, investor1, investor2, stranger] = await ethers.getSigners()

  const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy()
  const ipt = await (await ethers.getContractFactory("MockIPT")).deploy(0n)
  const ipnft = await (await ethers.getContractFactory("MatDAO_IPNFT")).deploy()
  const escrow = await (await ethers.getContractFactory("MatDAO_Escrow")).deploy(
    await usdc.getAddress(),
    await ipt.getAddress(),
    researcher.address,
    treasury.address,
    MILESTONE_DESCRIPTIONS,
    MILESTONE_AMOUNTS,
  )
  const swap = await (await ethers.getContractFactory("MatDAO_Swap")).deploy(await usdc.getAddress(), await ipt.getAddress(), USDC(1))
  const router = await (await ethers.getContractFactory("SwapRouter")).deploy()

  // Investors: 200k USDC each; IPT 60/40 split (100k total)
  await usdc.mint(investor1.address, USDC(200000))
  await usdc.mint(investor2.address, USDC(200000))
  await ipt.mint(investor1.address, IPT(60000))
  await ipt.mint(investor2.address, IPT(40000))

  return { deployer, researcher, treasury, investor1, investor2, stranger, usdc, ipt, ipnft, escrow, swap, router }
}

export type Stack = Awaited<ReturnType<typeof deployStack>>

/** Funds the escrow to its goal: investor1 pays 100k, investor2 the rest. */
export async function fundToGoal(s: Stack) {
  const escrowAddress = await s.escrow.getAddress()
  await s.usdc.connect(s.investor1).approve(escrowAddress, USDC(100000))
  await s.escrow.connect(s.investor1).fundProject(USDC(100000))
  const rest = GOAL - USDC(100000)
  await s.usdc.connect(s.investor2).approve(escrowAddress, rest)
  await s.escrow.connect(s.investor2).fundProject(rest)
}
