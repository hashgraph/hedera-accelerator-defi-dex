import { ContractId, TransactionId, AccountId } from "@hashgraph/sdk";
import { ContractService } from "../../deployment/service/ContractService";
import SafeFactory from "./SafeFactory";
import Safe from "./Safe";
import { clientsInfo } from "../../utils/ClientManagement";
import { BigNumber } from "bignumber.js";
import dex from "../../deployment/model/dex";

import * as fs from "fs";
import { ethers } from "hardhat";

const contractService = new ContractService();

const createSigner = () => {
  //a2feafa184e93d67e50328b1ff0d0a17c25e1b3a3d4a4f113d8dd2cd16315f2b
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.JSON_RPC_RELAY_URL
  );
  const signer = new ethers.Wallet(
    "a2feafa184e93d67e50328b1ff0d0a17c25e1b3a3d4a4f113d8dd2cd16315f2b",
    provider
  );
  console.log("Address", signer.address);
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

const readFileContent = (fileName: string) => {
  const rawdata: any = fs.readFileSync(fileName);
  return JSON.parse(rawdata);
};

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

const safeTx = async (safeAddress: string) => {
  const data = await getCallDataNew();
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
    nonce: 0,
  };
  return safeTx;
};

const txHash = async (safeAddress: string) => {
  return ethers.utils._TypedDataEncoder.hash(
    { verifyingContract: safeAddress, chainId: 296 },
    EIP712_SAFE_TX_TYPE,
    await safeTx(safeAddress)
  );
};

const safeSignTypedData = async (
  signer: ethers.Signer & ethers.TypedDataSigner,
  safeAddress: string,
  safeTx: SafeTransaction
): Promise<SafeSignature> => {
  const signerAddress = await signer.getAddress();
  return {
    signer: signerAddress,
    data: await signer._signTypedData(
      { verifyingContract: safeAddress, chainId: 296 },
      EIP712_SAFE_TX_TYPE,
      safeTx
    ),
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

const getSignatures = async (safeAddress: string) => {
  const signer = createSigner();
  const signers = [signer];
  const tx = await safeTx(safeAddress);
  const sigs = await Promise.all(
    signers.map((signer) => safeSignTypedData(signer, safeAddress, tx))
  );
  const signatures = buildSignatureBytes(sigs);
  return signatures;
};

const getCallDataNew = async (): Promise<string> => {
  const contractJson = readFileContent(
    "./artifacts/contracts/common/IERC20.sol/IERC20.json"
  );
  const contractInterface = new ethers.utils.Interface(contractJson.abi);
  const callData = contractInterface.encodeFunctionData("totalSupply", []);
  //const callData = contractInterface.encodeFunctionData("transfer(address,uint256)", [clientsInfo.dexOwnerId.toSolidityAddress(), 1]);

  return callData;
};

async function main() {
  const safeContract = contractService.getContract(contractService.gnosisSafe);
  // const factoryContract = contractService.getContract(
  //     contractService.gnosisSafeProxyFactory
  // );
  // console.log(`safeContract ${safeContract.id}`);
  // console.log(`factoryContract ${factoryContract.id}`);
  // const safeFactory = new SafeFactory(factoryContract.id);
  // const safeProxy = await safeFactory.createProxy(safeContract.address);
  // const safeProxyContractId = ContractId.fromSolidityAddress(safeProxy).toString();
  //const safeProxyContractId = "0.0.3701207";
  //console.log(`safeProxyContractId ${safeProxyContractId}`);
  console.log(`safeContract ${safeContract.id}`);

  const safe = new Safe(safeContract.id);
  // await safe.getChainId();

  const owners = [clientsInfo.operatorId.toSolidityAddress()];
  const data = new Uint8Array();
  // await safe.setup(
  //   owners,
  //   1,
  //   clientsInfo.operatorId.toSolidityAddress(),
  //   data,
  //   clientsInfo.adminId.toSolidityAddress(),
  //   dex.LAB49_3_TOKEN_ADDRESS,
  //   new BigNumber(0),
  //   clientsInfo.treasureId.toSolidityAddress()
  // );

  // const safeTx1 = await safeTx(safeContract.address);
  // const signBytes = await getSignatures(safeContract.address);

  // await safe.getSign(ethers.utils.arrayify(signBytes));

  // await safe.execTransaction(
  //     safeTx1.to,
  //     safeTx1.value,
  //     ethers.utils.arrayify(safeTx1.data),
  //     safeTx1.operation,
  //     new BigNumber(0),
  //     new BigNumber(0),
  //     new BigNumber(0),
  //     safeTx1.gasToken,
  //     safeTx1.refundReceiver,
  //     ethers.utils.arrayify(signBytes)
  // );

  return "Done";
}

main()
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => process.exit(0));
