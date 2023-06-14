import { Helper } from "../../utils/Helper";
import { ContractId } from "@hashgraph/sdk";
import { executeTokenTransferDAOFlow } from "../../integrationTest/governanceDAOFactory";

import TokenTransferDAOFactory from "../../e2e-test/business/TokenTransferDAOFactory";

async function main() {
  const input = Helper.readWorkflowInputs();

  // below calls are validating input data only
  const contractId = ContractId.fromString(input.contractId);
  ContractId.fromSolidityAddress(input.daoAddress);

  const daoFactory = new TokenTransferDAOFactory(contractId.toString());
  await executeTokenTransferDAOFlow(daoFactory, [input.daoAddress]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
