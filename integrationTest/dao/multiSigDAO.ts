import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import MultiSigDao from "../../e2e-test/business/MultiSigDao";
import HederaGnosisSafe from "../../e2e-test/business/HederaGnosisSafe";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import {
  Client,
  TokenId,
  AccountId,
  ContractId,
  PrivateKey,
} from "@hashgraph/sdk";

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

const DAO_ADMIN_ADDRESS = clientsInfo.uiUserId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.uiUserClient;

export const DAO_OWNERS_INFO = [
  {
    address: DAO_ADMIN_ADDRESS,
    client: DAO_ADMIN_CLIENT,
  },
  {
    address: clientsInfo.treasureId.toSolidityAddress(),
    client: clientsInfo.treasureClient,
  },
];

export const DAO_NAME = dex.MULTI_SIG_DAO_ONE;
export const DAO_LOGO = "https://defi-ui.hedera.com/";
export const DAO_WEB_LINKS = ["https://linkedin.com"];
export const DAO_DESC = "Lorem Ipsum is simply dummy text";
export const DAO_OWNERS_ADDRESSES = DAO_OWNERS_INFO.map(
  (item: any) => item.address
);

async function main() {
  const multiSigDAO = new MultiSigDao();
  await initDAO(multiSigDAO);

  await executeBatchTransaction(multiSigDAO);

  await executeDAOTokenTransferProposal(multiSigDAO);

  await executeDAOTextProposal(multiSigDAO);

  await multiSigDAO.updateDaoInfo(
    DAO_NAME + "_NEW",
    DAO_LOGO + "daos",
    DAO_DESC + "and updated",
    [...DAO_WEB_LINKS, "https://github.com"],
    DAO_ADMIN_CLIENT
  );
  await multiSigDAO.getDaoInfo();

  const roleBasedAccess = new SystemRoleBasedAccess();
  (await roleBasedAccess.checkIfChildProxyAdminRoleGiven()) &&
    (await multiSigDAO.upgradeHederaService(clientsInfo.childProxyAdminClient));
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

export async function executeDAOTokenTransferProposal(
  multiSigDAO: MultiSigDao,
  ownersInfo: any[] = DAO_OWNERS_INFO,
  token: TokenId = TOKEN,
  tokenQty: number = TOKEN_QTY,
  tokenReceiver: AccountId | ContractId = clientsInfo.treasureId,
  tokenReceiverPrivateKey: PrivateKey = clientsInfo.treasureKey,
  tokenReceiverClient: Client = clientsInfo.treasureClient,
  tokenSenderClient: Client = clientsInfo.uiUserClient,
  tokenSenderAccountId: AccountId = clientsInfo.uiUserId,
  tokenSenderPrivateKey: PrivateKey = clientsInfo.uiUserKey,
  safeTxnExecutionClient: Client = clientsInfo.treasureClient
) {
  console.log(
    `- executing token transfer Multi-sig DAO = ${multiSigDAO.contractId}\n`
  );

  // Step - 1 token associate
  const gnosisSafe = await getGnosisSafeInstance(multiSigDAO);
  const tokenAssociateTxnHash =
    await multiSigDAO.proposeTokenAssociateTransaction(token);
  const tokenAssociateTxnInfo = await multiSigDAO.getTransactionInfo(
    tokenAssociateTxnHash
  );
  for (const daoOwner of ownersInfo) {
    await gnosisSafe.approveHash(tokenAssociateTxnHash, daoOwner.client);
  }

  await gnosisSafe.executeTransaction(
    tokenAssociateTxnInfo.to,
    tokenAssociateTxnInfo.value,
    tokenAssociateTxnInfo.data,
    tokenAssociateTxnInfo.operation,
    tokenAssociateTxnInfo.nonce,
    safeTxnExecutionClient
  );

  // Step - 2 token transfer from wallet
  await Common.transferTokens(
    AccountId.fromString(gnosisSafe.contractId),
    tokenSenderAccountId,
    tokenSenderPrivateKey,
    token,
    tokenQty
  );

  // Step - 3 associate token to other account
  await Common.associateTokensToAccount(
    tokenReceiver.toString(),
    [token],
    tokenReceiverClient,
    tokenReceiverPrivateKey
  );

  // Step - 4 token transfer from safe to other account
  const transferTxnHash = await multiSigDAO.proposeTransferTransaction(
    token,
    tokenReceiver,
    tokenQty,
    gnosisSafe,
    tokenSenderClient
  );
  const transferTxnInfo = await multiSigDAO.getTransactionInfo(transferTxnHash);
  for (const daoOwner of ownersInfo) {
    await gnosisSafe.approveHash(transferTxnHash, daoOwner.client);
  }
  await gnosisSafe.executeTransaction(
    transferTxnInfo.to,
    transferTxnInfo.value,
    transferTxnInfo.data,
    transferTxnInfo.operation,
    transferTxnInfo.nonce,
    safeTxnExecutionClient
  );
}

export async function executeBatchTransaction(
  multiSigDAO: MultiSigDao,
  ownersInfo: any[] = DAO_OWNERS_INFO,
  safeTxnExecutionClient: Client = clientsInfo.treasureClient
) {
  console.log(
    `- executing batch operation using Multi-sig DAO = ${multiSigDAO.contractId}\n`
  );

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

  const multiSend = await multiSigDAO.getMultiSendContractAddressFromDAO();
  const gnosisSafe = await getGnosisSafeInstance(multiSigDAO);

  const batchTxnHash = await proposeBatchTransaction(multiSigDAO);

  await multiSigDAO.getApprovalCounts(batchTxnHash);
  const batchTxnInfo = await multiSigDAO.getTransactionInfo(batchTxnHash);
  for (const daoOwner of ownersInfo) {
    await gnosisSafe.approveHash(batchTxnHash, daoOwner.client);
    await multiSigDAO.getApprovalCounts(batchTxnHash);
  }

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

export async function executeDAOTextProposal(
  multiSigDAO: MultiSigDao,
  ownersInfo: any[] = DAO_OWNERS_INFO,
  safeTxnExecutionClient: Client = clientsInfo.treasureClient
) {
  console.log(
    `- executing text proposal using Multi-sig DAO  = ${multiSigDAO.contractId}\n`
  );

  const gnosisSafe = await getGnosisSafeInstance(multiSigDAO);
  const textTxnHash = await multiSigDAO.proposeTextTransaction(
    Helper.createProposalTitle("MultiSig Text Proposal"),
    clientsInfo.operatorId,
    clientsInfo.operatorClient
  );

  const textTxnInfo = await multiSigDAO.getTransactionInfo(textTxnHash);

  await multiSigDAO.state(textTxnHash);

  await gnosisSafe.getOwners();

  for (const daoOwner of ownersInfo) {
    await gnosisSafe.approveHash(textTxnHash, daoOwner.client);
  }

  await multiSigDAO.state(textTxnHash);

  await gnosisSafe.executeTransaction(
    textTxnInfo.to,
    textTxnInfo.value,
    textTxnInfo.data,
    textTxnInfo.operation,
    textTxnInfo.nonce,
    safeTxnExecutionClient
  );

  await multiSigDAO.state(textTxnHash);
}

async function getGnosisSafeInstance(multiSigDAO: MultiSigDao) {
  const safeContractId = await multiSigDAO.getHederaGnosisSafeContractAddress();
  return new HederaGnosisSafe(safeContractId);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
