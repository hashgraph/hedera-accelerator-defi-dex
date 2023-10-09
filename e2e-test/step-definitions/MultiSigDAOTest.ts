import dex from "../../deployment/model/dex";
import Common from "../business/Common";
import BigNumber from "bignumber.js";
import MultiSigDao from "../business/MultiSigDao";
import HederaGnosisSafe from "../business/HederaGnosisSafe";
import MultiSigDAOFactory from "../../e2e-test/business/factories/MultiSigDAOFactory";

import { expect } from "chai";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import { FeeConfigDetails } from "../business/types";
import { AccountId, TokenId } from "@hashgraph/sdk";
import { main as deployContract } from "../../deployment/scripts/logic";
import { binding, given, then, when } from "cucumber-tsflow";

const PRECISION = 1e8;
const TOKEN_ID = dex.TOKEN_LAB49_1_ID;

const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["https://linkedin.com"];

const DAO_ADMIN_ID = clientsInfo.uiUserId;
const DAO_ADMIN_KEY = clientsInfo.uiUserKey;
const DAO_ADMIN_ADDRESS = clientsInfo.uiUserId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.uiUserClient;

const DAO_OWNERS_INFO = [
  {
    address: clientsInfo.treasureId.toSolidityAddress(),
    client: clientsInfo.treasureClient,
  },
  {
    address: DAO_ADMIN_ADDRESS,
    client: DAO_ADMIN_CLIENT,
  },
];
const DAO_OWNERS_ADDRESSES = DAO_OWNERS_INFO.map((item: any) => item.address);

const feeConfig = {
  amountOrId: 1,
  tokenAddress: dex.GOD_TOKEN_ADDRESS,
  receiver: clientsInfo.treasureId.toSolidityAddress(),
  fromAccountId: DAO_ADMIN_ID,
  fromAccountKey: DAO_ADMIN_KEY,
  fromAccountClient: DAO_ADMIN_CLIENT,
};

const multiSigDAOFactory = new MultiSigDAOFactory();
let multiSigDao = new MultiSigDao();
let gnosisSafe: HederaGnosisSafe;
let txnHash: Uint8Array;
let balanceInUserAccount: BigNumber;
let proposedAmtFromSafe: number;
let errorMsg: string;
let balanceInSafe: BigNumber;
let listOfOwners: string[];
let contractNewAddress: string;
let upgradeResult: any;

