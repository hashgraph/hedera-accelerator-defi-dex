import dex from "../../deployment/model/dex";
import GodHolder from "../../e2e-test/business/GodHolder";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import ContractUpgradeGovernor from "../../e2e-test/business/ContractUpgradeGovernor";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractId, TokenId } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";

import {
  lockTokenForVotingIfNeeded,
  createAndExecuteContractUpgradeProposal,
} from "./governance";

const FT_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

async function main() {
  const voterAccountId = clientsInfo.treasureId;
  const voterAccountKey = clientsInfo.treasureKey;
  const voterClient = clientsInfo.treasureClient;

  const ftTokenHolderFactory = new FTTokenHolderFactory();
  const ftHolderContractId = await ftTokenHolderFactory.getTokenHolder(
    FT_TOKEN_ID.toSolidityAddress()
  );
  const tokenHolder = new GodHolder(ftHolderContractId);

  const deploymentDetails = await new Deployment().deployProxy(
    ContractService.GOVERNOR_UPGRADE
  );

  const governor = new ContractUpgradeGovernor(
    ContractId.fromString(deploymentDetails.transparentProxyId)
  );
  await governor.initialize(
    tokenHolder,
    clientsInfo.operatorClient,
    1,
    0,
    20,
    FT_TOKEN_ID,
    FT_TOKEN_ID
  );

  // step - 0 lock required tokens to token holder
  await lockTokenForVotingIfNeeded(
    governor,
    tokenHolder,
    clientsInfo.operatorClient,
    voterAccountId,
    voterAccountKey,
    voterClient,
    0
  );

  // step - 1 contract upgrade proposal
  const contractToUpgradeInfo = new ContractService().getContract(
    ContractService.MULTI_SIG
  );
  await createAndExecuteContractUpgradeProposal(
    contractToUpgradeInfo.transparentProxyAddress!,
    contractToUpgradeInfo.address,
    governor,
    tokenHolder,
    voterClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey,
    clientsInfo.operatorClient,
    0
  );

  // step - 3 unlock required tokens from token holder
  await tokenHolder.checkAndClaimGodTokens(voterClient, voterAccountId);
  await governor.upgradeHederaService();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
