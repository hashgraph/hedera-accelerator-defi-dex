import inquirer from "inquirer";
import { main as deployContract } from "../logicCode"
import { main as createContractProxy } from "../transparentUpgradeableProxyCode"
import { main as updateContractProxy } from "../upgradeProxyCode"

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

async function main() {
  const contractName = (
    await inquirer.prompt([
      {
        type: "rawlist",
        name: "contractName",
        message: "Please select which contract you want to deploy ? ",
        choices: [...SUPPORTED_CONTRACTS_FOR_DEPLOYMENT, "exit"],
      },
    ])
  ).contractName;
  if (contractName === "exit") {
    return "nothing to execute";
  }
  await deployContract(contractName);
  const option = (
    await inquirer.prompt([
      {
        type: "rawlist",
        name: "option",
        message: "Please select any option for proxy operation from menu ... ",
        choices: ["create", "update", "exit"],
      },
    ])
  ).option;
  if (option === "create") {
     await createContractProxy(contractName);
  } else if (option === "update") {
    await updateContractProxy(contractName);
  }
  return "all done successfully";
}
main()
  .then((res) => console.log(res))
  .catch((error) => console.error(error))
  .finally(() => process.exit(1));