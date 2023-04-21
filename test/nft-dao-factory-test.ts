import { expect } from "chai";
import { BigNumber } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Events, NFTDAOCreatedEventLog } from "./types";

describe("NFTDAOFactory contract tests", function () {
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

    const token = await TestHelper.deployLogic("ERC721Mock");
    token.setUserBalance(signers[0].address, total);

    const bastHTS = await TestHelper.deployLogic(
      "MockBaseHTS",
      true,
      zeroAddress
    );

    const nftTokenDAO = await TestHelper.deployLogic("GovernorTokenDAO");

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
      governorTransferToken.address
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
    } = await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance.initialize(
        dexOwner.address,
        bastHTS.address,
        nftTokenDAO.address,
        nftHolderFactory.address,
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
      .withArgs("DAOFactory: admin address is zero");
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
      .withArgs("DAOFactory: name is empty");
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
      .withArgs("DAOFactory: url is empty");
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
      .withArgs("DAOFactory: token address is zero");
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
      .withArgs("DAOFactory: voting period is zero");
  });

  it("Verify createDAO should emit NFTDAOCreated event when a DAO is created", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, token } =
      await loadFixture(deployFixture);

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

    const { name, args } = await TestHelper.readLastEvent(txn);
    expect(name).to.be.equal(Events.NFTDAOCreated);

    const argsWithName =
      TestHelper.getEventArgumentsByName<NFTDAOCreatedEventLog>(args);
    const { daoDetails } = argsWithName;
    expect(daoDetails).to.have.property("daoAddress");

    const { daoAddress } = daoDetails;
    expect(daoAddress).to.have.lengthOf.greaterThan(0);

    expect(daoDetails).to.deep.include({
      admin: daoAdminOne.address,
      name: "DAO_NAME",
      logoUrl: "LOGO_URL",
      tokenAddress: token.address,
      votingRules: {
        quorumThreshold: BigNumber.from(500),
        votingDelay: BigNumber.from(0),
        votingPeriod: BigNumber.from(100),
      },
      isPrivate: false,
    });
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

    const { args } = await TestHelper.readLastEvent(txn);
    const argsWithNames =
      TestHelper.getEventArgumentsByName<NFTDAOCreatedEventLog>(args);
    const { daoAddress, isPrivate } = argsWithNames.daoDetails;
    expect(isPrivate).to.be.equal(false);
    expect(daoAddress).not.to.be.equal("0x0");

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

    const { args } = await TestHelper.readLastEvent(txn);
    const argsWithNames =
      TestHelper.getEventArgumentsByName<NFTDAOCreatedEventLog>(args);
    const { daoAddress, isPrivate } = argsWithNames.daoDetails;
    expect(isPrivate).to.be.equal(true);
    expect(daoAddress).not.to.be.equal("0x0");

    const updatedList = await governorDAOFactoryInstance.getDAOs();
    expect(updatedList.length).to.be.equal(0);
  });

  it("Verify upgrade logic call should be reverted for non dex owner", async function () {
    const { governorDAOFactoryInstance, daoAdminOne, daoAdminTwo } =
      await loadFixture(deployFixture);

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminOne)
        .upgradeTokenDaoLogicImplementation(zeroAddress)
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("DAOFactory: auth failed");

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminTwo)
        .upgradeTokenTransferLogicImplementation(zeroAddress)
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("DAOFactory: auth failed");

    await expect(
      governorDAOFactoryInstance
        .connect(daoAdminTwo)
        .upgradeTokenHolderFactory(zeroAddress)
    )
      .to.revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("DAOFactory: auth failed");
  });

  it("Verify upgrade logic call should be proceeded for dex owner", async function () {
    const { governorDAOFactoryInstance, dexOwner } = await loadFixture(
      deployFixture
    );

    const txn1 = await governorDAOFactoryInstance
      .connect(dexOwner)
      .upgradeTokenDaoLogicImplementation(oneAddress);

    const event1 = (await txn1.wait()).events.pop();
    expect(event1.event).to.be.equal("LogicUpdated");
    expect(event1.args.name).to.be.equal("TokenDAO");
    expect(event1.args.newImplementation).to.be.equal(oneAddress);

    const txn2 = await governorDAOFactoryInstance
      .connect(dexOwner)
      .upgradeTokenTransferLogicImplementation(oneAddress);

    const event2 = (await txn2.wait()).events.pop();
    expect(event2.event).to.be.equal("LogicUpdated");
    expect(event2.args.name).to.be.equal("TransferToken");
    expect(event2.args.newImplementation).to.be.equal(oneAddress);

    const txn3 = await governorDAOFactoryInstance
      .connect(dexOwner)
      .upgradeTokenHolderFactory(oneAddress);

    const event3 = (await txn3.wait()).events.pop();
    expect(event3.event).to.be.equal("LogicUpdated");
    expect(event3.args.name).to.be.equal("TokenHolderFactory");
    expect(event3.args.newImplementation).to.be.equal(oneAddress);
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
      .to.revertedWithCustomError(governorDAOFactoryInstance, "NotAdmin")
      .withArgs("DAOFactory: auth failed");

    const address = await governorDAOFactoryInstance
      .connect(dexOwner)
      .getTokenHolderFactoryAddress();

    expect(address).to.be.equals(nftHolderFactory.address);
  });
});
