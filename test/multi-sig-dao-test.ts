import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("MultiSig tests", function () {
  const TXN_TYPE_BATCH = 1;
  const TXN_TYPE_TOKEN_ASSOCIATE = 2;

  const TXN_TYPE_TEXT = 1005;
  const TXN_TYPE_TRANSFER = 1006;

  const INVALID_TXN_HASH = ethers.utils.formatBytes32String("INVALID_TXN_HASH");
  const TOTAL = 100 * 1e8;
  const TRANSFER_AMOUNT = 10 * 1e8;
  const DAO_NAME = "DAO_NAME";
  const LOGO_URL = "LOGO_URL";
  const DESCRIPTION = "DESCRIPTION";
  const TEXT_PROPOSAL_TEXT = "TEXT_PROPOSAL_TEXT";
  const WEB_LINKS = [
    "TWITTER",
    "https://twitter.com",
    "LINKEDIN",
    "https://linkedin.com",
  ];
  const TITLE = "TITLE";
  const LINK_TO_DISCUSSION = "LINK_TO_DISCUSSION";

  async function gnosisProxyCreationVerification(txn: any) {
    const { name, args } = await TestHelper.readLastEvent(txn);
    expect(name).equal("ProxyCreation");
    expect(args.proxy).not.equal(TestHelper.ZERO_ADDRESS);
    expect(args.singleton).not.equal(TestHelper.ZERO_ADDRESS);
    return { proxy: args.proxy };
  }

  async function verifyExecutionSuccessEvent(txn: any, txHash: string) {
    const { name, args } = await TestHelper.readLastEvent(txn);
    expect(name).equals("ExecutionSuccess");
    expect(args.txHash).equals(txHash);
  }

  async function verifyTransactionCreatedEvent(txn: any, txnType: number) {
    const { name, args } = await TestHelper.readLastEvent(txn);
    const txnHash = args.txnHash;
    const info = args.info;

    expect(name).equal("TransactionCreated");
    expect(txnHash).not.equals(TestHelper.ZERO_ADDRESS);
    expect(info.to).not.equals(TestHelper.ZERO_ADDRESS);
    expect(info.operation).equals(0);
    expect(info.nonce).equals(1);
    expect(info.transactionType).equals(txnType);
    expect(info.title).equals(TITLE);
    txnType === TXN_TYPE_TEXT
      ? expect(info.description).equals(TEXT_PROPOSAL_TEXT)
      : expect(info.description).equals(DESCRIPTION);
    expect(info.linkToDiscussion).equals(LINK_TO_DISCUSSION);
    expect(info.creator).not.equals(TestHelper.ZERO_ADDRESS);
    return { txnHash, info };
  }

  async function proposeTransaction(
    multiSigDAOInstance: Contract,
    receiver: string,
    token: string,
    amount: number = TRANSFER_AMOUNT,
    title: string = TITLE,
    description: string = DESCRIPTION
  ) {
    const txn = await multiSigDAOInstance.proposeTransaction(
      token,
      createTransferTransactionABIData(receiver, amount),
      TXN_TYPE_TRANSFER,
      title,
      description,
      LINK_TO_DISCUSSION
    );
    return await verifyTransactionCreatedEvent(txn, TXN_TYPE_TRANSFER);
  }

  async function proposeTextTransaction(
    multiSigDAOInstance: Contract,
    text: string,
    creator: string,
    title: string = TITLE
  ) {
    const txn = await multiSigDAOInstance.proposeTransaction(
      multiSigDAOInstance.address,
      createTextTransaction(creator, text),
      TXN_TYPE_TEXT,
      title,
      text,
      LINK_TO_DISCUSSION
    );
    return await verifyTransactionCreatedEvent(txn, TXN_TYPE_TEXT);
  }

  async function proposeTransferTransaction(
    multiSigDAOInstance: Contract,
    gnosis: Contract,
    receiver: string,
    token: string,
    amount: number = TRANSFER_AMOUNT,
    title: string = TITLE,
    description: string = DESCRIPTION
  ) {
    const ABI = [
      "function transferTokenViaSafe(address,address,uint256) external",
    ];
    const iface = new ethers.utils.Interface(ABI);
    const data = iface.encodeFunctionData("transferTokenViaSafe", [
      token,
      receiver,
      amount,
    ]);
    const txn = await multiSigDAOInstance.proposeTransaction(
      gnosis.address,
      ethers.utils.arrayify(data),
      TXN_TYPE_TRANSFER,
      title,
      description,
      LINK_TO_DISCUSSION
    );
    return await verifyTransactionCreatedEvent(txn, TXN_TYPE_TRANSFER);
  }

  function createTransferTransactionABIData(
    receiver: string,
    amount: number
  ): Uint8Array {
    const ABI = ["function transfer(address to, uint amount) returns (bool)"];
    const iface = new ethers.utils.Interface(ABI);
    const data = iface.encodeFunctionData("transfer", [receiver, amount]);
    return ethers.utils.arrayify(data);
  }

  function createTextTransaction(
    creator: string,
    textAsHash: string
  ): Uint8Array {
    const ABI = [
      "function setText(address,string) external returns (address,string)",
    ];
    const iface = new ethers.utils.Interface(ABI);
    const data = iface.encodeFunctionData("setText", [creator, textAsHash]);
    return ethers.utils.arrayify(data);
  }

  async function deployFixture() {
    const signers = await TestHelper.getSigners();
    const hederaService = await TestHelper.deployMockHederaService();

    const daoSigners = await TestHelper.getDAOSigners();
    expect(daoSigners.length).not.equals(0);

    const daoAdminOne = await TestHelper.getDAOAdminOne();
    const tokenInstance = await TestHelper.deployERC20Mock();

    const systemUsersSigners = await TestHelper.systemUsersSigners();
    const systemRoleBasedAccess = (
      await TestHelper.deploySystemRoleBasedAccess()
    ).address;

    const multiSigDAOLogicInstance = await TestHelper.deployLogic(
      "MultiSigDAO"
    );

    const hederaGnosisSafeProxyFactoryInstance = await TestHelper.deployLogic(
      "HederaGnosisSafeProxyFactory"
    );

    const hederaGnosisSafeLogicInstance = await TestHelper.deployLogic(
      "HederaGnosisSafe"
    );

    const transaction = await hederaGnosisSafeProxyFactoryInstance.createProxy(
      hederaGnosisSafeLogicInstance.address,
      new Uint8Array()
    );
    const args = await gnosisProxyCreationVerification(transaction);

    const hederaGnosisSafeProxyInstance = args.proxy;
    const hederaGnosisSafeProxyContract = await TestHelper.getContract(
      "HederaGnosisSafe",
      hederaGnosisSafeProxyInstance
    );

    const multiSend = await TestHelper.deployLogic("HederaMultiSend");

    const doaSignersAddresses = daoSigners.map(
      (signer: SignerWithAddress) => signer.address
    );

    await hederaGnosisSafeProxyContract.setup(
      doaSignersAddresses,
      daoSigners.length,
      TestHelper.ZERO_ADDRESS,
      new Uint8Array(),
      TestHelper.ZERO_ADDRESS,
      TestHelper.ZERO_ADDRESS,
      0,
      TestHelper.ZERO_ADDRESS
    );

    const MULTISIG_ARGS = [
      daoAdminOne.address,
      DAO_NAME,
      LOGO_URL,
      DESCRIPTION,
      WEB_LINKS,
      hederaGnosisSafeProxyInstance,
      hederaService.address,
      multiSend.address,
      systemRoleBasedAccess,
    ];

    const multiSigDAOInstance = await TestHelper.deployLogic("MultiSigDAO");
    const txn = await multiSigDAOInstance.initialize(...MULTISIG_ARGS);
    const events = await TestHelper.readEvents(txn, ["DAOInfoUpdated"]);
    expect(events.length).equals(1);

    // factory setup
    const multiSigDAOFactoryInstance = await TestHelper.deployLogic(
      "MultisigDAOFactory"
    );
    await multiSigDAOFactoryInstance.initialize(
      systemRoleBasedAccess,
      multiSigDAOLogicInstance.address,
      hederaGnosisSafeLogicInstance.address,
      hederaGnosisSafeProxyFactoryInstance.address,
      hederaService.address,
      multiSend.address
    );

    // token association to gnosis contract not possible in unit test as of now

    // token transfer to contract
    await tokenInstance.setUserBalance(multiSend.address, TOTAL);
    await tokenInstance.setUserBalance(
      hederaGnosisSafeProxyContract.address,
      TOTAL
    );

    return {
      multiSigDAOInstance,
      multiSigDAOLogicInstance,
      multiSigDAOFactoryInstance,
      hederaGnosisSafeLogicInstance,
      hederaGnosisSafeProxyContract,
      hederaGnosisSafeProxyFactoryInstance,
      tokenInstance,
      signers,
      daoSigners,
      doaSignersAddresses,
      daoAdminOne,
      hederaService,
      MULTISIG_ARGS,
      multiSend,
      systemRoleBasedAccess,
      systemUsersSigners,
    };
  }

  describe("HederaGnosisSafe contract tests", function () {
    it("Verify proposed transaction approvals", async function () {
      const {
        multiSigDAOInstance,
        signers,
        tokenInstance,
        hederaGnosisSafeProxyContract,
        daoSigners,
      } = await loadFixture(deployFixture);
      const { txnHash } = await proposeTransaction(
        multiSigDAOInstance,
        signers[1].address,
        tokenInstance.address
      );
      const approvalStatus1 =
        await hederaGnosisSafeProxyContract.checkApprovals(txnHash);
      expect(approvalStatus1).equals(false);

      // took all approvals except from first singer
      for (const signer of daoSigners.slice(1)) {
        await hederaGnosisSafeProxyContract
          .connect(signer)
          .approveHash(txnHash);
      }

      const approvalStatus2 =
        await hederaGnosisSafeProxyContract.checkApprovals(txnHash);
      expect(approvalStatus2).equals(false);

      // took first signer approval now
      await hederaGnosisSafeProxyContract
        .connect(daoSigners.at(0)!)
        .approveHash(txnHash);

      const approvalStatus3 =
        await hederaGnosisSafeProxyContract.checkApprovals(txnHash);
      expect(approvalStatus3).equals(true);

      expect(await multiSigDAOInstance.state(txnHash)).equals(1); // Approved
    });

    it("Verify associate token to safe should be reverted if called without safe txn", async function () {
      const { tokenInstance, hederaGnosisSafeProxyContract, hederaService } =
        await loadFixture(deployFixture);

      await tokenInstance.setTransaferFailed(true);
      await expect(
        hederaGnosisSafeProxyContract.associateToken(
          hederaService.address,
          tokenInstance.address
        )
      ).revertedWith("GS031");
    });

    it("Verify transfer token from safe should be reverted if called without safe txn", async function () {
      const { hederaGnosisSafeProxyContract, tokenInstance, signers } =
        await loadFixture(deployFixture);
      await expect(
        hederaGnosisSafeProxyContract.transferTokenViaSafe(
          tokenInstance.address,
          signers[1].address,
          1e8
        )
      ).revertedWith("GS031");
    });

    it("Verify propose transaction should be reverted when user executed GnosisSafe exe method which is disabled by us", async function () {
      const {
        multiSigDAOInstance,
        signers,
        tokenInstance,
        hederaGnosisSafeProxyContract,
      } = await loadFixture(deployFixture);
      const { info } = await proposeTransaction(
        multiSigDAOInstance,
        signers[1].address,
        tokenInstance.address
      );
      await expect(
        hederaGnosisSafeProxyContract.execTransaction(
          info.to,
          info.value,
          info.data,
          info.operation,
          info.nonce,
          info.nonce,
          info.nonce,
          info.to,
          info.to,
          info.data
        )
      ).revertedWith("HederaGnosisSafe: API not available");
    });

    it("Verify propose transaction should be reverted for twice execution", async function () {
      const {
        multiSigDAOInstance,
        signers,
        tokenInstance,
        hederaGnosisSafeProxyContract,
        daoSigners,
      } = await loadFixture(deployFixture);
      const { txnHash, info } = await proposeTransaction(
        multiSigDAOInstance,
        signers[1].address,
        tokenInstance.address
      );
      for (const signer of daoSigners) {
        await hederaGnosisSafeProxyContract
          .connect(signer)
          .approveHash(txnHash);
      }
      await hederaGnosisSafeProxyContract.executeTransaction(
        info.to,
        info.value,
        info.data,
        info.operation,
        info.nonce
      );
      await expect(
        hederaGnosisSafeProxyContract.executeTransaction(
          info.to,
          info.value,
          info.data,
          info.operation,
          info.nonce
        )
      ).revertedWith("HederaGnosisSafe: txn already executed");
    });
  });

  describe("MultiSigDAOFactory contract tests", function () {
    it("Verify MultiSigDAOFactory contract revert for multiple initialization", async function () {
      const {
        multiSigDAOFactoryInstance,
        systemRoleBasedAccess,
        multiSigDAOLogicInstance,
        hederaGnosisSafeLogicInstance,
        hederaGnosisSafeProxyFactoryInstance,
        hederaService,
        multiSend,
      } = await loadFixture(deployFixture);
      await expect(
        multiSigDAOFactoryInstance.initialize(
          systemRoleBasedAccess,
          multiSigDAOLogicInstance.address,
          hederaGnosisSafeLogicInstance.address,
          hederaGnosisSafeProxyFactoryInstance.address,
          hederaService.address,
          multiSend.address
        )
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify createDAO should be reverted when dao admin is zero", async function () {
      const { multiSigDAOFactoryInstance, doaSignersAddresses } =
        await loadFixture(deployFixture);
      const ARGS = [
        TestHelper.ZERO_ADDRESS,
        DAO_NAME,
        LOGO_URL,
        doaSignersAddresses,
        doaSignersAddresses.length,
        true,
        DESCRIPTION,
        WEB_LINKS,
      ];
      await expect(multiSigDAOFactoryInstance.createDAO(ARGS))
        .revertedWithCustomError(multiSigDAOFactoryInstance, "InvalidInput")
        .withArgs("BaseDAO: admin address is zero");
    });

    it("Verify createDAO should be reverted when dao name is empty", async function () {
      const { multiSigDAOFactoryInstance, doaSignersAddresses, daoAdminOne } =
        await loadFixture(deployFixture);
      const ARGS = [
        daoAdminOne.address,
        "",
        LOGO_URL,
        doaSignersAddresses,
        doaSignersAddresses.length,
        true,
        DESCRIPTION,
        WEB_LINKS,
      ];
      await expect(multiSigDAOFactoryInstance.createDAO(ARGS))
        .revertedWithCustomError(multiSigDAOFactoryInstance, "InvalidInput")
        .withArgs("BaseDAO: name is empty");
    });

    it("Verify createDAO should add new dao into list when the dao is public", async function () {
      const { multiSigDAOFactoryInstance, doaSignersAddresses, daoAdminOne } =
        await loadFixture(deployFixture);

      const currentList = await multiSigDAOFactoryInstance.getDAOs();
      expect(currentList.length).equal(0);

      const ARGS = [
        daoAdminOne.address,
        DAO_NAME,
        LOGO_URL,
        doaSignersAddresses,
        doaSignersAddresses.length,
        false,
        DESCRIPTION,
        WEB_LINKS,
      ];

      const txn = await multiSigDAOFactoryInstance.createDAO(ARGS);

      const { name, args } = await TestHelper.readLastEvent(txn);
      expect(name).equal("DAOCreated");
      expect(args.daoAddress).not.equal(TestHelper.ZERO_ADDRESS);

      const updatedList = await multiSigDAOFactoryInstance.getDAOs();
      expect(updatedList.length).equal(1);
    });

    it("Verify createDAO should not add new dao into list when the dao is private", async function () {
      const { multiSigDAOFactoryInstance, doaSignersAddresses, daoAdminOne } =
        await loadFixture(deployFixture);

      const currentList = await multiSigDAOFactoryInstance.getDAOs();
      expect(currentList.length).equal(0);

      const ARGS = [
        daoAdminOne.address,
        DAO_NAME,
        LOGO_URL,
        doaSignersAddresses,
        doaSignersAddresses.length,
        true,
        DESCRIPTION,
        WEB_LINKS,
      ];

      const txn = await multiSigDAOFactoryInstance.createDAO(ARGS);

      const { name, args } = await TestHelper.readLastEvent(txn);
      expect(name).equal("DAOCreated");
      expect(args.daoAddress).not.equal(TestHelper.ZERO_ADDRESS);

      const updatedList = await multiSigDAOFactoryInstance.getDAOs();
      expect(updatedList.length).equal(0);
    });

    it("Verify upgrade logic call should be reverted for non dex owner", async function () {
      const { multiSigDAOFactoryInstance, daoAdminOne } = await loadFixture(
        deployFixture
      );

      await expect(
        multiSigDAOFactoryInstance
          .connect(daoAdminOne)
          .upgradeSafeFactoryAddress(TestHelper.ZERO_ADDRESS)
      ).reverted;

      await expect(
        multiSigDAOFactoryInstance
          .connect(daoAdminOne)
          .upgradeSafeLogicAddress(TestHelper.ZERO_ADDRESS)
      ).reverted;

      await expect(
        multiSigDAOFactoryInstance
          .connect(daoAdminOne)
          .upgradeDaoLogicAddress(TestHelper.ZERO_ADDRESS)
      ).reverted;
    });

    it("Verify upgrade logic call should be proceeded for dex owner", async function () {
      const { multiSigDAOFactoryInstance, systemUsersSigners } =
        await loadFixture(deployFixture);

      const safeFactoryTxn = await multiSigDAOFactoryInstance
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeSafeFactoryAddress(TestHelper.ONE_ADDRESS);
      const safeFactoryTxnEvent = await TestHelper.readLastEvent(
        safeFactoryTxn
      );
      expect(safeFactoryTxnEvent.name).equal("LogicUpdated");
      expect(safeFactoryTxnEvent.args.name).equal("SafeFactory");
      expect(safeFactoryTxnEvent.args.newImplementation).equal(
        TestHelper.ONE_ADDRESS
      );

      const safeLogicTxn = await multiSigDAOFactoryInstance
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeSafeLogicAddress(TestHelper.ONE_ADDRESS);
      const safeLogicTxnEvent = await TestHelper.readLastEvent(safeLogicTxn);
      expect(safeLogicTxnEvent.name).equal("LogicUpdated");
      expect(safeLogicTxnEvent.args.name).equal("SafeLogic");
      expect(safeLogicTxnEvent.args.newImplementation).equal(
        TestHelper.ONE_ADDRESS
      );

      const daoLogicTxn = await multiSigDAOFactoryInstance
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeDaoLogicAddress(TestHelper.ONE_ADDRESS);
      const daoLogicTxnEvent = await TestHelper.readLastEvent(daoLogicTxn);
      expect(daoLogicTxnEvent.name).equal("LogicUpdated");
      expect(daoLogicTxnEvent.args.name).equal("DaoLogic");
      expect(daoLogicTxnEvent.args.newImplementation).equal(
        TestHelper.ONE_ADDRESS
      );
    });

    it("Verify upgradeHederaService should fail when non-owner try to upgrade Hedera service", async function () {
      const { multiSigDAOFactoryInstance, signers } = await loadFixture(
        deployFixture
      );
      const nonOwner = signers[3];
      await expect(
        multiSigDAOFactoryInstance
          .connect(nonOwner)
          .upgradeHederaService(signers[3].address)
      ).reverted;
    });

    it("Verify upgrade Hedera service for factory should pass when owner try to upgrade it", async function () {
      const {
        multiSigDAOFactoryInstance,
        signers,
        hederaService,
        systemUsersSigners,
      } = await loadFixture(deployFixture);

      expect(await multiSigDAOFactoryInstance.getHederaServiceVersion()).equals(
        hederaService.address
      );

      const newAddress = signers[3].address;
      await multiSigDAOFactoryInstance
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeHederaService(newAddress);

      expect(await multiSigDAOFactoryInstance.getHederaServiceVersion()).equals(
        newAddress
      );
    });

    it("Verify upgradeMultiSend for factory should fail when non-owner try to upgrade MultiSend service", async function () {
      const { multiSigDAOFactoryInstance, signers } = await loadFixture(
        deployFixture
      );
      const nonOwner = signers[3];
      await expect(
        multiSigDAOFactoryInstance
          .connect(nonOwner)
          .upgradeMultiSend(signers[3].address)
      ).reverted;
    });

    it("Verify upgradeMultiSend for factory should be succeeded when owner try to upgrade MultiSend service", async function () {
      const { multiSend, systemUsersSigners, multiSigDAOFactoryInstance } =
        await loadFixture(deployFixture);

      expect(
        await multiSigDAOFactoryInstance.getMultiSendContractAddress()
      ).equals(multiSend.address);

      const newHederaService = await TestHelper.deployMockHederaService();
      await multiSigDAOFactoryInstance
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeMultiSend(newHederaService.address);

      expect(
        await multiSigDAOFactoryInstance.getMultiSendContractAddress()
      ).equals(newHederaService.address);
    });
  });

  describe("MultiSigDAO contract tests", function () {
    it("Verify MultiSigDAO contract should be reverted for multiple initialization", async function () {
      const { multiSigDAOInstance, MULTISIG_ARGS } = await loadFixture(
        deployFixture
      );
      await expect(
        multiSigDAOInstance.initialize(...MULTISIG_ARGS)
      ).revertedWith("Initializable: contract is already initialized");
    });

    it("Verify HederaGnosisSafe address set properly", async function () {
      const { multiSigDAOInstance, hederaGnosisSafeProxyContract } =
        await loadFixture(deployFixture);
      const currentAddress =
        await multiSigDAOInstance.getHederaGnosisSafeContractAddress();
      expect(currentAddress).equals(hederaGnosisSafeProxyContract.address);
    });

    it("Verify transaction info should be reverted for non-existing hash", async function () {
      const { multiSigDAOInstance } = await loadFixture(deployFixture);
      await expect(
        multiSigDAOInstance.getTransactionInfo(INVALID_TXN_HASH)
      ).revertedWith("MultiSigDAO: no txn exist");
    });

    it("Verify transaction state should be reverted for non-existing hash", async function () {
      const { multiSigDAOInstance } = await loadFixture(deployFixture);
      await expect(multiSigDAOInstance.state(INVALID_TXN_HASH)).revertedWith(
        "MultiSigDAO: no txn exist"
      );
    });

    it("Verify propose transaction should return a valid hash", async function () {
      const { multiSigDAOInstance, signers, tokenInstance } = await loadFixture(
        deployFixture
      );
      const { txnHash } = await proposeTransaction(
        multiSigDAOInstance,
        signers[1].address,
        tokenInstance.address
      );
      await expect(multiSigDAOInstance.getTransactionInfo(txnHash)).not
        .reverted;
    });

    it("Verify propose transaction should be in pending state", async function () {
      const { multiSigDAOInstance, signers, tokenInstance } = await loadFixture(
        deployFixture
      );
      const { txnHash } = await proposeTransaction(
        multiSigDAOInstance,
        signers[1].address,
        tokenInstance.address
      );
      expect(await multiSigDAOInstance.getApprovalCounts(txnHash)).equals(0);
      expect(await multiSigDAOInstance.state(txnHash)).equals(0); // Pending
    });

    it("Verify propose transaction should be in approved state", async function () {
      const {
        multiSigDAOInstance,
        signers,
        tokenInstance,
        hederaGnosisSafeProxyContract,
        daoSigners,
      } = await loadFixture(deployFixture);
      const { txnHash } = await proposeTransaction(
        multiSigDAOInstance,
        signers[1].address,
        tokenInstance.address
      );
      expect(await multiSigDAOInstance.getApprovalCounts(txnHash)).equals(0);
      for (const signer of daoSigners) {
        await hederaGnosisSafeProxyContract
          .connect(signer)
          .approveHash(txnHash);
      }
      expect(await multiSigDAOInstance.getApprovalCounts(txnHash)).equals(
        daoSigners.length
      );
      expect(await multiSigDAOInstance.state(txnHash)).equals(1); // Approved
    });

    it("Verify propose transaction should be in executed with operation type call", async function () {
      const {
        multiSigDAOInstance,
        signers,
        tokenInstance,
        hederaGnosisSafeProxyContract,
        daoSigners,
      } = await loadFixture(deployFixture);
      const { txnHash, info } = await proposeTransferTransaction(
        multiSigDAOInstance,
        hederaGnosisSafeProxyContract,
        signers[1].address,
        tokenInstance.address
      );
      for (const signer of daoSigners) {
        await hederaGnosisSafeProxyContract
          .connect(signer)
          .approveHash(txnHash);
      }
      const isTxnExecuted =
        await hederaGnosisSafeProxyContract.isTransactionExecuted(txnHash);
      expect(isTxnExecuted).equals(false);
      const transaction =
        await hederaGnosisSafeProxyContract.executeTransaction(
          info.to,
          info.value,
          info.data,
          info.operation,
          info.nonce
        );
      const { name, args } = await TestHelper.readLastEvent(transaction);
      expect(name).equals("ExecutionSuccess");
      expect(args.txHash).equals(txnHash);
      const isTxnExecuted1 =
        await hederaGnosisSafeProxyContract.isTransactionExecuted(txnHash);
      expect(isTxnExecuted1).equals(true); // Executed
      expect(await multiSigDAOInstance.state(txnHash)).equals(2); // Executed

      const userBalanceAfterTransactionExecution =
        await TestHelper.getAccountBalance(tokenInstance, signers[1].address);

      const contractBalanceAfterTransactionExecution =
        await TestHelper.getAccountBalance(
          tokenInstance,
          hederaGnosisSafeProxyContract.address
        );

      expect(contractBalanceAfterTransactionExecution).equals(
        TOTAL - TRANSFER_AMOUNT
      );
      expect(userBalanceAfterTransactionExecution).equals(TRANSFER_AMOUNT);
    });

    it("Verify propose batch transaction should be reverted with invalid inputs", async function () {
      const { multiSigDAOInstance, signers, tokenInstance } = await loadFixture(
        deployFixture
      );
      const receiver = signers[0].address;
      const callData = createTransferTransactionABIData(
        receiver,
        TRANSFER_AMOUNT
      );
      const VALUES = [0, 0];
      const TARGETS = [tokenInstance.address, tokenInstance.address];
      const CALL_DATA_ARRAY = [callData, callData];
      // 1- when target length is zero
      await expect(
        multiSigDAOInstance.proposeBatchTransaction(
          [],
          VALUES,
          CALL_DATA_ARRAY.slice(0, 1),
          TITLE,
          DESCRIPTION,
          LINK_TO_DISCUSSION
        )
      ).rejectedWith("MultiSigDAO: invalid transaction length");
      // 2- when targets is less
      await expect(
        multiSigDAOInstance.proposeBatchTransaction(
          TARGETS.slice(0, 1),
          VALUES,
          CALL_DATA_ARRAY,
          TITLE,
          DESCRIPTION,
          LINK_TO_DISCUSSION
        )
      ).rejectedWith("MultiSigDAO: invalid transaction length");
      // 3- when values is less
      await expect(
        multiSigDAOInstance.proposeBatchTransaction(
          TARGETS,
          VALUES.slice(0, 1),
          CALL_DATA_ARRAY,
          TITLE,
          DESCRIPTION,
          LINK_TO_DISCUSSION
        )
      ).rejectedWith("MultiSigDAO: invalid transaction length");
      // 4- when call-data-array is less
      await expect(
        multiSigDAOInstance.proposeBatchTransaction(
          TARGETS,
          VALUES,
          CALL_DATA_ARRAY.slice(0, 1),
          TITLE,
          DESCRIPTION,
          LINK_TO_DISCUSSION
        )
      ).rejectedWith("MultiSigDAO: invalid transaction length");
    });

    it("Verify propose batch transaction should be succeeded", async function () {
      const {
        signers,
        daoSigners,
        tokenInstance,
        multiSigDAOInstance,
        hederaGnosisSafeProxyContract,
      } = await loadFixture(deployFixture);

      const receiverAccount = signers[1];
      const callData = createTransferTransactionABIData(
        receiverAccount.address,
        TRANSFER_AMOUNT
      );
      const VALUES = [0, 0];
      const TARGETS = [tokenInstance.address, tokenInstance.address];
      const CALL_DATA_ARRAY = [callData, callData];
      const pTxn = await multiSigDAOInstance.proposeBatchTransaction(
        TARGETS,
        VALUES,
        CALL_DATA_ARRAY,
        TITLE,
        DESCRIPTION,
        LINK_TO_DISCUSSION
      );
      const { txnHash, info } = await verifyTransactionCreatedEvent(
        pTxn,
        TXN_TYPE_BATCH
      );
      for (const signer of daoSigners) {
        await hederaGnosisSafeProxyContract
          .connect(signer)
          .approveHash(txnHash);
      }
      expect(await tokenInstance.balanceOf(receiverAccount.address)).equals(0);
      const eTxn = await hederaGnosisSafeProxyContract.executeTransaction(
        info.to,
        info.value,
        info.data,
        info.operation,
        info.nonce
      );
      await verifyExecutionSuccessEvent(eTxn, txnHash);
      expect(await tokenInstance.balanceOf(receiverAccount.address)).equals(
        TRANSFER_AMOUNT * 2
      );
    });

    it("Verify propose transaction should be reverted when enough approvals not present", async function () {
      const {
        multiSigDAOInstance,
        signers,
        tokenInstance,
        hederaGnosisSafeProxyContract,
      } = await loadFixture(deployFixture);
      const { info } = await proposeTransaction(
        multiSigDAOInstance,
        signers[1].address,
        tokenInstance.address
      );
      await expect(
        hederaGnosisSafeProxyContract.executeTransaction(
          info.to,
          info.value,
          info.data,
          info.operation,
          info.nonce
        )
      ).revertedWith("Owner has not approved yet");
    });

    it("Verify upgrade Hedera service passes with system user", async function () {
      const { multiSigDAOInstance, systemUsersSigners, hederaService } =
        await loadFixture(deployFixture);

      expect(await multiSigDAOInstance.getHederaServiceVersion()).equals(
        hederaService.address
      );

      const newHederaService = await TestHelper.deployMockHederaService();
      await multiSigDAOInstance
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeHederaService(newHederaService.address);

      expect(await multiSigDAOInstance.getHederaServiceVersion()).equals(
        newHederaService.address
      );
    });

    it("Verify upgrade Hedera service fails with non-system user", async function () {
      const { multiSigDAOInstance, signers } = await loadFixture(deployFixture);
      const nonSystemUser = signers[3];
      const newHederaService = await TestHelper.deployMockHederaService();
      await expect(
        multiSigDAOInstance
          .connect(nonSystemUser)
          .upgradeHederaService(newHederaService.address)
      ).reverted;
    });

    it("Verify upgrade MultiSend service fails with non-system user", async function () {
      const { multiSigDAOInstance, signers } = await loadFixture(deployFixture);

      await expect(
        multiSigDAOInstance
          .connect(signers[3])
          .upgradeMultiSend(signers[3].address)
      ).reverted;
    });

    it("Verify upgrade MultiSend service passes with system user", async function () {
      const { multiSigDAOInstance, systemUsersSigners, multiSend } =
        await loadFixture(deployFixture);

      expect(await multiSigDAOInstance.getMultiSendContractAddress()).equals(
        multiSend.address
      );

      const newMultiSend = await TestHelper.deployLogic("HederaMultiSend");
      await multiSigDAOInstance
        .connect(systemUsersSigners.childProxyAdmin)
        .upgradeMultiSend(newMultiSend.address);

      expect(await multiSigDAOInstance.getMultiSendContractAddress()).equals(
        newMultiSend.address
      );
    });

    it("Verify propose transaction should be reverted when title / description empty", async function () {
      const { signers, tokenInstance, multiSigDAOInstance } = await loadFixture(
        deployFixture
      );
      await expect(
        proposeTransaction(
          multiSigDAOInstance,
          signers[1].address,
          tokenInstance.address,
          TRANSFER_AMOUNT,
          ""
        )
      ).revertedWith("MultiSigDAO: title can't be blank");
      await expect(
        proposeTransaction(
          multiSigDAOInstance,
          signers[1].address,
          tokenInstance.address,
          TRANSFER_AMOUNT,
          TITLE,
          ""
        )
      ).revertedWith("MultiSigDAO: desc can't be blank");
    });

    it("Verify token association propose transaction should be created successfully ", async function () {
      const { tokenInstance, multiSigDAOInstance } = await loadFixture(
        deployFixture
      );

      const txn = await multiSigDAOInstance.proposeTokenAssociateTransaction(
        tokenInstance.address,
        TITLE,
        DESCRIPTION,
        LINK_TO_DISCUSSION
      );
      await verifyTransactionCreatedEvent(txn, TXN_TYPE_TOKEN_ASSOCIATE);
    });

    describe("Text proposal test cases", () => {
      it("Verify text proposal workflow - proposal to execution ", async function () {
        const {
          multiSigDAOInstance,
          signers,
          hederaGnosisSafeProxyContract,
          daoSigners,
        } = await loadFixture(deployFixture);

        const { txnHash: textProposalTxnHash, info } =
          await proposeTextTransaction(
            multiSigDAOInstance,
            TEXT_PROPOSAL_TEXT,
            signers[0].address
          );

        const approvalStatus1 =
          await hederaGnosisSafeProxyContract.checkApprovals(
            textProposalTxnHash
          );
        expect(approvalStatus1).equals(false);

        // took all approvals except from first singer
        for (const signer of daoSigners.slice(1)) {
          await hederaGnosisSafeProxyContract
            .connect(signer)
            .approveHash(textProposalTxnHash);
        }

        const approvalStatus2 =
          await hederaGnosisSafeProxyContract.checkApprovals(
            textProposalTxnHash
          );
        expect(approvalStatus2).equals(false);

        // took first signer approval now
        await hederaGnosisSafeProxyContract
          .connect(daoSigners.at(0)!)
          .approveHash(textProposalTxnHash);

        const approvalStatus3 =
          await hederaGnosisSafeProxyContract.checkApprovals(
            textProposalTxnHash
          );
        expect(approvalStatus3).equals(true);

        expect(await multiSigDAOInstance.state(textProposalTxnHash)).equals(1); // Approved

        await hederaGnosisSafeProxyContract.executeTransaction(
          info.to,
          info.value,
          info.data,
          info.operation,
          info.nonce
        );
      });

      it("Verify setText can be called via HederaGnosisSafe ", async function () {
        const { multiSigDAOInstance } = await loadFixture(deployFixture);

        await expect(
          multiSigDAOInstance.setText(TestHelper.ONE_ADDRESS, "Anything")
        ).revertedWith("Only HederaGnosisSafe can execute it.");
      });
    });

    // describe("Hbar transfer tests", () => {

    //   it("Transfer hbar", async () => {
    //     const { multiSigDAOInstance, signers, hederaGnosisSafeProxyContract,
    //       daoSigners, } = await loadFixture(deployFixture);
    //     const ABI = [
    //       "function call(string)",
    //     ];
    //     const iface = new ethers.utils.Interface(ABI);
    //     const data = iface.encodeFunctionData("call", [
    //       "",
    //     ]);

    //     const { txnHash: textProposalTxnHash, info } = const txn = await multiSigDAOInstance.proposeTransaction(
    //       token,
    //       createTransferTransactionABIData(receiver, amount),
    //       TXN_TYPE_TRANSFER,
    //       title,
    //       description,
    //       LINK_TO_DISCUSSION
    //     );
    //     const approvalStatus1 =
    //       await hederaGnosisSafeProxyContract.checkApprovals(
    //         textProposalTxnHash
    //       );
    //     expect(approvalStatus1).equals(false);

    //     // took all approvals except from first singer
    //     for (const signer of daoSigners.slice(1)) {
    //       await hederaGnosisSafeProxyContract
    //         .connect(signer)
    //         .approveHash(textProposalTxnHash);
    //     }

    //     const approvalStatus2 =
    //       await hederaGnosisSafeProxyContract.checkApprovals(
    //         textProposalTxnHash
    //       );
    //     expect(approvalStatus2).equals(false);

    //     // took first signer approval now
    //     await hederaGnosisSafeProxyContract
    //       .connect(daoSigners.at(0)!)
    //       .approveHash(textProposalTxnHash);

    //     const approvalStatus3 =
    //       await hederaGnosisSafeProxyContract.checkApprovals(
    //         textProposalTxnHash
    //       );
    //     expect(approvalStatus3).equals(true);

    //     expect(await multiSigDAOInstance.state(textProposalTxnHash)).equals(1); // Approved

    //     await hederaGnosisSafeProxyContract.executeTransaction(
    //       info.to,
    //       info.value,
    //       info.data,
    //       info.operation,
    //       info.nonce
    //     );

    //   })
    // })
  });
});
