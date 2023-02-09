import Governor from "../../e2e-test/business/Governor";
import GodHolder from "../../e2e-test/business/GodHolder";
import { ContractService } from "../../deployment/service/ContractService";
import { ContractId } from "@hashgraph/sdk";
import Common from "../../e2e-test/business/Common";

const csDev = new ContractService();
const godHolderContract = csDev.getContractWithProxy(csDev.godHolderContract);
const governorUpgradeContract = csDev.getContractWithProxy(
  csDev.governorUpgradeContract
);

const factoryLogicId = csDev.getContract(csDev.factoryContractName).id!;
const factoryProxyId = csDev.getContractWithProxy(csDev.factoryContractName)
  .transparentProxyId!;

const governor = new Governor(governorUpgradeContract.transparentProxyId!);
const godHolder = new GodHolder(godHolderContract.transparentProxyId!);

async function main() {
  const title = "Upgrade Proposal - 2"; // title should be unique for each proposal
  await governor.initialize(godHolder);
  const { proposalId } = await governor.createContractUpgradeProposal(
    ContractId.fromString(factoryProxyId),
    ContractId.fromString(factoryLogicId),
    title
  );
  await governor.getProposalDetails(proposalId);
  await governor.forVote(proposalId);
  await governor.isQuorumReached(proposalId);
  await governor.isVoteSucceeded(proposalId);
  await governor.proposalVotes(proposalId);
  await governor.delay(proposalId);
  await governor.executeProposal(title);
  const { proxyAddress, logicAddress } =
    await governor.getContractAddressesFromGovernorUpgradeContract(proposalId);
  await Common.upgradeTo(proxyAddress, logicAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
