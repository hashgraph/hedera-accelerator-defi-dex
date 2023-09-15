import dex from "../../deployment/model/dex";
import Factory from "../../e2e-test/business/Factory";
import GodHolder from "../../e2e-test/business/GodHolder";
import TokenCreateGovernor from "../../e2e-test/business/TokenCreateGovernor";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { ContractId, TokenId } from "@hashgraph/sdk";
import {
  lockTokenForVotingIfNeeded,
  createAndExecuteTokenCreateProposal,
} from "./governance";

const FT_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

async function runFactoryTest(token1: TokenId, token2: TokenId) {
  const factory = new Factory();
  await factory.setupFactory();
  await factory.getPairs();
  await factory.createPair(
    token1,
    token2,
    clientsInfo.operatorId,
    clientsInfo.treasureKey,
  );
  await factory.getPair(token1, token2);
  await factory.getPairs();
}

async function main() {
  const voterAccountId = clientsInfo.treasureId;
  const voterAccountKey = clientsInfo.treasureKey;
  const voterClient = clientsInfo.treasureClient;

  const ftHolderFactory = new FTTokenHolderFactory();
  await ftHolderFactory.initialize();

  const ftHolderContractId = await ftHolderFactory.getTokenHolder(
    FT_TOKEN_ID.toSolidityAddress(),
  );
  const tokenHolder = new GodHolder(ftHolderContractId);

  const deploymentDetails = await new Deployment().deployProxy(
    ContractService.GOVERNOR_TOKEN_CREATE,
  );
  const governor = new TokenCreateGovernor(
    ContractId.fromString(deploymentDetails.transparentProxyId),
  );
  await governor.initialize(
    tokenHolder,
    clientsInfo.operatorClient,
    1,
    0,
    20,
    FT_TOKEN_ID,
    FT_TOKEN_ID,
  );

  // step - 0 lock required tokens to token holder
  await lockTokenForVotingIfNeeded(
    governor,
    tokenHolder,
    clientsInfo.operatorClient,
    voterAccountId,
    voterAccountKey,
    voterClient,
    0,
  );

  // step - 1 token a created
  const token1 = await createAndExecuteTokenCreateProposal(
    "TEST-A",
    "TEST-A",
    governor,
    tokenHolder,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    governor.TXN_FEE_FOR_TOKEN_CREATE,
  );

  // step - 2 token b created
  const token2 = await createAndExecuteTokenCreateProposal(
    "TEST-B",
    "TEST-B",
    governor,
    tokenHolder,
    clientsInfo.treasureClient,
    clientsInfo.treasureId,
    clientsInfo.treasureClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    governor.TXN_FEE_FOR_TOKEN_CREATE,
  );

  // step - 3 unlock required tokens from token holder
  await tokenHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
  await governor.upgradeHederaService();

  // step - 4 pair test
  await runFactoryTest(token1, token2);
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
