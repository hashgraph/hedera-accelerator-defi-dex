import { ContractId } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import SafeFactory from "./SafeFactory";
import Safe from "./Safe";
import { clientsInfo } from "../../utils/ClientManagement";
import { BigNumber } from "bignumber.js";
import dex from "../../deployment/model/dex";

import * as fs from "fs";
import { ethers } from "hardhat";

const contractService = new ContractService();

const readFileContent = (fileName: string) => {
  const rawdata: any = fs.readFileSync(fileName);
  return JSON.parse(rawdata);
};

const createSigner = () => {
  //a2feafa184e93d67e50328b1ff0d0a17c25e1b3a3d4a4f113d8dd2cd16315f2b
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.JSON_RPC_RELAY_URL
  );
  const signer = new ethers.Wallet(
    "a2feafa184e93d67e50328b1ff0d0a17c25e1b3a3d4a4f113d8dd2cd16315f2b",
    provider
  );
  console.log("signer Address", signer.address);
  return signer;
};

interface MetaTransaction {
  to: string;
  value: number | BigNumber;
  data: string;
  operation: number;
}

interface SafeTransaction extends MetaTransaction {
  safeTxGas: string | number;
  baseGas: string | number;
  gasPrice: string | number;
  gasToken: string;
  refundReceiver: string;
  nonce: string | number;
}

interface SafeSignature {
  signer: string;
  data: string;
}

const EIP712_SAFE_TX_TYPE = {
  // "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
  SafeTx: [
    { type: "address", name: "to" },
    { type: "uint256", name: "value" },
    { type: "bytes", name: "data" },
    { type: "uint8", name: "operation" },
    { type: "uint256", name: "safeTxGas" },
    { type: "uint256", name: "baseGas" },
    { type: "uint256", name: "gasPrice" },
    { type: "address", name: "gasToken" },
    { type: "address", name: "refundReceiver" },
    { type: "uint256", name: "nonce" },
  ],
};

const safeTx = async (nonceCount: number, data: string) => {
  const safeTx: SafeTransaction = {
    to: dex.LAB49_1_TOKEN_ADDRESS,
    value: 0,
    data: data,
    operation: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: dex.LAB49_3_TOKEN_ADDRESS,
    refundReceiver: clientsInfo.treasureId.toSolidityAddress(),
    nonce: nonceCount,
  };
  return safeTx;
};

const safeSignTypedData = async (
  signer: ethers.Signer & ethers.TypedDataSigner,
  safeAddress: string,
  safeTx: SafeTransaction,
  chainId: number
): Promise<SafeSignature> => {
  const signerAddress = await signer.getAddress();
  const tx = await signer._signTypedData(
    { verifyingContract: safeAddress, chainId: chainId },
    EIP712_SAFE_TX_TYPE,
    safeTx
  );
  return {
    signer: signerAddress,
    data: tx,
  };
};

const buildSignatureBytes = (signatures: SafeSignature[]): string => {
  signatures.sort((left, right) =>
    left.signer.toLowerCase().localeCompare(right.signer.toLowerCase())
  );
  let signatureBytes = "0x";
  for (const sig of signatures) {
    signatureBytes += sig.data.slice(2);
  }
  return signatureBytes;
};

const getSignatures = async (
  tx: SafeTransaction,
  safeAddress: string,
  chainId: number
) => {
  const signer = createSigner();
  const signers = [signer];
  const sigs = await Promise.all(
    signers.map((signer) => safeSignTypedData(signer, safeAddress, tx, chainId))
  );
  const signatures = buildSignatureBytes(sigs);
  return signatures;
};

const tokenTotalSupply = async (): Promise<string> => {
  const contractJson = readFileContent(
    "./artifacts/contracts/common/IERC20.sol/IERC20.json"
  );
  const contractInterface = new ethers.utils.Interface(contractJson.abi);
  const callData = contractInterface.encodeFunctionData("totalSupply", []);
  return callData;
};

const executeSafeTransaction = async (
  safeTx1: SafeTransaction,
  safe: any,
  signBytes: string
) => {
  await safe.execTransaction(
    safeTx1.to,
    safeTx1.value,
    ethers.utils.arrayify(safeTx1.data),
    safeTx1.operation,
    new BigNumber(0),
    new BigNumber(0),
    new BigNumber(0),
    safeTx1.gasToken,
    safeTx1.refundReceiver,
    ethers.utils.arrayify(signBytes)
  );
};

async function main() {
  const safeContract = contractService.getContract(contractService.gnosisSafe);
  const factoryContract = contractService.getContract(
    contractService.gnosisSafeProxyFactory
  );

  const safeFactory = new SafeFactory(factoryContract.id);
  const safeProxy = await safeFactory.createProxy(safeContract.address);
  const safeProxyContractId =
    ContractId.fromSolidityAddress(safeProxy).toString();
  console.log(`safeProxyContractId ${safeProxyContractId}`);

  const safe = new Safe(safeProxyContractId);

  const chainId = await safe.getChainId();

  const owners = ["0x21256d85dc994996a402e6e635e90d7cfb7c046c"]; //Hardcoded for now
  const data = new Uint8Array();
  await safe.setup(
    owners,
    1,
    clientsInfo.operatorId.toSolidityAddress(),
    data,
    clientsInfo.adminId.toSolidityAddress(),
    dex.LAB49_3_TOKEN_ADDRESS,
    new BigNumber(0),
    clientsInfo.treasureId.toSolidityAddress()
  );

  let nonceCount = await safe.getNonce();
  let totalSupply = await tokenTotalSupply();
  let safeTx1 = await safeTx(nonceCount.toNumber(), totalSupply);
  let signBytes = await getSignatures(safeTx1, safeProxy, chainId.toNumber());
  await executeSafeTransaction(safeTx1, safe, signBytes);

  nonceCount = await safe.getNonce();
  totalSupply = await tokenTotalSupply();
  safeTx1 = await safeTx(nonceCount.toNumber(), totalSupply);
  signBytes = await getSignatures(safeTx1, safeProxy, chainId.toNumber());
  await executeSafeTransaction(safeTx1, safe, signBytes);

  return "Done";
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
