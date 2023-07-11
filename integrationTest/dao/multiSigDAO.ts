import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import MultiSigDao from "../../e2e-test/business/MultiSigDao";
import HederaGnosisSafe from "../../e2e-test/business/HederaGnosisSafe";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import {
  Client,
  TokenId,
  AccountId,
  ContractId,
  PrivateKey,
} from "@hashgraph/sdk";

const csDev = new ContractService();

const TOKEN = TokenId.fromString(dex.TOKEN_LAB49_1);
const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const TOKEN_QTY = 1;
const TXN_DETAILS_FOR_BATCH = {
  TOKEN: GOD_TOKEN_ID,
  FROM_CLIENT: clientsInfo.operatorClient,
  FROM_ID: clientsInfo.operatorId,
  FROM_KEY: clientsInfo.operatorKey,
  TO_CLIENT: clientsInfo.uiUserClient,
  TO_ID: clientsInfo.uiUserId,
  TO_KEY: clientsInfo.uiUserKey,
  AMOUNT: 1,
};

export const DAO_OWNERS_INFO = [
  {
    address: clientsInfo.treasureId.toSolidityAddress(),
    client: clientsInfo.treasureClient,
  },
  {
    address: clientsInfo.uiUserId.toSolidityAddress(),
    client: clientsInfo.uiUserClient,
  },
];

export const DAO_NAME = dex.MULTI_SIG_DAO_ONE;
export const DAO_LOGO = "https://defi-ui.hedera.com/";
export const DAO_WEB_LINKS = ["https://linkedin.com"];
export const DAO_DESC = "Lorem Ipsum is simply dummy text";
export const DAO_OWNERS_ADDRESSES = DAO_OWNERS_INFO.map(
  (item: any) => item.address
);

const DAO_ADMIN_ADDRESS = clientsInfo.uiUserId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.uiUserClient;

async function main() {
  const contract = csDev.getContractWithProxy(ContractService.MULTI_SIG);
  const multiSigDAO = new MultiSigDao(
    ContractId.fromString(contract.transparentProxyId!)
  );
  await initDAO(multiSigDAO);
  await executeDAO(multiSigDAO);

  await multiSigDAO.updateDaoInfo(
    DAO_NAME + "_NEW",
    DAO_LOGO + "daos",
    DAO_DESC + "and updated",
    [...DAO_WEB_LINKS, "https://github.com"],
    DAO_ADMIN_CLIENT
  );
  await multiSigDAO.getDaoInfo();
  await multiSigDAO.upgradeHederaService(clientsInfo.uiUserClient);
}

async function initDAO(dao: MultiSigDao) {
  await dao.initialize(
    DAO_ADMIN_ADDRESS,
    DAO_NAME,
    DAO_LOGO,
    DAO_DESC,
    DAO_WEB_LINKS,
    DAO_OWNERS_ADDRESSES,
    clientsInfo.uiUserClient,
    DAO_OWNERS_ADDRESSES.length
  );
}

export async function executeDAO(
  multiSigDAO: MultiSigDao,
  ownersInfo: any[] = DAO_OWNERS_INFO,
  token: TokenId = TOKEN,
  tokenQty: number = TOKEN_QTY,
  tokenReceiver: AccountId | ContractId = clientsInfo.treasureId,
  tokenSenderClient: Client = clientsInfo.uiUserClient,
  tokenSenderAccountId: AccountId = clientsInfo.uiUserId,
  tokenSenderPrivateKey: PrivateKey = clientsInfo.uiUserKey,
  safeTxnExecutionClient: Client = clientsInfo.treasureClient
) {
  console.log(`- executing Multi-sig DAO = ${multiSigDAO.contractId}\n`);

  const gnosisSafe = await getGnosisSafeInstance(multiSigDAO);

  await multiSigDAO.setupAllowanceForTransferTransaction(
    token,
    tokenQty,
    tokenSenderClient,
    tokenSenderAccountId,
    tokenSenderPrivateKey,
    gnosisSafe
  );
  const transferTxnHash = await multiSigDAO.proposeTransferTransaction(
    token,
    tokenReceiver,
    tokenQty,
    tokenSenderClient
  );
  const transferTxnInfo = await multiSigDAO.getTransactionInfo(transferTxnHash);

  await multiSigDAO.state(transferTxnHash);

  await gnosisSafe.getOwners();

  for (const daoOwner of ownersInfo) {
    await gnosisSafe.approveHash(transferTxnHash, daoOwner.client);
  }
  await multiSigDAO.state(transferTxnHash);

  await gnosisSafe.executeTransaction(
    transferTxnInfo.to,
    transferTxnInfo.value,
    transferTxnInfo.data,
    transferTxnInfo.operation,
    transferTxnInfo.nonce,
    safeTxnExecutionClient
  );
  await multiSigDAO.state(transferTxnHash);

  // TXN-2 batch
  const batchTxnHash = await proposeBatchTransaction(multiSigDAO);
  await multiSigDAO.getApprovalCounts(batchTxnHash);
  const batchTxnInfo = await multiSigDAO.getTransactionInfo(batchTxnHash);
  for (const daoOwner of ownersInfo) {
    await gnosisSafe.approveHash(batchTxnHash, daoOwner.client);
    await multiSigDAO.getApprovalCounts(batchTxnHash);
  }
  const multiSend = await multiSigDAO.getMultiSendContractAddressFromDAO();
  await Common.setTokenAllowance(
    TXN_DETAILS_FOR_BATCH.TOKEN,
    multiSend.toString(),
    TXN_DETAILS_FOR_BATCH.AMOUNT,
    TXN_DETAILS_FOR_BATCH.FROM_ID,
    TXN_DETAILS_FOR_BATCH.FROM_KEY,
    TXN_DETAILS_FOR_BATCH.FROM_CLIENT
  );
  await gnosisSafe.executeTransaction(
    batchTxnInfo.to,
    batchTxnInfo.value,
    batchTxnInfo.data,
    batchTxnInfo.operation,
    batchTxnInfo.nonce,
    safeTxnExecutionClient
  );
}

async function getGnosisSafeInstance(multiSigDAO: MultiSigDao) {
  const safeContractId = await multiSigDAO.getHederaGnosisSafeContractAddress();
  return new HederaGnosisSafe(safeContractId);
}

async function proposeBatchTransaction(multiSigDAO: MultiSigDao) {
  const targets = [
    ContractId.fromString(TOKEN.toString()),
    ContractId.fromString(TXN_DETAILS_FOR_BATCH.TOKEN.toString()),
  ];

  const callDataArray = [
    await multiSigDAO.encodeFunctionData("IERC20", "totalSupply", []),
    await multiSigDAO.encodeFunctionData("IERC20", "transferFrom", [
      TXN_DETAILS_FOR_BATCH.FROM_ID.toSolidityAddress(),
      TXN_DETAILS_FOR_BATCH.TO_ID.toSolidityAddress(),
      TXN_DETAILS_FOR_BATCH.AMOUNT,
    ]),
  ].map((data: any) => data.bytes);
  return await multiSigDAO.proposeBatchTransaction(
    [0, 0], // 0 HBars
    targets, // contract address
    callDataArray // contract call data
  );
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
