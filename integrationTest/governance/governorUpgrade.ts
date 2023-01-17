import { ContractId } from "@hashgraph/sdk";

import GovernorMethods from "./GovernorMethods";
import { ContractService } from "../../deployment/service/ContractService";
import { Helper } from "../../utils/Helper";

const contractService = new ContractService();
const governor = new GovernorMethods();

const contractId = contractService.getContractWithProxy(
  contractService.governorUpgradeContract
).transparentProxyId!;

const upgradeContractId = ContractId.fromString(
  contractService.getContract(contractService.factoryContractName).id!
);

const transparentContractId = ContractId.fromString(
  contractService.getContractWithProxy(contractService.factoryContractName)
    .transparentProxyId!
);

async function main() {
  console.log(`\nUsing governor proxy contract id ${contractId}`);
  await governor.initialize(contractId);
  const title = "Upgrade Proposal - 2"; // title should be unique for each proposal
  const { proposalId, success: status } =
    await governor.createContractUpgradeProposal(
      ContractId.fromString(contractId),
      transparentContractId,
      upgradeContractId,
      title,
      "description",
      "link"
    );
  console.log(`Proposal tx status ${status} with proposal id ${proposalId}`);
  await governor.getProposalDetails(proposalId, contractId);
  await governor.vote(proposalId, 1, contractId); // 1 is for vote.
  await governor.quorumReached(proposalId, contractId);
  await governor.voteSucceeded(proposalId, contractId);
  await governor.proposalVotes(proposalId, contractId);
  await governor.state(proposalId, contractId);
  console.log(`\nWaiting for voting period to get over.`);
  await Helper.delay(15 * 1000); // Wait till waiting period is over. It's current deadline as per Governance.
  await governor.state(proposalId, contractId); // 4 means succeeded
  await governor.execute(title, contractId);
  const { proxyAddress, logicAddress } = await governor.getContractAddresses(
    contractId.toString(),
    proposalId
  );
  await governor.upgradeTo(proxyAddress, logicAddress);
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
