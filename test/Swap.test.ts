import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers"
import { IPT, USDC, deployStack } from "./fixtures"

describe("MatDAO_Swap (6-decimal USDC <-> 18-decimal IPT)", () => {
  async function withLiquidity() {
    const s = await deployStack()
    const swapAddress = await s.swap.getAddress()
    await s.ipt.mint(s.deployer.address, IPT(10000))
    await s.usdc.approve(swapAddress, USDC(10000))
    await s.ipt.approve(swapAddress, IPT(10000))
    await s.swap.addLiquidity(USDC(10000), IPT(10000))
    return { ...s, swapAddress }
  }

  it("stores the token scales and quotes across decimals", async () => {
    const s = await loadFixture(withLiquidity)
    expect(await s.swap.usdcScale()).to.equal(10n ** 6n)
    expect(await s.swap.iptScale()).to.equal(10n ** 18n)
    // 1 IPT = 1 USDC
    expect(await s.swap.getQuoteUSDCForIPT(USDC(250))).to.equal(IPT(250))
    expect(await s.swap.getQuoteIPTForUSDC(IPT(250))).to.equal(USDC(250))

    await s.swap.setExchangeRate(USDC("2.5")) // 1 IPT = 2.5 USDC
    expect(await s.swap.getQuoteUSDCForIPT(USDC(10))).to.equal(IPT(4))
    expect(await s.swap.getQuoteIPTForUSDC(IPT(4))).to.equal(USDC(10))
    await expect(s.swap.connect(s.investor1).setExchangeRate(1)).to.be.revertedWith("Ownable: caller is not the owner")
  })

  it("swaps USDC -> IPT with approval", async () => {
    const s = await loadFixture(withLiquidity)
    await expect(s.swap.connect(s.investor1).swapUSDCForIPT(USDC(100))).to.be.revertedWith("ERC20: insufficient allowance")
    await s.usdc.connect(s.investor1).approve(s.swapAddress, USDC(100))
    const iptBefore = await s.ipt.balanceOf(s.investor1.address)
    await expect(s.swap.connect(s.investor1).swapUSDCForIPT(USDC(100)))
      .to.emit(s.swap, "SwapUSDCForIPT")
      .withArgs(s.investor1.address, USDC(100), IPT(100))
    expect(await s.ipt.balanceOf(s.investor1.address)).to.equal(iptBefore + IPT(100))
    const [usdcBal, iptBal] = await s.swap.getLiquidityStatus()
    expect(usdcBal).to.equal(USDC(10100))
    expect(iptBal).to.equal(IPT(9900))
  })

  it("swaps IPT -> USDC with approval and enforces liquidity", async () => {
    const s = await loadFixture(withLiquidity)
    await s.ipt.connect(s.investor1).approve(s.swapAddress, IPT(60000))
    const usdcBefore = await s.usdc.balanceOf(s.investor1.address)
    await expect(s.swap.connect(s.investor1).swapIPTForUSDC(IPT(500)))
      .to.emit(s.swap, "SwapIPTForUSDC")
      .withArgs(s.investor1.address, IPT(500), USDC(500))
    expect(await s.usdc.balanceOf(s.investor1.address)).to.equal(usdcBefore + USDC(500))
    // Only 9,500 USDC left in the pool
    await expect(s.swap.connect(s.investor1).swapIPTForUSDC(IPT(20000))).to.be.revertedWith("Insufficient USDC liquidity")
  })

  it("owner can remove liquidity", async () => {
    const s = await loadFixture(withLiquidity)
    await expect(s.swap.connect(s.investor1).removeLiquidity(1, 1)).to.be.revertedWith("Ownable: caller is not the owner")
    await expect(s.swap.removeLiquidity(USDC(1000), IPT(1000))).to.emit(s.swap, "LiquidityRemoved").withArgs(USDC(1000), IPT(1000))
  })
})

