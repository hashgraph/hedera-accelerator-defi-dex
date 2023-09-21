import * as fs from "fs";
import { DeployedContract } from "../model/contract";
import { httpRequest } from "../api/HttpsService";

export class ContractService {
  public static BASE_DAO = "BaseDAO";
  public static MULTI_SIG = "multisigdao";
  public static MULTI_SIG_FACTORY = "multisigdaofactory";
  public static SAFE = "hederagnosissafe";
  public static SAFE_FACTORY = "hederagnosissafeproxyfactory";
  public static NFT_DAO_FACTORY = "nftdaofactory";
  public static FT_DAO_FACTORY = "ftdaofactory";
  public static GOVERNOR_TT = "governortransfertoken";
  public static GOVERNOR_TEXT = "governortextproposal";
  public static GOVERNOR_UPGRADE = "governorupgrade";
  public static FT_DAO = "ftdao";
  public static GOVERNOR_TOKEN_CREATE = "governortokencreate";
  public static FACTORY = "factory";
  public static PAIR = "pair";
  public static LP_TOKEN = "lptoken";
  public static VAULT = "vault";
  public static SPLITTER = "splitter";
  public static GOD_HOLDER = "godholder";
  public static NFT_HOLDER = "nftholder";
  public static MULTI_SEND = "hederamultisend";
  public static SYSTEM_ROLE_BASED_ACCESS = "systemrolebasedaccess";
  public static FT_TOKEN_HOLDER_FACTORY = "godtokenholderfactory";
  public static NFT_TOKEN_HOLDER_FACTORY = "nftTokenHolderFactory";
  public static HEDERA_GOVERNOR = "hederagovernor";
  public static ASSET_HOLDER = "assetsholder";

  public factoryContractName = "factory";
  public pairContractName = "pair";
  public hederaServiceContractName = "hederaservice";
  public lpTokenContractName = "lptoken";
  public splitterContractName = "splitter";
  public vaultContractName = "vault";
  public governorContractName = "governortokencreate";
  public governorTextContractName = "governortextproposal";
  public governorTTContractName = "governortransfertoken";
  public governorUpgradeContract = "governorupgrade";
  public vaultContract = "vault";
  public allGovernorContracts = [
    this.governorContractName,
    this.governorTextContractName,
    this.governorTTContractName,
    this.governorUpgradeContract,
  ];
  public godHolderContract = "godholder";
  public nftHolderContract = "nftholder";
  public configuration = "configuration";
  public godTokenHolderFactory = "godtokenholderfactory";
  public nftTokenHolderFactory = "nfttokenholderfactory";

  private contractRecordFile = "./deployment/state/contracts.json";
  static DEV_CONTRACTS_PATH = "./deployment/state/contracts.json";
  static UAT_CONTRACTS_PATH = "./deployment/state/contractsUAT.json";
  private static CONTRACTS_IDS = "./deployment/state/contractIds.json";

  constructor(filePath?: string) {
    this.contractRecordFile = filePath ?? ContractService.DEV_CONTRACTS_PATH;
  }

  static getContractServiceForIds() {
    return new ContractService(this.CONTRACTS_IDS);
  }

  private readFileContent = () => {
    const rawdata: any = fs.readFileSync(this.contractRecordFile);
    return JSON.parse(rawdata);
  };

  public getContractId = async (contractEvmAddress: string): Promise<any> => {
    console.log(`Fetching contract id for evm address ${contractEvmAddress}`);
    const contractId: any = await httpRequest(contractEvmAddress, undefined);
    return contractId.contract_id;
  };

  public saveDeployedContract = async (
    contractId: string,
    contractAddress: string,
    contractName: string,
    calculatedHash: string,
  ) => {
    const contractNameLowerCase = contractName.toLowerCase();

    if (contractNameLowerCase === "transparentupgradeableproxy") {
      return;
    }

    const contracts: [DeployedContract] = this.readFileContent();

    const newContract: DeployedContract = {
      name: contractNameLowerCase,
      id: contractId,
      address: "0x" + contractAddress,
      timestamp: new Date().toISOString(),
      hash: calculatedHash,
    };

    const contractsWithNewContract = [...contracts, newContract];

    const data = JSON.stringify(contractsWithNewContract, null, 2);

    console.log(`Contract details: ${JSON.stringify(newContract)}`);

    fs.writeFileSync(this.contractRecordFile, data);
  };

  public recordDeployedContract = async (
    contractAddress: string,
    contractName: string,
  ) => {
    const contractNameLowerCase = contractName.toLowerCase();

    if (contractNameLowerCase === "transparentupgradeableproxy") {
      return;
    }

    const contracts: [DeployedContract] = this.readFileContent();

    const contractId = await this.getContractId(contractAddress);
    console.log(`Contract id from api ${contractId}`);

    const newContract: DeployedContract = {
      name: contractNameLowerCase,
      id: contractId,
      address: contractAddress,
      timestamp: new Date().toISOString(),
      hash: "",
    };

    const contractsWithNewContract = [...contracts, newContract];

    const data = JSON.stringify(contractsWithNewContract, null, 2);

    console.log(`Contract details ${data}`);

    fs.writeFileSync(this.contractRecordFile, data);
  };

