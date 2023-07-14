import dex from "../../deployment/model/dex";
import MultiSigDao from "../business/MultiSigDao";
import HederaGnosisSafe from "../business/HederaGnosisSafe";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import Common from "../business/Common";
import { expect } from "chai";
import { binding, given, then, when } from "cucumber-tsflow";
import { TokenId, AccountId } from "@hashgraph/sdk";
import { Helper } from "../../utils/Helper";
import MultiSigDAOFactory from "../../e2e-test/business/factories/MultiSigDAOFactory";
import { ContractId } from "@hashgraph/sdk";
import { main as deployContract } from "../../deployment/scripts/logic";

const csDev = new ContractService();
const transferTokenId = TokenId.fromString(dex.TOKEN_LAB49_1);

const contract = csDev.getContractWithProxy(ContractService.MULTI_SIG);
const multiSigDAOContractId = contract.transparentProxyId!;
let multiSigDAO: MultiSigDao;
multiSigDAO = new MultiSigDao(ContractId.fromString(multiSigDAOContractId));
const withPrecision = 1e8;
const DAO_OWNERS_INFO = [
  {
    address: clientsInfo.treasureId.toSolidityAddress(),
    client: clientsInfo.treasureClient,
  },
  {
    address: clientsInfo.uiUserId.toSolidityAddress(),
    client: clientsInfo.uiUserClient,
  },
];
const DAO_OWNERS_ADDRESSES = DAO_OWNERS_INFO.map((item: any) => item.address);
const DAO_WEB_LINKS = ["LINKEDIN", "https://linkedin.com"];
const DAO_DESC = "Lorem Ipsum is simply dummy text";

const factoryContractId = new ContractService().getContractWithProxy(
  ContractService.MULTI_SIG_FACTORY
).transparentProxyId!;
const daoFactory = new MultiSigDAOFactory(
  ContractId.fromString(factoryContractId)
);

let gnosisSafe: HederaGnosisSafe;
let txnHash: any;
let targetTokenBalFromPayeeAcct: any;
let targetTokenAmtToBeTransferred: number;
let errorMsg: string;
let targetTokenBalFromPayerAcct: any;
let listOfOwners: string[];
let daoAddress: string;
let contractNewAddress: string;
let upgradeResult: any;

