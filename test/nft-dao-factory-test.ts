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
  const DESCRIPTION = "DESCRIPTION";
  const WEB_LINKS = [
    "TWITTER",
    "https://twitter.com",
    "LINKEDIN",
    "https://linkedin.com",
  ];

  async function deployFixture() {
    const dexOwner = await TestHelper.getDexOwner();
    const signers = await TestHelper.getSigners();
    const daoAdminOne = signers[5];
    const daoAdminTwo = signers[6];

    const token = await TestHelper.deployLogic("ERC721Mock");
    token.setUserBalance(signers[0].address, total);

    const bastHTS = await TestHelper.deployMockHederaService();
    const godHolder = await TestHelper.deployGodHolder(bastHTS, token);

    const governorTT = await TestHelper.deployLogic("GovernorTransferToken");
    const governorUpgrade = await TestHelper.deployLogic("GovernorUpgrade");
    const governorTokenCreate = await TestHelper.deployLogic(
      "GovernorTokenCreate"
    );
    const governorTextProposal = await TestHelper.deployLogic(
      "GovernorTextProposal"
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

    const common = [
      bastHTS.address,
      godHolder.address,
      signers[4].address,
      signers[5].address,
    ];

    const nftTokenDAO = await TestHelper.deployLogic("TokenTransferDAO");

    const nftHolder = await TestHelper.deployLogic("NFTHolder");
    const nftHolderFactory = await TestHelper.deployProxy(
      "NFTTokenHolderFactory",
      bastHTS.address,
      nftHolder.address,
      dexOwner.address
    );

    const governorTransferToken = await TestHelper.deployLogic(
      "GovernorTransferToken"
    );

    const governorDAOFactoryInstance = await TestHelper.deployProxy(
      "NFTDAOFactory",
      dexOwner.address,
      bastHTS.address,
      nftTokenDAO.address,
      nftHolderFactory.address,
      governance
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
    };
  }

  it("Verify NFTDAOFactory contract revert for multiple initialization", async function () {
    const {
      governorDAOFactoryInstance,
      dexOwner,
      bastHTS,
      nftTokenDAO,
      nftHolderFactory,
      governorTransferToken,
      governance,
    } = await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance.initialize(
        dexOwner.address,
        bastHTS.address,
        nftTokenDAO.address,
        nftHolderFactory.address,
        governance
      )
    ).revertedWith("Initializable: contract is already initialized");
  });

  it("Verify createDAO should be reverted when dao admin is zero", async function () {
    const { governorDAOFactoryInstance, token } = await loadFixture(
      deployFixture
    );
    const CREATE_DAO_ARGS = [
      TestHelper.ZERO_ADDRESS,
      DAO_NAME,
      LOGO_URL,
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
    const { governorDAOFactoryInstance, daoAdminOne } = await loadFixture(
      deployFixture
    );
    const CREATE_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
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

  it("Verify createDAO should add new dao into list when the dao is public", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);

    const currentList = await governorDAOFactoryInstance.getDAOs();
    expect(currentList.length).equal(0);

    const CREATE_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
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
    const { governorDAOFactoryInstance, daoAdminOne, daoAdminTwo, governance } =
      await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminOne)
        .upgradeTokenDaoLogicImplementation(zeroAddress)
    )
      .revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("DAOFactory: auth failed");

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminTwo)
        .upgradeGovernorsImplementation(governance)
    )
      .revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("DAOFactory: auth failed");

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminTwo)
        .upgradeTokenHolderFactory(zeroAddress)
    )
      .revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("DAOFactory: auth failed");
  });

  it("Verify upgrade logic call should be proceeded for dex owner", async function () {
    const { governorDAOFactoryInstance, dexOwner, governance } =
      await loadFixture(deployFixture);

    const txn1 = await governorDAOFactoryInstance
      .connect(dexOwner)
      .upgradeTokenDaoLogicImplementation(oneAddress);

    const event1 = (await txn1.wait()).events.pop();
    expect(event1.event).equal("LogicUpdated");
    expect(event1.args.name).equal("TokenDAO");
    expect(event1.args.newImplementation).equal(oneAddress);

    const txn2 = await governorDAOFactoryInstance
      .connect(dexOwner)
      .upgradeGovernorsImplementation(governance);

    const event2 = (await txn2.wait()).events.pop();
    expect(event2.event).equal("GovernorLogicUpdated");
    expect(event2.args.name).equal("Governors");
    expect(event2.args.newImplementation.tokenTransferLogic).equal(
      governance[0]
    );
    expect(event2.args.newImplementation.textLogic).equal(governance[1]);
    expect(event2.args.newImplementation.contractUpgradeLogic).equal(
      governance[2]
    );
    expect(event2.args.newImplementation.createTokenLogic).equal(governance[3]);

    const txn3 = await governorDAOFactoryInstance
      .connect(dexOwner)
      .upgradeTokenHolderFactory(oneAddress);

    const event3 = (await txn3.wait()).events.pop();
    expect(event3.event).equal("LogicUpdated");
    expect(event3.args.name).equal("TokenHolderFactory");
    expect(event3.args.newImplementation).equal(oneAddress);
  });

  it("Verify getNFTTokenHolderFactoryAddress guard check ", async function () {
    const {
      governorDAOFactoryInstance,
      daoAdminOne,
      nftHolderFactory,
      dexOwner,
    } = await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminOne)
        .getTokenHolderFactoryAddress()
    )
      .revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("DAOFactory: auth failed");

    const address = await governorDAOFactoryInstance
      .connect(dexOwner)
      .getTokenHolderFactoryAddress();

    expect(address).equals(nftHolderFactory.address);
  });

  it("Verify upgradeHederaService should fail when non-owner try to upgrade Hedera service", async function () {
    const { governorDAOFactoryInstance, signers } = await loadFixture(
      deployFixture
    );
    const nonOwner = signers[3];
    await expect(
      governorDAOFactoryInstance
        .connect(nonOwner)
        .upgradeHederaService(signers[3].address)
    ).revertedWith("Ownable: caller is not the owner");
  });

  it("Verify upgrade Hedera service should pass when owner try to upgrade it", async function () {
    const { governorDAOFactoryInstance, signers } = await loadFixture(
      deployFixture
    );

    await expect(
      governorDAOFactoryInstance.upgradeHederaService(signers[3].address)
    ).not.revertedWith("Ownable: caller is not the owner");
  });
});
