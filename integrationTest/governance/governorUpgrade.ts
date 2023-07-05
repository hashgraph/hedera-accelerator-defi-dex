import dex from "../../deployment/model/dex";
import Common from "../../e2e-test/business/Common";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";
import { InstanceProvider } from "../../utils/InstanceProvider";
import { TokenId, ContractId } from "@hashgraph/sdk";

const GOD_TOKEN_ID = TokenId.fromString(dex.GOD_TOKEN_ID);

async function main() {
  const { id } = await new Deployment().deploy(ContractService.FACTORY);

  const provider = InstanceProvider.getInstance();
  const godHolder = await provider.getGODTokenHolderFromFactory(GOD_TOKEN_ID);
  const governor = provider.getGovernor(ContractService.GOVERNOR_UPGRADE);
  await governor.initialize(godHolder);

  await godHolder.setupAllowanceForTokenLocking();
  await godHolder.lock();

  await governor.setupAllowanceForProposalCreation(
    clientsInfo.operatorClient,
    clientsInfo.operatorId,
    clientsInfo.operatorKey
  );

  const title = Helper.createProposalTitle("Upgrade Proposal");
  const { proposalId } = await governor.createContractUpgradeProposal(
    ContractId.fromString(provider.getFactory().contractId),
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
    await Common.upgradeTo(proxyAddress, logicAddress);
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
