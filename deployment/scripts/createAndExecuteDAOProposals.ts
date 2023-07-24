import { Helper } from "../../utils/Helper";
import { TokenId, ContractId } from "@hashgraph/sdk";
import { executeDAOFlow } from "../../integrationTest/dao/ftDaoFactory";

import FTDAOFactory from "../../e2e-test/business/factories/FTDAOFactory";

async function main() {
  const input = Helper.readWorkflowInputs();

  // below calls are validating input data only
  const contractId = ContractId.fromString(input.contractId);
  const tokenId = TokenId.fromSolidityAddress(input.tokenAddress);

  const daoFactory = new FTDAOFactory(contractId);
  await executeDAOFlow(daoFactory, input.daoAddress, tokenId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
