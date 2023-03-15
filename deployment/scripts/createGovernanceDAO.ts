import { Helper } from "../../utils/Helper";
import { TokenId, AccountId, ContractId } from "@hashgraph/sdk";

import GovernanceDAOFactory from "../../e2e-test/business/GovernanceDAOFactory";

async function main() {
  const input = Helper.readWorkflowInputs();
  if (!input) {
    throw Error("- Failed to read workflow inputs");
  }

  // below calls are validating input data only
  const contractId = ContractId.fromString(input.contractId);
  TokenId.fromSolidityAddress(input.tokenAddress);
  AccountId.fromSolidityAddress(input.daoAdmin);

  const governanceDAOFactory = new GovernanceDAOFactory(contractId.toString());
  await governanceDAOFactory.createDAO(
    input.daoName,
    input.daoLogoUrl,
    input.tokenAddress,
    Number(input.quorumThreshold),
    Number(input.votingDelay),
    Number(input.votingPeriod),
    input.isPrivate.toLowerCase() === "true",
    input.daoAdmin
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
