import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { TokenId, ContractId } from "@hashgraph/sdk";
import ContractUpgradeGovernor from "../../e2e-test/business/ContractUpgradeGovernor";
import FTTokenHolderFactory from "../../e2e-test/business/factories/FTTokenHolderFactory";
import GodHolder from "../../e2e-test/business/GodHolder";
import Factory from "../../e2e-test/business/Factory";

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

async function main() {
  const { id } = await new Deployment().deploy(ContractService.FACTORY);

  const governor = new ContractUpgradeGovernor();
  const godHolderFactory = new FTTokenHolderFactory();
  const godHolderContractId = await godHolderFactory.getTokenHolder(
    GOD_TOKEN_ID.toSolidityAddress()
  );
  const godHolder = new GodHolder(godHolderContractId);

  await governor.initialize(godHolder);

  await godHolder.setupAllowanceForTokenLocking(50001e8);
  await godHolder.lock(50001e8, clientsInfo.uiUserClient);

  await governor.setupAllowanceForProposalCreation(
    clientsInfo.operatorClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey
  );

  const title = Helper.createProposalTitle("Upgrade Proposal");
  const { proposalId } = await governor.createContractUpgradeProposal(
    ContractId.fromString(new Factory().contractId),
    ContractId.fromString(id),
    title,
    clientsInfo.operatorClient
  );

  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId, 0, clientsInfo.uiUserClient);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  if (await governor.isSucceeded(proposalId)) {
    await governor.executeProposal(title);
    const { proxyAddress, logicAddress } =
      await governor.getContractAddressesFromGovernorUpgradeContract(
        proposalId
      );
    await new Common(ContractId.fromSolidityAddress(proxyAddress)).upgradeTo(
      proxyAddress,
      logicAddress
    );
  } else {
    await governor.cancelProposal(title, clientsInfo.operatorClient);
  }
  await godHolder.checkAndClaimGodTokens(
    clientsInfo.uiUserClient,
    clientsInfo.uiUserId
  );
  await governor.upgradeHederaService();
}

main()
  .then(() => process.exit(0))
  .catch(Helper.processError);
