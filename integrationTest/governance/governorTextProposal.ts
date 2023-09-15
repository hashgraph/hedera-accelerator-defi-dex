import dex from "../../deployment/model/dex";
import GodHolder from "../../e2e-test/business/GodHolder";
import TextGovernor from "../../e2e-test/business/TextGovernor";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { ContractId, TokenId } from "@hashgraph/sdk";
import {
  lockTokenForVotingIfNeeded,
  createAndExecuteTextProposal,
} from "./governance";

const deployment = new Deployment();

const FT_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

const txnFeePayerClient = clientsInfo.operatorClient;

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

  const deploymentDetails = await deployment.deployProxy(
    ContractService.GOVERNOR_TEXT,
  );
  const governor = new TextGovernor(
    ContractId.fromString(deploymentDetails.transparentProxyId),
  );
  await governor.initialize(
    tokenHolder,
    txnFeePayerClient,
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
    txnFeePayerClient,
    voterAccountId,
    voterAccountKey,
    voterClient,
    0,
  );

  // step - 1 text proposal flow
  await createAndExecuteTextProposal(
    governor,
    tokenHolder,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0,
  );

  // step - 3 unlock required tokens from token holder
  await tokenHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
  await governor.upgradeHederaService();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
