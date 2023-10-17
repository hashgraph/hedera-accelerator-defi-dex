import { expect } from "chai";
import { BigNumber } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  verifyDAOCreatedEvent,
  verifyDAOInfoUpdatedEvent,
  verifyFeeConfigControllerChangedEvent,
  verifyFeeConfigUpdatedEvent,
} from "./common";

describe("NFT-Governance-DAO tests", function () {
  const DAO_NAME = "DAO_NAME";
  const LOGO_URL = "https://twitter.com";
  const INFO_URL = "https://twitter.com";
  const DESCRIPTION = "DESCRIPTION";
  const WEB_LINKS = ["https://twitter.com", "https://linkedin.com"];

  async function deployFixture() {
    const dexOwner = await TestHelper.getDexOwner();
    const daoAdminOne = await TestHelper.getDAOAdminOne();
    const daoAdminTwo = await TestHelper.getDAOAdminTwo();
    const daoTreasure = await TestHelper.getDAOTreasure();

    const signers = await TestHelper.getSigners();
    const systemUsers = await TestHelper.systemUsersSigners();

    const hederaService = await TestHelper.deployMockHederaService();

    const token = await TestHelper.deployERC721Mock(signers[0]);

    const ftToken = await TestHelper.deployERC20Mock(100 * 1e8);

    const godHolder = await TestHelper.deployNftGodHolder(hederaService, token);

    const godHolderFactory = await TestHelper.deployNFTTokenHolderFactory(
      hederaService,
      godHolder,
      dexOwner.address,
    );

    const governor = await TestHelper.deployGovernor();
    const assetsHolder = await TestHelper.deployAssetsHolder();
    const roleBasedAccess = await TestHelper.deploySystemRoleBasedAccess();
    const governorTokenDAO = await TestHelper.deployLogic("FTDAO");

    const daoCreationFeeConfig = await TestHelper.getDefaultFeeConfig(
      token.address,
    );
    const INIT_ARGS = {
      _daoLogic: governorTokenDAO.address,
      _governorLogic: governor.address,
      _assetsHolderLogic: assetsHolder.address,
      _hederaService: hederaService.address,
      _feeConfig: Object.values(daoCreationFeeConfig),
      _tokenHolderFactory: godHolderFactory.address,
      _iSystemRoleBasedAccess: roleBasedAccess.address,
    };

    const proposalCreationFeeConfig = await TestHelper.getDefaultFeeConfig();
    const CREATE_DAO_ARGS = {
      admin: daoAdminOne.address,
      name: DAO_NAME,
      logoUrl: LOGO_URL,
      infoUrl: INFO_URL,
      tokenAddress: token.address,
      quorumThreshold: BigNumber.from(500),
      votingDelay: BigNumber.from(0),
      votingPeriod: BigNumber.from(100),
      isPrivate: false,
      description: DESCRIPTION,
      webLinks: WEB_LINKS,
      feeConfig: Object.values(proposalCreationFeeConfig),
    };

    const factory = await TestHelper.deployNFTDAOFactory(
      Object.values(INIT_ARGS),
    );
    await verifyFeeConfigUpdatedEvent(factory, daoCreationFeeConfig);

    const events = await factory.queryFilter("LogicUpdated");
    expect(events.length).equals(6);

    return {
      token,
      signers,
      daoTreasure,
      hederaService,
      daoAdminOne,
      daoAdminTwo,
      godHolderFactory,
      factory,
      roleBasedAccess,
      systemUsers,
      INIT_ARGS,
      CREATE_DAO_ARGS,
      daoCreationFeeConfig,
      proposalCreationFeeConfig,
      ftToken,
    };
  }

  describe("DAOFactory contract tests", async function () {
    it("Verify contract should be revert for multiple initialization", async function () {
      const { factory, INIT_ARGS } = await loadFixture(deployFixture);

      await expect(
        factory.initialize(...Object.values(INIT_ARGS)),
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify createDAO should be reverted when dao admin is zero", async function () {
      const { factory, CREATE_DAO_ARGS } = await loadFixture(deployFixture);
      const CREATE_DAO_INVALID_ARGS = {
        ...CREATE_DAO_ARGS,
        admin: TestHelper.ZERO_ADDRESS,
      };
      await expect(factory.createDAO(Object.values(CREATE_DAO_INVALID_ARGS)))
        .revertedWithCustomError(factory, "InvalidInput")
        .withArgs("BaseDAO: admin address is zero");
    });

    it("Verify createDAO should be reverted when created with FT Token", async function () {
      const { factory, ftToken, CREATE_DAO_ARGS } =
        await loadFixture(deployFixture);
      const CREATE_DAO_INVALID_ARGS = {
        ...CREATE_DAO_ARGS,
        tokenAddress: ftToken.address,
      };
      await expect(factory.createDAO(CREATE_DAO_INVALID_ARGS)).revertedWith(
        "DAOFactory: Token type & DAO type mismatch.",
      );
    });

    it("Verify createDAO should be reverted when dao name is empty", async function () {
      const { factory, CREATE_DAO_ARGS } = await loadFixture(deployFixture);
      const CREATE_DAO_INVALID_ARGS = {
        ...CREATE_DAO_ARGS,
        name: "",
      };
      await expect(factory.createDAO(Object.values(CREATE_DAO_INVALID_ARGS)))
        .revertedWithCustomError(factory, "InvalidInput")
        .withArgs("BaseDAO: name is empty");
    });

    it("Verify createDAO should be reverted when token address is zero", async function () {
      const { factory, CREATE_DAO_ARGS } = await loadFixture(deployFixture);
      const CREATE_DAO_INVALID_ARGS = {
        ...CREATE_DAO_ARGS,
        tokenAddress: TestHelper.ZERO_ADDRESS,
      };
      await expect(factory.createDAO(Object.values(CREATE_DAO_INVALID_ARGS)))
        .revertedWithCustomError(factory, "InvalidInput")
        .withArgs("DAOFactory: token address is zero");
    });

    it("Verify createDAO should be reverted when info url is empty", async function () {
      const { factory, CREATE_DAO_ARGS } = await loadFixture(deployFixture);
      const CREATE_DAO_INVALID_ARGS = {
        ...CREATE_DAO_ARGS,
        infoUrl: "",
      };
      await expect(factory.createDAO(Object.values(CREATE_DAO_INVALID_ARGS)))
        .revertedWithCustomError(factory, "InvalidInput")
        .withArgs("BaseDAO: info url is empty");
    });

    it("Verify createDAO should be reverted when voting period is zero", async function () {
      const { factory, CREATE_DAO_ARGS } = await loadFixture(deployFixture);
      const CREATE_DAO_INVALID_ARGS = {
        ...CREATE_DAO_ARGS,
        votingPeriod: 0,
      };
      await expect(factory.createDAO(Object.values(CREATE_DAO_INVALID_ARGS)))
        .revertedWithCustomError(factory, "InvalidInput")
        .withArgs("DAOFactory: voting period is zero");
    });

    it("Verify createDAO should emit 'DAOCreated' event", async function () {
      const { factory, CREATE_DAO_ARGS } = await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(CREATE_DAO_ARGS));
      await verifyDAOCreatedEvent(txn);
    });

    it("Verify createDAO should add new dao into list when the dao is public", async function () {
      const { factory, CREATE_DAO_ARGS } = await loadFixture(deployFixture);

      const currentList = await factory.getDAOs();
      expect(currentList.length).equal(0);

      await factory.createDAO(Object.values(CREATE_DAO_ARGS));

      const updatedList = await factory.getDAOs();
      expect(updatedList.length).equal(1);
    });

    it("Verify createDAO should not add new dao into list when the dao is private", async function () {
      const { factory, CREATE_DAO_ARGS } = await loadFixture(deployFixture);

      const currentList = await factory.getDAOs();
      expect(currentList.length).equal(0);

      const UPDATED_CREATE_DAO_ARGS = {
        ...CREATE_DAO_ARGS,
        isPrivate: true,
      };

      await factory.createDAO(Object.values(UPDATED_CREATE_DAO_ARGS));

      const updatedList = await factory.getDAOs();
      expect(updatedList.length).equal(0);
    });

    it("Verify createDAO should deduct HBAR as DAO creation fee", async function () {
      const { signers, INIT_ARGS, CREATE_DAO_ARGS } =
        await loadFixture(deployFixture);

      const hBarAsFeeConfig = await TestHelper.getDefaultFeeConfig();

      const UPDATED_INIT_ARGS = {
        ...INIT_ARGS,
        _feeConfig: Object.values(hBarAsFeeConfig),
      };

      const factory = await TestHelper.deployNFTDAOFactory(
        Object.values(UPDATED_INIT_ARGS),
      );

      await expect(
        factory.createDAO(Object.values(CREATE_DAO_ARGS), {
          value: hBarAsFeeConfig.amountOrId,
        }),
      ).changeEtherBalances(
        [signers[0].address, hBarAsFeeConfig.receiver],
        [-hBarAsFeeConfig.amountOrId, hBarAsFeeConfig.amountOrId],
      );
    });

    it("Verify createDAO should deduct Fungible Token as DAO creation fee", async function () {
      const { signers, token, factory, CREATE_DAO_ARGS } =
        await loadFixture(deployFixture);

      const ftAsFeeConfig = await factory.feeConfig();

      await expect(
        factory.createDAO(Object.values(CREATE_DAO_ARGS)),
      ).changeTokenBalances(
        token,
        [signers[0].address, ftAsFeeConfig.receiver],
        [-ftAsFeeConfig.amountOrId, ftAsFeeConfig.amountOrId],
      );
    });

    it("Verify createDAO should be reverted if no HBAR send during creation when HBAR configured as creation fee", async function () {
      const { INIT_ARGS, CREATE_DAO_ARGS } = await loadFixture(deployFixture);
      const hBarAsFeeConfig = await TestHelper.getDefaultFeeConfig();
      const UPDATED_INIT_ARGS = {
        ...INIT_ARGS,
        _feeConfig: Object.values(hBarAsFeeConfig),
      };
      const factory = await TestHelper.deployNFTDAOFactory(
        Object.values(UPDATED_INIT_ARGS),
      );
      await expect(factory.createDAO(Object.values(CREATE_DAO_ARGS))).reverted;
    });

    it("Verify dao creation fee configuration should be updated", async function () {
      const { factory, systemUsers } = await loadFixture(deployFixture);
      const newDAOCreationFeeConfig = await TestHelper.getDefaultFeeConfig(
        TestHelper.ZERO_ADDRESS,
        10e8,
      );

      await factory
        .connect(systemUsers.feeConfigControllerUser)
        .changeFeeConfigController(systemUsers.superAdmin.address);

      await factory
        .connect(systemUsers.superAdmin)
        .updateFeeConfig(Object.values(newDAOCreationFeeConfig));
      await verifyFeeConfigUpdatedEvent(factory, newDAOCreationFeeConfig);
    });

    it("Verify updating dao creation fee configuration should be reverted for invalid inputs", async function () {
      const { factory, systemUsers } = await loadFixture(deployFixture);

      await expect(
        factory
          .connect(systemUsers.feeConfigControllerUser)
          .changeFeeConfigController(
            systemUsers.feeConfigControllerUser.address,
          ),
      ).revertedWith("FC: self not allowed");

      await expect(
        factory.updateFeeConfig([
          TestHelper.ONE_ADDRESS,
          TestHelper.ONE_ADDRESS,
          TestHelper.toPrecision(30),
        ]),
      ).revertedWith("FC: No Authorization");

      await factory
        .connect(systemUsers.feeConfigControllerUser)
        .changeFeeConfigController(systemUsers.superAdmin.address);
      await verifyFeeConfigControllerChangedEvent(
        factory,
        TestHelper.ZERO_ADDRESS,
        systemUsers.superAdmin.address,
      );

      await expect(
        factory
          .connect(systemUsers.superAdmin)
          .updateFeeConfig([
            TestHelper.ZERO_ADDRESS,
            TestHelper.ONE_ADDRESS,
            TestHelper.toPrecision(30),
          ]),
      ).revertedWith("FC: Invalid fee config data");

      await expect(
        factory
          .connect(systemUsers.superAdmin)
          .updateFeeConfig([
            TestHelper.ONE_ADDRESS,
            TestHelper.ONE_ADDRESS,
            TestHelper.toPrecision(0),
          ]),
      ).revertedWith("FC: Invalid fee config data");
    });

    it("Verify upgrade logic call should be reverted for non dex owner", async function () {
      const { factory, daoAdminOne } = await loadFixture(deployFixture);

      await expect(
        factory
          .connect(daoAdminOne)
          .upgradeDAOLogicImplementation(TestHelper.ZERO_ADDRESS),
      ).reverted;

      await expect(
        factory
          .connect(daoAdminOne)
          .upgradeGovernorImplementation(TestHelper.ZERO_ADDRESS),
      ).reverted;

      await expect(
        factory
          .connect(daoAdminOne)
          .upgradeAssetHolderImplementation(TestHelper.ZERO_ADDRESS),
      ).reverted;

      await expect(
        factory
          .connect(daoAdminOne)
          .upgradeTokenHolderFactory(TestHelper.ZERO_ADDRESS),
      ).reverted;

      await expect(
        factory
          .connect(daoAdminOne)
          .upgradeHederaService(TestHelper.ZERO_ADDRESS),
      ).reverted;

      await expect(
        factory
          .connect(daoAdminOne)
          .upgradeISystemRoleBasedAccess(TestHelper.ZERO_ADDRESS),
      ).reverted;
    });

    it("Verify upgrade logic call should be proceeded for dex owner", async function () {
      const { factory, systemUsers } = await loadFixture(deployFixture);

      await expect(
        factory
          .connect(systemUsers.childProxyAdmin)
          .upgradeDAOLogicImplementation(TestHelper.ZERO_ADDRESS),
      ).emit(factory, "LogicUpdated");

      await expect(
        factory
          .connect(systemUsers.childProxyAdmin)
          .upgradeGovernorImplementation(TestHelper.ZERO_ADDRESS),
      ).emit(factory, "LogicUpdated");

      await expect(
        factory
          .connect(systemUsers.childProxyAdmin)
          .upgradeAssetHolderImplementation(TestHelper.ZERO_ADDRESS),
      ).emit(factory, "LogicUpdated");

      await expect(
        factory
          .connect(systemUsers.childProxyAdmin)
          .upgradeTokenHolderFactory(TestHelper.ZERO_ADDRESS),
      ).emit(factory, "LogicUpdated");

      await expect(
        factory
          .connect(systemUsers.childProxyAdmin)
          .upgradeHederaService(TestHelper.ZERO_ADDRESS),
      ).emit(factory, "LogicUpdated");

      await expect(
        factory
          .connect(systemUsers.childProxyAdmin)
          .upgradeISystemRoleBasedAccess(TestHelper.ZERO_ADDRESS),
      ).emit(factory, "LogicUpdated");
    });

    it("Verify getTokenHolderFactoryAddress return correct address", async function () {
      const { factory, godHolderFactory } = await loadFixture(deployFixture);
      expect(await factory.getTokenHolderFactoryAddress()).equals(
        godHolderFactory.address,
      );
    });

    it("Verify getHederaServiceVersion return correct address", async function () {
      const { factory, hederaService } = await loadFixture(deployFixture);
      expect(await factory.getHederaServiceVersion()).equals(
        hederaService.address,
      );
    });
  });

  describe("FTDAO contract tests", function () {
    it("Verify contract should be revert for multiple initialization", async function () {
      const { factory, CREATE_DAO_ARGS } = await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(CREATE_DAO_ARGS));
      const info = await verifyDAOCreatedEvent(txn);
      await expect(
        info.dao.initialize(
          info.governor.address,
          Object.values(CREATE_DAO_ARGS),
        ),
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify governorAddress should return correct value", async function () {
      const { factory, CREATE_DAO_ARGS } = await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(CREATE_DAO_ARGS));
      const info = await verifyDAOCreatedEvent(txn);
      expect(await info.dao.governorAddress()).equals(info.governor.address);
    });

    it("Verify updating dao info should be reverted for empty info-url", async function () {
      const { factory, CREATE_DAO_ARGS, daoAdminOne } =
        await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(CREATE_DAO_ARGS));
      const info = await verifyDAOCreatedEvent(txn);

      await expect(
        info.dao
          .connect(daoAdminOne)
          .updateDaoInfo(DAO_NAME, LOGO_URL, "", DESCRIPTION, WEB_LINKS),
      )
        .revertedWithCustomError(info.dao, "InvalidInput")
        .withArgs("BaseDAO: info url is empty");
    });
  });

  describe("BaseDAO contract tests", function () {
    it("Verify contract should be reverted if __BaseDAO_init called from outside", async function () {
      const { factory, CREATE_DAO_ARGS, daoAdminOne } =
        await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(CREATE_DAO_ARGS));
      const info = await verifyDAOCreatedEvent(txn);
      await expect(
        info.dao.__BaseDAO_init(
          daoAdminOne.address,
          DAO_NAME,
          LOGO_URL,
          INFO_URL,
          DESCRIPTION,
          WEB_LINKS,
        ),
      ).revertedWith("Initializable: contract is not initializing");
    });

    it("Verify updating dao info should be reverted for non-admin user", async function () {
      const { factory, CREATE_DAO_ARGS, daoAdminTwo } =
        await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(CREATE_DAO_ARGS));
      const info = await verifyDAOCreatedEvent(txn);

      await expect(
        info.dao
          .connect(daoAdminTwo)
          .updateDaoInfo(DAO_NAME, LOGO_URL, INFO_URL, DESCRIPTION, WEB_LINKS),
      ).reverted;
    });

    it("Verify updating dao info should be reverted for invalid CREATE_DAO_ARGS", async function () {
      const { factory, CREATE_DAO_ARGS, daoAdminOne } =
        await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(CREATE_DAO_ARGS));
      const info = await verifyDAOCreatedEvent(txn);

      await expect(
        info.dao
          .connect(daoAdminOne)
          .updateDaoInfo("", LOGO_URL, INFO_URL, DESCRIPTION, WEB_LINKS),
      )
        .revertedWithCustomError(info.dao, "InvalidInput")
        .withArgs("BaseDAO: name is empty");

      await expect(
        info.dao
          .connect(daoAdminOne)
          .updateDaoInfo(DAO_NAME, LOGO_URL, INFO_URL, "", WEB_LINKS),
      )
        .revertedWithCustomError(info.dao, "InvalidInput")
        .withArgs("BaseDAO: description is empty");

      await expect(
        info.dao
          .connect(daoAdminOne)
          .updateDaoInfo(DAO_NAME, LOGO_URL, INFO_URL, DESCRIPTION, [
            ...WEB_LINKS,
            "",
          ]),
      )
        .revertedWithCustomError(info.dao, "InvalidInput")
        .withArgs("BaseDAO: invalid link");
    });

    it("Verify updating dao info should be succeeded for valid CREATE_DAO_ARGS", async function () {
      const { factory, CREATE_DAO_ARGS, daoAdminOne } =
        await loadFixture(deployFixture);
      const txn0 = await factory.createDAO(Object.values(CREATE_DAO_ARGS));
      const info = await verifyDAOCreatedEvent(txn0);

      const UPDATED_DAO_NAME = DAO_NAME + "_1";
      const UPDATED_LOGO_URL = LOGO_URL + "_1";
      const UPDATED_INFO_URL = INFO_URL + "_1";
      const UPDATED_DESCRIPTION = DESCRIPTION + "_1";
      const UPDATED_WEB_LINKS = ["A", "B"];
      const txn = await info.dao
        .connect(daoAdminOne)
        .updateDaoInfo(
          UPDATED_DAO_NAME,
          UPDATED_LOGO_URL,
          UPDATED_INFO_URL,
          UPDATED_DESCRIPTION,
          UPDATED_WEB_LINKS,
        );

      await verifyDAOInfoUpdatedEvent(
        txn,
        daoAdminOne.address,
        UPDATED_DAO_NAME,
        UPDATED_LOGO_URL,
        UPDATED_INFO_URL,
        UPDATED_DESCRIPTION,
        UPDATED_WEB_LINKS,
      );
    });

    it("Verify getDaoInfo returns correct values", async function () {
      const { factory, CREATE_DAO_ARGS, daoAdminOne } =
        await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(CREATE_DAO_ARGS));
      const info = await verifyDAOCreatedEvent(txn);
      const daoInfo = await info.dao.getDaoInfo();
      expect(daoInfo.name).equals(DAO_NAME);
      expect(daoInfo.admin).equals(daoAdminOne.address);
      expect(daoInfo.logoUrl).equals(LOGO_URL);
      expect(daoInfo.description).equals(DESCRIPTION);
      expect(daoInfo.webLinks.join(",")).equals(WEB_LINKS.join(","));
    });
  });
});
