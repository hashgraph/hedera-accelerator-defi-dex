import ContractMetadata from "../../utils/ContractMetadata";
import { ContractService } from "../service/ContractService";
import { EventConsumer } from "../../utils/EventConsumer";
import { DeployedContract } from "../model/contract";
import { Helper } from "../../utils/Helper";

const contractMetadata = new ContractMetadata();
const contractService = new ContractService();
const helper = new Helper();

export async function main(_contractId: string? = null) {
  const contractId =
    _contractId ?? process.env.PROPOSAL_CONTRACT_ID ?? undefined;
  let contract: DeployedContract;
  if (contractId !== undefined) {
    contract = contractService.getContractWithProxyById(contractId);
  } else {
    const contractName = await helper.prompt(
      ContractMetadata.SUPPORTED_CONTRACTS_FOR_DEPLOYMENT,
      "Please select which contract events you want to read?"
    );
    if (contractName === "exit") {
      throw Error("nothing to execute");
    }
    contract = contractService.getContractWithProxy(contractName.toLowerCase());
  }
  const filePath = contractMetadata.getFilePath(contract.name);
  const eventConsumer = new EventConsumer(filePath);
  const events = await eventConsumer.getEventsFromMirror(
    contract.transparentProxyId!
  );
  console.log(events);
  return events;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
    })
    .finally(() => {
      process.exit(1);
    });
}