describe("SwapRouter (ETH <-> USDC, 6 decimals)", () => {
  async function routerWithLiquidity() {
    const s = await deployStack()
    const routerAddress = await s.router.getAddress()
    await s.usdc.approve(routerAddress, USDC(100000))
    await s.router.addLiquidity(await s.usdc.getAddress(), USDC(100000), { value: ethers.parseEther("10") })
    return { ...s, routerAddress }
  }

  it("quotes in USDC base units (the old code returned whole USDC)", async () => {
    const s = await loadFixture(routerWithLiquidity)
    // 1 ETH = 3333 USDC -> 3333 * 1e6 base units
    expect(await s.router.getQuoteETHForUSDC(ethers.parseEther("1"))).to.equal(USDC(3333))
    // 0.01 ETH = 33.33 USDC
    expect(await s.router.getQuoteETHForUSDC(ethers.parseEther("0.01"))).to.equal(USDC("33.33"))
    // 3333 USDC -> 3333 * 3e14 wei = 0.9999 ETH
    expect(await s.router.getQuoteUSDCForETH(USDC(3333))).to.equal(ethers.parseEther("0.9999"))
  })

  it("swapETHForUSDC pays 6-decimal USDC", async () => {
    const s = await loadFixture(routerWithLiquidity)
    const usdcAddress = await s.usdc.getAddress()
    const before = await s.usdc.balanceOf(s.investor1.address)
    await expect(s.router.connect(s.investor1).swapETHForUSDC(usdcAddress, { value: ethers.parseEther("1") }))
      .to.emit(s.router, "Swapped")
      .withArgs(s.investor1.address, ethers.ZeroAddress, usdcAddress, ethers.parseEther("1"), USDC(3333))
    expect(await s.usdc.balanceOf(s.investor1.address)).to.equal(before + USDC(3333))
  })

  it("swapUSDCForETH pays wei", async () => {
    const s = await loadFixture(routerWithLiquidity)
    const usdcAddress = await s.usdc.getAddress()
    await s.usdc.connect(s.investor1).approve(s.routerAddress, USDC(1000))
    const before = await ethers.provider.getBalance(s.investor1.address)
    const tx = await s.router.connect(s.investor1).swapUSDCForETH(usdcAddress, USDC(1000))
    const receipt = await tx.wait()
    const gas = receipt!.gasUsed * receipt!.gasPrice
    expect(await ethers.provider.getBalance(s.investor1.address)).to.equal(before - gas + ethers.parseEther("0.3"))
  })
})

describe("MockUSDC faucet", () => {
  it("allows one claim per address per day and owner-only mint", async () => {
    const s = await loadFixture(deployStack)
    const before = await s.usdc.balanceOf(s.stranger.address)
    await expect(s.usdc.connect(s.stranger).faucet()).to.emit(s.usdc, "FaucetClaimed")
    expect(await s.usdc.balanceOf(s.stranger.address)).to.equal(before + USDC(10000))

    await expect(s.usdc.connect(s.stranger).faucet()).to.be.revertedWith("MockUSDC: faucet cooldown active")
    expect(await s.usdc.faucetCooldownRemaining(s.stranger.address)).to.be.greaterThan(0n)
    // A different address is unaffected
    await s.usdc.connect(s.investor2).faucet()

    await time.increase(24 * 60 * 60)
    expect(await s.usdc.faucetCooldownRemaining(s.stranger.address)).to.equal(0n)
    await s.usdc.connect(s.stranger).faucet()
    expect(await s.usdc.balanceOf(s.stranger.address)).to.equal(before + USDC(20000))

    await expect(s.usdc.connect(s.stranger).mint(s.stranger.address, 1)).to.be.revertedWith("Ownable: caller is not the owner")
    expect(await s.usdc.decimals()).to.equal(6)
    expect(await s.usdc.balanceOf(s.deployer.address)).to.be.gte(USDC(600000)) // constructor supply minus test mints
  })
})

describe("MockIPT", () => {
  it("has 18 decimals, owner-only mint and burn", async () => {
    const s = await loadFixture(deployStack)
    expect(await s.ipt.decimals()).to.equal(18)
    await expect(s.ipt.connect(s.stranger).mint(s.stranger.address, 1)).to.be.revertedWith("Ownable: caller is not the owner")
    await s.ipt.connect(s.investor1).burn(IPT(1))
    expect(await s.ipt.balanceOf(s.investor1.address)).to.equal(IPT(59999))
  })
})