  public getAllContracts = (): Array<DeployedContract> =>
    this.readFileContent();

  public updateContractRecord = (
    updatedContract: DeployedContract,
    contractBeingDeployed: DeployedContract,
  ) => {
    const contracts: Array<DeployedContract> = this.getAllContracts();
    const allOtherContracts = contracts.filter(
      (contract: DeployedContract) =>
        contract.address !== contractBeingDeployed.address,
    );
    const updatedContracts = [...allOtherContracts, updatedContract];
    const data = JSON.stringify(updatedContracts, null, 2);
    fs.writeFileSync(this.contractRecordFile, data);
  };

  public getContract = (contractName: string): DeployedContract => {
    const contracts: Array<DeployedContract> = this.getAllContracts();
    const matchingContracts = contracts.filter(
      (contract: DeployedContract) => contract.name === contractName,
    );
    const latestContract = matchingContracts[matchingContracts.length - 1];
    return latestContract;
  };

  public getContractWithProxy = (contractName: string): DeployedContract => {
    const contracts: Array<DeployedContract> = this.getAllContracts();
    const matchingProxyContracts = contracts.filter(
      (contract: DeployedContract) =>
        contract.name === contractName &&
        contract.transparentProxyAddress != null &&
        contract.transparentProxyId != null,
    );
    return matchingProxyContracts[matchingProxyContracts.length - 1];
  };

  public getContractWithProxyAtIndex = (
    contractName: string,
    index: number,
  ): DeployedContract => {
    const contracts: Array<DeployedContract> = this.getAllContracts();
    const matchingProxyContracts = contracts.filter(
      (contract: DeployedContract) =>
        contract.name === contractName &&
        contract.transparentProxyAddress != null &&
        contract.transparentProxyId != null,
    );
    return matchingProxyContracts[matchingProxyContracts.length - (1 + index)];
  };

  public getContractsWithProxy = (
    contractName: string,
    count: number,
  ): DeployedContract[] => {
    const contracts: Array<DeployedContract> = this.getAllContracts();
    const matchingProxyContracts = contracts.filter(
      (contract: DeployedContract) =>
        contract.name === contractName &&
        contract.transparentProxyAddress != null &&
        contract.transparentProxyId != null,
    );
    return matchingProxyContracts.slice(-count);
  };

  public getContractWithProxyById = (contractId: string): DeployedContract => {
    const contracts: Array<DeployedContract> = this.getAllContracts();
    const matchingProxyContracts = contracts.filter(
      (contract: DeployedContract) =>
        contract.transparentProxyAddress != null &&
        contract.transparentProxyId != null &&
        contract.transparentProxyId === contractId,
    );
    return matchingProxyContracts[matchingProxyContracts.length - 1];
  };

  public addDeployed = (contract: DeployedContract | any) => {
    const contracts: [DeployedContract] = this.readFileContent();
    contracts.push(contract);
    const data = JSON.stringify(contracts, null, 2);
    fs.writeFileSync(this.contractRecordFile, data);
  };

  public updateDeployed = (contract: DeployedContract) => {
    const contracts: [DeployedContract] = this.readFileContent();
    const items = contracts.filter((item) => item.name !== contract.name);
    items.push(contract);
    const data = JSON.stringify(items, null, 2);
    fs.writeFileSync(this.contractRecordFile, data);
  };

  public remove = (id: string) => {
    const contracts: [DeployedContract] = this.readFileContent();
    const items = contracts.filter((item) => item.id !== id);
    const data = JSON.stringify(items, null, 2);
    fs.writeFileSync(this.contractRecordFile, data);
  };

  public makeLatestDeploymentAsDefault = () => {
    const contracts: [DeployedContract] = this.readFileContent();
    const oldContents = JSON.stringify(contracts, null, 2);
    console.log(`Contract details oldContents ${oldContents}`);
    const mergedContracts = [
      ...new Map(contracts.map((x) => [x.name, x])).values(),
    ];
    const newContents = JSON.stringify(mergedContracts, null, 2);
    console.log(`Contract details newContents ${newContents}`);
    fs.writeFileSync(this.contractRecordFile, newContents);
  };

  public getContractInfo = (
    idOrAddress: string,
  ): DeployedContract | undefined => {
    const contracts: Array<DeployedContract> = this.getAllContracts();
    const matchingContracts = contracts.filter(
      (contract: DeployedContract) =>
        contract.id.includes(idOrAddress) ||
        contract.address.includes(idOrAddress),
    );
    return matchingContracts.length > 0 ? matchingContracts.at(0) : undefined;
  };
}
