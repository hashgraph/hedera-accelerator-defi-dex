import { expect } from "chai";
import { BigNumber } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("NFTDAOFactory contract tests", function () {
  const QUORUM_THRESHOLD = 5;
  const QUORUM_THRESHOLD_BSP = QUORUM_THRESHOLD * 100;
  const VOTING_DELAY = 0;
  const VOTING_PERIOD = 12;

  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const oneAddress = "0x0000000000000000000000000000000000000001";
  const total = 100 * 1e8;
  const DAO_NAME = "DAO_NAME";
  const LOGO_URL = "LOGO_URL";
  const INFO_URL = "https://twitter.com";
  const DESCRIPTION = "DESCRIPTION";
  const WEB_LINKS = [
    "TWITTER",
    "https://twitter.com",
    "LINKEDIN",
    "https://linkedin.com",
  ];

  async function verifyDAOConfigChangeEvent(txn: any, daoConfig: any) {
    const { name, args } = await TestHelper.readLastEvent(txn);
    const txnHash = args.txnHash;
    const newDAOConfig = args.daoConfig;

    expect(name).equal("DAOConfig");
    expect(newDAOConfig.daoTreasurer).equals(daoConfig.daoTreasurer);
    expect(newDAOConfig.tokenAddress).equals(daoConfig.tokenAddress);
    expect(newDAOConfig.daoFee).equals(daoConfig.daoFee);
    return { txnHash, newDAOConfig };
  }

  async function deployFixture() {
    const dexOwner = await TestHelper.getDexOwner();
    const signers = await TestHelper.getSigners();
    const tokenInstance = await TestHelper.deployERC20Mock();
    const daoAdminOne = signers[5];
    const daoAdminTwo = signers[6];

    const token = await TestHelper.deployLogic("ERC721Mock");
    token.setUserBalance(signers[0].address, total);

    const bastHTS = await TestHelper.deployMockHederaService();
    const godHolder = await TestHelper.deployGodHolder(bastHTS, token);

    const governorTT = await TestHelper.deployLogic("GovernorTransferToken");
    const governorUpgrade = await TestHelper.deployLogic("GovernorUpgrade");
    const governorTokenCreate = await TestHelper.deployLogic(
      "GovernorTokenCreate",
    );
    const governorTextProposal = await TestHelper.deployLogic(
      "GovernorTextProposal",
    );

    const inputs = {
      admin: daoAdminOne.address,
      name: DAO_NAME,
      LOGO_URL,
      token: token.address,
      QUORUM_THRESHOLD_BSP,
      VOTING_DELAY,
      VOTING_PERIOD,
      isPrivate: false,
      description: DESCRIPTION,
      webLinks: WEB_LINKS,
    };

    const governance = [
      governorTT.address,
      governorTextProposal.address,
      governorUpgrade.address,
      governorTokenCreate.address,
    ];

    const common = [bastHTS.address, godHolder.address];

    const systemUsersSigners = await TestHelper.systemUsersSigners();
    const systemRoleBasedAccess = (
      await TestHelper.deploySystemRoleBasedAccess()
    ).address;

    const nftTokenDAO = await TestHelper.deployLogic("FTDAO");

    const nftHolder = await TestHelper.deployLogic("NFTHolder");
    const nftHolderFactory = await TestHelper.deployProxy(
      "NFTTokenHolderFactory",
      bastHTS.address,
      nftHolder.address,
      dexOwner.address,
    );

    const governorTransferToken = await TestHelper.deployLogic(
      "GovernorTransferToken",
    );

    const daoConfigData = {
      daoTreasurer: signers[11].address,
      tokenAddress: tokenInstance.address,
      daoFee: TestHelper.toPrecision(20),
    };
    const governorDAOFactoryInstance = await TestHelper.deployProxy(
      "NFTDAOFactory",
      systemRoleBasedAccess,
      bastHTS.address,
      nftTokenDAO.address,
      Object.values(daoConfigData),
      nftHolderFactory.address,
      governance,
    );

    return {
      governorDAOFactoryInstance,
      dexOwner,
      bastHTS,
      nftTokenDAO,
      nftHolderFactory,
      governorTransferToken,
      daoAdminOne,
      daoAdminTwo,
      token,
      signers,
      inputs,
      governance,
      common,
      systemRoleBasedAccess,
      systemUsersSigners,
      tokenInstance,
      daoConfigData,
    };
  }

  it("Verify NFTDAOFactory contract revert for multiple initialization", async function () {
    const {
      governorDAOFactoryInstance,
      bastHTS,
      nftTokenDAO,
      nftHolderFactory,
      governance,
      systemRoleBasedAccess,
      daoConfigData,
    } = await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance.initialize(
        systemRoleBasedAccess,
        bastHTS.address,
        nftTokenDAO.address,
        Object.values(daoConfigData),
        nftHolderFactory.address,
        governance,
      ),
    ).revertedWith("Initializable: contract is already initialized");
  });

  it("Verify createDAO should be reverted when dao admin is zero", async function () {
    const { governorDAOFactoryInstance, token } =
      await loadFixture(deployFixture);
    const CREATE_DAO_ARGS = [
      TestHelper.ZERO_ADDRESS,
      DAO_NAME,
      LOGO_URL,
      INFO_URL,
      token.address,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(100),
      true,
      DESCRIPTION,
      WEB_LINKS,
    ];
    await expect(governorDAOFactoryInstance.createDAO(CREATE_DAO_ARGS))
      .revertedWithCustomError(governorDAOFactoryInstance, "InvalidInput")
      .withArgs("BaseDAO: admin address is zero");
  });

  it("Verify createDAO should be reverted when dao name is empty", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);
    const CREATE_DAO_ARGS = [
      daoAdminOne.address,
      "",
      LOGO_URL,
      INFO_URL,
      token.address,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(100),
      true,
      DESCRIPTION,
      WEB_LINKS,
    ];
    await expect(governorDAOFactoryInstance.createDAO(CREATE_DAO_ARGS))
      .revertedWithCustomError(governorDAOFactoryInstance, "InvalidInput")
      .withArgs("BaseDAO: name is empty");
  });

  it("Verify createDAO should be reverted when token address is zero", async function () {
    const { governorDAOFactoryInstance, daoAdminOne } =
      await loadFixture(deployFixture);
    const CREATE_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      INFO_URL,
      TestHelper.ZERO_ADDRESS,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(100),
      true,
      DESCRIPTION,
      WEB_LINKS,
    ];
    await expect(governorDAOFactoryInstance.createDAO(CREATE_DAO_ARGS))
      .revertedWithCustomError(governorDAOFactoryInstance, "InvalidInput")
      .withArgs("DAOFactory: token address is zero");
  });

  it("Verify createDAO should be reverted when voting period is zero", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);
    const CREATE_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      INFO_URL,
      token.address,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(0),
      true,
      DESCRIPTION,
      WEB_LINKS,
    ];
    await expect(governorDAOFactoryInstance.createDAO(CREATE_DAO_ARGS))
      .revertedWithCustomError(governorDAOFactoryInstance, "InvalidInput")
      .withArgs("DAOFactory: voting period is zero");
  });

  it("Verify createDAO should be reverted when info url is empty", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);
    const CREATE_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      "",
      token.address,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(100),
      true,
      DESCRIPTION,
      WEB_LINKS,
    ];
    await expect(governorDAOFactoryInstance.createDAO(CREATE_DAO_ARGS))
      .revertedWithCustomError(governorDAOFactoryInstance, "InvalidInput")
      .withArgs("BaseDAO: info url is empty");
  });

  it("Verify createDAO should add new dao into list when the dao is public", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);

    const currentList = await governorDAOFactoryInstance.getDAOs();
    expect(currentList.length).equal(0);

    const CREATE_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      INFO_URL,
      token.address,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(100),
      false,
      DESCRIPTION,
      WEB_LINKS,
    ];

    const txn = await governorDAOFactoryInstance.createDAO(CREATE_DAO_ARGS);

    const lastEvent = (await txn.wait()).events.pop();
    expect(lastEvent.event).equal("DAOCreated");
    expect(lastEvent.args.daoAddress).not.equal("0x0");

    const updatedList = await governorDAOFactoryInstance.getDAOs();
    expect(updatedList.length).equal(1);
  });

  it("Verify createDAO should not add new dao into list when the dao is private", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);

    const currentList = await governorDAOFactoryInstance.getDAOs();
    expect(currentList.length).equal(0);

    const CREATE_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      INFO_URL,
      token.address,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(100),
      true,
      DESCRIPTION,
      WEB_LINKS,
    ];

    const txn = await governorDAOFactoryInstance.createDAO(CREATE_DAO_ARGS);

    const lastEvent = (await txn.wait()).events.pop();
    expect(lastEvent.event).equal("DAOCreated");
    expect(lastEvent.args.daoAddress).not.equal("0x0");

    const updatedList = await governorDAOFactoryInstance.getDAOs();
    expect(updatedList.length).equal(0);
  });

  it("Verify upgrade logic call should be reverted for non dex owner", async function () {
    const { governorDAOFactoryInstance, governance } =
      await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance.upgradeFTDAOLogicImplementation(zeroAddress),
    ).reverted;

    await expect(
      governorDAOFactoryInstance.upgradeGovernorsImplementation(governance),
    ).reverted;

    await expect(
      governorDAOFactoryInstance.upgradeTokenHolderFactory(zeroAddress),
    ).reverted;
  });

  it("Verify upgrade logic call should be proceeded for dex owner", async function () {
    const { governorDAOFactoryInstance, governance, systemUsersSigners } =
      await loadFixture(deployFixture);

    const txn1 = await governorDAOFactoryInstance
      .connect(systemUsersSigners.childProxyAdmin)
      .upgradeFTDAOLogicImplementation(oneAddress);

    const event1 = (await txn1.wait()).events.pop();
    expect(event1.event).equal("LogicUpdated");
    expect(event1.args.name).equal("FTDAO");
    expect(event1.args.newImplementation).equal(oneAddress);

    const txn2 = await governorDAOFactoryInstance
      .connect(systemUsersSigners.childProxyAdmin)
      .upgradeGovernorsImplementation(governance);

    const event2 = (await txn2.wait()).events.pop();
    expect(event2.event).equal("GovernorLogicUpdated");
    expect(event2.args.name).equal("Governors");
    expect(event2.args.newImplementation.tokenTransferLogic).equal(
      governance[0],
    );
    expect(event2.args.newImplementation.textLogic).equal(governance[1]);
    expect(event2.args.newImplementation.contractUpgradeLogic).equal(
      governance[2],
    );
    expect(event2.args.newImplementation.createTokenLogic).equal(governance[3]);

    const txn3 = await governorDAOFactoryInstance
      .connect(systemUsersSigners.childProxyAdmin)
      .upgradeTokenHolderFactory(oneAddress);

    const event3 = (await txn3.wait()).events.pop();
    expect(event3.event).equal("LogicUpdated");
    expect(event3.args.name).equal("TokenHolderFactory");
    expect(event3.args.newImplementation).equal(oneAddress);
  });

  it("Verify getTokenHolderFactoryAddress return correct address", async function () {
    const { governorDAOFactoryInstance, nftHolderFactory } =
      await loadFixture(deployFixture);
    expect(
      await governorDAOFactoryInstance.getTokenHolderFactoryAddress(),
    ).equals(nftHolderFactory.address);
  });

  it("Verify upgradeHederaService should fail when non-owner try to upgrade Hedera service", async function () {
    const { governorDAOFactoryInstance, signers } =
      await loadFixture(deployFixture);
    await expect(
      governorDAOFactoryInstance.upgradeHederaService(signers[3].address),
    ).reverted;
  });

  it("Verify upgrade Hedera service should pass when owner try to upgrade it", async function () {
    const { governorDAOFactoryInstance, signers, systemUsersSigners } =
      await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeHederaService(signers[3].address),
    ).not.reverted;
  });

  it("Verify createDAO should defined HBAR as DAO creation fee", async function () {
    const {
      bastHTS,
      nftTokenDAO,
      nftHolderFactory,
      governance,
      systemRoleBasedAccess,
      signers,
      daoAdminOne,
      token,
    } = await loadFixture(deployFixture);

    const daoConfigData = {
      daoTreasurer: signers[11].address,
      tokenAddress: TestHelper.ZERO_ADDRESS,
      daoFee: TestHelper.toPrecision(20),
    };

    const CREATE_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      INFO_URL,
      token.address,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(100),
      true,
      DESCRIPTION,
      WEB_LINKS,
    ];
    const governorDAOFactoryInstance = await TestHelper.deployProxy(
      "NFTDAOFactory",
      systemRoleBasedAccess,
      bastHTS.address,
      nftTokenDAO.address,
      Object.values(daoConfigData),
      nftHolderFactory.address,
      governance,
    );

    await expect(
      governorDAOFactoryInstance.createDAO(CREATE_DAO_ARGS, {
        value: daoConfigData.daoFee,
      }),
    ).changeEtherBalances(
      [signers[0].address, daoConfigData.daoTreasurer],
      [-daoConfigData.daoFee, daoConfigData.daoFee],
    );
  });

  it("Verify createDAO should defined token as DAO creation fee", async function () {
    const {
      governorDAOFactoryInstance,
      signers,
      tokenInstance,
      daoConfigData,
      daoAdminOne,
      token,
    } = await loadFixture(deployFixture);

    await tokenInstance.setUserBalance(
      signers[0].address,
      daoConfigData.daoFee,
    );
    const CREATE_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      INFO_URL,
      token.address,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(100),
      true,
      DESCRIPTION,
      WEB_LINKS,
    ];
    await expect(
      governorDAOFactoryInstance.createDAO(CREATE_DAO_ARGS),
    ).changeTokenBalances(
      tokenInstance,
      [signers[0].address, daoConfigData.daoTreasurer],
      [-daoConfigData.daoFee, daoConfigData.daoFee],
    );
  });

  it("Verify Change DAO Configuration Change should work", async function () {
    const { governorDAOFactoryInstance, signers, tokenInstance, daoAdminOne } =
      await loadFixture(deployFixture);

    const initialTreasurer = signers[11];
    const {
      daoTreasurer: initialTreasurerAddress,
      tokenAddress: initialTokenAddress,
      daoFee: initialFee,
    } = await governorDAOFactoryInstance.getDAOConfigDetails();

    expect(initialTreasurerAddress).equals(initialTreasurer.address);
    expect(initialTokenAddress).equals(tokenInstance.address);
    expect(initialFee).equals(TestHelper.toPrecision(20));

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminOne)
        .changeDAOConfig(
          signers[12].address,
          tokenInstance.address,
          TestHelper.toPrecision(30),
        ),
    ).revertedWith("FT DAO Factroy: DAO Treasurer only.");

    const newDAOConfig = {
      daoTreasurer: signers[12].address,
      tokenAddress: tokenInstance.address,
      daoFee: TestHelper.toPrecision(30),
    };
    const txn = await governorDAOFactoryInstance
      .connect(initialTreasurer)
      .changeDAOConfig(
        newDAOConfig.daoTreasurer,
        newDAOConfig.tokenAddress,
        newDAOConfig.daoFee,
      );

    verifyDAOConfigChangeEvent(txn, newDAOConfig);
  });

  it("Verify Initialize NFT DAO Factory emits DAOConfig", async function () {
    const {
      bastHTS,
      nftTokenDAO,
      nftHolderFactory,
      governance,
      systemRoleBasedAccess,
      signers,
      inputs,
    } = await loadFixture(deployFixture);

    const daoConfigData = {
      daoTreasurer: signers[11].address,
      tokenAddress: TestHelper.ZERO_ADDRESS,
      daoFee: TestHelper.toPrecision(20),
    };

    const transaction = await TestHelper.deployProxy(
      "NFTDAOFactory",
      systemRoleBasedAccess,
      bastHTS.address,
      nftTokenDAO.address,
      Object.values(daoConfigData),
      nftHolderFactory.address,
      governance,
    );
    verifyDAOConfigChangeEvent(transaction, daoConfigData);
  });
});
