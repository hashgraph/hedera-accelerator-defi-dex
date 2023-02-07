import { DeployedContract } from "../model/contract";
import { ContractService } from "../service/ContractService";
import { ContractId } from "@hashgraph/sdk";
import {
  METHOD_LP_IMPL,
  METHOD_PAIR_IMPL,
} from "../../e2e-test/business/Factory";
import ContractMetadata from "../../utils/ContractMetadata";
import Governor from "../../e2e-test/business/Governor";
import Factory from "../../e2e-test/business/Factory";
import { clientsInfo } from "../../utils/ClientManagement";
import Common from "../../e2e-test/business/Common";

const contractService = new ContractService();
const contractMetadata = new ContractMetadata();
const contractUATService = new ContractService(
  ContractService.UAT_CONTRACTS_PATH
);

const factory = new Factory(getFactoryProxyId()!);

function getFactoryProxyId() {
  const name = contractUATService.factoryContractName;
  const factory = contractUATService.getContract(name);
  return factory.transparentProxyId;
}

async function updateProxy(contractId: string, proposalId: string) {
  const governor = new Governor(contractId);
  const response =
    await governor.getContractAddressesFromGovernorUpgradeContract(proposalId);
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
  const pairs = await factory.getPairs();
  for (const pair of pairs) {
    const proxyAddress = await factory.resolveProxyAddress(functionName, pair);
    const ownerKey = clientsInfo.dexOwnerKey;
    await Common.upgradeTo(proxyAddress, logicAddress, ownerKey);
  }
  await factory.upgradeLogic(logicAddress, functionName);
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
  await Common.upgradeTo(
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
    await updateProxy(
      contract.transparentProxyId!,
      proposal.proposalId.toFixed()
    );
  }
}
