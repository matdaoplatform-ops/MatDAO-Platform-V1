import { expect } from "chai"
import { ethers } from "hardhat"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { deployStack } from "./fixtures"

const ZERO_HASH = "0x" + "00".repeat(32)

describe("MatDAO_IPNFT", () => {
  it("mintIP(address,string,bytes32) mints token id 1 and emits IPNFTMinted", async () => {
    const s = await loadFixture(deployStack)
    const uri = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
    const legalHash = ethers.keccak256(ethers.toUtf8Bytes("IPAA v1"))

    expect(await s.ipnft.getNextTokenId()).to.equal(1n)
    await expect(s.ipnft.mintIP(s.researcher.address, uri, legalHash))
      .to.emit(s.ipnft, "IPNFTMinted")
      .withArgs(1n, s.researcher.address, uri, legalHash)

    expect(await s.ipnft.ownerOf(1)).to.equal(s.researcher.address)
    expect(await s.ipnft.tokenURI(1)).to.equal(uri)
    expect(await s.ipnft.originalResearcher(1)).to.equal(s.researcher.address)
    expect(await s.ipnft.legalAgreementHashes(1)).to.equal(legalHash)
    expect(await s.ipnft.totalSupply()).to.equal(1n)
    expect(await s.ipnft.getNextTokenId()).to.equal(2n)

    // token id 0 never exists and returns the zero hash (frontend treats it as "not recorded")
    expect(await s.ipnft.legalAgreementHashes(0)).to.equal(ZERO_HASH)
  })

  it("mintIP is onlyOwner", async () => {
    const s = await loadFixture(deployStack)
    await expect(s.ipnft.connect(s.researcher).mintIP(s.researcher.address, "ipfs://x", ZERO_HASH)).to.be.revertedWith(
      "Ownable: caller is not the owner",
    )
  })

  it("registerCorporateLicense records licenses that getActiveLicenses returns", async () => {
    const s = await loadFixture(deployStack)
    await s.ipnft.mintIP(s.researcher.address, "ipfs://x", ZERO_HASH)
    const termsHash = ethers.keccak256(ethers.toUtf8Bytes("SCG license terms"))

    await expect(s.ipnft.registerCorporateLicense(2, s.stranger.address, 100, termsHash)).to.be.revertedWith("Token does not exist")
    await expect(s.ipnft.connect(s.stranger).registerCorporateLicense(1, s.stranger.address, 100, termsHash)).to.be.revertedWith(
      "Ownable: caller is not the owner",
    )

    const tx = await s.ipnft.registerCorporateLicense(1, s.stranger.address, 100, termsHash)
    const receipt = await tx.wait()
    const expiration = BigInt(receipt!.blockNumber) + 100n
    await expect(tx).to.emit(s.ipnft, "CorporateLicenseRegistered").withArgs(1n, s.stranger.address, expiration, termsHash)

    const [licensees, expirations, hashes] = await s.ipnft.getActiveLicenses(1)
    expect(licensees).to.deep.equal([s.stranger.address])
    expect(expirations).to.deep.equal([expiration])
    expect(hashes).to.deep.equal([termsHash])
  })
})
