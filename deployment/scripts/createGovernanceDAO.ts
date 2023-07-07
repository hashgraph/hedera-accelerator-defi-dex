import { Helper } from "../../utils/Helper";
import { TokenId, AccountId, ContractId } from "@hashgraph/sdk";

import FTDAOFactory from "../../e2e-test/business/factories/FTDAOFactory";

async function main() {
  const input = Helper.readWorkflowInputs();

  // below calls are validating input data only
  const contractId = ContractId.fromString(input.contractId);
  TokenId.fromSolidityAddress(input.tokenAddress);
  AccountId.fromSolidityAddress(input.daoAdmin);
  const webLinks = input.daoWebLinks.split(",");
  const governanceDAOFactory = new FTDAOFactory(contractId);
  await governanceDAOFactory.createDAO(
    input.daoName,
    "https://defi-ui.hedera.com/",
    input.daoDescription,
    webLinks,
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
