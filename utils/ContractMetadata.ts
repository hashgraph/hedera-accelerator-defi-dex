import Web3 from "web3";
import hre from "hardhat";
import md5File from "md5-file";

import { ethers } from "ethers";
import { Artifact } from "hardhat/types";
import { ContractService } from "../deployment/service/ContractService";

export interface ContractInfo {
  artifact: Artifact;
  path: string;
  hash: string;
}

export default class ContractMetadata {
  static NON_PROXY_CONTRACTS = [
    "HederaService",
    "HederaMultiSend",
    "HederaGnosisSafe",
    "HederaGnosisSafeProxyFactory",
  ];

  static NON_PROXY_CONTRACTS_LOWER_CASE =
    ContractMetadata.NON_PROXY_CONTRACTS.map((item: string) =>
      item.toLowerCase()
    );

  static SUPPORTED_CONTRACTS_FOR_DEPLOYMENT = [
    "Factory",
    "FTDAOFactory",
    "NFTDAOFactory",
    "MultisigDAOFactory",
    "NFTTokenHolderFactory",
    "GODTokenHolderFactory",
    "Configuration",
    "FTDAO",
    "MultiSigDAO",
    "Pair",
    "LPToken",
    "Splitter",
    "Vault",
    "GODHolder",
    "NFTHolder",
    "SystemRoleBasedAccess",
    "GovernorUpgrade",
    "GovernorTextProposal",
    "GovernorTransferToken",
    "GovernorTokenCreate",
    ...ContractMetadata.NON_PROXY_CONTRACTS,
  ];

  static SUPPORTED_PROXY_OPTIONS = ["create", "update"];
  private static ERROR_ABI: any = {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "Error",
    type: "error",
  };

  private static PANIC_ABI: any = {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "Panic",
    type: "error",
  };

  private _readAllContractInfo = async (supportedContractsName: string[]) => {
    const contractsInfo: ContractInfo[] = [];
    const artifacts = hre.artifacts;
    const paths = await artifacts.getArtifactPaths();
    const fullNames = await artifacts.getAllFullyQualifiedNames();
    for (let index = 0; index < paths.length; index++) {
      const fullName = fullNames[index];
      const artifact = artifacts.readArtifactSync(fullName);
      if (supportedContractsName.includes(artifact.contractName)) {
        const path = paths[index];
        const hash = md5File.sync(path);
        contractsInfo.push({ path, hash, artifact });
      }
    }
    return contractsInfo;
  };

  public getFilePath = async (contractName: string) => {
    return (await this.getContractInfo(contractName)).path;
  };

  public calculateHash = async (contractName: string) => {
    return (await this.getContractInfo(contractName)).hash;
  };

  public getAllChangedContractNames = async (targetCs: ContractService) => {
    const proxyContractsForDeployments: string[] = [];
    const nonProxyContractsForDeployments: string[] = [];
    const contractsInfo = await this.getContractsInfo(
      ContractMetadata.SUPPORTED_CONTRACTS_FOR_DEPLOYMENT
    );
    for (const contractInfo of contractsInfo) {
      const name = contractInfo.artifact.contractName.toLowerCase();
      const contract = targetCs.getContractByNameAndHash(
        name,
        contractInfo.hash
      );
      if (!contract) {
        if (ContractMetadata.NON_PROXY_CONTRACTS_LOWER_CASE.includes(name)) {
          nonProxyContractsForDeployments.push(name);
        } else {
          proxyContractsForDeployments.push(name);
        }
      }
    }
    return {
      proxies: proxyContractsForDeployments,
      nonProxies: nonProxyContractsForDeployments,
      all: [
        ...nonProxyContractsForDeployments,
        ...proxyContractsForDeployments,
      ],
    };
  };

  public getContractsInfo = async (
    contractNameList: string[] = [
      ...ContractMetadata.SUPPORTED_CONTRACTS_FOR_DEPLOYMENT,
      "TransparentUpgradeableProxy",
      "BaseDAO",
      "IERC20",
    ]
  ) => {
    return await this._readAllContractInfo(contractNameList);
  };

  public getContractInfo = async (contractName: string) => {
    return (await this.getContractsInfo()).find(
      (contract: ContractInfo) =>
        contract.artifact.contractName.toLowerCase() ===
        contractName.toLowerCase()
    )!;
  };

  public static getContractInterface = async (contractName: string) => {
    const info = (await new ContractMetadata().getContractsInfo()).find(
      (contract: ContractInfo) =>
        contract.artifact.contractName.toLowerCase() ===
        contractName.toLowerCase()
    )!;
    return new ethers.utils.Interface(info.artifact.abi);
  };

  public getSignatureToABIMap = async () => {
    const web3 = new Web3();
    const signatureToAbiMap: Map<string, any> = new Map();
    signatureToAbiMap.set("0x08c379a0", ContractMetadata.ERROR_ABI);
    signatureToAbiMap.set("0x4e487b71", ContractMetadata.PANIC_ABI);

    const contractsInfo = await this.getContractsInfo();
    for (const contractInfo of contractsInfo) {
      for (const eachABI of contractInfo.artifact.abi) {
        if (eachABI.type === "event") {
          const signature = web3.eth.abi.encodeEventSignature(eachABI);
          signatureToAbiMap.set(signature, eachABI);
        } else if (eachABI.type === "error") {
          const signature = web3.eth.abi.encodeFunctionSignature(eachABI);
          signatureToAbiMap.set(signature, eachABI);
        }
      }
    }
    return signatureToAbiMap;
  };
}