@binding()
export class MultiSigDAOSteps {
  @given(
    /User tries to initialize the multisigdao with name as "([^"]*)" and logo as "([^"]*)"/,
    undefined,
    60000
  )
  public async initializeFail(name: string, logo: string): Promise<void> {
    const daoAdminAddress = clientsInfo.uiUserId.toSolidityAddress();
    console.log(
      "*******************Starting multisigdao test with following credentials*******************"
    );
    console.log("MultiSigContractId :", multiSigDAO.contractId);
    console.log("DAO Admin Address :", daoAdminAddress);
    try {
      await multiSigDAO.initialize(
        daoAdminAddress,
        name,
        logo,
        DAO_DESC,
        DAO_WEB_LINKS,
        DAO_OWNERS_ADDRESSES,
        clientsInfo.uiUserClient,
        DAO_OWNERS_ADDRESSES.length
      );

      const safeContractId =
        await multiSigDAO.getHederaGnosisSafeContractAddress();
      gnosisSafe = new HederaGnosisSafe(safeContractId);
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
    240000
  )
  public async initializeSafe(name: string, logo: string): Promise<void> {
    const daoAdminAddress = clientsInfo.uiUserId.toSolidityAddress();
    await multiSigDAO.initialize(
      daoAdminAddress,
      name,
      logo,
      DAO_DESC,
      DAO_WEB_LINKS,
      DAO_OWNERS_ADDRESSES,
      clientsInfo.uiUserClient,
      DAO_OWNERS_ADDRESSES.length
    );

    const safeContractId =
      await multiSigDAO.getHederaGnosisSafeContractAddress();
    gnosisSafe = new HederaGnosisSafe(safeContractId);
  }

  @when(
    /User setup allowance amount as (\d+\.?\d*) for target token/,
    undefined,
    60000
  )
  public async setAllowance(allowanceAmount: number) {
    await multiSigDAO.setupAllowanceForTransferTransaction(
      transferTokenId,
      allowanceAmount * withPrecision,
      clientsInfo.uiUserClient,
      clientsInfo.uiUserId,
      clientsInfo.uiUserKey,
      gnosisSafe
    );
  }

  @when(
    /User propose the transaction for transferring (\d+\.?\d*) unit of the target token/,
    undefined,
    60000
  )
  public async setTransaction(tokenAmount: number) {
    targetTokenAmtToBeTransferred = tokenAmount * withPrecision;
    txnHash = await multiSigDAO.proposeTransferTransaction(
      transferTokenId,
      clientsInfo.treasureId,
      targetTokenAmtToBeTransferred,
      clientsInfo.uiUserClient
    );
  }

  @when(
    /User propose transaction for transferring (\d+\.?\d*) unit of the target token/,
    undefined,
    60000
  )
  public async setFailTransaction(tokenAmount: number) {
    try {
      targetTokenAmtToBeTransferred = tokenAmount * withPrecision;
      txnHash = await multiSigDAO.proposeTransferTransaction(
        transferTokenId,
        clientsInfo.treasureId,
        targetTokenAmtToBeTransferred,
        clientsInfo.uiUserClient
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @then(/User verify transaction state is "([^"]*)"/, undefined, 60000)
  public async verifyTransactionState(state: string) {
    const expectedState = await multiSigDAO.getTransactionNumericState(state);
    const actualState = await multiSigDAO.state(txnHash);
    expect(Number(actualState)).to.eql(expectedState);
  }

  @when(/User get (\d+\.?\d*) approval from DAO owners/, undefined, 60000)
  public async getApprovalFromOwners(approvalCount: number) {
    if (approvalCount > DAO_OWNERS_INFO.length)
      throw new Error(
        `Approval count can not be greater than number of dao owners : ${DAO_OWNERS_INFO.length}`
      );
    for (let i = 0; i < approvalCount; i++) {
      await gnosisSafe.approveHash(txnHash, DAO_OWNERS_INFO[i].client);
    }
  }

  @when(/User execute the transaction/, undefined, 60000)
  public async executeTransaction() {
    const transferTxnInfo = await multiSigDAO.getTransactionInfo(txnHash);
    await gnosisSafe.executeTransaction(
      transferTxnInfo.to,
      transferTxnInfo.value,
      transferTxnInfo.data,
      transferTxnInfo.operation,
      transferTxnInfo.nonce,
      clientsInfo.treasureClient
    );
  }

  @when(
    /User fetch balance of the target token from payee account/,
    undefined,
    60000
  )
  public async getTokenBalance() {
    targetTokenBalFromPayeeAcct = await Common.getTokenBalance(
      clientsInfo.treasureId,
      transferTokenId,
      clientsInfo.treasureClient
    );
  }

  @then(
    /User verify that target token is transferred to the payee account/,
    undefined,
    60000
  )
  public async verifyTokenBalance() {
    const updatedBalance = await Common.getTokenBalance(
      clientsInfo.treasureId,
      transferTokenId,
      clientsInfo.treasureClient
    );
    expect(Number(updatedBalance)).to.eql(
      Number(targetTokenBalFromPayeeAcct) +
        Number(targetTokenAmtToBeTransferred)
    );
  }

  @when(
    /User fetch balance of the target token from payer account/,
    undefined,
    60000
  )
  public async getTokenBalanceFromPayerAcct() {
    targetTokenBalFromPayerAcct = await Common.getTokenBalance(
      clientsInfo.uiUserId,
      transferTokenId,
      clientsInfo.uiUserClient
    );
  }

  @when(
    /User setup allowance amount greater than balance of target token in payer account/,
    undefined,
    60000
  )
  public async setAllowanceGreaterThanTargetTokenBalInPayerAcct() {
    const allownceAmt = targetTokenBalFromPayerAcct / withPrecision + 1;
    await multiSigDAO.setupAllowanceForTransferTransaction(
      transferTokenId,
      allownceAmt * withPrecision,
      clientsInfo.uiUserClient,
      clientsInfo.uiUserId,
      clientsInfo.uiUserKey,
      gnosisSafe
    );
  }

  @when(
    /User propose the transaction for transferring amount greater than balance of target token in payer account/,
    undefined,
    60000
  )
  public async setTransactionGreaterThanTargetTokenBalance() {
    try {
      targetTokenAmtToBeTransferred =
        targetTokenBalFromPayerAcct / withPrecision + 1;
      txnHash = await multiSigDAO.proposeTransferTransaction(
        transferTokenId,
        clientsInfo.treasureId,
        targetTokenAmtToBeTransferred * withPrecision,
        clientsInfo.uiUserClient
      );
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @when(
    /User propose the transaction for changing the threshold of approvals to (\d+\.?\d*)/,
    undefined,
    60000
  )
  public async proposeTransactionForChangingApprovalThreshold(
    numberOfApprovals: number
  ) {
    txnHash = await multiSigDAO.proposeChangeThreshold(
      numberOfApprovals,
      gnosisSafe,
      clientsInfo.uiUserClient
    );
  }

  @then(
    /User verify the updated threshold for approvals is (\d+\.?\d*)/,
    undefined,
    60000
  )
  public async verifyApprovalThreshold(expectedApprovals: number) {
    const actualThreshold = await gnosisSafe.getThreshold(
      clientsInfo.uiUserClient
    );
    expect(Number(actualThreshold)).to.eql(Number(expectedApprovals));
  }

  @when(
    /User propose the transaction for removing (\d+\.?\d*) owner/,
    undefined,
    60000
  )
  public async proposeTxnForRemovingOwner(numberOfOwners: number) {
    txnHash = await multiSigDAO.proposeRemoveOwnerWithThreshold(
      numberOfOwners,
      AccountId.fromSolidityAddress(listOfOwners[0]),
      AccountId.fromSolidityAddress(listOfOwners[1]),
      gnosisSafe,
      clientsInfo.uiUserClient
    );
  }

  @when(
    /User propose the transaction for adding (\d+\.?\d*) new owner/,
    undefined,
    60000
  )
  public async proposeTxnForAddingOwner(numberOfOwners: number) {
    txnHash = await multiSigDAO.proposeAddOwnerWithThreshold(
      numberOfOwners,
      AccountId.fromSolidityAddress(clientsInfo.uiUserId.toSolidityAddress()),
      gnosisSafe,
      clientsInfo.uiUserClient
    );
  }

  @when(/User propose the transaction for swapping owner/, undefined, 60000)
  public async proposeTxnForSwappingOwner() {
    txnHash = await multiSigDAO.proposeSwapOwnerWithThreshold(
      AccountId.fromSolidityAddress(listOfOwners[0]),
      AccountId.fromSolidityAddress(listOfOwners[1]),
      AccountId.fromSolidityAddress(clientsInfo.operatorId.toSolidityAddress()),
      gnosisSafe,
      clientsInfo.uiUserClient
    );
  }

  @then(/User verify new owner is swapped with old/, undefined, 30000)
  public async verifyOwnerIsSwapped() {
    const newListOfOwners = await gnosisSafe.getOwners(
      clientsInfo.uiUserClient
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
      clientsInfo.uiUserClient
    );
    expect(actualNumberOfOwners.length).to.eql(Number(numberOfOwners));
  }

  @given(/User initializes MultiSigDAOFactory Contract/, undefined, 30000)
  public async initializeMultiSigDaoFactory() {
    console.log(
      "*******************Starting multisigdao factory test with following credentials*******************"
    );
    console.log("MultiSigDAOFactoryContractId :", daoFactory.contractId);
    await daoFactory.initialize();
  }

  @when(
    /User create MultiSigDAO with name "([^"]*)" and logo as "([^"]*)" via factory/,
    undefined,
    30000
  )
  public async createDAOSafe(name: string, logo: string) {
    daoAddress = await daoFactory.createDAO(
      name,
      logo,
      DAO_DESC,
      DAO_WEB_LINKS,
      DAO_OWNERS_ADDRESSES,
      DAO_OWNERS_ADDRESSES.length,
      false,
      clientsInfo.uiUserId.toSolidityAddress(),
      clientsInfo.uiUserClient
    );

    const multiSigDAOId = ContractId.fromSolidityAddress(daoAddress);
    multiSigDAO = new MultiSigDao(multiSigDAOId);
    const safeContractId =
      await multiSigDAO.getHederaGnosisSafeContractAddress();
    gnosisSafe = new HederaGnosisSafe(safeContractId);
  }

  @when(
    /User tries to create the multisigdao with name as "([^"]*)" and logo as "([^"]*)"/,
    undefined,
    30000
  )
  public async createDAOFail(name: string, logo: string) {
    try {
      daoAddress = await daoFactory.createDAO(
        name,
        logo,
        DAO_DESC,
        DAO_WEB_LINKS,
        DAO_OWNERS_ADDRESSES,
        DAO_OWNERS_ADDRESSES.length,
        false,
        clientsInfo.uiUserId.toSolidityAddress(),
        clientsInfo.uiUserClient
      );

      const multiSigDAOId = ContractId.fromSolidityAddress(daoAddress);
      multiSigDAO = new MultiSigDao(multiSigDAOId);
      const safeContractId =
        await multiSigDAO.getHederaGnosisSafeContractAddress();
      gnosisSafe = new HederaGnosisSafe(safeContractId);
    } catch (e: any) {
      errorMsg = e.message;
    }
  }

  @when(/User deploy "([^"]*)" contract/, undefined, 30000)
  public async contractDeploy(contractName: string) {
    contractNewAddress = (await deployContract(contractName)).address;
  }

  @when(/User upgrade the DAO logic address/, undefined, 30000)
  public async upgradeDAOLogicAddress() {
    upgradeResult = await daoFactory.upgradeDaoLogicAddress(
      contractNewAddress,
      clientsInfo.childProxyAdminClient
    );
  }

  @then(/User verify contract logic address is updated/, undefined, 30000)
  public async verifyDAOLogicIsUpdated() {
    expect(upgradeResult.newImplementation).not.to.eql(
      upgradeResult.oldImplementation
    );
    expect(upgradeResult.newImplementation.toString().toUpperCase()).to.eql(
      contractNewAddress.toUpperCase()
    );
  }

  @when(/User upgrade the hedera gnosis safe logic address/, undefined, 30000)
  public async upgradeSafeLogicAddress() {
    upgradeResult = await daoFactory.upgradeSafeLogicAddress(
      contractNewAddress,
      clientsInfo.childProxyAdminClient
    );
  }

  @when(
    /User upgrade the hedera gnosis safe proxy factory logic address/,
    undefined,
    30000
  )
  public async upgradeGnosisSafeProxyFactory() {
    upgradeResult = await daoFactory.upgradeSafeFactoryAddress(
      contractNewAddress,
      clientsInfo.childProxyAdminClient
    );
  }
}
