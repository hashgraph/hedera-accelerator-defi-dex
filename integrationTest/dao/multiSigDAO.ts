import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import MultiSigDao from "../../e2e-test/business/MultiSigDao";
import HederaGnosisSafe from "../../e2e-test/business/HederaGnosisSafe";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";

import { ethers } from "ethers";
import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { AddressHelper } from "../../utils/AddressHelper";
import {
  Hbar,
  Client,
  TokenId,
  HbarUnit,
  AccountId,
  ContractId,
  PrivateKey,
} from "@hashgraph/sdk";
import { DEFAULT_FEE_CONFIG } from "../../e2e-test/business/constants";

const TOKEN = TokenId.fromString(dex.TOKEN_LAB49_1);
const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);
const TOKEN_QTY = 1;
const HBAR_AMOUNT = Hbar.from(1, HbarUnit.Hbar);
const TXN_DETAILS_FOR_BATCH = {
  TOKEN: GOD_TOKEN_ID,
  FROM_CLIENT: clientsInfo.treasureClient,
  FROM_ID: clientsInfo.treasureId,
  FROM_KEY: clientsInfo.treasureKey,
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
export const DAO_LOGO = "https://defi-ui.zilbo.com/";
export const INFO_URL = "";
export const DAO_WEB_LINKS = ["https://linkedin.com"];
export const DAO_DESC = "Lorem Ipsum is simply dummy text";
export const DAO_OWNERS_ADDRESSES = DAO_OWNERS_INFO.map(
  (item: any) => item.address,
);

async function main() {
  const multiSigDAO = new MultiSigDao();
  await initDAO(multiSigDAO);
  await executeHbarTransfer(multiSigDAO);
  await executeDAOTextProposal(multiSigDAO);
  await executeBatchTransaction(multiSigDAO);
  await executeDAOUpgradeProposal(multiSigDAO);
  await executeFTTokenTransferProposal(multiSigDAO);
  await executeNFTTokenTransferProposal(multiSigDAO);
  await multiSigDAO.updateDaoInfo(
    DAO_NAME + "_NEW",
    DAO_LOGO + "daos",
    INFO_URL,
    DAO_DESC + "and updated",
    [...DAO_WEB_LINKS, "https://github.com"],
    DAO_ADMIN_CLIENT,
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
    DEFAULT_FEE_CONFIG,
    clientsInfo.uiUserClient,
    DAO_OWNERS_ADDRESSES.length,
  );
}

export async function executeNFTTokenTransferProposal(
  multiSigDAO: MultiSigDao,
  ownersInfo: any[] = DAO_OWNERS_INFO,
  nftToken: TokenId = dex.NFT_TOKEN_ID,
  nftTokenSerialId: number = 9,
  tokenReceiver: AccountId = clientsInfo.operatorId,
  tokenReceiverPrivateKey: PrivateKey = clientsInfo.operatorKey,
  tokenReceiverClient: Client = clientsInfo.operatorClient,
  tokenSenderAccountId: AccountId = clientsInfo.operatorId,
  tokenSenderPrivateKey: PrivateKey = clientsInfo.operatorKey,
  tokenSenderClient: Client = clientsInfo.operatorClient,
  safeTxnExecutionClient: Client = clientsInfo.treasureClient,
) {
  console.log(
    `- executing nft token transfer Multi-sig DAO = ${multiSigDAO.contractId}\n`,
  );

  // Step - 1 setup allowance for proposal
  const { proposalFee, hBarPayable, tokenAddress } =
    await multiSigDAO.feeConfig();

  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(tokenAddress),
    multiSigDAO.contractId,
    proposalFee,
    tokenSenderAccountId,
    tokenSenderPrivateKey,
    tokenSenderClient,
  );

  // Step - 2 associate nft token to contract
  const gnosisSafe = await getGnosisSafeInstance(multiSigDAO);
  const tokenAssociateTxnHash =
    await multiSigDAO.proposeTokenAssociateTransaction(
      nftToken,
      tokenSenderClient,
      hBarPayable,
    );
  const tokenAssociateTxnInfo = await multiSigDAO.getTransactionInfo(
    tokenAssociateTxnHash,
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
    safeTxnExecutionClient,
  );

  // Step - 3 transfer nft token from wallet to safe
  await Common.transferAssets(
    nftToken,
    nftTokenSerialId,
    gnosisSafe.contractId,
    tokenSenderAccountId,
    tokenSenderPrivateKey,
    safeTxnExecutionClient,
  );

  // Step - 4 associate nft token to receiver account
  await Common.associateTokensToAccount(
    tokenReceiver.toString(),
    [nftToken],
    tokenReceiverClient,
    tokenReceiverPrivateKey,
  );

  // Step - 5 setup allowance for proposal
  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(tokenAddress),
    multiSigDAO.contractId,
    proposalFee,
    tokenSenderAccountId,
    tokenSenderPrivateKey,
    safeTxnExecutionClient,
  );

  // Step - 6 transfer nft token from safe to receiver account
  const transferTxnHash = await multiSigDAO.proposeTransferTransaction(
    tokenReceiver.toSolidityAddress(),
    nftToken.toSolidityAddress(),
    nftTokenSerialId,
    safeTxnExecutionClient,
    hBarPayable,
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
    safeTxnExecutionClient,
  );
}

