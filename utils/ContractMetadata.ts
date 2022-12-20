import { Helper } from "./Helper";
import md5File from "md5-file";
import { ContractService } from "../deployment/service/ContractService";

export default class ClientMetadata {
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
  ];

  static SUPPORTED_PROXY_OPTIONS = ["create", "update"];

  private contractService = new ContractService();

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

  public getAllChangedContractNames = (): Array<string> => {
    let eligibleContractsForDeployments = new Array<string>();

    ClientMetadata.SUPPORTED_CONTRACTS_FOR_DEPLOYMENT.forEach((name) => {
      const contractName = name.toLowerCase();
      console.log(`Checking contract deploy ${contractName}`);
      const hash = this.calculateHash(contractName);
      const contract = this.contractService.getContract(contractName);
      if (contract?.hash != hash) {
        console.log(`Eligible for contract deployment ${contractName} `);
        eligibleContractsForDeployments.push(contractName);
      }
    });
    return eligibleContractsForDeployments;
  };
}
