import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { TestHelper } from "./TestHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import BigNumber from "bignumber.js";

describe("MultiSigDAO contract tests", function () {
  const ZERO_ADDRESS = TestHelper.getZeroAddress();
  const INVALID_TXN_HASH = ethers.utils.formatBytes32String("INVALID_TXN_HASH");
  const TOTAL = 100 * 1e8;
  const TRANSFER_AMOUNT = 10 * 1e8;
  const DAO_NAME = "DAO_NAME";
  const LOGO_URL = "LOGO_URL";

  async function deployFixture() {
    const signers = await ethers.getSigners();

    const tokenInstance = await TestHelper.deployLogic(
      "ERC20Mock",
      "Test",
      "Test",
      TOTAL,
      0
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
    const lastEvent = (await transaction.wait()).events.pop();
    expect(lastEvent.event).equal("ProxyCreation");
    expect(lastEvent.args.proxy).not.equal("0x0");
    expect(lastEvent.args.singleton).not.equal("0x0");

    const hederaGnosisSafeProxyInstance = lastEvent.args.proxy;
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
      ZERO_ADDRESS,
      new Uint8Array(),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      0,
      ZERO_ADDRESS
    );

    const dexOwner = await TestHelper.getDexOwner();
    const multiSigDAOInstance = await TestHelper.deployProxy(
      "MultiSigDAO",
      dexOwner.address,
      DAO_NAME,
      LOGO_URL,
      hederaGnosisSafeProxyInstance
    );

    // setup contract balance because delegate call not working
    await tokenInstance.setUserBalance(
      hederaGnosisSafeProxyContract.address,
      TOTAL
    );

    return {
      multiSigDAOInstance,
      hederaGnosisSafeProxyContract,
      tokenInstance,
      dexOwner,
      signers,
      daoSigners,
    };
  }

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
    const { txnHash } = await createTransaction(
      multiSigDAOInstance,
      signers[1].address,
      tokenInstance.address
    );
    await expect(multiSigDAOInstance.getTransactionInfo(txnHash)).not.reverted;
  });

  it("Verify propose transaction should be in pending state", async function () {
    const { multiSigDAOInstance, signers, tokenInstance } = await loadFixture(
      deployFixture
    );
    const { txnHash } = await createTransaction(
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
    const { txnHash } = await createTransaction(
      multiSigDAOInstance,
      signers[1].address,
      tokenInstance.address
    );
    for (const signer of daoSigners) {
      await hederaGnosisSafeProxyContract.connect(signer).approveHash(txnHash);
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
    const { txnHash, info } = await createTransaction(
      multiSigDAOInstance,
      signers[1].address,
      tokenInstance.address
    );
    for (const signer of daoSigners) {
      await hederaGnosisSafeProxyContract.connect(signer).approveHash(txnHash);
    }
    const transaction = await hederaGnosisSafeProxyContract.executeTransaction(
      info.to,
      info.value,
      info.data,
      info.operation,
      info.nonce
    );
    const lastEvent = (await transaction.wait()).events.pop();
    expect(lastEvent.event).equals("ExecutionSuccess");
    expect(lastEvent.args.txHash).equals(txnHash);
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
    const { txnHash, info } = await createTransaction(
      multiSigDAOInstance,
      signers[1].address,
      tokenInstance.address,
      TRANSFER_AMOUNT,
      1
    );
    for (const signer of daoSigners) {
      await hederaGnosisSafeProxyContract.connect(signer).approveHash(txnHash);
    }
    const transaction = await hederaGnosisSafeProxyContract.executeTransaction(
      info.to,
      info.value,
      info.data,
      info.operation,
      info.nonce
    );
    const lastEvent = (await transaction.wait()).events.pop();
    expect(lastEvent.event).equals("ExecutionSuccess");
    expect(lastEvent.args.txHash).equals(txnHash);
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
    const { info } = await createTransaction(
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
    const { info } = await createTransaction(
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
    const { txnHash, info } = await createTransaction(
      multiSigDAOInstance,
      signers[1].address,
      tokenInstance.address
    );
    for (const signer of daoSigners) {
      await hederaGnosisSafeProxyContract.connect(signer).approveHash(txnHash);
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

  async function createTransaction(
    multiSigDAOInstance: Contract,
    receiver: string,
    token: string,
    amount: number = TRANSFER_AMOUNT,
    operation: number = 0 // 1 delegate and 0 call (balance verification not working with 1,so default is 0 for unit test)
  ) {
    const transaction = await multiSigDAOInstance.proposeTransaction(
      receiver,
      token,
      amount,
      operation
    );
    const lastEvent = (await transaction.wait()).events.pop();
    expect(lastEvent.event).equal("TransactionCreated");

    const txnHash = lastEvent.args.txnHash;
    expect(txnHash).not.equals(TestHelper.getZeroAddress());

    const info = lastEvent.args.info;
    expect(info.to).not.equals(TestHelper.getZeroAddress());
    expect(info.operation).equals(operation);
    expect(info.nonce).equals(1);
    return { txnHash, info };
  }

  async function getDAOSigners() {
    const signers = await TestHelper.getSigners();
    return [signers[4], signers[5]];
  }
});
