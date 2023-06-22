import dex from "../../deployment/model/dex";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";
import { Deployment } from "../../utils/deployContractOnTestnet";
const deployment = new Deployment();

const TOKEN_ID = TokenId.fromString(dex.TOKEN_LAB49_1);
const TOKEN_QTY = 1e8;

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

const fungibleTokenFlow = async () => {
  const deploymentDetails = await deployment.deployProxy(
    ContractService.GOVERNOR_TT
  );
  const provider = InstanceProvider.getInstance();
  const godHolder = await provider.getGODTokenHolderFromFactory(GOD_TOKEN_ID);
  const governor = provider.getGovernor(
    ContractService.GOVERNOR_TT,
    deploymentDetails.proxyId
  );
  await governor.initialize(godHolder);

  await godHolder.setupAllowanceForTokenLocking();
  await godHolder.lock();

  await governor.setupAllowanceForProposalCreation(
    clientsInfo.operatorClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey
  );

  const title = Helper.createProposalTitle("Token Transfer Proposal");
  const proposalId = await governor.createTokenTransferProposal(
    title,
    clientsInfo.treasureId.toSolidityAddress(),
    clientsInfo.operatorId.toSolidityAddress(),
    TOKEN_ID.toSolidityAddress(),
    TOKEN_QTY,
    clientsInfo.operatorClient
  );
  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId, 0, clientsInfo.uiUserClient);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  if (await governor.isSucceeded(proposalId)) {
    await governor.setAllowanceForTransferTokenProposal(
      TOKEN_ID,
      TOKEN_QTY,
      governor.contractId,
      clientsInfo.treasureId,
      clientsInfo.treasureKey
    );
    await governor.executeProposal(title, clientsInfo.treasureKey);
  } else {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }
  await godHolder.checkAndClaimGodTokens(
    clientsInfo.uiUserClient,
    clientsInfo.uiUserId
  );
  await governor.upgradeHederaService();
};

const nonFungibleTokenFlow = async () => {
  const deploymentDetails = await deployment.deployProxy(
    ContractService.GOVERNOR_TT
  );
  const provider = InstanceProvider.getInstance();
  const nftHolder = provider.getNonFungibleTokenHolder();
  const governor = provider.getGovernor(
    ContractService.GOVERNOR_TT,
    deploymentDetails.proxyId
  );
  await governor.initialize(
    nftHolder,
    clientsInfo.operatorClient,
    500,
    0,
    30,
    TokenId.fromString(dex.NFT_TOKEN_ID),
    TokenId.fromString(dex.NFT_TOKEN_ID)
  );

  await nftHolder.setupAllowanceForTokenLocking();
  await nftHolder.grabTokensForVoter(
    20,
    clientsInfo.uiUserId,
    clientsInfo.uiUserKey,
    clientsInfo.uiUserClient
  );

  await governor.setupNFTAllowanceForProposalCreation(
    clientsInfo.operatorClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey
  );

  const title = Helper.createProposalTitle("Token Transfer Proposal");
  const proposalId = await governor.createTokenTransferProposal(
    title,
    clientsInfo.treasureId.toSolidityAddress(),
    clientsInfo.operatorId.toSolidityAddress(),
    TOKEN_ID.toSolidityAddress(),
    TOKEN_QTY,
    clientsInfo.operatorClient,
    18
  );
  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId, 0, clientsInfo.uiUserClient);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  if (await governor.isSucceeded(proposalId)) {
    await governor.setAllowanceForTransferTokenProposal(
      TOKEN_ID,
      TOKEN_QTY,
      governor.contractId,
      clientsInfo.treasureId,
      clientsInfo.treasureKey
    );
    await governor.executeProposal(title, clientsInfo.treasureKey);
  } else {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }
  await nftHolder.checkAndClaimGodTokens(
    clientsInfo.uiUserClient,
    clientsInfo.uiUserId
  );
  await governor.upgradeHederaService();
};

async function main() {
  console.log("************************ FT Test ******************");
  await fungibleTokenFlow();
  console.log(`\n************************ NFT Test ******************\n`);
  await nonFungibleTokenFlow();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
