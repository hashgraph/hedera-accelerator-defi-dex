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
  const WEB_LINKS = ["https://twitter.com", "https://linkedin.com"];

  async function verifyDAOInfoUpdatedEvent(
    txn: any,
    admin: string,
    daoName: string,
    logoUrl: string,
    description: string,
    webLinks: string[]
  ) {
    const lastEvent = (
      await TestHelper.readEvents(txn, ["DAOInfoUpdated"])
    ).pop();
    const { name, args } = { name: lastEvent.event, args: lastEvent.args };
    expect(name).equals("DAOInfoUpdated");
    const daoInfo = args.daoInfo;

    expect(daoInfo.name).equals(daoName);
    expect(daoInfo.admin).equals(admin);
    expect(daoInfo.logoUrl).equals(logoUrl);
    expect(daoInfo.description).equals(description);
    expect(daoInfo.webLinks.join(",")).equals(webLinks.join(","));
  }

  async function deployFixture() {
    const dexOwner = await TestHelper.getDexOwner();
    const daoAdminOne = await TestHelper.getDAOAdminOne();
    const daoAdminTwo = await TestHelper.getDAOAdminTwo();
    const signers = await TestHelper.getSigners();

    const hederaService = await TestHelper.deployMockHederaService();
    const token = await TestHelper.deployERC20Mock(TOTAL);
    await token.setUserBalance(signers[0].address, TOTAL);

    const godHolder = await TestHelper.deployGodHolder(hederaService, token);

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
      urls: LOGO_URL,
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

    const governorTokenDAO = await TestHelper.deployLogic("FTDAO");

    const txn = await governorTokenDAO.initialize(
      Object.values(inputs),
      governance,
      common
    );
    await verifyDAOInfoUpdatedEvent(
      txn,
      inputs.admin,
      inputs.name,
      inputs.urls,
      inputs.description,
      inputs.webLinks
    );

    const godHolderFactory = await TestHelper.deployGodTokenHolderFactory(
      hederaService,
      godHolder,
      dexOwner.address
    );

    const governorDAOFactory = await TestHelper.deployLogic("FTDAOFactory");

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
      inputs,
      governance,
      common,
    };
  }

  describe("DAOFactory contract tests", async function () {
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
          .upgradeFTDAOLogicImplementation(TestHelper.ZERO_ADDRESS)
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
        .upgradeFTDAOLogicImplementation(TestHelper.ONE_ADDRESS);

      const event1 = (await txn1.wait()).events.pop();
      expect(event1.event).equal("LogicUpdated");
      expect(event1.args.name).equal("FTDAO");
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

      const tokenDAO = TestHelper.getContract("FTDAO", daos[0]);
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
      const dao = await TestHelper.deployLogic("FTDAO");
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

    it("Verify getGovernorContractAddresses", async function () {
      const { governorTokenDAO } = await loadFixture(deployFixture);
      const governors = await governorTokenDAO.getGovernorContractAddresses();
      expect(governors[0]).not.equals(TestHelper.ZERO_ADDRESS);
      expect(governors[1]).not.equals(TestHelper.ZERO_ADDRESS);
      expect(governors[2]).not.equals(TestHelper.ZERO_ADDRESS);
      expect(governors[3]).not.equals(TestHelper.ZERO_ADDRESS);
    });

    it("Verify createTokenTransferProposal", async function () {
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

    it("Verify createTokenTransferProposal with non admin should fail", async function () {
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

    it("Verify createContractUpgradeProposal", async function () {
      const { governorTokenDAO, signers, daoAdminOne, hederaService } =
        await loadFixture(deployFixture);

      const lpTokenLogic = await TestHelper.deployLogic("LPToken");
      const args = [
        hederaService.address,
        signers[0].address,
        "tokenName",
        "tokenSymbol",
      ];
      const lpTokenProxy = await TestHelper.deployProxy("LPToken", ...args);
      await governorTokenDAO
        .connect(daoAdminOne)
        .createContractUpgradeProposal(
          "proposal",
          "description",
          "linkToDiscussion",
          lpTokenProxy.address,
          lpTokenLogic.address
        );
      const proposals = await governorTokenDAO.getContractUpgradeProposals();
      expect(proposals.length).equals(1);
    });

    it("Verify createContractUpgradeProposal with non admin should fail", async function () {
      const { governorTokenDAO, daoAdminTwo, signers, hederaService } =
        await loadFixture(deployFixture);
      const lpTokenLogic = await TestHelper.deployLogic("LPToken");
      const args = [
        hederaService.address,
        signers[0].address,
        "tokenName",
        "tokenSymbol",
      ];
      const lpTokenProxy = await TestHelper.deployProxy("LPToken", ...args);
      await expect(
        governorTokenDAO
          .connect(daoAdminTwo)
          .createContractUpgradeProposal(
            "proposal",
            "description",
            "linkToDiscussion",
            lpTokenProxy.address,
            lpTokenLogic.address
          )
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify createTextProposal", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
        deployFixture
      );

      await governorTokenDAO
        .connect(daoAdminOne)
        .createTextProposal("proposal", "description", "linkToDiscussion");
      const proposals = await governorTokenDAO.getTextProposals();
      expect(proposals.length).equals(1);
    });

    it("Verify createTextProposal with non admin should fail", async function () {
      const { governorTokenDAO, daoAdminTwo } = await loadFixture(
        deployFixture
      );
      await expect(
        governorTokenDAO
          .connect(daoAdminTwo)
          .createTextProposal("proposal", "description", "linkToDiscussion")
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify createTokenCreateProposal", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
        deployFixture
      );

      await governorTokenDAO
        .connect(daoAdminOne)
        .createTokenCreateProposal(
          "proposal",
          "description",
          "linkToDiscussion",
          daoAdminOne.address,
          "TokenName",
          "TokenSymbol"
        );
      const proposals = await governorTokenDAO.getTokenCreateProposals();
      expect(proposals.length).equals(1);
    });

    it("Verify createTokenCreateProposal with non admin should fail", async function () {
      const { governorTokenDAO, daoAdminTwo } = await loadFixture(
        deployFixture
      );
      await expect(
        governorTokenDAO
          .connect(daoAdminTwo)
          .createTokenCreateProposal(
            "proposal",
            "description",
            "linkToDiscussion",
            daoAdminTwo.address,
            "TokenName",
            "TokenSymbol"
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
      const { inputs, governance, common } = await loadFixture(deployFixture);
      const governorTokenDAO = await TestHelper.deployLogic("FTDAO");
      const newInputsWithNoName = {
        ...inputs,
        name: "",
      };
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
        admin: TestHelper.ZERO_ADDRESS,
      };
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
        description: "",
      };
      await expect(
        governorTokenDAO.initialize(
          Object.values(newInputsWithNoDesc),
          governance,
          common
        )
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: description is empty");
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

    it("Verify getDaoInfo returns correct values", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
        deployFixture
      );
      const daoInfo = await governorTokenDAO.getDaoInfo();
      expect(daoInfo.name).equals(DAO_NAME);
      expect(daoInfo.admin).equals(daoAdminOne.address);
      expect(daoInfo.logoUrl).equals(LOGO_URL);
      expect(daoInfo.description).equals(DESCRIPTION);
      expect(daoInfo.webLinks.join(",")).equals(WEB_LINKS.join(","));
    });

    it("Verify updating dao info should be reverted for non-admin user", async function () {
      const { governorTokenDAO, daoAdminTwo } = await loadFixture(
        deployFixture
      );

      await expect(
        governorTokenDAO
          .connect(daoAdminTwo)
          .updateDaoInfo(DAO_NAME, LOGO_URL, DESCRIPTION, WEB_LINKS)
      ).revertedWith("Ownable: caller is not the owner");
    });

    it("Verify updating dao info should be reverted for invalid inputs", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
        deployFixture
      );

      await expect(
        governorTokenDAO
          .connect(daoAdminOne)
          .updateDaoInfo("", LOGO_URL, DESCRIPTION, WEB_LINKS)
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: name is empty");

      await expect(
        governorTokenDAO
          .connect(daoAdminOne)
          .updateDaoInfo(DAO_NAME, LOGO_URL, "", WEB_LINKS)
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: description is empty");

      await expect(
        governorTokenDAO
          .connect(daoAdminOne)
          .updateDaoInfo(DAO_NAME, LOGO_URL, DESCRIPTION, [...WEB_LINKS, ""])
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: invalid link");
    });

    it("Verify updating dao info should be succeeded for valid inputs", async function () {
      const { governorTokenDAO, daoAdminOne } = await loadFixture(
        deployFixture
      );

      const UPDATED_DAO_NAME = DAO_NAME + "_1";
      const UPDATED_LOGO_URL = LOGO_URL + "_1";
      const UPDATED_DESCRIPTION = DESCRIPTION + "_1";
      const UPDATED_WEB_LINKS = ["A", "B"];
      const txn = await governorTokenDAO
        .connect(daoAdminOne)
        .updateDaoInfo(
          UPDATED_DAO_NAME,
          UPDATED_LOGO_URL,
          UPDATED_DESCRIPTION,
          UPDATED_WEB_LINKS
        );

      await verifyDAOInfoUpdatedEvent(
        txn,
        daoAdminOne.address,
        UPDATED_DAO_NAME,
        UPDATED_LOGO_URL,
        UPDATED_DESCRIPTION,
        UPDATED_WEB_LINKS
      );
    });
  });
});
