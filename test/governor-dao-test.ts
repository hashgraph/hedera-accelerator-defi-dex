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
    webLinks: string[],
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
      "GovernorTokenCreate",
    );
    const governorTextProposal = await TestHelper.deployLogic(
      "GovernorTextProposal",
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

    const common = [hederaService.address, godHolder.address];

    const systemUsersSigners = await TestHelper.systemUsersSigners();
    const systemRoleBasedAccess = (
      await TestHelper.deploySystemRoleBasedAccess()
    ).address;

    const governorTokenDAO = await TestHelper.deployLogic("FTDAO");

    const txn = await governorTokenDAO.initialize(
      Object.values(inputs),
      governance,
      common,
      systemRoleBasedAccess,
    );
    await verifyDAOInfoUpdatedEvent(
      txn,
      inputs.admin,
      inputs.name,
      inputs.urls,
      inputs.description,
      inputs.webLinks,
    );

    const godHolderFactory = await TestHelper.deployGodTokenHolderFactory(
      hederaService,
      godHolder,
      dexOwner.address,
    );

    const governorDAOFactory = await TestHelper.deployLogic("FTDAOFactory");

    await governorDAOFactory.initialize(
      systemRoleBasedAccess,
      hederaService.address,
      governorTokenDAO.address,
      godHolderFactory.address,
      governance,
    );

    return {
      token,
      signers,
      hederaService,
      governorTT,
      daoAdminOne,
      daoAdminTwo,
      godHolderFactory,
      governorTokenDAO,
      governorDAOFactory,
      inputs,
      governance,
      common,
      systemRoleBasedAccess,
      systemUsersSigners,
    };
  }

  describe("DAOFactory contract tests", async function () {
    it("Verify contract should be revert for multiple initialization", async function () {
      const {
        governorDAOFactory,
        systemRoleBasedAccess,
        hederaService,
        governorTokenDAO,
        godHolderFactory,
        governance,
      } = await loadFixture(deployFixture);

      await expect(
        governorDAOFactory.initialize(
          systemRoleBasedAccess,
          hederaService.address,
          governorTokenDAO.address,
          godHolderFactory.address,
          governance,
        ),
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
      const { governorDAOFactory, daoAdminOne, token } =
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
      await expect(governorDAOFactory.createDAO(CREATE_DAO_ARGS))
        .revertedWithCustomError(governorDAOFactory, "InvalidInput")
        .withArgs("BaseDAO: name is empty");
    });

    it("Verify createDAO should be reverted when token address is zero", async function () {
      const { governorDAOFactory, daoAdminOne } =
        await loadFixture(deployFixture);
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
      const { governorDAOFactory, daoAdminOne, token } =
        await loadFixture(deployFixture);
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
      const { governorDAOFactory, daoAdminOne, token } =
        await loadFixture(deployFixture);

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
      const { governorDAOFactory, daoAdminOne, token } =
        await loadFixture(deployFixture);

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
          .upgradeFTDAOLogicImplementation(TestHelper.ZERO_ADDRESS),
      ).reverted;

      await expect(
        governorDAOFactory
          .connect(daoAdminTwo)
          .upgradeGovernorsImplementation(governance),
      ).reverted;

      await expect(
        governorDAOFactory
          .connect(daoAdminTwo)
          .upgradeTokenHolderFactory(TestHelper.ZERO_ADDRESS),
      ).reverted;
    });

    it("Verify upgrade logic call should be proceeded for dex owner", async function () {
      const { governorDAOFactory, systemUsersSigners, governance } =
        await loadFixture(deployFixture);

      const txn1 = await governorDAOFactory
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeFTDAOLogicImplementation(TestHelper.ONE_ADDRESS);

      const event1 = (await txn1.wait()).events.pop();
      expect(event1.event).equal("LogicUpdated");
      expect(event1.args.name).equal("FTDAO");
      expect(event1.args.newImplementation).equal(TestHelper.ONE_ADDRESS);

      const txn2 = await governorDAOFactory
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
      expect(event2.args.newImplementation.createTokenLogic).equal(
        governance[3],
      );

      const txn3 = await governorDAOFactory
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeTokenHolderFactory(TestHelper.ONE_ADDRESS);

      const event3 = (await txn3.wait()).events.pop();
      expect(event3.event).equal("LogicUpdated");
      expect(event3.args.name).equal("TokenHolderFactory");
      expect(event3.args.newImplementation).equal(TestHelper.ONE_ADDRESS);
    });

    it("Verify getTokenHolderFactoryAddress return correct address", async function () {
      const { governorDAOFactory, godHolderFactory } =
        await loadFixture(deployFixture);
      expect(await governorDAOFactory.getTokenHolderFactoryAddress()).equals(
        godHolderFactory.address,
      );
    });

    it("Verify upgradeHederaService should fail when non-owner try to upgrade Hedera service", async function () {
      const { governorDAOFactory, signers } = await loadFixture(deployFixture);
      await expect(
        governorDAOFactory
          .connect(signers[3])
          .upgradeHederaService(signers[3].address),
      ).reverted;
    });

    it("Verify upgrade Hedera service should pass when child-proxy-admin try to upgrade it", async function () {
      const { governorDAOFactory, hederaService, systemUsersSigners } =
        await loadFixture(deployFixture);

      expect(await governorDAOFactory.getHederaServiceVersion()).equals(
        hederaService.address,
      );

      const newHederaService = await TestHelper.deployMockHederaService();
      await governorDAOFactory
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeHederaService(newHederaService.address);

      expect(await governorDAOFactory.getHederaServiceVersion()).equals(
        newHederaService.address,
      );
    });
  });

  describe("TokenTransferDAO contract tests", function () {
    it("Verify contract should be revert for multiple initialization", async function () {
      const {
        governorTokenDAO,
        inputs,
        governance,
        common,
        systemRoleBasedAccess,
      } = await loadFixture(deployFixture);
      await expect(
        governorTokenDAO.initialize(
          Object.values(inputs),
          governance,
          common,
          systemRoleBasedAccess,
        ),
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify TokenTransferDAO initialize call", async function () {
      const { inputs, governance, common, systemRoleBasedAccess } =
        await loadFixture(deployFixture);
      const dao = await TestHelper.deployLogic("FTDAO");
      const newInputsWithNoName = {
        ...inputs,
        name: "",
      };
      await expect(
        dao.initialize(
          Object.values(newInputsWithNoName),
          governance,
          common,
          systemRoleBasedAccess,
        ),
      )
        .revertedWithCustomError(dao, "InvalidInput")
        .withArgs("BaseDAO: name is empty");

      const newInputsWithNoAdmin = {
        ...inputs,
        admin: TestHelper.ZERO_ADDRESS,
      };
      await expect(
        dao.initialize(
          Object.values(newInputsWithNoAdmin),
          governance,
          common,
          systemRoleBasedAccess,
        ),
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

    it("Verify upgrade Hedera service passes with system user", async function () {
      const { governorTokenDAO, systemUsersSigners, hederaService } =
        await loadFixture(deployFixture);

      const allGovernors =
        await governorTokenDAO.getGovernorContractAddresses();

      const governor = await TestHelper.getContract(
        "GovernorTokenCreate",
        allGovernors.at(-1),
      );

      expect(await governor.getHederaServiceVersion()).equals(
        hederaService.address,
      );

      const newHederaService = await TestHelper.deployMockHederaService();
      await governorTokenDAO
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeHederaService(newHederaService.address);

      expect(await governor.getHederaServiceVersion()).equals(
        newHederaService.address,
      );
    });

    it("Verify upgrade Hedera service fails with non-system user", async function () {
      const { governorTokenDAO, signers } = await loadFixture(deployFixture);
      const nonSystemUser = signers[3];
      const newHederaService = await TestHelper.deployMockHederaService();
      await expect(
        governorTokenDAO
          .connect(nonSystemUser)
          .upgradeHederaService(newHederaService.address),
      ).reverted;
    });
  });

  describe("BaseDAO contract tests", function () {
    it("Verify contract should be revert for initialization with invalid inputs", async function () {
      const { inputs, governance, common, systemRoleBasedAccess } =
        await loadFixture(deployFixture);
      const governorTokenDAO = await TestHelper.deployLogic("FTDAO");
      const newInputsWithNoName = {
        ...inputs,
        name: "",
      };
      await expect(
        governorTokenDAO.initialize(
          Object.values(newInputsWithNoName),
          governance,
          common,
          systemRoleBasedAccess,
        ),
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
          common,
          systemRoleBasedAccess,
        ),
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
          common,
          systemRoleBasedAccess,
        ),
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: description is empty");
    });

    it("Verify contract should be reverted if __BaseDAO_init called from outside", async function () {
      const { daoAdminOne, governorTokenDAO } =
        await loadFixture(deployFixture);
      await expect(
        governorTokenDAO.__BaseDAO_init(
          daoAdminOne.address,
          DAO_NAME,
          LOGO_URL,
          DESCRIPTION,
          WEB_LINKS,
        ),
      ).revertedWith("Initializable: contract is not initializing");
    });

    it("Verify getDaoInfo returns correct values", async function () {
      const { governorTokenDAO, daoAdminOne } =
        await loadFixture(deployFixture);
      const daoInfo = await governorTokenDAO.getDaoInfo();
      expect(daoInfo.name).equals(DAO_NAME);
      expect(daoInfo.admin).equals(daoAdminOne.address);
      expect(daoInfo.logoUrl).equals(LOGO_URL);
      expect(daoInfo.description).equals(DESCRIPTION);
      expect(daoInfo.webLinks.join(",")).equals(WEB_LINKS.join(","));
    });

    it("Verify updating dao info should be reverted for non-admin user", async function () {
      const { governorTokenDAO, daoAdminTwo } =
        await loadFixture(deployFixture);

      await expect(
        governorTokenDAO
          .connect(daoAdminTwo)
          .updateDaoInfo(DAO_NAME, LOGO_URL, DESCRIPTION, WEB_LINKS),
      ).reverted;
    });

    it("Verify updating dao info should be reverted for invalid inputs", async function () {
      const { governorTokenDAO, daoAdminOne } =
        await loadFixture(deployFixture);

      await expect(
        governorTokenDAO
          .connect(daoAdminOne)
          .updateDaoInfo("", LOGO_URL, DESCRIPTION, WEB_LINKS),
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: name is empty");

      await expect(
        governorTokenDAO
          .connect(daoAdminOne)
          .updateDaoInfo(DAO_NAME, LOGO_URL, "", WEB_LINKS),
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: description is empty");

      await expect(
        governorTokenDAO
          .connect(daoAdminOne)
          .updateDaoInfo(DAO_NAME, LOGO_URL, DESCRIPTION, [...WEB_LINKS, ""]),
      )
        .revertedWithCustomError(governorTokenDAO, "InvalidInput")
        .withArgs("BaseDAO: invalid link");
    });

    it("Verify updating dao info should be succeeded for valid inputs", async function () {
      const { governorTokenDAO, daoAdminOne } =
        await loadFixture(deployFixture);

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
          UPDATED_WEB_LINKS,
        );

      await verifyDAOInfoUpdatedEvent(
        txn,
        daoAdminOne.address,
        UPDATED_DAO_NAME,
        UPDATED_LOGO_URL,
        UPDATED_DESCRIPTION,
        UPDATED_WEB_LINKS,
      );
    });
  });
});