@binding()
export class MultiSigDAOSteps {
  @given(
    /User tries to initialize the multisigdao with name as "([^"]*)" and logo as "([^"]*)"/,
    undefined,
    60000,
  )
  public async initializeFail(name: string, logo: string): Promise<void> {
    console.log(
      "*******************Starting multisigdao test with following credentials*******************",
    );
    console.log("MultiSigDao contract-id :", multiSigDao.contractId);
    console.log("Dao admin address :", DAO_ADMIN_ADDRESS);
    const DAO_FEE_CONFIG: FeeConfigDetails = {
      receiver: feeConfig.receiver,
      tokenAddress: feeConfig.tokenAddress,
      amountOrId: feeConfig.amountOrId,
    };
    try {
      await multiSigDao.initialize(
        DAO_ADMIN_ADDRESS,
        name,
        logo,
        DAO_DESC,
        DAO_WEB_LINKS,
        DAO_OWNERS_ADDRESSES,
        DAO_FEE_CONFIG,
        DAO_ADMIN_CLIENT,
        DAO_OWNERS_ADDRESSES.length,
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @then(/User receives the error message "([^"]*)"/, undefined, 60000)
  public async verifyErrorMessage(msg: string) {
    expect(errorMsg).contains(msg);
    errorMsg = "";
  }

  @given(
    /User initialize the multisigdao with name as "([^"]*)" and logo as "([^"]*)"/,
    undefined,
    240000,
  )
  public async initializeSafe(name: string, logo: string): Promise<void> {
    const FEE_CONFIG: FeeConfigDetails = {
      receiver: feeConfig.receiver,
      tokenAddress: feeConfig.tokenAddress,
      amountOrId: feeConfig.amountOrId,
    };
    await multiSigDao.initialize(
      DAO_ADMIN_ADDRESS,
      name,
      logo,
      DAO_DESC,
      DAO_WEB_LINKS,
      DAO_OWNERS_ADDRESSES,
      FEE_CONFIG,
      DAO_ADMIN_CLIENT,
      DAO_OWNERS_ADDRESSES.length,
    );
    gnosisSafe = new HederaGnosisSafe(
      await multiSigDao.getHederaGnosisSafeContractAddress(),
    );
  }

  @when(
    /User propose transaction for transferring (\d+\.?\d*) unit of the target token/,
    undefined,
    60000,
  )
  public async setFailTransaction(tokenAmount: number) {
    try {
      proposedAmtFromSafe = tokenAmount * PRECISION;
      txnHash = await multiSigDao.proposeTransferTransaction(
        clientsInfo.treasureId.toSolidityAddress(),
        TOKEN_ID.toSolidityAddress(),
        proposedAmtFromSafe,
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @then(/User verify transaction state is "([^"]*)"/, undefined, 60000)
  public async verifyTransactionState(state: string) {
    const expectedState = await multiSigDao.getTransactionNumericState(state);
    const actualState = await multiSigDao.state(txnHash);
    expect(Number(actualState)).to.eql(expectedState);
  }

  @when(/User get (\d+\.?\d*) approval from DAO owners/, undefined, 60000)
  public async getApprovalFromOwners(approvalCount: number) {
    if (approvalCount > DAO_OWNERS_INFO.length)
      throw new Error(
        `Approval count can not be greater than number of dao owners : ${DAO_OWNERS_INFO.length}`,
      );
    for (let i = 0; i < approvalCount; i++) {
      await gnosisSafe.approveHash(txnHash, DAO_OWNERS_INFO[i].client);
    }
  }

  @when(/User execute the transaction/, undefined, 60000)
  public async executeTransaction() {
    const txnInfo = await multiSigDao.getTransactionInfo(txnHash);
    await gnosisSafe.executeTransaction(
      txnInfo.to,
      txnInfo.value,
      txnInfo.data,
      txnInfo.operation,
      txnInfo.nonce,
    );
  }

  @when(
    /User try to execute the transaction and receives the error message "([^"]*)"/,
    undefined,
    60000,
  )
  public async executeAndRevertTransaction(message: string) {
    const txnInfo = await multiSigDao.getTransactionInfo(txnHash);
    try {
      await gnosisSafe.executeTransaction(
        txnInfo.to,
        txnInfo.value,
        txnInfo.data,
        txnInfo.operation,
        txnInfo.nonce,
      );
    } catch (e: any) {
      expect(e.message).contains(message);
    }
  }

  @when(
    /User fetch balance of the target token from payee account/,
    undefined,
    60000,
  )
  public async getTokenBalance() {
    balanceInUserAccount = await Common.getTokenBalance(
      clientsInfo.treasureId,
      TOKEN_ID,
    );
  }

  @then(
    /User verify that target token is transferred to the payee account/,
    undefined,
    60000,
  )
  public async verifyTokenBalance() {
    const balanceInUserAccountAfter = await Common.getTokenBalance(
      clientsInfo.treasureId,
      TOKEN_ID,
    );
    const tokenBalanceInUserAccountBefore =
      balanceInUserAccount.plus(proposedAmtFromSafe);
    expect(
      balanceInUserAccountAfter.isGreaterThanOrEqualTo(
        tokenBalanceInUserAccountBefore,
      ),
    );
  }

  @when(/User fetch balance of the target token from safe/, undefined, 60000)
  public async getTokenBalanceFromSafe() {
    gnosisSafe = new HederaGnosisSafe(
      await multiSigDao.getHederaGnosisSafeContractAddress(),
    );
    balanceInSafe = await Common.getTokenBalance(
      await AddressHelper.idToEvmAddress(gnosisSafe.contractId),
      TOKEN_ID,
      clientsInfo.uiUserClient,
    );
  }

  @when(
    /User propose the transaction for transferring (\d+\.?\d*) unit of the token/,
    undefined,
    60000,
  )
  public async proposeTransferTransfer(amount: number) {
    await Common.setTokenAllowance(
      TokenId.fromSolidityAddress(feeConfig.tokenAddress),
      multiSigDao.contractId,
      feeConfig.amountOrId,
      feeConfig.fromAccountId,
      feeConfig.fromAccountKey,
      feeConfig.fromAccountClient,
    );
    txnHash = await multiSigDao.proposeTransferTransaction(
      clientsInfo.treasureId.toSolidityAddress(),
      TOKEN_ID.toSolidityAddress(),
      amount * PRECISION,
    );
  }

  @when(
    /User propose the transaction for transferring token amount greater than safe balance of token/,
    undefined,
    60000,
  )
  public async proposeTransferTransferWithGreaterAmount() {
    await Common.setTokenAllowance(
      TokenId.fromSolidityAddress(feeConfig.tokenAddress),
      multiSigDao.contractId,
      feeConfig.amountOrId,
      feeConfig.fromAccountId,
      feeConfig.fromAccountKey,
      feeConfig.fromAccountClient,
    );
    txnHash = await multiSigDao.proposeTransferTransaction(
      clientsInfo.treasureId.toSolidityAddress(),
      TOKEN_ID.toSolidityAddress(),
      balanceInSafe.plus(PRECISION).toNumber(),
    );
  }

  @when(
    /User propose the transaction for changing the threshold of approvals to (\d+\.?\d*)/,
    undefined,
    60000,
  )
  public async proposeTransactionForChangingApprovalThreshold(
    numberOfApprovals: number,
  ) {
    await Common.setTokenAllowance(
      TokenId.fromSolidityAddress(feeConfig.tokenAddress),
      multiSigDao.contractId,
      feeConfig.amountOrId,
      feeConfig.fromAccountId,
      feeConfig.fromAccountKey,
      feeConfig.fromAccountClient,
    );
    txnHash = await multiSigDao.proposeChangeThreshold(
      numberOfApprovals,
      gnosisSafe,
      clientsInfo.uiUserClient,
    );
  }

  @then(
    /User verify the updated threshold for approvals is (\d+\.?\d*)/,
    undefined,
    60000,
  )
  public async verifyApprovalThreshold(expectedApprovals: number) {
    const actualThreshold = await gnosisSafe.getThreshold(
      clientsInfo.uiUserClient,
    );
    expect(Number(actualThreshold)).to.eql(Number(expectedApprovals));
  }

  @when(
    /User propose the transaction for removing (\d+\.?\d*) owner/,
    undefined,
    60000,
  )
  public async proposeTxnForRemovingOwner(numberOfOwners: number) {
    txnHash = await multiSigDao.proposeRemoveOwnerWithThreshold(
      numberOfOwners,
      AccountId.fromSolidityAddress(listOfOwners[0]),
      AccountId.fromSolidityAddress(listOfOwners[1]),
      gnosisSafe,
      clientsInfo.uiUserClient,
    );
  }

  @when(
    /User propose the transaction for adding (\d+\.?\d*) new owner/,
    undefined,
    60000,
  )
  public async proposeTxnForAddingOwner(numberOfOwners: number) {
    txnHash = await multiSigDao.proposeAddOwnerWithThreshold(
      numberOfOwners,
      AccountId.fromSolidityAddress(clientsInfo.uiUserId.toSolidityAddress()),
      gnosisSafe,
      clientsInfo.uiUserClient,
    );
  }

  @when(/User propose the transaction for swapping owner/, undefined, 60000)
  public async proposeTxnForSwappingOwner() {
    txnHash = await multiSigDao.proposeSwapOwnerWithThreshold(
      AccountId.fromSolidityAddress(listOfOwners[0]),
      AccountId.fromSolidityAddress(listOfOwners[1]),
      AccountId.fromSolidityAddress(clientsInfo.operatorId.toSolidityAddress()),
      gnosisSafe,
      clientsInfo.uiUserClient,
    );
  }

  @then(/User verify new owner is swapped with old/, undefined, 30000)
  public async verifyOwnerIsSwapped() {
    const newListOfOwners = await gnosisSafe.getOwners(
      clientsInfo.uiUserClient,
    );
    expect(newListOfOwners[1]).not.to.eql(listOfOwners[1]);
    expect(newListOfOwners[0]).to.eql(listOfOwners[0]);
  }

  @when(/User get list of owners/, undefined, 60000)
  public async getListOfOwners() {
    listOfOwners = await gnosisSafe.getOwners(clientsInfo.uiUserClient);
  }

  @then(/User verify number of owners are (\d+\.?\d*)/, undefined, 60000)
  public async verifyNumberOfOwners(numberOfOwners: number) {
    const actualNumberOfOwners = await gnosisSafe.getOwners(
      clientsInfo.uiUserClient,
    );
    expect(actualNumberOfOwners.length).to.eql(Number(numberOfOwners));
  }

  @given(/User initializes MultiSigDAOFactory Contract/, undefined, 60000)
  public async initializeMultiSigDaoFactory() {
    console.log(
      "*******************Starting multisigdao factory test with following credentials*******************",
    );
    console.log(
      "MultiSigDaoFactory contract-id :",
      multiSigDAOFactory.contractId,
    );
    const _feeConfig: FeeConfigDetails = {
      receiver: feeConfig.receiver,
      tokenAddress: feeConfig.tokenAddress,
      amountOrId: feeConfig.amountOrId,
    };
    await multiSigDAOFactory.initialize(_feeConfig);
  }

  @when(
    /User setup allowance for dao creation for collecting fee/,
    undefined,
    30000,
  )
  public async setupAllowanceForCollectingDAOCreationFee() {
    await Common.setTokenAllowance(
      TokenId.fromSolidityAddress(feeConfig.tokenAddress),
      multiSigDAOFactory.contractId,
      feeConfig.amountOrId,
      feeConfig.fromAccountId,
      feeConfig.fromAccountKey,
      feeConfig.fromAccountClient,
    );
  }

  @when(
    /User create MultiSigDAO with name "([^"]*)" and logo as "([^"]*)" via factory/,
    undefined,
    30000,
  )
  public async createDAOSafe(name: string, logo: string) {
    const FEE_CONFIG: FeeConfigDetails = {
      receiver: feeConfig.receiver,
      tokenAddress: feeConfig.tokenAddress,
      amountOrId: feeConfig.amountOrId,
    };
    const daoAddress = await multiSigDAOFactory.createDAO(
      name,
      logo,
      DAO_DESC,
      DAO_WEB_LINKS,
      DAO_OWNERS_ADDRESSES,
      DAO_OWNERS_ADDRESSES.length,
      false,
      0,
      FEE_CONFIG,
      DAO_ADMIN_ADDRESS,
      DAO_ADMIN_CLIENT,
    );
    multiSigDao = new MultiSigDao(
      await AddressHelper.addressToIdObject(daoAddress),
    );
    gnosisSafe = new HederaGnosisSafe(
      await multiSigDao.getHederaGnosisSafeContractAddress(),
    );
  }

  @when(
    /User tries to create the multisigdao with name as "([^"]*)" and logo as "([^"]*)"/,
    undefined,
    30000,
  )
  public async createDAOFail(name: string, logo: string) {
    const FEE_CONFIG: FeeConfigDetails = {
      receiver: feeConfig.receiver,
      tokenAddress: feeConfig.tokenAddress,
      amountOrId: feeConfig.amountOrId,
    };
    try {
      await multiSigDAOFactory.createDAO(
        name,
        logo,
        DAO_DESC,
        DAO_WEB_LINKS,
        DAO_OWNERS_ADDRESSES,
        DAO_OWNERS_ADDRESSES.length,
        false,
        0,
        FEE_CONFIG,
        DAO_ADMIN_ADDRESS,
        DAO_ADMIN_CLIENT,
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @when(/User deploy "([^"]*)" contract/, undefined, 60000)
  public async contractDeploy(contractName: string) {
    contractNewAddress = (await deployContract(contractName)).address;
  }

  @when(/User upgrade the DAO logic address/, undefined, 30000)
  public async upgradeDAOLogicAddress() {
    upgradeResult = await multiSigDAOFactory.upgradeDaoLogicAddress(
      contractNewAddress,
      clientsInfo.childProxyAdminClient,
    );
  }

  @then(/User verify contract logic address is updated/, undefined, 30000)
  public async verifyDAOLogicIsUpdated() {
    expect(upgradeResult.newImplementation).not.to.eql(
      upgradeResult.oldImplementation,
    );
    expect(upgradeResult.newImplementation.toString().toUpperCase()).to.eql(
      contractNewAddress.toUpperCase(),
    );
  }

  @then(/User transfer balance from safe to eoa account/, undefined, 30000)
  public async transferBalanceFromSafeToEOA() {
    if (balanceInSafe.isGreaterThan(0)) {
      await Common.transferAssets(
        TOKEN_ID,
        balanceInSafe.toNumber(),
        clientsInfo.treasureId,
        AccountId.fromString(gnosisSafe.contractId),
        clientsInfo.operatorKey,
      );
    }
  }

  @when(/User upgrade the hedera gnosis safe logic address/, undefined, 30000)
  public async upgradeSafeLogicAddress() {
    upgradeResult = await multiSigDAOFactory.upgradeSafeLogicAddress(
      contractNewAddress,
      clientsInfo.childProxyAdminClient,
    );
  }

  @when(
    /User upgrade the hedera gnosis safe proxy factory logic address/,
    undefined,
    30000,
  )
  public async upgradeGnosisSafeProxyFactory() {
    upgradeResult = await multiSigDAOFactory.upgradeSafeFactoryAddress(
      contractNewAddress,
      clientsInfo.childProxyAdminClient,
    );
  }

  @when(
    /User propose the transaction for associating the token/,
    undefined,
    30000,
  )
  public async proposeTokenAssociateTransaction() {
    const FEE_CONFIG: FeeConfigDetails = {
      receiver: feeConfig.receiver,
      tokenAddress: feeConfig.tokenAddress,
      amountOrId: feeConfig.amountOrId,
    };
    txnHash = await multiSigDao.proposeTokenAssociateTransaction(TOKEN_ID);
  }

  @when(/User transfer (\d+\.?\d*) uint of tokens to safe/, undefined, 60000)
  public async transferAmountToSafe(amount: number) {
    await Common.transferAssets(
      TOKEN_ID,
      amount * PRECISION,
      AccountId.fromString(gnosisSafe.contractId),
      clientsInfo.treasureId,
      clientsInfo.treasureKey,
    );
  }
}
