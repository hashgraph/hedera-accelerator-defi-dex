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
  const DESCRIPTION = "DESCRIPTION";
  const WEB_LINKS = [
    "TWITTER",
    "https://twitter.com",
    "LINKEDIN",
    "https://linkedin.com",
  ];

  const WEB_KEY = "git";
  const WEB_URL = "web-url";

  async function deployFixture() {
    const dexOwner = await TestHelper.getDexOwner();
    const daoAdminOne = await TestHelper.getDAOAdminOne();
    const daoAdminTwo = await TestHelper.getDAOAdminTwo();
    const signers = await TestHelper.getSigners();

    const hederaService = await TestHelper.deployMockHederaService();
    const token = await TestHelper.deployERC20Mock(TOTAL);
    await token.setUserBalance(signers[0].address, TOTAL);

    const godHolder = await TestHelper.deployGodHolder(hederaService, token);

    const ARGS = [
      token.address,
      VOTING_DELAY,
      VOTING_PERIOD,
      hederaService.address,
      godHolder.address,
      QUORUM_THRESHOLD_BSP,
    ];

    const governorTT = await TestHelper.deployLogic("GovernorTransferToken");
    await governorTT.initialize(...ARGS);
    const governorUpgrade = await TestHelper.deployLogic("GovernorUpgrade");
    const governorTokenCreate = await TestHelper.deployLogic(
      "GovernorTokenCreate"
    );
    const governorTextProposal = await TestHelper.deployLogic(
      "GovernorTextProposal"
    );

    const GOVERNOR_TOKEN_DAO_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      DESCRIPTION,
      WEB_LINKS,
      governorTT.address,
    ];

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
      hederaService.address,
      godHolder.address,
      signers[4].address,
      signers[5].address,
    ];

    const governorTokenDAO = await TestHelper.deployLogic("TokenTransferDAO");

    await governorTokenDAO.initialize(
      Object.values(inputs),
      governance,
      common
    );

    const godHolderFactory = await TestHelper.deployGodTokenHolderFactory(
      hederaService,
      godHolder,
      dexOwner.address
    );

    const governorDAOFactory = await TestHelper.deployLogic(
      "TokenTransferDAOFactory"
    );

    await governorDAOFactory.initialize(
      dexOwner.address,
      hederaService.address,
      governorTokenDAO.address,
      godHolderFactory.address,
      governance
    );

    return {
      token,
      signers,
      hederaService,
      dexOwner,
      governorTT,
      daoAdminOne,
      daoAdminTwo,
      godHolderFactory,
      governorTokenDAO,
      governorDAOFactory,
      GOVERNOR_TOKEN_DAO_ARGS,
      inputs,
      governance,
      common,
    };
  }

  describe("TokenTransferDAOFactory contract tests", async function () {
    it("Verify contract should be revert for multiple initialization", async function () {
      const {
        governorDAOFactory,
        dexOwner,
        hederaService,
        governorTokenDAO,
        godHolderFactory,
        governance,
      } = await loadFixture(deployFixture);

      await expect(
        governorDAOFactory.initialize(
          dexOwner.address,
          hederaService.address,
          governorTokenDAO.address,
          godHolderFactory.address,
          governance
        )
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify createDAO should be reverted when dao admin is zero", async function () {
      const { governorDAOFactory, token } = await loadFixture(deployFixture);
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
      await expect(governorDAOFactory.createDAO(CREATE_DAO_ARGS))
        .revertedWithCustomError(governorDAOFactory, "InvalidInput")
        .withArgs("BaseDAO: admin address is zero");
    });

    it("Verify createDAO should be reverted when dao name is empty", async function () {
      const { governorDAOFactory, daoAdminOne, token } = await loadFixture(
        deployFixture
      );
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
      await expect(governorDAOFactory.createDAO(CREATE_DAO_ARGS))
        .revertedWithCustomError(governorDAOFactory, "InvalidInput")
        .withArgs("BaseDAO: name is empty");
    });

    it("Verify createDAO should be reverted when token address is zero", async function () {
      const { governorDAOFactory, daoAdminOne } = await loadFixture(
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
      await expect(governorDAOFactory.createDAO(CREATE_DAO_ARGS))
        .revertedWithCustomError(governorDAOFactory, "InvalidInput")
        .withArgs("DAOFactory: token address is zero");
    });

    it("Verify createDAO should be reverted when voting period is zero", async function () {
      const { governorDAOFactory, daoAdminOne, token } = await loadFixture(
        deployFixture
      );
      const CREATE_DAO_ARGS = [
        daoAdminOne.address,
        DAO_NAME,
        LOGO_URL,
        token.address,
        BigNumber.from(500),
        BigNumber.from(0),
        BigNumber.from(0),
        false,
        DESCRIPTION,
        WEB_LINKS,
      ];
      await expect(governorDAOFactory.createDAO(CREATE_DAO_ARGS))
        .revertedWithCustomError(governorDAOFactory, "InvalidInput")
        .withArgs("DAOFactory: voting period is zero");
    });

    it("Verify createDAO should add new dao into list when the dao is public", async function () {
      const { governorDAOFactory, daoAdminOne, token } = await loadFixture(
        deployFixture
      );

      const currentList = await governorDAOFactory.getDAOs();
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

      const txn = await governorDAOFactory.createDAO(CREATE_DAO_ARGS);

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

      const txn = await governorDAOFactory.createDAO(CREATE_DAO_ARGS);

      const lastEvent = (await txn.wait()).events.pop();
      expect(lastEvent.event).equal("DAOCreated");
      expect(lastEvent.args.daoAddress).not.equal("0x0");

      const updatedList = await governorDAOFactory.getDAOs();
      expect(updatedList.length).equal(0);
    });

    it("Verify upgrade logic call should be reverted for non dex owner", async function () {
      const { governorDAOFactory, daoAdminOne, daoAdminTwo, governance } =
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
          .upgradeGovernorsImplementation(governance)
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
      const { governorDAOFactory, dexOwner, governance } = await loadFixture(
        deployFixture
      );

      const txn1 = await governorDAOFactory
        .connect(dexOwner)
        .upgradeTokenDaoLogicImplementation(TestHelper.ONE_ADDRESS);

      const event1 = (await txn1.wait()).events.pop();
      expect(event1.event).equal("LogicUpdated");
      expect(event1.args.name).equal("TokenDAO");
      expect(event1.args.newImplementation).equal(TestHelper.ONE_ADDRESS);

      const txn2 = await governorDAOFactory
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
      expect(event2.args.newImplementation.createTokenLogic).equal(
        governance[3]
      );

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

    it("Verify upgradeHederaService should fail when non-owner try to upgrade Hedera service", async function () {
      const { governorDAOFactory, signers } = await loadFixture(deployFixture);
      const nonOwner = signers[3];
      await expect(
        governorDAOFactory
          .connect(nonOwner)
          .upgradeHederaService(signers[3].address)
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify upgrade Hedera service should pass when owner try to upgrade it", async function () {
      const { governorDAOFactory, signers, daoAdminOne, token } =
        await loadFixture(deployFixture);

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

      await governorDAOFactory.createDAO(CREATE_DAO_ARGS);

      const daos = await governorDAOFactory.getDAOs();

      const tokenDAO = TestHelper.getContract("IGovernanceDAO", daos[0]);
      expect(tokenDAO).not.equals(TestHelper.ZERO_ADDRESS);
      await expect(
        governorDAOFactory.upgradeHederaService(signers[3].address)
      ).not.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("TokenTransferDAO contract tests", function () {
    it("Verify contract should be revert for multiple initialization", async function () {
      const { governorTokenDAO, inputs, governance, common } =
        await loadFixture(deployFixture);
      await expect(
        governorTokenDAO.initialize(Object.values(inputs), governance, common)
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify TokenTransferDAO initialize call", async function () {
      const { inputs, governance, common } = await loadFixture(deployFixture);
      const dao = await TestHelper.deployLogic("TokenTransferDAO");
      const newInputsWithNoName = {
        ...inputs,
      };
      newInputsWithNoName.name = "";
      await expect(
        dao.initialize(Object.values(newInputsWithNoName), governance, common)
      )
        .revertedWithCustomError(dao, "InvalidInput")
        .withArgs("BaseDAO: name is empty");

      const newInputsWithNoAdmin = {
        ...inputs,
      };
      newInputsWithNoAdmin.admin = TestHelper.ZERO_ADDRESS;

      await expect(
        dao.initialize(Object.values(newInputsWithNoAdmin), governance, common)
      )
        .revertedWithCustomError(dao, "InvalidInput")
        .withArgs("BaseDAO: admin address is zero");
    });

    it("Verify getGovernorContractAddress", async function () {
      const { governorTokenDAO } = await loadFixture(deployFixture);
      const governors = await governorTokenDAO.getGovernorContractAddresses();
      expect(governors[0]).not.equals(TestHelper.ZERO_ADDRESS);
      expect(governors[1]).not.equals(TestHelper.ZERO_ADDRESS);
      expect(governors[2]).not.equals(TestHelper.ZERO_ADDRESS);
      expect(governors[3]).not.equals(TestHelper.ZERO_ADDRESS);
    });

    it("Verify createProposal", async function () {
      const { governorTokenDAO, signers, daoAdminOne, token } =
        await loadFixture(deployFixture);
      await governorTokenDAO
        .connect(daoAdminOne)
        .createTokenTransferProposal(
          "proposal",
          "description",
          "linkToDiscussion",
          signers[0].address,
          signers[1].address,
          token.address,
          100
        );
      const proposals = await governorTokenDAO.getTokenTransferProposals();
      expect(proposals.length).equals(1);
    });

    it("Verify createProposal with non admin should fail", async function () {
      const { governorTokenDAO, daoAdminTwo, signers, token } =
        await loadFixture(deployFixture);
      await expect(
        governorTokenDAO
          .connect(daoAdminTwo)
          .createTokenTransferProposal(
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
        .createTokenTransferProposal(
          "proposal",
          "description",
          "linkToDiscussion",
          signers[0].address,
          signers[1].address,
          token.address,
          100
        );
      const proposals = await governorTokenDAO.getTokenTransferProposals();
      expect(proposals.length).equals(1);
    });
  });

  describe("BaseDAO contract tests", function () {
    it("Verify contract should be revert for initialization with invalid inputs", async function () {
      const { inputs, governance, common, daoAdminOne } = await loadFixture(
        deployFixture
      );
      const governorTokenDAO = await TestHelper.deployLogic("TokenTransferDAO");
      const newInputsWithNoName = {
        ...inputs,
      };
      newInputsWithNoName.name = "";
      await expect(
        governorTokenDAO.initialize(
          Object.values(newInputsWithNoName),
          governance,
          common
        )
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: name is empty");

      const newInputsWithNoAdmin = {
        ...inputs,
      };
      newInputsWithNoAdmin.admin = TestHelper.ZERO_ADDRESS;
      await expect(
        governorTokenDAO.initialize(
          Object.values(newInputsWithNoAdmin),
          governance,
          common
        )
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: admin address is zero");

      const newInputsWithNoDesc = {
        ...inputs,
      };
      newInputsWithNoDesc.description = "";
      await expect(
        governorTokenDAO.initialize(
          Object.values(newInputsWithNoDesc),
          governance,
          common
        )
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: description is empty");

      const newInputsWithWebLink = {
        ...inputs,
      };
      newInputsWithWebLink.webLinks = ["WEB_LINKS"];
      await expect(
        governorTokenDAO.initialize(
          Object.values(newInputsWithWebLink),
          governance,
          common
        )
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: links must be even length array");
    });

    it("Verify contract should be reverted if __BaseDAO_init called from outside", async function () {
      const { daoAdminOne, governorTokenDAO } = await loadFixture(
        deployFixture
      );
      await expect(
        governorTokenDAO.__BaseDAO_init(
          daoAdminOne.address,
          DAO_NAME,
          LOGO_URL,
          DESCRIPTION,
          WEB_LINKS
        )
      ).revertedWith("Initializable: contract is not initializing");
    });

    it("Verify getDaoDetail returns correct values", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
        deployFixture
      );
      const daoDetails1 = await governorTokenDAO.getDaoDetail();
      expect(daoDetails1[0]).equals(DAO_NAME);
      expect(daoDetails1[1]).equals(LOGO_URL);
      expect(daoDetails1[2]).equals(WEB_LINKS.join(","));
      expect(daoDetails1[3]).equals(DESCRIPTION);
      expect(daoDetails1[4]).equals(daoAdminOne.address);

      await governorTokenDAO.connect(daoAdminOne).addWebLink(WEB_KEY, WEB_URL);

      const daoDetails2 = await governorTokenDAO.getDaoDetail();
      expect(daoDetails2[2]).equals([...WEB_LINKS, WEB_KEY, WEB_URL].join(","));
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

      await expect(
        governorTokenDAO.connect(daoAdminTwo).updateDescription(DESCRIPTION)
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify addWebLink, updateName, updateDescription should be reverted for invalid inputs", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
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

      await expect(governorTokenDAO.connect(daoAdminOne).updateDescription(""))
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: description is empty");
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
      expect(args.previousLink).equals(WEB_LINKS.join(","));
      expect(args.currentLink).equals(
        [...WEB_LINKS, WEB_KEY, WEB_URL].join(",")
      );

      const result = await governorTokenDAO.getDaoDetail();
      const links: any[] = result[2].split(",").slice(-2);
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

    it("Verify updateDescription should be succeeded for valid inputs", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
        deployFixture
      );

      const UPDATED_DESCRIPTION = DESCRIPTION + "_1";
      const txn = await governorTokenDAO
        .connect(daoAdminOne)
        .updateDescription(UPDATED_DESCRIPTION);

      const { name, args } = await TestHelper.readLastEvent(txn);
      expect(name).equals("DescriptionUpdated");
      expect(args[0]).equals(DESCRIPTION);
      expect(args[1]).equals(UPDATED_DESCRIPTION);
    });
  });
});
