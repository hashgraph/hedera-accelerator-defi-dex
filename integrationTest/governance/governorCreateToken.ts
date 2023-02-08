import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import Factory from "../../e2e-test/business/Factory";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";

import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

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

  const title = "Create Token Proposal - 101";
  const proposalId = await governor.createTokenProposal(
    title,
    "TEST-A",
    "TEST-A1",
    clientsInfo.treasureId,
    clientsInfo.treasureKey.publicKey,
    clientsInfo.treasureId,
    clientsInfo.treasureKey.publicKey
  );

  const title1 = "Create Token Proposal - 201";
  const proposalId1 = await governor.createTokenProposal(
    title1,
    "TEST-B",
    "TEST-B1",
    clientsInfo.treasureId,
    clientsInfo.treasureKey.publicKey,
    clientsInfo.treasureId,
    clientsInfo.treasureKey.publicKey
  );

  await governor.forVote(proposalId, clientsInfo.treasureClient);
  await Common.transferTokens(
    clientsInfo.operatorId,
    clientsInfo.treasureId,
    clientsInfo.treasureKey,
    dex.GOD_DEV_TOKEN_ID,
    1000 * 1e8
  );
  await governor.forVote(proposalId, clientsInfo.operatorClient);

  await governor.forVote(proposalId1, clientsInfo.treasureClient);
  await governor.forVote(proposalId1, clientsInfo.operatorClient);

  await governor.proposalVotes(proposalId);
  await governor.proposalVotes(proposalId1);

  await governor.isQuorumReached(proposalId);
  await governor.isQuorumReached(proposalId1);

  await governor.isVoteSucceeded(proposalId);
  await governor.isVoteSucceeded(proposalId1);

  await governor.state(proposalId);
  await governor.state(proposalId1);

  await governor.delay(25 * 1000);

  await governor.state(proposalId);
  await governor.state(proposalId1);

  await governor.executeProposal(title, clientsInfo.treasureKey);
  await governor.executeProposal(title1, clientsInfo.treasureKey);

  await godHolder.checkAndClaimedGodTokens(clientsInfo.treasureClient);
  await godHolder.checkAndClaimedGodTokens(clientsInfo.operatorClient);

  const token1 = await governor.getTokenAddressFromGovernorTokenCreate(
    proposalId
  );
  const token2 = await governor.getTokenAddressFromGovernorTokenCreate(
    proposalId1
  );

  await factory.setupFactory();
  await factory.createPair(
    token1,
    token2,
    clientsInfo.operatorId,
    clientsInfo.treasureKey
  );
  await factory.getPair(token1, token2);
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
