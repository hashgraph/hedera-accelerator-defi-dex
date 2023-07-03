import { Helper } from "../../utils/Helper";
import { TokenId, ContractId } from "@hashgraph/sdk";
import { executeDAOFlow } from "../../integrationTest/dao/ftDaoFactory";

import DAOFactory from "../../e2e-test/business/factories/DAOFactory";

async function main() {
  const input = Helper.readWorkflowInputs();

  // below calls are validating input data only
  const contractId = ContractId.fromString(input.contractId);
  const daoId = ContractId.fromSolidityAddress(input.daoAddress);
  const tokenId = TokenId.fromSolidityAddress(input.tokenAddress);

  const daoFactory = new DAOFactory(contractId.toString(), false);
  await executeDAOFlow(daoFactory, daoId.toSolidityAddress(), tokenId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
