import { DeployedContract } from "../model/contract";
import { ContractService } from "../service/ContractService";
import { BigNumber } from "bignumber.js";
import { ContractId } from "@hashgraph/sdk";
import ContractMetadata from "../../utils/ContractMetadata";
import GovernorMethods from "../../integrationTest/governance/GovernorMethods";
import Factory from "../../e2e-test/business/Factory";
import Pair from "../../e2e-test/business/Pair";
import ClientManagement from "../../utils/ClientManagement";

const METHOD_PAIR_IMPL = "upgradePairImplementation";
const METHOD_LP_IMPL = "upgradeLpTokenImplementation";

const pair = new Pair();
const factory = new Factory();
const governor = new GovernorMethods();
const contractService = new ContractService();
const contractMetadata = new ContractMetadata();
const contractUATService = new ContractService(
  ContractService.UAT_CONTRACTS_PATH
);

const clientManagement = new ClientManagement();
const operatorClient = clientManagement.createOperatorClient();
const dexOwnerClient = clientManagement.dexOwnerClient();

function getFactoryProxyId() {
  const name = contractUATService.factoryContractName;
  const factory = contractUATService.getContract(name);
  return factory.transparentProxyId;
}

const resolveProxyAddress = async (
  functionName: string,
  proxyAddress: string
) => {
  if (functionName === METHOD_PAIR_IMPL) {
    return proxyAddress;
  }
  if (functionName === METHOD_LP_IMPL) {
    const cId = ContractId.fromSolidityAddress(proxyAddress);
    return await pair.getLpTokenContractAddress(cId.toString(), operatorClient);
  }
  throw Error(`Invalid function name passed: ${functionName}`);
};

async function updateProxy(contractId: string, proposalId: BigNumber) {
  const response = await governor.getContractAddresses(contractId, proposalId);
  const proxyId = response.proxyId;
  const logicId = response.logicId;
  const proxyUATContract = contractUATService.getContractWithProxyById(
    response.proxyIdString
  );
  switch (proxyUATContract.name) {
    case contractService.factoryContractName:
    case contractService.splitterContractName:
    case contractService.governorContractName:
    case contractService.governorTextContractName:
    case contractService.governorTTContractName:
    case contractService.governorUpgradeContract: {
      await updateDirectProxy(proxyId, logicId, proxyUATContract);
      break;
    }
    case contractService.pairContractName: {
      await upgradeProxy(proxyId, logicId, proxyUATContract, METHOD_PAIR_IMPL);
      break;
    }
    case contractService.lpTokenContractName: {
      await upgradeProxy(proxyId, logicId, proxyUATContract, METHOD_LP_IMPL);
      break;
    }
  }
}

/**
 * Handle the upgrade operation for [ PairContract, LpTokenContact ] contracts in 3 steps:
 * 1 - Upgrade the implementation of the pair / lp proxies that factory owns.
 * 2 - Upgrade the implementation of the pair / lp old implementation state that factory owns.
 * 3 - Upgrade the implementation of the proxy.
 * @param proxyId proxy address
 * @param logicId new implementation address
 * @param oldVersionContract old version contract details
 * @param functionName factory function's name to update state variable.
 */
async function upgradeProxy(
  proxyId: ContractId,
  logicId: ContractId,
  oldVersionContract: DeployedContract,
  functionName: string
) {
  console.log("Running upgrade for : " + functionName);
  const logicAddress = logicId.toSolidityAddress();
  const factoryContractId = getFactoryProxyId()!;
  const pairs = await factory.getAllPairs(factoryContractId, operatorClient);
  for (const pair of pairs) {
    const proxyAddress = await resolveProxyAddress(functionName, pair);
    await governor.upgradeTo(proxyAddress, logicAddress, dexOwnerClient);
  }
  await factory.upgradeLogic(
    factoryContractId,
    logicAddress,
    dexOwnerClient,
    functionName
  );
  await updateDirectProxy(proxyId, logicId, oldVersionContract);
}

/**
 * Upgrade the implementation of the proxy.
 * @param proxyId proxy address
 * @param logicId new implementation address
 * @param oldVersionContract old version contract details
 */
async function updateDirectProxy(
  proxyId: ContractId,
  logicId: ContractId,
  oldVersionContract: DeployedContract
) {
  await governor.upgradeTo(
    proxyId.toSolidityAddress(),
    logicId.toSolidityAddress()
  );
  const newContract: DeployedContract = {
    ...oldVersionContract,
    id: logicId.toString(),
    address: logicId.toSolidityAddress(),
    hash: contractMetadata.calculateHash(oldVersionContract.name),
    timestamp: new Date().toISOString(),
  };
  contractService.remove(logicId.toString());
  contractService.addDeployed(newContract);
  contractUATService.updateDeployed(newContract);
}

export async function main(contract: DeployedContract, proposal: any) {
  if (contract.name === contractService.governorUpgradeContract) {
    await updateProxy(contract.transparentProxyId!, proposal.proposalId);
  }
}
