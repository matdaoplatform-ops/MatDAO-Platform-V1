import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"

describe("MatDAO_RWA3643 (ERC-3643 style compliance token)", () => {
  async function deploy() {
    const [admin, alice, bob, carol] = await ethers.getSigners()
    const token = await (await ethers.getContractFactory("MatDAO_RWA3643")).deploy(
      "MatDAO RWA",
      "MRWA",
      ethers.parseEther("1000"),
      ethers.parseEther("2000"),
    )
    return { admin, alice, bob, carol, token }
  }

  it("compiles, deploys and grants all roles to the deployer", async () => {
    const { admin, token } = await loadFixture(deploy)
    expect(await token.totalSupply()).to.equal(ethers.parseEther("1000"))
    expect(await token.hasRole(await token.COMPLIANCE_ROLE(), admin.address)).to.equal(true)
    expect(await token.hasRole(await token.MINTER_ROLE(), admin.address)).to.equal(true)
  })

  it("blocks transfers to unverified recipients and allows them once compliant", async () => {
    const { admin, alice, token } = await loadFixture(deploy)
    const amount = ethers.parseEther("10")

    await expect(token.transfer(alice.address, amount)).to.be.revertedWith("Transfer not compliant with ERC-3643")
    expect(await token.isTransferCompliant(admin.address, alice.address, amount)).to.equal(false)

    await expect(token.setIdentityVerified(alice.address, true)).to.emit(token, "IdentityVerified").withArgs(alice.address, true)
    // Verified but neither accredited nor a registered entity -> still blocked
    await expect(token.transfer(alice.address, amount)).to.be.revertedWith("Transfer not compliant with ERC-3643")

    await expect(token.setRegisteredEntity(alice.address, true)).to.emit(token, "EntityRegistered").withArgs(alice.address, true)
    await expect(token.transfer(alice.address, amount)).to.emit(token, "ComplianceTransfer").withArgs(admin.address, alice.address, amount)
    expect(await token.balanceOf(alice.address)).to.equal(amount)
  })

  it("transfers are not limited by max supply (only minting is)", async () => {
    const { admin, alice, token } = await loadFixture(deploy)
    await token.setIdentityVerified(alice.address, true)
    await token.setAccreditedInvestor(alice.address, true)
    // Mint up to the cap, then transfer the full balance - previously failed
    await token.mint(alice.address, ethers.parseEther("1000"))
    expect(await token.totalSupply()).to.equal(ethers.parseEther("2000"))
    await expect(token.mint(alice.address, 1)).to.be.revertedWith("Exceeds max supply")

    await token.setIdentityVerified(admin.address, true)
    await token.setAccreditedInvestor(admin.address, true)
    await expect(token.connect(alice).transfer(admin.address, ethers.parseEther("1000"))).to.not.be.reverted
  })

  it("mint requires a verified + qualified recipient; frozen accounts and pause block transfers", async () => {
    const { admin, alice, bob, token } = await loadFixture(deploy)
    await expect(token.mint(bob.address, 1)).to.be.revertedWith("Recipient not identity verified")
    await token.setIdentityVerified(bob.address, true)
    await expect(token.mint(bob.address, 1)).to.be.revertedWith("Recipient not qualified")
    await token.setAccreditedInvestor(bob.address, true)
    await token.mint(bob.address, ethers.parseEther("5"))

    await token.freezeAccount(bob.address, true)
    await token.setIdentityVerified(alice.address, true)
    await token.setAccreditedInvestor(alice.address, true)
    await expect(token.connect(bob).transfer(alice.address, 1)).to.be.revertedWith("Transfer not compliant with ERC-3643")
    await token.freezeAccount(bob.address, false)

    await token.pause()
    await expect(token.connect(bob).transfer(alice.address, 1)).to.be.revertedWith("Pausable: paused")
    // mint has no whenNotPaused modifier of its own - it is blocked by the ERC20Pausable hook override
    await expect(token.mint(bob.address, 1)).to.be.revertedWith("ERC20Pausable: token transfer while paused")
    await token.unpause()
    await expect(token.connect(bob).transfer(alice.address, 1)).to.not.be.reverted

    await expect(token.connect(alice).setIdentityVerified(admin.address, true)).to.be.reverted // missing COMPLIANCE_ROLE
  })

  it("respects the per-account transfer allowance and offering window", async () => {
    const { admin, alice, token } = await loadFixture(deploy)
    await token.setIdentityVerified(alice.address, true)
    await token.setAccreditedInvestor(alice.address, true)
    await token.setTransferAllowance(admin.address, ethers.parseEther("1"))
    await expect(token.transfer(alice.address, ethers.parseEther("2"))).to.be.revertedWith("Transfer not compliant with ERC-3643")
    await expect(token.transfer(alice.address, ethers.parseEther("1"))).to.not.be.reverted

    const now = (await ethers.provider.getBlock("latest"))!.timestamp
    await token.setOfferingPeriod(true, now + 1000, now + 2000)
    await expect(token.transfer(alice.address, 1)).to.be.revertedWith("Transfer not compliant with ERC-3643")
  })
})
