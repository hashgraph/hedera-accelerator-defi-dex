import dex from "../../deployment/model/dex";
import NFTHolder from "../../e2e-test/business/NFTHolder";
import FTDAO from "../../e2e-test/business/FTDAO";
import * as GovernorTokenMetaData from "../../e2e-test/business/FTDAO";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import {
  AccountId,
  Client,
  ContractId,
  PrivateKey,
  TokenId,
} from "@hashgraph/sdk";
import TokenTransferGovernor from "../../e2e-test/business/TokenTransferGovernor";
import NFTTokenHolderFactory from "../../e2e-test/business/factories/NFTTokenHolderFactory";
import SystemRoleBasedAccess from "../../e2e-test/business/common/SystemRoleBasedAccess";
import Common from "../../e2e-test/business/Common";

const TOKEN_QTY = 1 * 1e8;
const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const adminAddress: string = clientsInfo.operatorId.toSolidityAddress();
const DAO_ADMIN_CLIENT = clientsInfo.operatorClient;
const DAO_DESC = "Lorem Ipsum is simply dummy text";
const DAO_WEB_LINKS = ["https://linkedin.com"];

const deployment = new Deployment();

async function main() {
  const newCopies = await deployment.deployProxies([ContractService.FT_DAO]);

  const transferDao = newCopies.get(ContractService.FT_DAO);

  const tokenTransferDAO = new FTDAO(ContractId.fromString(transferDao.id));

  const roleBasedAccess = new SystemRoleBasedAccess();

  const tokenHolderFactory = new NFTTokenHolderFactory();

  const nftHolderContractId = await tokenHolderFactory.getTokenHolder(
    GovernorTokenMetaData.NFT_TOKEN_ID.toSolidityAddress(),
  );
  const nftHolder = new NFTHolder(nftHolderContractId);

  await tokenTransferDAO.initialize(
    adminAddress,
    "Governor Token Dao",
    "dao url",
    DAO_DESC,
    DAO_WEB_LINKS,
    nftHolder,
    clientsInfo.operatorClient,
    1,
    0,
    30,
    GovernorTokenMetaData.NFT_TOKEN_ID,
    GovernorTokenMetaData.NFT_TOKEN_ID,
  );

  await executeGovernorTokenTransferFlow(nftHolder, tokenTransferDAO);

  DAO_WEB_LINKS.push("https://github.com");
  await tokenTransferDAO.updateDaoInfo(
    "Governor Token Dao - New",
    "dao url - New",
    "desc - New",
    DAO_WEB_LINKS,
    DAO_ADMIN_CLIENT,
  );
  const hasRole = await roleBasedAccess.checkIfChildProxyAdminRoleGiven();
  hasRole &&
    (await tokenTransferDAO.upgradeHederaService(
      clientsInfo.childProxyAdminClient,
    ));
  console.log(`\nDone`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(Helper.processError);
}

export async function executeGovernorTokenTransferFlow(
  nftHolder: NFTHolder,
  tokenTransferDAO: FTDAO,
  transferTokenId: TokenId = TOKEN_ID,
  transferTokenAmount: number = TOKEN_QTY,
  receiverAccountId: AccountId = clientsInfo.uiUserId,
  receiverAccountPK: PrivateKey = clientsInfo.uiUserKey,
  senderAccountId: AccountId = clientsInfo.treasureId,
  senderAccountPK: PrivateKey = clientsInfo.treasureKey,
  daoAdminClient: Client = clientsInfo.operatorClient,
  daoAdminId: AccountId = clientsInfo.operatorId,
  daoAdminPK: PrivateKey = clientsInfo.operatorKey,
  voterClient: Client = clientsInfo.operatorClient,
  voterAccountId: AccountId = clientsInfo.operatorId,
  voterAccountKey: PrivateKey = clientsInfo.operatorKey,
  txnFeePayerClient: Client = clientsInfo.operatorClient,
) {
  const governorAddresses =
    await tokenTransferDAO.getGovernorTokenTransferContractAddresses();

  const governor = new TokenTransferGovernor(
    governorAddresses.governorTokenTransferProxyId,
  );

  const quorum = await governor.quorum(txnFeePayerClient);
  const votingPowerAmount = await nftHolder.balanceOfVoter(
    voterAccountId,
    txnFeePayerClient,
  );

  if (votingPowerAmount < quorum) {
    await nftHolder.setupAllowanceForTokenLocking(
      voterAccountId,
      voterAccountKey,
      voterClient,
    );
    await nftHolder.grabTokensForVoter(
      governor.DEFAULT_NFT_TOKEN_SERIAL_NO_FOR_VOTING,
      voterClient,
    );
  }

  // step -1 association proposal
  await governor.setupNFTAllowanceForProposalCreation(
    daoAdminClient,
    daoAdminId,
    daoAdminPK,
  );

  const title = Helper.createProposalTitle("Token Associate Proposal");
  const proposalId = await tokenTransferDAO.createTokenAssociateProposal(
    title,
    transferTokenId.toSolidityAddress(),
    daoAdminClient,
    "DAO Token Association Proposal - Desc",
    "DAO Token Association Proposal - LINK",
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
  );

  await governor.getProposalDetails(proposalId, voterClient);
  await governor.forVote(proposalId, 0, voterClient);
  await governor.getProposalDetails(proposalId, voterClient);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title);
  } else {
    await governor.cancelProposal(title, daoAdminClient);
  }

  // step -2 transfer proposal
  await governor.setupNFTAllowanceForProposalCreation(
    daoAdminClient,
    daoAdminId,
    daoAdminPK,
  );

  const title1 = Helper.createProposalTitle("Token Transfer Proposal");
  const proposalId1 = await tokenTransferDAO.createTokenTransferProposal(
    title1,
    receiverAccountId.toSolidityAddress(),
    transferTokenId.toSolidityAddress(),
    transferTokenAmount,
    daoAdminClient,
    "DAO Token Transfer Proposal - Desc",
    "DAO Token Transfer Proposal - Link",
    governor.DEFAULT_NFT_TOKEN_SERIAL_NO,
  );
  await governor.getProposalDetails(proposalId1, voterClient);
  await governor.forVote(proposalId1, 0, voterClient);
  await governor.getProposalDetails(proposalId1, voterClient);
  if (await governor.isSucceeded(proposalId1)) {
    // step - 1 transfer some amount to governance
    await Common.transferAssets(
      transferTokenId,
      transferTokenAmount,
      governor.contractId,
      senderAccountId,
      senderAccountPK,
      txnFeePayerClient,
    );

    // step - 2 associate token to receiver
    await Common.associateTokensToAccount(
      receiverAccountId,
      [transferTokenId],
      txnFeePayerClient,
      receiverAccountPK,
    );
    await governor.executeProposal(title1);
  } else {
    await governor.cancelProposal(title1, daoAdminClient);
  }

  await nftHolder.checkAndClaimNFTTokens(voterClient, voterAccountId);
  await tokenTransferDAO.getTokenTransferProposals();
}
