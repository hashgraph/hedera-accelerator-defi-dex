import { expect } from "chai";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";

const defaultQuorumThresholdValue = 5;
const defaultQuorumThresholdValueInBsp = defaultQuorumThresholdValue * 100;
const zeroAddress = "0x1111111000000000000000000000000000000000";
const daoName = "DaoName";
const daoLogoUrl = "dao-logo-url";
const webKey = "git";
const webUrl = "web-url";

describe("GovernorTokenDAO Tests", function () {
  async function deployFixture() {
    const votingDelay = 0;
    const votingPeriod = 12;
    const signers = await ethers.getSigners();

    const TokenCont = await ethers.getContractFactory("ERC20Mock");
    const tokenCont = await TokenCont.deploy(
      "tokenName",
      "tokenSymbol",
      100,
      0
    );

    const MockBaseHTS = await ethers.getContractFactory("MockBaseHTS");
    const mockBaseHTS = await MockBaseHTS.deploy(true, zeroAddress);

    const GODHolder = await ethers.getContractFactory("GODHolder");
    const godHolder = await upgrades.deployProxy(GODHolder, [
      mockBaseHTS.address,
      tokenCont.address,
    ]);

    const Governor = await ethers.getContractFactory("GovernorTransferToken");
    const args = [
      tokenCont.address,
      votingDelay,
      votingPeriod,
      mockBaseHTS.address,
      godHolder.address,
      defaultQuorumThresholdValueInBsp,
    ];
    const governorTransferToken = await upgrades.deployProxy(Governor, args);
    await governorTransferToken.deployed();
    const Dao = await ethers.getContractFactory("GovernorTokenDAO");
    const daoArgs = [
      signers[0].address,
      daoName,
      daoLogoUrl,
      governorTransferToken.address,
    ];
    const instanceDao = await upgrades.deployProxy(Dao, daoArgs);
    await instanceDao.deployed();

    return {
      instanceDao,
      governorTransferToken,
      tokenCont,
      signers,
    };
  }

  it("Verify if the GovernorTokenDAO contract is upgradeable safe ", async function () {
    const votingDelay = 0;
    const votingPeriod = 12;
    const signers = await ethers.getSigners();

    const Governor = await ethers.getContractFactory("GovernorTransferToken");
    const args = [
      signers[0].address,
      votingDelay,
      votingPeriod,
      signers[0].address,
      signers[0].address,
      defaultQuorumThresholdValueInBsp,
    ];
    const instance = await upgrades.deployProxy(Governor, args);
    await instance.deployed();
    const Dao = await ethers.getContractFactory("GovernorTokenDAO");
    const daoArgs = [signers[0].address, daoName, daoLogoUrl, instance.address];
    const instanceDao = await upgrades.deployProxy(Dao, daoArgs);
    await instanceDao.deployed();
  });

  describe("Given GovernorTokenDAO contract deployed and initialised", async function () {
    it("GovernorTokenDAO initialize again should fail", async function () {
      const { instanceDao, signers, governorTransferToken } = await loadFixture(
        deployFixture
      );
      const daoArgs = [
        signers[0].address,
        daoName,
        daoLogoUrl,
        governorTransferToken.address,
      ];
      await expect(
        instanceDao.initialize(
          signers[0].address,
          daoName,
          daoLogoUrl,
          governorTransferToken.address
        )
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify getDaoDetail returns correct values", async function () {
      const { instanceDao } = await loadFixture(deployFixture);
      const result = await instanceDao.callStatic.getDaoDetail();
      expect(result[0]).to.be.equals(daoName);
      expect(result[1]).to.be.equals(daoLogoUrl);
    });

    it("Verify addWebLink and getWebLinks", async function () {
      const { instanceDao, signers } = await loadFixture(deployFixture);
      await instanceDao.addWebLink(webKey, webUrl);
      const result = await instanceDao.callStatic.getWebLinks();
      await expect(instanceDao.addWebLink("", webUrl)).revertedWith(
        "BaseDAO: invalid key passed"
      );
      await expect(instanceDao.addWebLink(webKey, "")).revertedWith(
        "BaseDAO: invalid value passed"
      );

      expect(result[0].key).to.be.equals(webKey);
      expect(result[0].value).to.be.equals(webUrl);
    });

    it("Verify addWebLink fails when called by non admin", async function () {
      const { instanceDao, signers } = await loadFixture(deployFixture);
      await expect(
        instanceDao.connect(signers[1]).addWebLink(webKey, webUrl)
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify getGovernorTokenTransferContractAddress", async function () {
      const { instanceDao, governorTransferToken } = await loadFixture(
        deployFixture
      );
      const governor =
        await instanceDao.getGovernorTokenTransferContractAddress();
      expect(governor).to.be.equals(governorTransferToken.address);
    });

    it("Verify createProposal", async function () {
      const { instanceDao, signers, tokenCont } = await loadFixture(
        deployFixture
      );
      await instanceDao.createProposal(
        "proposal",
        "description",
        "linkToDiscussion",
        signers[0].address,
        signers[1].address,
        tokenCont.address,
        100
      );
      const proposals = await instanceDao.getAllProposals();
      expect(proposals.length).to.be.equals(1);
    });

    it("Verify createProposal with non admin should fail", async function () {
      const { instanceDao, signers, tokenCont } = await loadFixture(
        deployFixture
      );
      await expect(
        instanceDao
          .connect(signers[1])
          .createProposal(
            "proposal",
            "description",
            "linkToDiscussion",
            signers[0].address,
            signers[1].address,
            tokenCont.address,
            100
          )
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify getAllProposals", async function () {
      const { instanceDao, signers, tokenCont } = await loadFixture(
        deployFixture
      );
      await instanceDao.createProposal(
        "proposal",
        "description",
        "linkToDiscussion",
        signers[0].address,
        signers[1].address,
        tokenCont.address,
        100
      );
      const proposals = await instanceDao.getAllProposals();
      expect(proposals.length).to.be.equals(1);
    });
  });
});
