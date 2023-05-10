import dex from "../../deployment/model/dex";
import MultiSigDao from "../business/MultiSigDao";
import HederaGnosisSafe from "../business/HederaGnosisSafe";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import Common from "../business/Common";
import { expect } from "chai";
import { binding, given, then, when } from "cucumber-tsflow";
import { TokenId, AccountId } from "@hashgraph/sdk";
import { ethers } from "hardhat";
import { Helper } from "../../utils/Helper";

const csDev = new ContractService();
const transferTokenId = TokenId.fromString(dex.TOKEN_LAB49_1);

const contract = csDev.getContractWithProxy(ContractService.MULTI_SIG);
const multiSigDAOContractId = contract.transparentProxyId!;
const multiSigDAO = new MultiSigDao(multiSigDAOContractId);
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

let gnosisSafe: HederaGnosisSafe;
let txnHash: any;
let targetTokenBalFromPayeeAcct: any;
let targetTokenAmtToBeTransferred: number;
let errorMsg: string;
let targetTokenBalFromPayerAcct: any;
let approvalThreshold: number;
let listOfOwners: string[];
enum ABIs {
  "function changeThreshold(uint256 _threshold)",
}

@binding()
export class MultiSigDAOSteps {
  @given(
    /User tries to initialize the multisigdao with name as "([^"]*)" and logo as "([^"]*)"/,
    undefined,
    60000
  )
  public async initializeFail(name: string, logo: string): Promise<void> {
    const daoOwnerAddress = clientsInfo.dexOwnerId.toSolidityAddress();
    console.log(
      "*******************Starting multisigdao test with following credentials*******************"
    );
    console.log("MultiSigContractId :", multiSigDAO.contractId);
    console.log("DAO Owner Address :", daoOwnerAddress);
    try {
      await multiSigDAO.initialize(
        daoOwnerAddress,
        name,
        logo,
        DAO_OWNERS_ADDRESSES,
        clientsInfo.uiUserClient,
        DAO_OWNERS_ADDRESSES.length
      );

      const safeContractId =
        await multiSigDAO.getHederaGnosisSafeContractAddress();
      gnosisSafe = new HederaGnosisSafe(safeContractId.toString());
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
    const daoOwnerAddress = clientsInfo.dexOwnerId.toSolidityAddress();
    await multiSigDAO.initialize(
      daoOwnerAddress,
      name,
      logo,
      DAO_OWNERS_ADDRESSES,
      clientsInfo.uiUserClient,
      DAO_OWNERS_ADDRESSES.length
    );

    const safeContractId =
      await multiSigDAO.getHederaGnosisSafeContractAddress();
    gnosisSafe = new HederaGnosisSafe(safeContractId.toString());
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
      clientsInfo.dexOwnerClient
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
    await Helper.delay(15000);
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
}
