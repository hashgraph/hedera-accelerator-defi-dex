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

const createSigner = (ecdsaPrivateKey: string): ethers.Signer => {
  //a2feafa184e93d67e50328b1ff0d0a17c25e1b3a3d4a4f113d8dd2cd16315f2b
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.JSON_RPC_RELAY_URL
  );
  const signer = new ethers.Wallet(ecdsaPrivateKey, provider);
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

const safeTx = async (
  nonceCount: number,
  data: string,
  callOrDelegate: number
) => {
  const safeTx: SafeTransaction = {
    to: dex.LAB49_1_TOKEN_ADDRESS,
    value: 0,
    data: data,
    operation: callOrDelegate,
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
  signers: ethers.Signer[],
  tx: SafeTransaction,
  safeAddress: string,
  chainId: number
) => {
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

const transferToken = async (): Promise<string> => {
  const contractJson = readFileContent(
    "./artifacts/contracts/common/IERC20.sol/IERC20.json"
  );
  const contractInterface = new ethers.utils.Interface(contractJson.abi);
  const callData = contractInterface.encodeFunctionData(
    "transfer(address,uint256)",
    [clientsInfo.dexOwnerId.toSolidityAddress(), 1]
  );
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

  const signer1 = await createSigner(
    "a2feafa184e93d67e50328b1ff0d0a17c25e1b3a3d4a4f113d8dd2cd16315f2b"
  );
  const signer2 = await createSigner(
    "8a273b396366b53a43c474cd17ef09cbdadb70694f0d5bdcad6ac882f336e3b1"
  );

  console.log("Signer1 Address", signer1.address);
  console.log("Signer2 Address", signer2.address);
  console.log(`\n`);

  const owners = [signer1.address, signer2.address];
  const ownersThreshold = owners.length;
  const data = new Uint8Array();
  await safe.setup(
    owners,
    ownersThreshold,
    clientsInfo.operatorId.toSolidityAddress(),
    data,
    clientsInfo.adminId.toSolidityAddress(),
    dex.LAB49_3_TOKEN_ADDRESS,
    new BigNumber(0),
    clientsInfo.treasureId.toSolidityAddress()
  );

  let nonceCount = await safe.getNonce();
  let totalSupply = await tokenTotalSupply();
  let totalSupplyTx = await safeTx(nonceCount.toNumber(), totalSupply, 0);
  console.log(`Signed total supply transaction.`);
  let totalSupplySignBytes = await getSignatures(
    [signer1, signer2],
    totalSupplyTx,
    safeProxy,
    chainId.toNumber()
  );
  console.log(`Execute total supply transaction. \n`);
  await executeSafeTransaction(totalSupplyTx, safe, totalSupplySignBytes);

  nonceCount = await safe.getNonce();
  let transToken = await transferToken();
  let tokenTransferTx = await safeTx(nonceCount.toNumber(), transToken, 1);
  console.log(`Signed transfer token transaction.`);
  let signBytesTokenTransfer = await getSignatures(
    [signer1, signer2],
    tokenTransferTx,
    safeProxy,
    chainId.toNumber()
  );
  console.log(`Execute transfer transaction. \n`);
  await executeSafeTransaction(tokenTransferTx, safe, signBytesTokenTransfer);

  return "Done";
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
