import { expect } from "chai";
import { BigNumber } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("GovernanceDAOFactory contract tests", function () {
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const oneAddress = "0x0000000000000000000000000000000000000001";
  const total = 100 * 1e8;
  const DAO_NAME = "DAO_NAME";
  const LOGO_URL = "LOGO_URL";

  async function deployFixture() {
    const dexOwner = await TestHelper.getDexOwner();
    const signers = await TestHelper.getSigners();
    const daoAdminOne = signers[5];
    const daoAdminTwo = signers[6];

    const token = await TestHelper.deployLogic(
      "ERC20Mock",
      "Test",
      "Test",
      total,
      0
    );
    token.setUserBalance(signers[0].address, total);

    const bastHTS = await TestHelper.deployLogic(
      "MockBaseHTS",
      true,
      zeroAddress
    );

    const governorTokenDAO = await TestHelper.deployLogic("GovernorTokenDAO");

    const godHolder = await TestHelper.deployLogic("GODHolder");
    const godHolderFactory = await TestHelper.deployProxy(
      "GODTokenHolderFactory",
      bastHTS.address,
      godHolder.address,
      dexOwner.address
    );

    const governorTransferToken = await TestHelper.deployLogic(
      "GovernorTransferToken"
    );

    const governorDAOFactoryInstance = await TestHelper.deployProxy(
      "GovernanceDAOFactory",
      dexOwner.address,
      bastHTS.address,
      governorTokenDAO.address,
      godHolderFactory.address,
      governorTransferToken.address
    );
    return {
      governorDAOFactoryInstance,
      dexOwner,
      bastHTS,
      governorTokenDAO,
      godHolderFactory,
      governorTransferToken,
      daoAdminOne,
      daoAdminTwo,
      token,
    };
  }

  it("Verify GovernanceDAOFactory contract revert for multiple initialization", async function () {
    const {
      governorDAOFactoryInstance,
      dexOwner,
      bastHTS,
      governorTokenDAO,
      godHolderFactory,
      governorTransferToken,
    } = await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance.initialize(
        dexOwner.address,
        bastHTS.address,
        governorTokenDAO.address,
        godHolderFactory.address,
        governorTransferToken.address
      )
    ).to.revertedWith("Initializable: contract is already initialized");
  });

  it("Verify createDAO should be reverted when dao admin is zero", async function () {
    const { governorDAOFactoryInstance, token } = await loadFixture(
      deployFixture
    );
    await expect(
      governorDAOFactoryInstance.createDAO(
        zeroAddress,
        DAO_NAME,
        LOGO_URL,
        token.address,
        BigNumber.from(500),
        BigNumber.from(0),
        BigNumber.from(100),
        true
      )
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "InvalidInput")
      .withArgs("GovernanceDAOFactory: admin address is zero");
  });

  it("Verify createDAO should be reverted when dao name is empty", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);
    await expect(
      governorDAOFactoryInstance.createDAO(
        daoAdminOne.address,
        "",
        LOGO_URL,
        token.address,
        BigNumber.from(500),
        BigNumber.from(0),
        BigNumber.from(100),
        true
      )
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "InvalidInput")
      .withArgs("GovernanceDAOFactory: name is empty");
  });

  it("Verify createDAO should be reverted when dao url is empty", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);
    await expect(
      governorDAOFactoryInstance.createDAO(
        daoAdminOne.address,
        DAO_NAME,
        "",
        token.address,
        BigNumber.from(500),
        BigNumber.from(0),
        BigNumber.from(100),
        true
      )
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "InvalidInput")
      .withArgs("GovernanceDAOFactory: url is empty");
  });

  it("Verify createDAO should be reverted when token address is zero", async function () {
    const { governorDAOFactoryInstance, daoAdminOne } = await loadFixture(
      deployFixture
    );
    await expect(
      governorDAOFactoryInstance.createDAO(
        daoAdminOne.address,
        DAO_NAME,
        LOGO_URL,
        zeroAddress,
        BigNumber.from(500),
        BigNumber.from(0),
        BigNumber.from(100),
        true
      )
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "InvalidInput")
      .withArgs("GovernanceDAOFactory: token address is zero");
  });

  it("Verify createDAO should be reverted when voting period is zero", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);
    await expect(
      governorDAOFactoryInstance.createDAO(
        daoAdminOne.address,
        DAO_NAME,
        LOGO_URL,
        token.address,
        BigNumber.from(500),
        BigNumber.from(0),
        BigNumber.from(0),
        false
      )
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "InvalidInput")
      .withArgs("GovernanceDAOFactory: voting period is zero");
  });

  it("Verify createDAO should add new dao into list when the dao is public", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);

    const currentList = await governorDAOFactoryInstance.getDAOs();
    expect(currentList.length).to.be.equal(0);

    const txn = await governorDAOFactoryInstance.createDAO(
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      token.address,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(100),
      false
    );

    const lastEvent = (await txn.wait()).events.pop();
    expect(lastEvent.event).to.be.equal("PublicDaoCreated");
    expect(lastEvent.args.daoAddress).not.to.be.equal("0x0");

    const updatedList = await governorDAOFactoryInstance.getDAOs();
    expect(updatedList.length).to.be.equal(1);
  });

  it("Verify createDAO should not add new dao into list when the dao is private", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);

    const currentList = await governorDAOFactoryInstance.getDAOs();
    expect(currentList.length).to.be.equal(0);

    const txn = await governorDAOFactoryInstance.createDAO(
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      token.address,
      BigNumber.from(500),
      BigNumber.from(0),
      BigNumber.from(100),
      true
    );

    const lastEvent = (await txn.wait()).events.pop();
    expect(lastEvent.event).to.be.equal("PrivateDaoCreated");
    expect(lastEvent.args.daoAddress).not.to.be.equal("0x0");

    const updatedList = await governorDAOFactoryInstance.getDAOs();
    expect(updatedList.length).to.be.equal(0);
  });

  it("Verify upgrade logic call should be reverted for non dex owner", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, daoAdminTwo } =
      await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminOne)
        .upgradeGovernorTokenDaoLogicImplementation(zeroAddress)
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("GovernanceDAOFactory: auth failed");

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminTwo)
        .upgradeGovernorTokenTransferLogicImplementation(zeroAddress)
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("GovernanceDAOFactory: auth failed");

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminTwo)
        .upgradeGODTokenHolderFactory(zeroAddress)
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("GovernanceDAOFactory: auth failed");
  });

  it("Verify upgrade logic call should be proceeded for dex owner", async function () {
    const { governorDAOFactoryInstance, dexOwner } = await loadFixture(
      deployFixture
    );

    const txn1 = await governorDAOFactoryInstance
      .connect(dexOwner)
      .upgradeGovernorTokenDaoLogicImplementation(oneAddress);

    const event1 = (await txn1.wait()).events.pop();
    expect(event1.event).to.be.equal("LogicUpdated");
    expect(event1.args.name).to.be.equal("GovernorTokenDAO");
    expect(event1.args.newImplementation).to.be.equal(oneAddress);

    const txn2 = await governorDAOFactoryInstance
      .connect(dexOwner)
      .upgradeGovernorTokenTransferLogicImplementation(oneAddress);

    const event2 = (await txn2.wait()).events.pop();
    expect(event2.event).to.be.equal("LogicUpdated");
    expect(event2.args.name).to.be.equal("GovernorTransferToken");
    expect(event2.args.newImplementation).to.be.equal(oneAddress);

    const txn3 = await governorDAOFactoryInstance
      .connect(dexOwner)
      .upgradeGODTokenHolderFactory(oneAddress);

    const event3 = (await txn3.wait()).events.pop();
    expect(event3.event).to.be.equal("LogicUpdated");
    expect(event3.args.name).to.be.equal("GODTokenHolderFactory");
    expect(event3.args.newImplementation).to.be.equal(oneAddress);
  });

  it("Verify getGODTokenHolderFactoryAddress guard check ", async function () {
    const {
      governorDAOFactoryInstance,
      daoAdminOne,
      godHolderFactory,
      dexOwner,
    } = await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminOne)
        .getGODTokenHolderFactoryAddress()
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("GovernanceDAOFactory: auth failed");

    const address = await governorDAOFactoryInstance
      .connect(dexOwner)
      .getGODTokenHolderFactoryAddress();

    expect(address).to.be.equals(godHolderFactory.address);
  });
});