export async function executeFTTokenTransferProposal(
  multiSigDAO: MultiSigDao,
  ownersInfo: any[] = DAO_OWNERS_INFO,
  ftToken: TokenId = TOKEN,
  ftTokenAmount: number = TOKEN_QTY,
  tokenReceiver: AccountId = clientsInfo.treasureId,
  tokenReceiverPrivateKey: PrivateKey = clientsInfo.treasureKey,
  tokenReceiverClient: Client = clientsInfo.treasureClient,
  tokenSenderAccountId: AccountId = clientsInfo.treasureId,
  tokenSenderPrivateKey: PrivateKey = clientsInfo.treasureKey,
  safeTxnExecutionClient: Client = clientsInfo.treasureClient,
) {
  console.log(
    `- executing token transfer Multi-sig DAO = ${multiSigDAO.contractId}\n`,
  );

  // Step - 1 Setup Allowance for Proposal
  const { proposalFee, hBarPayable, tokenAddress } =
    await multiSigDAO.feeConfig();
  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(tokenAddress),
    multiSigDAO.contractId,
    proposalFee,
    tokenSenderAccountId,
    tokenSenderPrivateKey,
    safeTxnExecutionClient,
  );

  // Step - 2 associate ft token to safe
  const gnosisSafe = await getGnosisSafeInstance(multiSigDAO);
  const tokenAssociateTxnHash =
    await multiSigDAO.proposeTokenAssociateTransaction(
      ftToken,
      safeTxnExecutionClient,
      hBarPayable,
    );
  const tokenAssociateTxnInfo = await multiSigDAO.getTransactionInfo(
    tokenAssociateTxnHash,
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
    safeTxnExecutionClient,
  );

  // Step - 3 transfer ft token from wallet to safe
  await Common.transferAssets(
    ftToken,
    ftTokenAmount,
    gnosisSafe.contractId,
    tokenSenderAccountId,
    tokenSenderPrivateKey,
  );

  // Step - 4 associate ft token to receiver account
  await Common.associateTokensToAccount(
    tokenReceiver.toString(),
    [ftToken],
    tokenReceiverClient,
    tokenReceiverPrivateKey,
  );

  // Step - 5 Set up allowance for proposal
  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(tokenAddress),
    multiSigDAO.contractId,
    proposalFee,
    tokenSenderAccountId,
    tokenSenderPrivateKey,
    safeTxnExecutionClient,
  );

  // Step - 6 transfer ft token from safe to receiver account
  const transferTxnHash = await multiSigDAO.proposeTransferTransaction(
    tokenReceiver.toSolidityAddress(),
    ftToken.toSolidityAddress(),
    ftTokenAmount,
    safeTxnExecutionClient,
    hBarPayable,
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
    safeTxnExecutionClient,
  );
}

