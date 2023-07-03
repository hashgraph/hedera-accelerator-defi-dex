import dex from "../../deployment/model/dex";
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
const TOKEN_QTY = 1;

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

const DAO_ADMIN_ADDRESS = clientsInfo.dexOwnerId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.dexOwnerClient;

async function main() {
  const contract = csDev.getContractWithProxy(ContractService.MULTI_SIG);
  const multiSigDAO = new MultiSigDao(contract.transparentProxyId!);
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
  safeTxnExecutionClient: Client = clientsInfo.dexOwnerClient
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
}

async function getGnosisSafeInstance(multiSigDAO: MultiSigDao) {
  const safeContractId = await multiSigDAO.getHederaGnosisSafeContractAddress();
  return new HederaGnosisSafe(safeContractId.toString());
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}
