import inquirer from "inquirer";
import { main as deployContract } from "../logicCode";
import { main as createContractProxy } from "../transparentUpgradeableProxyCode";
import { main as updateContractProxy } from "../upgradeProxyCode";

const SUPPORTED_CONTRACTS_FOR_DEPLOYMENT = [
  "Factory",
  "LPToken",
  "Pair",
  "BaseHTS",
  "GovernorUpgrade",
  "GovernorTransferToken",
  "GovernorTextProposal",
  "GovernorTokenCreate",
  "TransparentUpgradeableProxy",
];

const SUPPORTED_PROXY_OPTIONS = ["create", "update"];

async function main() {
  const contractName = await prompt(
    SUPPORTED_CONTRACTS_FOR_DEPLOYMENT,
    "Please select which contract you want to deploy ?"
  );
  if (contractName === "exit") {
    return "nothing to execute";
  }
  await deployContract(contractName);
  const proxyOption = await prompt(
    SUPPORTED_PROXY_OPTIONS,
    "Please select any option for proxy operation from menu !"
  );
  if (proxyOption === "create") {
    await createContractProxy(contractName);
  } else if (proxyOption === "update") {
    await updateContractProxy(contractName);
  }
  return "all done successfully";
}

async function prompt(inputs: string[], userMessage: string) {
  return (
    await inquirer.prompt([
      {
        type: "rawlist",
        name: "option",
        message: userMessage,
        choices: [...inputs, "exit"],
      },
    ])
  ).option;
}

main()
  .then((res) => console.log(res))
  .catch((error) => console.error(error))
  .finally(() => process.exit(1));