export async function executeBatchTransaction(
  multiSigDAO: MultiSigDao,
  ownersInfo: any[] = DAO_OWNERS_INFO,
  fromAccountId: AccountId = clientsInfo.treasureId,
  fromPrivateKey: PrivateKey = clientsInfo.treasureKey,
  safeTxnExecutionClient: Client = clientsInfo.treasureClient,
) {
  console.log(
    `- executing batch operation using Multi-sig DAO = ${multiSigDAO.contractId}\n`,
  );

  const { proposalFee, hBarPayable, tokenAddress } =
    await multiSigDAO.feeConfig();
  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(tokenAddress),
    multiSigDAO.contractId,
    proposalFee,
    fromAccountId,
    fromPrivateKey,
    safeTxnExecutionClient,
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
      callDataArray, // contract call data
      safeTxnExecutionClient,
      hBarPayable,
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

  await Common.associateTokensToAccount(
    TXN_DETAILS_FOR_BATCH.TO_ID,
    [TXN_DETAILS_FOR_BATCH.TOKEN],
    TXN_DETAILS_FOR_BATCH.TO_CLIENT,
    TXN_DETAILS_FOR_BATCH.TO_KEY,
  );
  await Common.setTokenAllowance(
    TXN_DETAILS_FOR_BATCH.TOKEN,
    multiSend.toString(),
    TXN_DETAILS_FOR_BATCH.AMOUNT,
    TXN_DETAILS_FOR_BATCH.FROM_ID,
    TXN_DETAILS_FOR_BATCH.FROM_KEY,
    TXN_DETAILS_FOR_BATCH.FROM_CLIENT,
  );

  await gnosisSafe.executeTransaction(
    batchTxnInfo.to,
    batchTxnInfo.value,
    batchTxnInfo.data,
    batchTxnInfo.operation,
    batchTxnInfo.nonce,
    safeTxnExecutionClient,
  );
}

export async function executeHbarTransfer(
  multiSigDAO: MultiSigDao,
  ownersInfo: any[] = DAO_OWNERS_INFO,
  hBarAmount: Hbar = HBAR_AMOUNT,
  toAccountId: AccountId | ContractId = clientsInfo.treasureId,
  fromAccountId: AccountId = clientsInfo.treasureId,
  fromPrivateKey: PrivateKey = clientsInfo.treasureKey,
  safeTxnExecutionClient: Client = clientsInfo.treasureClient,
) {
  console.log(`- executing Multi-sig DAO = ${multiSigDAO.contractId}\n`);

  // step 1 - Set up Allowance to create the Proposal
  const { proposalFee, hBarPayable, tokenAddress } =
    await multiSigDAO.feeConfig();
  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(tokenAddress),
    multiSigDAO.contractId,
    proposalFee,
    fromAccountId,
    fromPrivateKey,
    safeTxnExecutionClient,
  );

  // step 2 - create HBAR Proposal
  const gnosisSafe = await getGnosisSafeInstance(multiSigDAO);
  const hBarTransferTxnHash = await multiSigDAO.proposeTransferTransaction(
    toAccountId.toSolidityAddress(),
    ethers.constants.AddressZero,
    hBarAmount.to(HbarUnit.Tinybar),
    safeTxnExecutionClient,
    hBarPayable,
  );
  const transferTxnInfo =
    await multiSigDAO.getTransactionInfo(hBarTransferTxnHash);
  for (const daoOwner of ownersInfo) {
    await gnosisSafe.approveHash(hBarTransferTxnHash, daoOwner.client);
  }
  // step 2 - transfer hBar from sender account to safe
  await Common.transferAssets(
    dex.ZERO_TOKEN_ID,
    hBarAmount.to(HbarUnit.Tinybar).toNumber(),
    gnosisSafe.contractId,
    fromAccountId,
    fromPrivateKey,
    safeTxnExecutionClient,
  );
  // step 3 - transfer hBar from safe to receiver
  await gnosisSafe.executeTransaction(
    transferTxnInfo.to,
    transferTxnInfo.value,
    transferTxnInfo.data,
    transferTxnInfo.operation,
    transferTxnInfo.nonce,
    safeTxnExecutionClient,
  );
}

