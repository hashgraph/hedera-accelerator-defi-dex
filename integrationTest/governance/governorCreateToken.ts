import Factory from "../../e2e-test/business/Factory";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import { BigNumber } from "bignumber.js";

import { Helper } from "../../utils/Helper";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { TokenId } from "@hashgraph/sdk";

const csDev = new ContractService();
const factoryContractId = csDev.getContractWithProxy(csDev.factoryContractName)
  .transparentProxyId!;

const tokenCreateContractId = csDev.getContractWithProxy(
  csDev.governorContractName
).transparentProxyId!;

const godHolderContractId = csDev.getContractWithProxy(csDev.godHolderContract)
  .transparentProxyId!;

const factory = new Factory(factoryContractId);
const governor = new Governor(tokenCreateContractId);
const godHolder = new GodHolder(godHolderContractId);

async function main() {
  await governor.initialize(godHolder);
  const token1 = await createTokenViaProposal("TEST-A", "TEST-A");
  //const token2 = await createTokenViaProposal("TEST-B", "TEST-B");
  //await runFactoryTest(token1, token2);
  console.log(`Done`);
}

async function createTokenViaProposal(name: string, symbol: string) {
  let tokenId: TokenId | null = null;

  await godHolder.setupAllowanceForTokenLocking();
  await godHolder.lock();

  await governor.setupAllowanceForProposalCreation(
    clientsInfo.operatorClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey
  );

  const title = Helper.createProposalTitle("Create Token Proposal");
  //const title = "Create Token Proposal 0x2579e405dc393dcfffbb3cab60322596cb60dc77";
  const proposalId = await governor.createTokenProposal(
    title,
    name,
    symbol,
    clientsInfo.treasureId,
    clientsInfo.treasureKey.publicKey,
    clientsInfo.treasureId,
    clientsInfo.treasureKey.publicKey,
    clientsInfo.operatorClient
  );

  //const proposalId = "60582987365490624733715688346112975058902830155639671619887774238854816511204";
  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId, 0, clientsInfo.uiUserClient);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title, clientsInfo.treasureKey);
    tokenId = await governor.getTokenAddressFromGovernorTokenCreate(proposalId);
  } else {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }
  // await governor.cancelProposal(title, clientsInfo.operatorClient);
  await godHolder.checkAndClaimGodTokens(
    clientsInfo.uiUserClient,
    clientsInfo.uiUserId
  );
  if (!tokenId) {
    throw Error("failed to created token inside integration test");
  }
  await governor.mintToken(proposalId, new BigNumber(10));
  await governor.burnToken(proposalId, new BigNumber(10));
  return tokenId;
}

async function runFactoryTest(token1: TokenId, token2: TokenId) {
  await factory.setupFactory();
  await factory.createPair(
    token1,
    token2,
    clientsInfo.operatorId,
    clientsInfo.treasureKey
  );
  await factory.getPair(token1, token2);
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
