import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("MultiSig contract tests", function () {
  const INVALID_TXN_HASH = ethers.utils.formatBytes32String("INVALID_TXN_HASH");
  const TOTAL = 100 * 1e8;
  const TRANSFER_AMOUNT = 10 * 1e8;
  const DAO_NAME = "DAO_NAME";
  const LOGO_URL = "LOGO_URL";

  async function gnosisProxyCreationVerification(name: string, args: any) {
    expect(name).equal("ProxyCreation");
    expect(args.proxy).not.equal(TestHelper.ZERO_ADDRESS);
    expect(args.singleton).not.equal(TestHelper.ZERO_ADDRESS);
  }

  async function getDAOSigners() {
    const signers = await TestHelper.getSigners();
    return [signers[4], signers[5]];
  }

  async function deployFixture() {
    const signers = await ethers.getSigners();
    const daoAdminOne = signers[5];

    const tokenInstance = await TestHelper.deployLogic(
      "ERC20Mock",
      "Test",
      "Test",
      TOTAL,
      0
    );

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
    const { name, args } = await TestHelper.readEvent(transaction);
    gnosisProxyCreationVerification(name, args);

    const hederaGnosisSafeProxyInstance = args.proxy;
    const hederaGnosisSafeProxyContract = await TestHelper.getContract(
      "HederaGnosisSafe",
      hederaGnosisSafeProxyInstance
    );

    const daoSigners = await getDAOSigners();
    const doaSignersAddresses = daoSigners.map(
      (signer: SignerWithAddress) => signer.address
    );
    expect(daoSigners.length).not.equals(0);

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

    const dexOwner = await TestHelper.getDexOwner();
    const multiSigDAOInstance = await TestHelper.deployProxy(
      "MultiSigDAO",
      dexOwner.address,
      DAO_NAME,
      LOGO_URL,
      hederaGnosisSafeProxyInstance
    );

    // factory setup
    const multiSigDAOFactoryInstance = await TestHelper.deployProxy(
      "MultisigDAOFactory",
      dexOwner.address,
      multiSigDAOLogicInstance.address,
      hederaGnosisSafeLogicInstance.address,
      hederaGnosisSafeProxyFactoryInstance.address
    );

    // setup contract balance because delegate call not working
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
      dexOwner,
      signers,
      daoSigners,
      doaSignersAddresses,
      daoAdminOne,
    };
  }

  describe("MultiSigDAOFactory contract tests", function () {
    it("Verify MultiSigDAOFactory contract revert for multiple initialization", async function () {
      const {
        multiSigDAOFactoryInstance,
        dexOwner,
        multiSigDAOLogicInstance,
        hederaGnosisSafeLogicInstance,
        hederaGnosisSafeProxyFactoryInstance,
      } = await loadFixture(deployFixture);
      await expect(
        multiSigDAOFactoryInstance.initialize(
          dexOwner.address,
          multiSigDAOLogicInstance.address,
          hederaGnosisSafeLogicInstance.address,
          hederaGnosisSafeProxyFactoryInstance.address
        )
      ).to.revertedWith("Initializable: contract is already initialized");
    });

    it("Verify createDAO should be reverted when dao admin is zero", async function () {
      const { multiSigDAOFactoryInstance, doaSignersAddresses } =
        await loadFixture(deployFixture);
      await expect(
        multiSigDAOFactoryInstance.createDAO(
          TestHelper.ZERO_ADDRESS,
          DAO_NAME,
          LOGO_URL,
          doaSignersAddresses,
          doaSignersAddresses.length,
          true
        )
      )
        .to.revertedWithCustomError(multiSigDAOFactoryInstance, "InvalidInput")
        .withArgs("BaseDAO: admin address is zero");
    });

    it("Verify createDAO should be reverted when dao name is empty", async function () {
      const { multiSigDAOFactoryInstance, doaSignersAddresses, daoAdminOne } =
        await loadFixture(deployFixture);
      await expect(
        multiSigDAOFactoryInstance.createDAO(
          daoAdminOne.address,
          "",
          LOGO_URL,
          doaSignersAddresses,
          doaSignersAddresses.length,
          true
        )
      )
        .to.revertedWithCustomError(multiSigDAOFactoryInstance, "InvalidInput")
        .withArgs("BaseDAO: name is empty");
    });

    it("Verify createDAO should be reverted when dao url is empty", async function () {
      const { multiSigDAOFactoryInstance, doaSignersAddresses, daoAdminOne } =
        await loadFixture(deployFixture);
      await expect(
        multiSigDAOFactoryInstance.createDAO(
          daoAdminOne.address,
          DAO_NAME,
          "",
          doaSignersAddresses,
          doaSignersAddresses.length,
          true
        )
      )
        .to.revertedWithCustomError(multiSigDAOFactoryInstance, "InvalidInput")
        .withArgs("BaseDAO: url is empty");
    });

    it("Verify createDAO should add new dao into list when the dao is public", async function () {
      const { multiSigDAOFactoryInstance, doaSignersAddresses, daoAdminOne } =
        await loadFixture(deployFixture);

      const currentList = await multiSigDAOFactoryInstance.getDAOs();
      expect(currentList.length).to.be.equal(0);

      const txn = await multiSigDAOFactoryInstance.createDAO(
        daoAdminOne.address,
        DAO_NAME,
        LOGO_URL,
        doaSignersAddresses,
        doaSignersAddresses.length,
        false
      );

      const { name, args } = await TestHelper.readEvent(txn);
      expect(name).to.be.equal("PublicDaoCreated");
      expect(args.daoAddress).not.to.be.equal(TestHelper.ZERO_ADDRESS);

      const updatedList = await multiSigDAOFactoryInstance.getDAOs();
      expect(updatedList.length).to.be.equal(1);
    });

    it("Verify createDAO should not add new dao into list when the dao is private", async function () {
      const { multiSigDAOFactoryInstance, doaSignersAddresses, daoAdminOne } =
        await loadFixture(deployFixture);

      const currentList = await multiSigDAOFactoryInstance.getDAOs();
      expect(currentList.length).to.be.equal(0);

      const txn = await multiSigDAOFactoryInstance.createDAO(
        daoAdminOne.address,
        DAO_NAME,
        LOGO_URL,
        doaSignersAddresses,
        doaSignersAddresses.length,
        true
      );

      const { name, args } = await TestHelper.readEvent(txn);
      expect(name).to.be.equal("PrivateDaoCreated");
      expect(args.daoAddress).not.to.be.equal(TestHelper.ZERO_ADDRESS);

      const updatedList = await multiSigDAOFactoryInstance.getDAOs();
      expect(updatedList.length).to.be.equal(0);
    });

    it("Verify upgrade logic call should be reverted for non dex owner", async function () {
      const { multiSigDAOFactoryInstance, daoAdminOne } = await loadFixture(
        deployFixture
      );

      await expect(
        multiSigDAOFactoryInstance
          .connect(daoAdminOne)
          .upgradeSafeFactoryAddress(TestHelper.ZERO_ADDRESS)
      )
        .to.revertedWithCustomError(multiSigDAOFactoryInstance, "NotAdmin")
        .withArgs("MultisigDAOFactory: auth failed");

      await expect(
        multiSigDAOFactoryInstance
          .connect(daoAdminOne)
          .upgradeSafeLogicAddress(TestHelper.ZERO_ADDRESS)
      )
        .to.revertedWithCustomError(multiSigDAOFactoryInstance, "NotAdmin")
        .withArgs("MultisigDAOFactory: auth failed");

      await expect(
        multiSigDAOFactoryInstance
          .connect(daoAdminOne)
          .upgradeDaoLogicAddress(TestHelper.ZERO_ADDRESS)
      )
        .to.revertedWithCustomError(multiSigDAOFactoryInstance, "NotAdmin")
        .withArgs("MultisigDAOFactory: auth failed");
    });

    it("Verify upgrade logic call should be proceeded for dex owner", async function () {
      const { multiSigDAOFactoryInstance, dexOwner } = await loadFixture(
        deployFixture
      );

      const safeFactoryTxn = await multiSigDAOFactoryInstance
        .connect(dexOwner)
        .upgradeSafeFactoryAddress(TestHelper.ONE_ADDRESS);
      const safeFactoryTxnEvent = await TestHelper.readEvent(safeFactoryTxn);
      expect(safeFactoryTxnEvent.name).to.be.equal("LogicUpdated");
      expect(safeFactoryTxnEvent.args.name).to.be.equal("SafeFactory");
      expect(safeFactoryTxnEvent.args.newImplementation).to.be.equal(
        TestHelper.ONE_ADDRESS
      );

      const safeLogicTxn = await multiSigDAOFactoryInstance
        .connect(dexOwner)
        .upgradeSafeLogicAddress(TestHelper.ONE_ADDRESS);
      const safeLogicTxnEvent = await TestHelper.readEvent(safeLogicTxn);
      expect(safeLogicTxnEvent.name).to.be.equal("LogicUpdated");
      expect(safeLogicTxnEvent.args.name).to.be.equal("SafeLogic");
      expect(safeLogicTxnEvent.args.newImplementation).to.be.equal(
        TestHelper.ONE_ADDRESS
      );

      const daoLogicTxn = await multiSigDAOFactoryInstance
        .connect(dexOwner)
        .upgradeDaoLogicAddress(TestHelper.ONE_ADDRESS);
      const daoLogicTxnEvent = await TestHelper.readEvent(daoLogicTxn);
      expect(daoLogicTxnEvent.name).to.be.equal("LogicUpdated");
      expect(daoLogicTxnEvent.args.name).to.be.equal("DaoLogic");
      expect(daoLogicTxnEvent.args.newImplementation).to.be.equal(
        TestHelper.ONE_ADDRESS
      );
    });
  });

  describe("MultiSigDAO contract tests", function () {
    it("Verify MultiSigDAO contract revert for multiple initialization", async function () {
      const { multiSigDAOInstance, dexOwner, hederaGnosisSafeProxyContract } =
        await loadFixture(deployFixture);
      await expect(
        multiSigDAOInstance.initialize(
          dexOwner.address,
          DAO_NAME,
          LOGO_URL,
          hederaGnosisSafeProxyContract.address
        )
      ).to.revertedWith("Initializable: contract is already initialized");
    });

    it("Verify HederaGnosisSafe address set properly", async function () {
      const { multiSigDAOInstance, hederaGnosisSafeProxyContract } =
        await loadFixture(deployFixture);
      const currentAddress =
        await multiSigDAOInstance.getMultisigContractAddress();
      expect(currentAddress).equals(hederaGnosisSafeProxyContract.address);
    });

    it("Verify transaction info should be reverted for non-existing hash", async function () {
      const { multiSigDAOInstance } = await loadFixture(deployFixture);
      await expect(
        multiSigDAOInstance.getTransactionInfo(INVALID_TXN_HASH)
      ).to.revertedWith("MultiSigDAO: no txn exist");
    });

    it("Verify transaction state should be reverted for non-existing hash", async function () {
      const { multiSigDAOInstance } = await loadFixture(deployFixture);
      await expect(multiSigDAOInstance.state(INVALID_TXN_HASH)).to.revertedWith(
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
      for (const signer of daoSigners) {
        await hederaGnosisSafeProxyContract
          .connect(signer)
          .approveHash(txnHash);
      }
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
        signers[1].address,
        tokenInstance.address
      );
      for (const signer of daoSigners) {
        await hederaGnosisSafeProxyContract
          .connect(signer)
          .approveHash(txnHash);
      }
      const transaction =
        await hederaGnosisSafeProxyContract.executeTransaction(
          info.to,
          info.value,
          info.data,
          info.operation,
          info.nonce
        );
      const { name, args } = await TestHelper.readEvent(transaction);
      expect(name).equals("ExecutionSuccess");
      expect(args.txHash).equals(txnHash);
      const isTxnExecuted =
        await hederaGnosisSafeProxyContract.isTransactionExecuted(txnHash);
      expect(isTxnExecuted).equals(true); // Executed
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

    it("Verify propose transaction should be in executed with operation type delegate", async function () {
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
        tokenInstance.address,
        TRANSFER_AMOUNT,
        1
      );
      for (const signer of daoSigners) {
        await hederaGnosisSafeProxyContract
          .connect(signer)
          .approveHash(txnHash);
      }
      const transaction =
        await hederaGnosisSafeProxyContract.executeTransaction(
          info.to,
          info.value,
          info.data,
          info.operation,
          info.nonce
        );
      const { name, args } = await TestHelper.readEvent(transaction);
      expect(name).equals("ExecutionSuccess");
      expect(args.txHash).equals(txnHash);
      const isTxnExecuted =
        await hederaGnosisSafeProxyContract.isTransactionExecuted(txnHash);
      expect(isTxnExecuted).equals(true); // Executed
      // Note - no balance verification here due to delegate
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
      ).to.revertedWith("Owner has not approved yet");
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
      ).to.revertedWith("HederaGnosisSafe: API not available");
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
      ).to.revertedWith("HederaGnosisSafe: txn already executed");
    });

    async function proposeTransaction(
      multiSigDAOInstance: Contract,
      receiver: string,
      token: string,
      amount: number = TRANSFER_AMOUNT,
      operation: number = 0 // 1 delegate and 0 call (balance verification not working with 1,so default is 0 for unit test)
    ) {
      const transaction = await multiSigDAOInstance.proposeTransaction(
        token,
        createTransferTransactionABIData(receiver, amount),
        operation
      );
      const { name, args } = await TestHelper.readEvent(transaction);
      const txnHash = args.txnHash;
      const info = args.info;

      expect(name).equal("TransactionCreated");
      expect(txnHash).not.equals(TestHelper.ZERO_ADDRESS);
      expect(info.to).not.equals(TestHelper.ZERO_ADDRESS);
      expect(info.operation).equals(operation);
      expect(info.nonce).equals(1);
      return { txnHash, info };
    }

    async function proposeTransferTransaction(
      multiSigDAOInstance: Contract,
      receiver: string,
      token: string,
      amount: number = TRANSFER_AMOUNT,
      operation: number = 0 // 1 delegate and 0 call (balance verification not working with 1,so default is 0 for unit test)
    ) {
      const transaction = await multiSigDAOInstance.proposeTransferTransaction(
        receiver,
        token,
        amount,
        operation
      );
      const { name, args } = await TestHelper.readEvent(transaction);
      const txnHash = args.txnHash;
      const info = args.info;

      expect(name).equal("TransactionCreated");
      expect(txnHash).not.equals(TestHelper.ZERO_ADDRESS);
      expect(info.to).not.equals(TestHelper.ZERO_ADDRESS);
      expect(info.operation).equals(operation);
      expect(info.nonce).equals(1);
      return { txnHash, info };
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
  });
});
