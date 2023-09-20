import { expect } from "chai";
import { BigNumber } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("NFTDAOFactory contratc tests", function () {
  const QUORUM_THRESHOLD = 5;
  const QUORUM_THRESHOLD_BSP = QUORUM_THRESHOLD * 100;

  const VOTING_DELAY = 0;
  const VOTING_PERIOD = 12;

  const DAO_NAME = "DAO_NAME";
  const LOGO_URL = "https://twitter.com";
  const INFO_URL = "https://twitter.com";
  const DESCRIPTION = "DESCRIPTION";
  const WEB_LINKS = ["https://twitter.com", "https://linkedin.com"];

  async function verifyDAOCreatedEvent(txn: any) {
    const event = await TestHelper.readLastEvent(txn);
    expect(event.name).equal("DAOCreated");
    expect(event.args.length).equal(5);
    expect(event.args.daoAddress).not.equal(TestHelper.ZERO_ADDRESS);
    expect(event.args.governorAddress).not.equal(TestHelper.ZERO_ADDRESS);
    expect(event.args.tokenHolderAddress).not.equal(TestHelper.ZERO_ADDRESS);
    expect(event.args.assetsHolderAddress).not.equal(TestHelper.ZERO_ADDRESS);

    const dao = await TestHelper.getContract("FTDAO", event.args.daoAddress);
    const governor = await TestHelper.getDeployGovernorAt(
      event.args.governorAddress,
    );
    return { dao, governor };
  }

  async function verifyDAOInfoUpdatedEvent(
    txn: any,
    admin: string,
    daoName: string,
    logoUrl: string,
    infoUrl: string,
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
    expect(daoInfo.infoUrl).equals(infoUrl);
    expect(daoInfo.description).equals(description);
    expect(daoInfo.webLinks.join(",")).equals(webLinks.join(","));
  }

  async function deployFixture() {
    const dexOwner = await TestHelper.getDexOwner();
    const daoAdminOne = await TestHelper.getDAOAdminOne();
    const daoAdminTwo = await TestHelper.getDAOAdminTwo();

    const signers = await TestHelper.getSigners();
    const systemUsers = await TestHelper.systemUsersSigners();

    const hederaService = await TestHelper.deployMockHederaService();

    const token = await TestHelper.deployERC721Mock(signers[0]);
    const nftHolder = await TestHelper.deployNftGodHolder(hederaService, token);

    const inputs = {
      admin: daoAdminOne.address,
      name: DAO_NAME,
      logoUrl: LOGO_URL,
      infoUrl: INFO_URL,
      tokenAddress: token.address,
      quorumThreshold: QUORUM_THRESHOLD_BSP,
      votingDelay: VOTING_DELAY,
      votingPeriod: VOTING_PERIOD,
      isPrivate: false,
      description: DESCRIPTION,
      webLinks: WEB_LINKS,
    };

    const nftHolderFactory = await TestHelper.deployProxy(
      "NFTTokenHolderFactory",
      hederaService.address,
      nftHolder.address,
      dexOwner.address,
    );

    const governor = await TestHelper.deployGovernor();
    const assetsHolder = await TestHelper.deployAssetsHolder();
    const roleBasedAccess = await TestHelper.deploySystemRoleBasedAccess();
    const governorTokenDAO = await TestHelper.deployLogic("FTDAO");

    const INIT_ARGS = {
      _daoLogic: governorTokenDAO.address,
      _governorLogic: governor.address,
      _assetsHolderLogic: assetsHolder.address,
      _hederaService: hederaService.address,
      _tokenHolderFactory: nftHolderFactory.address,
      _iSystemRoleBasedAccess: roleBasedAccess.address,
    };

    const factory = await TestHelper.deployLogic("NFTDAOFactory");
    const txn = await factory.initialize(...Object.values(INIT_ARGS));
    const events = await TestHelper.readEvents(txn, ["LogicUpdated"]);
    expect(events.length).equals(6);

    return {
      token,
      signers,
      hederaService,
      daoAdminOne,
      daoAdminTwo,
      nftHolderFactory,
      factory,
      inputs,
      roleBasedAccess,
      systemUsers,
      INIT_ARGS,
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
      const { factory, token } = await loadFixture(deployFixture);
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
      await expect(factory.createDAO(CREATE_DAO_ARGS))
        .revertedWithCustomError(factory, "InvalidInput")
        .withArgs("BaseDAO: admin address is zero");
    });

    it("Verify createDAO should be reverted when dao name is empty", async function () {
      const { factory, daoAdminOne, token } = await loadFixture(deployFixture);
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
      await expect(factory.createDAO(CREATE_DAO_ARGS))
        .revertedWithCustomError(factory, "InvalidInput")
        .withArgs("BaseDAO: name is empty");
    });

    it("Verify createDAO should be reverted when token address is zero", async function () {
      const { factory, daoAdminOne } = await loadFixture(deployFixture);
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
      await expect(factory.createDAO(CREATE_DAO_ARGS))
        .revertedWithCustomError(factory, "InvalidInput")
        .withArgs("DAOFactory: token address is zero");
    });

    it("Verify createDAO should be reverted when info url is empty", async function () {
      const { factory, daoAdminOne, token } = await loadFixture(deployFixture);
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
      await expect(factory.createDAO(CREATE_DAO_ARGS))
        .revertedWithCustomError(factory, "InvalidInput")
        .withArgs("BaseDAO: info url is empty");
    });

    it("Verify createDAO should be reverted when voting period is zero", async function () {
      const { factory, daoAdminOne, token } = await loadFixture(deployFixture);
      const CREATE_DAO_ARGS = [
        daoAdminOne.address,
        DAO_NAME,
        LOGO_URL,
        INFO_URL,
        token.address,
        BigNumber.from(500),
        BigNumber.from(0),
        BigNumber.from(0),
        false,
        DESCRIPTION,
        WEB_LINKS,
      ];
      await expect(factory.createDAO(CREATE_DAO_ARGS))
        .revertedWithCustomError(factory, "InvalidInput")
        .withArgs("DAOFactory: voting period is zero");
    });

    it("Verify createDAO should add new dao into list when the dao is public", async function () {
      const { factory, daoAdminOne, token } = await loadFixture(deployFixture);

      const currentList = await factory.getDAOs();
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

      const txn = await factory.createDAO(CREATE_DAO_ARGS);

      const lastEvent = (await txn.wait()).events.pop();
      expect(lastEvent.event).equal("DAOCreated");
      expect(lastEvent.args.daoAddress).not.equal("0x0");

      const updatedList = await factory.getDAOs();
      expect(updatedList.length).equal(1);
    });

    it("Verify createDAO should not add new dao into list when the dao is private", async function () {
      const { factory, daoAdminOne, token } = await loadFixture(deployFixture);

      const currentList = await factory.getDAOs();
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

      const txn = await factory.createDAO(CREATE_DAO_ARGS);

      const lastEvent = (await txn.wait()).events.pop();
      expect(lastEvent.event).equal("DAOCreated");
      expect(lastEvent.args.daoAddress).not.equal("0x0");

      const updatedList = await factory.getDAOs();
      expect(updatedList.length).equal(0);
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
      const { factory, nftHolderFactory } = await loadFixture(deployFixture);
      expect(await factory.getTokenHolderFactoryAddress()).equals(
        nftHolderFactory.address,
      );
    });

    it("Verify getHederaServiceVersion return correct address", async function () {
      const { factory, hederaService } = await loadFixture(deployFixture);
      expect(await factory.getHederaServiceVersion()).equals(
        hederaService.address,
      );
    });

    it("Verify upgrade Hedera service should fail when non-owner try to upgrade Hedera service", async function () {
      const { factory, signers } = await loadFixture(deployFixture);
      await expect(
        factory.connect(signers[3]).upgradeHederaService(signers[3].address),
      ).reverted;
    });

    it("Verify upgrade Hedera service should pass when child-proxy-admin try to upgrade it", async function () {
      const { factory, hederaService, systemUsers } =
        await loadFixture(deployFixture);

      expect(await factory.getHederaServiceVersion()).equals(
        hederaService.address,
      );

      const newHederaService = await TestHelper.deployMockHederaService();
      await expect(
        factory
          .connect(systemUsers.childProxyAdmin)
          .upgradeHederaService(newHederaService.address),
      ).emit(factory, "LogicUpdated");

      expect(await factory.getHederaServiceVersion()).equals(
        newHederaService.address,
      );
    });
  });

  describe("FTDAO contract tests", function () {
    it("Verify contract should be revert for multiple initialization", async function () {
      const { factory, inputs } = await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(inputs));
      const info = await verifyDAOCreatedEvent(txn);
      await expect(
        info.dao.initialize(info.governor.address, Object.values(inputs)),
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify governorAddress should return correct value", async function () {
      const { factory, inputs } = await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(inputs));
      const info = await verifyDAOCreatedEvent(txn);
      expect(await info.dao.governorAddress()).equals(info.governor.address);
    });

    it("Verify updating dao info should be reverted for empty info-url", async function () {
      const { factory, inputs, daoAdminOne } = await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(inputs));
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
      const { factory, inputs, daoAdminOne } = await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(inputs));
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
      const { factory, inputs, daoAdminTwo } = await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(inputs));
      const info = await verifyDAOCreatedEvent(txn);

      await expect(
        info.dao
          .connect(daoAdminTwo)
          .updateDaoInfo(DAO_NAME, LOGO_URL, INFO_URL, DESCRIPTION, WEB_LINKS),
      ).reverted;
    });

    it("Verify updating dao info should be reverted for invalid inputs", async function () {
      const { factory, inputs, daoAdminOne } = await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(inputs));
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

    it("Verify updating dao info should be succeeded for valid inputs", async function () {
      const { factory, inputs, daoAdminOne } = await loadFixture(deployFixture);
      const txn0 = await factory.createDAO(Object.values(inputs));
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
      const { factory, inputs, daoAdminOne } = await loadFixture(deployFixture);
      const txn = await factory.createDAO(Object.values(inputs));
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