export async function executeDAOUpgradeProposal(
  multiSigDAO: MultiSigDao,
  ownersInfo: any[] = DAO_OWNERS_INFO,
  fromAccountId: AccountId = clientsInfo.treasureId,
  fromPrivateKey: PrivateKey = clientsInfo.treasureKey,
  safeTxnExecutionClient: Client = clientsInfo.treasureClient,
) {
  console.log(
    `- executing Multi-sig DAO upgrade contract flow = ${multiSigDAO.contractId}\n`,
  );
  const { proposalFee, hBarPayable, tokenAddress } =
    await multiSigDAO.feeConfig();
  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(tokenAddress),
    multiSigDAO.contractId,
    proposalFee,
    fromAccountId,
    fromPrivateKey,
    safeTxnExecutionClient,
  );
  const gnosisSafe = await getGnosisSafeInstance(multiSigDAO);
  const safeEvmAddress = await AddressHelper.idToEvmAddress(
    gnosisSafe.contractId,
  );

  const proxyId = ContractId.fromString(multiSigDAO.contractId);
  const proxyLogic = await new Common(proxyId).getCurrentImplementation();
  const proxyAddress = await AddressHelper.idToEvmAddress(proxyId.toString());

  const updateTxnHash = await multiSigDAO.proposeUpgradeProxyTransaction(
    proxyAddress,
    proxyLogic,
    safeTxnExecutionClient,
    hBarPayable,
  );
  const updateTxnInfo = await multiSigDAO.getTransactionInfo(updateTxnHash);
  for (const daoOwner of ownersInfo) {
    await gnosisSafe.approveHash(updateTxnHash, daoOwner.client);
  }

  // step-1 setting safe as new admin
  await new Common(proxyId).changeAdmin(
    safeEvmAddress,
    clientsInfo.proxyAdminKey,
    clientsInfo.proxyAdminClient,
  );
  // step-2 running safe txn with 2 operation internally
  // a - upgradeTo
  // b - changeAdmin (back to proxyAdmin)
  await gnosisSafe.executeTransaction(
    updateTxnInfo.to,
    updateTxnInfo.value,
    updateTxnInfo.data,
    updateTxnInfo.operation,
    updateTxnInfo.nonce,
    safeTxnExecutionClient,
  );
}

export async function executeDAOTextProposal(
  multiSigDAO: MultiSigDao,
  ownersInfo: any[] = DAO_OWNERS_INFO,
  creatorAccountId: AccountId = clientsInfo.treasureId,
  creatorPrivateKey: PrivateKey = clientsInfo.treasureKey,
  creatorAccountClient: Client = clientsInfo.treasureClient,
  safeTxnExecutionClient: Client = clientsInfo.treasureClient,
) {
  console.log(
    `- executing text proposal using Multi-sig DAO  = ${multiSigDAO.contractId}\n`,
  );

  const { proposalFee, hBarPayable, tokenAddress } =
    await multiSigDAO.feeConfig();
  await Common.setTokenAllowance(
    TokenId.fromSolidityAddress(tokenAddress),
    multiSigDAO.contractId,
    proposalFee,
    creatorAccountId,
    creatorPrivateKey,
    creatorAccountClient,
  );

  const gnosisSafe = await getGnosisSafeInstance(multiSigDAO);
  const textTxnHash = await multiSigDAO.proposeTextTransaction(
    Helper.createProposalTitle("MultiSig Text Proposal"),
    creatorAccountId,
    creatorAccountClient,
    hBarPayable,
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
    safeTxnExecutionClient,
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
