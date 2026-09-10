import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { DEAD, GOAL, USDC, deployStack, fundToGoal } from "./fixtures"

describe("MatDAO_Escrow", () => {
  describe("funding", () => {
    it("reaches the goal, marks projectFunded and sends the 2.5% fee to the treasury", async () => {
      const s = await loadFixture(deployStack)
      const escrowAddress = await s.escrow.getAddress()
      const treasuryBefore = await s.usdc.balanceOf(s.treasury.address)

      await fundToGoal(s)

      const fee = (GOAL * 250n) / 10000n
      expect(await s.escrow.projectFunded()).to.equal(true)
      expect(await s.usdc.balanceOf(s.treasury.address)).to.equal(treasuryBefore + fee)
      expect(await s.usdc.balanceOf(escrowAddress)).to.equal(GOAL - fee)

      const [current, goal, pct] = await s.escrow.getFundingProgress()
      expect(current).to.equal(GOAL)
      expect(goal).to.equal(GOAL)
      expect(pct).to.equal(100n)
    })

    it("emits ProjectFunded / FundingGoalReached / PlatformFeeCollected", async () => {
      const s = await loadFixture(deployStack)
      const escrowAddress = await s.escrow.getAddress()
      await s.usdc.connect(s.investor1).approve(escrowAddress, GOAL)
      await expect(s.escrow.connect(s.investor1).fundProject(GOAL))
        .to.emit(s.escrow, "ProjectFunded")
        .withArgs(s.investor1.address, GOAL)
        .and.to.emit(s.escrow, "FundingGoalReached")
        .withArgs(GOAL)
        .and.to.emit(s.escrow, "PlatformFeeCollected")
        .withArgs((GOAL * 250n) / 10000n)
    })

    it("rejects contributions that exceed the remaining goal (no stranded funds)", async () => {
      const s = await loadFixture(deployStack)
      const escrowAddress = await s.escrow.getAddress()
      await s.usdc.connect(s.investor1).approve(escrowAddress, GOAL + USDC(1))
      await expect(s.escrow.connect(s.investor1).fundProject(GOAL + USDC(1))).to.be.revertedWith("Exceeds remaining funding goal")
    })

    it("rejects funding once fully funded", async () => {
      const s = await loadFixture(deployStack)
      await fundToGoal(s)
      await s.usdc.connect(s.investor1).approve(await s.escrow.getAddress(), USDC(1))
      await expect(s.escrow.connect(s.investor1).fundProject(USDC(1))).to.be.revertedWith("Project already fully funded")
    })
  })

  describe("milestones", () => {
    it("owner approves, researcher claims net of the 2.5% fee", async () => {
      const s = await loadFixture(deployStack)
      await fundToGoal(s)

      await expect(s.escrow.approveMilestone(0)).to.emit(s.escrow, "MilestoneApproved").withArgs(0)

      const amount = USDC(45000)
      const net = amount - (amount * 250n) / 10000n
      const before = await s.usdc.balanceOf(s.researcher.address)
      await expect(s.escrow.connect(s.researcher).claimMilestone(0)).to.emit(s.escrow, "MilestoneClaimed").withArgs(0, net)
      expect(await s.usdc.balanceOf(s.researcher.address)).to.equal(before + net)

      const [, , approved, withdrawn] = await s.escrow.getAllMilestones()
      expect(approved[0]).to.equal(true)
      expect(withdrawn[0]).to.equal(true)
      expect(approved[1]).to.equal(false)
    })

    it("all four milestones together pay out exactly goal - fee (nothing stranded)", async () => {
      const s = await loadFixture(deployStack)
      await fundToGoal(s)
      for (let i = 0; i < 4; i++) {
        await s.escrow.approveMilestone(i)
        await s.escrow.connect(s.researcher).claimMilestone(i)
      }
      expect(await s.usdc.balanceOf(await s.escrow.getAddress())).to.equal(0n)
      const [, , netRunway] = await s.escrow.getFinancialBreakdown()
      expect(await s.usdc.balanceOf(s.researcher.address)).to.equal(netRunway)
    })

    it("non-owner cannot approve; non-researcher cannot claim; unfunded cannot approve", async () => {
      const s = await loadFixture(deployStack)
      await expect(s.escrow.approveMilestone(0)).to.be.revertedWith("Project must be fully funded first")
      await fundToGoal(s)
      await expect(s.escrow.connect(s.investor1).approveMilestone(0)).to.be.revertedWith("Ownable: caller is not the owner")
      await s.escrow.approveMilestone(0)
      await expect(s.escrow.connect(s.investor1).claimMilestone(0)).to.be.revertedWith("Only researcher can claim")
      await expect(s.escrow.connect(s.researcher).claimMilestone(1)).to.be.revertedWith("Milestone must be approved first")
    })
  })

  describe("failure + emergency refund", () => {
    it("toggleProjectFailure (owner only, once) and proportional refunds that lock the IPT", async () => {
      const s = await loadFixture(deployStack)
      const escrowAddress = await s.escrow.getAddress()
      await fundToGoal(s)

      await expect(s.escrow.connect(s.investor1).toggleProjectFailure()).to.be.revertedWith("Ownable: caller is not the owner")
      await expect(s.escrow.toggleProjectFailure()).to.emit(s.escrow, "ProjectFailed")
      await expect(s.escrow.toggleProjectFailure()).to.be.revertedWith("Project already failed")
      expect(await s.escrow.isProjectFailed()).to.equal(true)

      const pool = await s.usdc.balanceOf(escrowAddress) // goal - fee
      const totalIpt = await s.ipt.totalSupply()
      const inv1Ipt = await s.ipt.balanceOf(s.investor1.address)
      const expected1 = (inv1Ipt * pool) / totalIpt
      expect(await s.escrow.getEmergencyRefundEstimate(s.investor1.address)).to.equal(expected1)

      // Without approval the pull fails
      await expect(s.escrow.connect(s.investor1).claimEmergencyRefund()).to.be.revertedWith("ERC20: insufficient allowance")

      await s.ipt.connect(s.investor1).approve(escrowAddress, inv1Ipt)
      const before = await s.usdc.balanceOf(s.investor1.address)
      await expect(s.escrow.connect(s.investor1).claimEmergencyRefund())
        .to.emit(s.escrow, "EmergencyRefundClaimed")
        .withArgs(s.investor1.address, expected1)
        .and.to.emit(s.escrow, "IPTBurnedForRefund")
        .withArgs(s.investor1.address, inv1Ipt)
      expect(await s.usdc.balanceOf(s.investor1.address)).to.equal(before + expected1)

      // IPT is locked at the dead address, not held by the escrow
      expect(await s.ipt.balanceOf(s.investor1.address)).to.equal(0n)
      expect(await s.ipt.balanceOf(DEAD)).to.equal(inv1Ipt)
      expect(await s.ipt.balanceOf(escrowAddress)).to.equal(0n)

      // Same wallet cannot claim twice
      await expect(s.escrow.connect(s.investor1).claimEmergencyRefund()).to.be.revertedWith("No IPT tokens held")

      // investor2 gets its proportional share of what is left
      const inv2Ipt = await s.ipt.balanceOf(s.investor2.address)
      const expected2 = (inv2Ipt * (await s.usdc.balanceOf(escrowAddress))) / totalIpt
      await s.ipt.connect(s.investor2).approve(escrowAddress, inv2Ipt)
      await expect(s.escrow.connect(s.investor2).claimEmergencyRefund()).to.emit(s.escrow, "EmergencyRefundClaimed").withArgs(s.investor2.address, expected2)
    })

    it("refund is not available before failure and blocks milestone claims after", async () => {
      const s = await loadFixture(deployStack)
      await fundToGoal(s)
      await expect(s.escrow.connect(s.investor1).claimEmergencyRefund()).to.be.revertedWith("Project must be failed first")
      await s.escrow.approveMilestone(0)
      await s.escrow.toggleProjectFailure()
      await expect(s.escrow.connect(s.researcher).claimMilestone(0)).to.be.revertedWith("Project has failed")
    })
  })

  describe("royalties + dividends", () => {
    it("splits deposits 10/30/60 and lets IPT holders claim pro-rata exactly once", async () => {
      const s = await loadFixture(deployStack)
      const escrowAddress = await s.escrow.getAddress()
      const amount = USDC(10000)
      await s.usdc.connect(s.stranger).faucet() // 10,000 USDC
      await s.usdc.connect(s.stranger).approve(escrowAddress, amount)

      const treasuryBefore = await s.usdc.balanceOf(s.treasury.address)
      const researcherBefore = await s.usdc.balanceOf(s.researcher.address)
      await expect(s.escrow.connect(s.stranger).depositRoyalties(amount))
        .to.emit(s.escrow, "RoyaltiesDeposited")
        .withArgs(amount, USDC(1000), USDC(3000), USDC(6000))
      expect(await s.usdc.balanceOf(s.treasury.address)).to.equal(treasuryBefore + USDC(1000))
      expect(await s.usdc.balanceOf(s.researcher.address)).to.equal(researcherBefore + USDC(3000))
      expect(await s.escrow.totalDividendPool()).to.equal(USDC(6000))

      // investor1 holds 60% of IPT -> 3,600 USDC
      expect(await s.escrow.getClaimableDividends(s.investor1.address)).to.equal(USDC(3600))
      expect(await s.escrow.getClaimableDividends(s.investor2.address)).to.equal(USDC(2400))
      expect(await s.escrow.getClaimableDividends(s.stranger.address)).to.equal(0n)

      const before = await s.usdc.balanceOf(s.investor1.address)
      await expect(s.escrow.connect(s.investor1).claimDividends()).to.emit(s.escrow, "DividendClaimed").withArgs(s.investor1.address, USDC(3600))
      expect(await s.usdc.balanceOf(s.investor1.address)).to.equal(before + USDC(3600))

      // Second claim by the same address yields nothing
      expect(await s.escrow.getClaimableDividends(s.investor1.address)).to.equal(0n)
      await expect(s.escrow.connect(s.investor1).claimDividends()).to.be.revertedWith("No claimable dividends")
      expect(await s.escrow.totalDividendsClaimed()).to.equal(USDC(3600))

      // A later deposit is claimable again, but only the new share
      await s.usdc.connect(s.stranger).approve(escrowAddress, USDC(0))
      await s.usdc.mint(s.stranger.address, amount)
      await s.usdc.connect(s.stranger).approve(escrowAddress, amount)
      await s.escrow.connect(s.stranger).depositRoyalties(amount)
      expect(await s.escrow.getClaimableDividends(s.investor1.address)).to.equal(USDC(3600))
      expect(await s.escrow.getClaimableDividends(s.investor2.address)).to.equal(USDC(4800))
    })

    it("dividend claims can never exceed the un-claimed pool (milestone funds are protected)", async () => {
      const s = await loadFixture(deployStack)
      const escrowAddress = await s.escrow.getAddress()
      await fundToGoal(s) // escrow now also holds milestone funds

      await s.usdc.connect(s.stranger).faucet()
      await s.usdc.connect(s.stranger).approve(escrowAddress, USDC(10000))
      await s.escrow.connect(s.stranger).depositRoyalties(USDC(10000)) // pool = 6,000

      await s.escrow.connect(s.investor1).claimDividends() // 3,600
      // Token-hop: investor1 moves its IPT to a fresh wallet (known limitation, see NatSpec)
      await s.ipt.connect(s.investor1).transfer(s.stranger.address, await s.ipt.balanceOf(s.investor1.address))
      await s.escrow.connect(s.stranger).claimDividends() // would be 3,600 but only 2,400 remain in the pool
      expect(await s.escrow.totalDividendsClaimed()).to.equal(USDC(6000))
      // Nothing left for anyone - escrowed milestone USDC untouched
      expect(await s.escrow.getClaimableDividends(s.investor2.address)).to.equal(0n)
      const fee = (GOAL * 250n) / 10000n
      expect(await s.usdc.balanceOf(escrowAddress)).to.equal(GOAL - fee)
    })
  })

  it("exposes the financial breakdown and constructor validation", async () => {
    const s = await loadFixture(deployStack)
    const [totalGoal, platformFee, netRunway] = await s.escrow.getFinancialBreakdown()
    expect(totalGoal).to.equal(GOAL)
    expect(platformFee).to.equal((GOAL * 250n) / 10000n)
    expect(netRunway).to.equal(GOAL - platformFee)
    expect(await s.escrow.getMilestoneCount()).to.equal(4n)

    const Escrow = await ethers.getContractFactory("MatDAO_Escrow")
    await expect(
      Escrow.deploy(await s.usdc.getAddress(), await s.ipt.getAddress(), s.researcher.address, s.treasury.address, ["a"], []),
    ).to.be.revertedWith("Milestone arrays length mismatch")
  })
})
