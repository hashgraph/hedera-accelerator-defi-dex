import { Helper } from "../../utils/Helper";
import { ContractId } from "@hashgraph/sdk";
import { executeGovernorTokenDAOFlow } from "../../integrationTest/governanceDAOFactory";

import GovernanceDAOFactory from "../../e2e-test/business/GovernanceDAOFactory";

async function main() {
  const input = Helper.readWorkflowInputs();
  if (!input) {
    throw Error("- Failed to read workflow inputs");
  }

  // below calls are validating input data only
  const contractId = ContractId.fromString(input.contractId);
  ContractId.fromSolidityAddress(input.daoAddress);

  const daoFactory = new GovernanceDAOFactory(contractId.toString());
  await executeGovernorTokenDAOFlow(daoFactory, [input.daoAddress]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
