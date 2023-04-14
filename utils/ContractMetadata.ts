import * as fs from "fs";
import { Helper } from "./Helper";
import md5File from "md5-file";
import { ContractService } from "../deployment/service/ContractService";

export default class ContractMetadata {
  static SUPPORTED_CONTRACTS_FOR_UPGRADE = [
    "Factory",
    "LPToken",
    "Pair",
    "GovernorUpgrade",
    "GovernorTransferToken",
    "GovernorTextProposal",
    "GovernorTokenCreate",
    "Splitter",
    "Configuration",
    "GODTokenHolderFactory",
    "GovernanceDAOFactory",
  ];

  static SUPPORTED_CONTRACTS_FOR_DEPLOYMENT = [
    "Factory",
    "LPToken",
    "Pair",
    "BaseHTS",
    "GovernorUpgrade",
    "GovernorTransferToken",
    "GovernorTextProposal",
    "GovernorTokenCreate",
    "Splitter",
    "Vault",
    "GODHolder",
    "NFTHolder",
    "Configuration",
    "GODTokenHolderFactory",
    "NFTTokenHolderFactory",
    "GovernanceDAOFactory",
    "GovernorTokenDAO",
  ];

  static SUPPORTED_PROXY_OPTIONS = ["create", "update"];

  private contractUATService = new ContractService(
    ContractService.UAT_CONTRACTS_PATH
  );

  public getFilePath = (contractNameArgs: string) => {
    const contractName = contractNameArgs.toLowerCase();
    const compiledPaths =
      Helper.getContractPathList("./artifacts").compiledPaths;
    const filePath = compiledPaths.find(
      (path) => Helper.extractFileName(path).toLowerCase() === contractName
    );
    if (filePath === undefined) {
      throw Error(`Failed to locate (${contractName}) contract json`);
    }
    return filePath;
  };

  public calculateHash = (contractName: string): string => {
    const filePath = this.getFilePath(contractName.toLowerCase());
    const hash = md5File.sync(filePath);
    return hash;
  };

  getContractABI(contractName: string) {
    const filePath = this.getFilePath(contractName.toLowerCase());
    const rawData: any = fs.readFileSync(filePath);
    return JSON.parse(rawData);
  }

  public getAllChangedContractNames = (): Array<string> => {
    const eligibleContractsForDeployments: string[] = [];
    ContractMetadata.SUPPORTED_CONTRACTS_FOR_UPGRADE.forEach((name) => {
      const contractName = name.toLowerCase();
      const hash = this.calculateHash(contractName);
      const contract =
        this.contractUATService.getContractWithProxy(contractName);
      if (contract?.hash !== hash) {
        eligibleContractsForDeployments.push(contractName);
      }
    });
    return eligibleContractsForDeployments;
  };
}
