import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";
import Factory from "../../e2e-test/business/Factory";
import GodHolder from "../../e2e-test/business/GodHolder";

import { Helper } from "../../utils/Helper";
import { TokenId } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";
import { clientsInfo } from "../../utils/ClientManagement";
import TokenCreateGovernor from "../../e2e-test/business/TokenCreateGovernor";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

let factory: Factory;
let governor: TokenCreateGovernor;
let godHolder: GodHolder;

async function main() {
  factory = new Factory();
  governor = new TokenCreateGovernor();

  const godHolderFactory = new FTTokenHolderFactory(); //GOD token factory
  const godHolderContractId = await godHolderFactory.getTokenHolder(
    GOD_TOKEN_ID.toSolidityAddress()
  );
  godHolder = new GodHolder(godHolderContractId);

  await governor.initialize(godHolder);
  const token1 = await createTokenViaProposal("TEST-A", "TEST-A");
  const token2 = await createTokenViaProposal("TEST-B", "TEST-B");
  await governor.upgradeHederaService();

  await runFactoryTest(token1, token2);
  console.log(`Done`);
}

async function createTokenViaProposal(name: string, symbol: string) {
  let tokenId: TokenId | null = null;

  await godHolder.setupAllowanceForTokenLocking(50001e8);
  await godHolder.lock(50001e8, clientsInfo.uiUserClient);

  await governor.setupAllowanceForProposalCreation(
    clientsInfo.operatorClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey
  );

  const title = Helper.createProposalTitle("Create Token Proposal");
  const proposalId = await governor.createTokenProposal(
    title,
    name,
    symbol,
    clientsInfo.treasureId,
    clientsInfo.operatorClient
  );

  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId, 0, clientsInfo.uiUserClient);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(
      title,
      clientsInfo.treasureKey,
      clientsInfo.operatorClient,
      governor.TXN_FEE_FOR_TOKEN_CREATE
    );
    tokenId = await governor.getTokenAddressFromGovernorTokenCreate(proposalId);
  } else {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }
  await godHolder.checkAndClaimGodTokens(
    clientsInfo.uiUserClient,
    clientsInfo.uiUserId
  );
  if (!tokenId) {
    throw Error("failed to created token inside integration test");
  }
  await governor.mintToken(
    proposalId,
    new BigNumber(10),
    clientsInfo.treasureClient
  );
  await governor.burnToken(
    proposalId,
    new BigNumber(9),
    clientsInfo.treasureClient
  );
  await Common.associateTokensToAccount(
    clientsInfo.treasureId,
    [tokenId!],
    clientsInfo.treasureClient
  );
  await governor.transferToken(
    proposalId,
    clientsInfo.treasureId.toSolidityAddress(),
    new BigNumber(1),
    clientsInfo.treasureClient
  );
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
