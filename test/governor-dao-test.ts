import { expect } from "chai";
import { BigNumber } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("GovernanceTokenDAO tests", function () {
  const QUORUM_THRESHOLD = 5;
  const QUORUM_THRESHOLD_BSP = QUORUM_THRESHOLD * 100;

  const TOTAL = 100 * 1e8;
  const VOTING_DELAY = 0;
  const VOTING_PERIOD = 12;

  const DAO_NAME = "DAO_NAME";
  const LOGO_URL = "LOGO_URL";

  const WEB_KEY = "git";
  const WEB_URL = "web-url";

  async function deployFixture() {
    const dexOwner = await TestHelper.getDexOwner();
    const daoAdminOne = await TestHelper.getDAOAdminOne();
    const daoAdminTwo = await TestHelper.getDAOAdminTwo();
    const signers = await TestHelper.getSigners();

    const baseHTS = await TestHelper.deployMockBaseHTS();
    const token = await TestHelper.deployERC20Mock(TOTAL);
    await token.setUserBalance(signers[0].address, TOTAL);

    const godHolder = await TestHelper.deployGodHolder(baseHTS, token);

    const ARGS = [
      token.address,
      VOTING_DELAY,
      VOTING_PERIOD,
      baseHTS.address,
      godHolder.address,
      QUORUM_THRESHOLD_BSP,
    ];

    const governorTT = await TestHelper.deployLogic("GovernorTransferToken");
    await governorTT.initialize(...ARGS);

    const GOVERNOR_TOKEN_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      governorTT.address,
    ];
    const governorTokenDAO = await TestHelper.deployLogic("GovernorTokenDAO");
    await governorTokenDAO.initialize(...GOVERNOR_TOKEN_DAO_ARGS);

    const godHolderFactory = await TestHelper.deployGodTokenHolderFactory(
      baseHTS,
      godHolder,
      dexOwner.address
    );

    const governorDAOFactory = await TestHelper.deployLogic(
      "GovernanceDAOFactory"
    );
    await governorDAOFactory.initialize(
      dexOwner.address,
      baseHTS.address,
      governorTokenDAO.address,
      godHolderFactory.address,
      governorTT.address
    );
    return {
      token,
      signers,
      baseHTS,
      dexOwner,
      governorTT,
      daoAdminOne,
      daoAdminTwo,
      godHolderFactory,
      governorTokenDAO,
      governorDAOFactory,
      GOVERNOR_TOKEN_DAO_ARGS,
    };
  }

  describe("GovernanceDAOFactory contract tests", async function () {
    it("Verify contract should be revert for multiple initialization", async function () {
      const {
        governorDAOFactory,
        dexOwner,
        baseHTS,
        governorTokenDAO,
        godHolderFactory,
        governorTT,
      } = await loadFixture(deployFixture);

      await expect(
        governorDAOFactory.initialize(
          dexOwner.address,
          baseHTS.address,
          governorTokenDAO.address,
          godHolderFactory.address,
          governorTT.address
        )
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify createDAO should be reverted when dao admin is zero", async function () {
      const { governorDAOFactory, token } = await loadFixture(deployFixture);
      await expect(
        governorDAOFactory.createDAO(
          TestHelper.ZERO_ADDRESS,
          DAO_NAME,
          LOGO_URL,
          token.address,
          BigNumber.from(500),
          BigNumber.from(0),
          BigNumber.from(100),
          true
        )
      )
        .revertedWithCustomError(governorDAOFactory, "InvalidInput")
        .withArgs("DAOFactory: admin address is zero");
    });

    it("Verify createDAO should be reverted when dao name is empty", async function () {
      const { governorDAOFactory, daoAdminOne, token } = await loadFixture(
        deployFixture
      );
      await expect(
        governorDAOFactory.createDAO(
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
        .revertedWithCustomError(governorDAOFactory, "InvalidInput")
        .withArgs("DAOFactory: name is empty");
    });

    it("Verify createDAO should be reverted when token address is zero", async function () {
      const { governorDAOFactory, daoAdminOne } = await loadFixture(
        deployFixture
      );
      await expect(
        governorDAOFactory.createDAO(
          daoAdminOne.address,
          DAO_NAME,
          LOGO_URL,
          TestHelper.ZERO_ADDRESS,
          BigNumber.from(500),
          BigNumber.from(0),
          BigNumber.from(100),
          true
        )
      )
        .revertedWithCustomError(governorDAOFactory, "InvalidInput")
        .withArgs("DAOFactory: token address is zero");
    });

    it("Verify createDAO should be reverted when voting period is zero", async function () {
      const { governorDAOFactory, daoAdminOne, token } = await loadFixture(
        deployFixture
      );
      await expect(
        governorDAOFactory.createDAO(
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
        .revertedWithCustomError(governorDAOFactory, "InvalidInput")
        .withArgs("DAOFactory: voting period is zero");
    });

    it("Verify createDAO should add new dao into list when the dao is public", async function () {
      const { governorDAOFactory, daoAdminOne, token } = await loadFixture(
        deployFixture
      );

      const currentList = await governorDAOFactory.getDAOs();
      expect(currentList.length).equal(0);

      const txn = await governorDAOFactory.createDAO(
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
      expect(lastEvent.event).equal("DAOCreated");
      expect(lastEvent.args.daoAddress).not.equal("0x0");

      const updatedList = await governorDAOFactory.getDAOs();
      expect(updatedList.length).equal(1);
    });

    it("Verify createDAO should not add new dao into list when the dao is private", async function () {
      const { governorDAOFactory, daoAdminOne, token } = await loadFixture(
        deployFixture
      );

      const currentList = await governorDAOFactory.getDAOs();
      expect(currentList.length).equal(0);

      const txn = await governorDAOFactory.createDAO(
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
      expect(lastEvent.event).equal("DAOCreated");
      expect(lastEvent.args.daoAddress).not.equal("0x0");

      const updatedList = await governorDAOFactory.getDAOs();
      expect(updatedList.length).equal(0);
    });

    it("Verify upgrade logic call should be reverted for non dex owner", async function () {
      const { governorDAOFactory, daoAdminOne, daoAdminTwo } =
        await loadFixture(deployFixture);

      await expect(
        governorDAOFactory
          .connect(daoAdminOne)
          .upgradeTokenDaoLogicImplementation(TestHelper.ZERO_ADDRESS)
      )
        .revertedWithCustomError(governorDAOFactory, "NotAdmin")
        .withArgs("DAOFactory: auth failed");

      await expect(
        governorDAOFactory
          .connect(daoAdminTwo)
          .upgradeTokenTransferLogicImplementation(TestHelper.ZERO_ADDRESS)
      )
        .revertedWithCustomError(governorDAOFactory, "NotAdmin")
        .withArgs("DAOFactory: auth failed");

      await expect(
        governorDAOFactory
          .connect(daoAdminTwo)
          .upgradeTokenHolderFactory(TestHelper.ZERO_ADDRESS)
      )
        .revertedWithCustomError(governorDAOFactory, "NotAdmin")
        .withArgs("DAOFactory: auth failed");
    });

    it("Verify upgrade logic call should be proceeded for dex owner", async function () {
      const { governorDAOFactory, dexOwner } = await loadFixture(deployFixture);

      const txn1 = await governorDAOFactory
        .connect(dexOwner)
        .upgradeTokenDaoLogicImplementation(TestHelper.ONE_ADDRESS);

      const event1 = (await txn1.wait()).events.pop();
      expect(event1.event).equal("LogicUpdated");
      expect(event1.args.name).equal("TokenDAO");
      expect(event1.args.newImplementation).equal(TestHelper.ONE_ADDRESS);

      const txn2 = await governorDAOFactory
        .connect(dexOwner)
        .upgradeTokenTransferLogicImplementation(TestHelper.ONE_ADDRESS);

      const event2 = (await txn2.wait()).events.pop();
      expect(event2.event).equal("LogicUpdated");
      expect(event2.args.name).equal("TransferToken");
      expect(event2.args.newImplementation).equal(TestHelper.ONE_ADDRESS);

      const txn3 = await governorDAOFactory
        .connect(dexOwner)
        .upgradeTokenHolderFactory(TestHelper.ONE_ADDRESS);

      const event3 = (await txn3.wait()).events.pop();
      expect(event3.event).equal("LogicUpdated");
      expect(event3.args.name).equal("TokenHolderFactory");
      expect(event3.args.newImplementation).equal(TestHelper.ONE_ADDRESS);
    });

    it("Verify getTokenHolderFactoryAddress guard check ", async function () {
      const { governorDAOFactory, daoAdminOne, godHolderFactory, dexOwner } =
        await loadFixture(deployFixture);

      await expect(
        governorDAOFactory.connect(daoAdminOne).getTokenHolderFactoryAddress()
      )
        .revertedWithCustomError(governorDAOFactory, "NotAdmin")
        .withArgs("DAOFactory: auth failed");

      const address = await governorDAOFactory
        .connect(dexOwner)
        .getTokenHolderFactoryAddress();

      expect(address).equals(godHolderFactory.address);
    });
  });

  describe("GovernorTokenDAO contract tests", function () {
    it("Verify contract should be revert for multiple initialization", async function () {
      const { governorTokenDAO, GOVERNOR_TOKEN_DAO_ARGS } = await loadFixture(
        deployFixture
      );
      await expect(
        governorTokenDAO.initialize(...GOVERNOR_TOKEN_DAO_ARGS)
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify GovernorTokenDAO initialize call", async function () {
      const { governorTT, daoAdminOne } = await loadFixture(deployFixture);
      const dao = await TestHelper.deployLogic("GovernorTokenDAO");

      await expect(
        dao.initialize(daoAdminOne.address, "", LOGO_URL, governorTT.address)
      )
        .revertedWithCustomError(dao, "InvalidInput")
        .withArgs("BaseDAO: name is empty");

      await expect(
        dao.initialize(
          TestHelper.ZERO_ADDRESS,
          DAO_NAME,
          LOGO_URL,
          governorTT.address
        )
      )
        .revertedWithCustomError(dao, "InvalidInput")
        .withArgs("BaseDAO: admin address is zero");
    });

    it("Verify getGovernorTokenTransferContractAddress", async function () {
      const { governorTokenDAO, governorTT } = await loadFixture(deployFixture);
      const governor =
        await governorTokenDAO.getGovernorTokenTransferContractAddress();
      expect(governor).equals(governorTT.address);
    });

    it("Verify createProposal", async function () {
      const { governorTokenDAO, signers, daoAdminOne, token } =
        await loadFixture(deployFixture);
      await governorTokenDAO
        .connect(daoAdminOne)
        .createProposal(
          "proposal",
          "description",
          "linkToDiscussion",
          signers[0].address,
          signers[1].address,
          token.address,
          100
        );
      const proposals = await governorTokenDAO.getAllProposals();
      expect(proposals.length).equals(1);
    });

    it("Verify createProposal with non admin should fail", async function () {
      const { governorTokenDAO, daoAdminTwo, signers, token } =
        await loadFixture(deployFixture);
      await expect(
        governorTokenDAO
          .connect(daoAdminTwo)
          .createProposal(
            "proposal",
            "description",
            "linkToDiscussion",
            signers[0].address,
            signers[1].address,
            token.address,
            100
          )
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify getAllProposals", async function () {
      const { governorTokenDAO, signers, token, daoAdminOne } =
        await loadFixture(deployFixture);
      await governorTokenDAO
        .connect(daoAdminOne)
        .createProposal(
          "proposal",
          "description",
          "linkToDiscussion",
          signers[0].address,
          signers[1].address,
          token.address,
          100
        );
      const proposals = await governorTokenDAO.getAllProposals();
      expect(proposals.length).equals(1);
    });
  });

  describe("BaseDAO contract tests", function () {
    it("Verify contract should be revert for initialization with invalid inputs", async function () {
      const { governorTT, daoAdminOne } = await loadFixture(deployFixture);
      const governorTokenDAO = await TestHelper.deployLogic("GovernorTokenDAO");

      await expect(
        governorTokenDAO.initialize(
          daoAdminOne.address,
          "",
          LOGO_URL,
          governorTT.address
        )
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: name is empty");

      await expect(
        governorTokenDAO.initialize(
          TestHelper.ZERO_ADDRESS,
          DAO_NAME,
          LOGO_URL,
          governorTT.address
        )
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: admin address is zero");
    });

    it("Verify contract should be reverted if __BaseDAO_init called from outside", async function () {
      const { daoAdminOne, governorTokenDAO } = await loadFixture(
        deployFixture
      );
      await expect(
        governorTokenDAO.__BaseDAO_init(daoAdminOne.address, DAO_NAME, LOGO_URL)
      ).revertedWith("Initializable: contract is not initializing");
    });

    it("Verify getDaoDetail returns correct values", async function () {
      const { governorTokenDAO } = await loadFixture(deployFixture);
      const result = await governorTokenDAO.getDaoDetail();
      expect(result[0]).equals(DAO_NAME);
      expect(result[1]).equals(LOGO_URL);
      expect(result[2]).equals("");
    });

    it("Verify updating dao details should be reverted for non-admin user", async function () {
      const { governorTokenDAO, daoAdminTwo } = await loadFixture(
        deployFixture
      );

      await expect(
        governorTokenDAO.connect(daoAdminTwo).addWebLink(WEB_KEY, WEB_URL)
      ).revertedWith("Ownable: caller is not the owner");

      await expect(
        governorTokenDAO.connect(daoAdminTwo).updateName(DAO_NAME)
      ).revertedWith("Ownable: caller is not the owner");

      await expect(
        governorTokenDAO.connect(daoAdminTwo).updateLogoURL(LOGO_URL)
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify addWebLink, updateName should be reverted for invalid inputs", async function () {
      const { governorTokenDAO, daoAdminOne, daoAdminTwo } = await loadFixture(
        deployFixture
      );

      await expect(
        governorTokenDAO.connect(daoAdminOne).addWebLink("", WEB_URL)
      ).revertedWith("BaseDAO: invalid key passed");

      await expect(
        governorTokenDAO.connect(daoAdminOne).addWebLink(WEB_KEY, "")
      ).revertedWith("BaseDAO: invalid value passed");

      await expect(governorTokenDAO.connect(daoAdminOne).updateName(""))
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: name is empty");
    });

    it("Verify addWebLink should be succeeded for valid inputs", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
        deployFixture
      );
      const txn = await governorTokenDAO
        .connect(daoAdminOne)
        .addWebLink(WEB_KEY, WEB_URL);

      const { name, args } = await TestHelper.readLastEvent(txn);
      expect(name).equals("WebLinkUpdated");
      expect(args.previousLink).equals("");
      expect(args.currentLink).equals(WEB_KEY + "," + WEB_URL);

      const result = await governorTokenDAO.getDaoDetail();
      const links = result[2].split(",");
      expect(links[0]).equals(WEB_KEY);
      expect(links[1]).equals(WEB_URL);
    });

    it("Verify updateName should be succeeded for valid inputs", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
        deployFixture
      );

      const UPDATED_DAO_NAME = DAO_NAME + "_1";
      const txn = await governorTokenDAO
        .connect(daoAdminOne)
        .updateName(UPDATED_DAO_NAME);

      const { name, args } = await TestHelper.readLastEvent(txn);
      expect(name).equals("NameUpdated");
      expect(args[0]).equals(DAO_NAME);
      expect(args[1]).equals(UPDATED_DAO_NAME);
    });

    it("Verify updateLogoUrl should be succeeded for valid inputs", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
        deployFixture
      );

      const UPDATED_LOGO_URL = LOGO_URL + "_1";
      const txn = await governorTokenDAO
        .connect(daoAdminOne)
        .updateLogoURL(UPDATED_LOGO_URL);

      const { name, args } = await TestHelper.readLastEvent(txn);
      expect(name).equals("LogoUrlUpdated");
      expect(args[0]).equals(LOGO_URL);
      expect(args[1]).equals(UPDATED_LOGO_URL);
    });
  });
});
