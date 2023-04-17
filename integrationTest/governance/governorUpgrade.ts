import Common from "../../e2e-test/business/Common";
import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";

import { Helper } from "../../utils/Helper";
import { Deployment } from "../../utils/deployContractOnTestnet";
import { ContractId } from "@hashgraph/sdk";
import { clientsInfo } from "../../utils/ClientManagement";
import { ContractService } from "../../deployment/service/ContractService";

const csDev = new ContractService();
const deployment = new Deployment();

const godHolderContract = csDev.getContractWithProxy(csDev.godHolderContract);
const governorUpgradeContract = csDev.getContractWithProxy(
  csDev.governorUpgradeContract
);
const factoryProxyId = csDev.getContractWithProxy(csDev.factoryContractName)
  .transparentProxyId!;

const governor = new Governor(governorUpgradeContract.transparentProxyId!);
const godHolder = new GodHolder(godHolderContract.transparentProxyId!);

async function main() {
  const { id } = await deployment.deploy(csDev.factoryContractName);

  await governor.initialize(godHolder);
  await godHolder.lock();

  const title = Helper.createProposalTitle("Upgrade Proposal");
  const { proposalId } = await governor.createContractUpgradeProposal(
    ContractId.fromString(factoryProxyId),
    ContractId.fromString(id),
    title
  );

  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId, clientsInfo.uiUserClient);
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
