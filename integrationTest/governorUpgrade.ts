import { BigNumber } from "bignumber.js";
import * as fs from "fs";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  TokenId,
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";
import { ContractService } from "../deployment/service/ContractService";
import { ethers } from "ethers";
import GovernorMethods from "./GovernorMethods";

const clientManagement = new ClientManagement();
const contractService = new ContractService();

const governor = new GovernorMethods();

let client = clientManagement.createOperatorClient();
const { key } = clientManagement.getOperator();
const { adminId, adminKey } = clientManagement.getAdmin();

const adminClient = clientManagement.createClientAsAdmin();

const htsServiceAddress = contractService.getContract(
  contractService.baseContractName
).address;

let contractId: string | ContractId = contractService.getContractWithProxy(
    contractService.governorUpgradeContract
  ).transparentProxyId!;

const upgradeContractId = ContractId.fromString( 
    contractService.getContract(
        contractService.factoryContractName
    ).id!
);

const transparentContractId = ContractId.fromString(
    contractService.getContractWithProxy(
        contractService.factoryContractName
    ).transparentProxyId!
);

const readFileContent = (filePath: string) => {
  const rawdata: any = fs.readFileSync(filePath);
  return JSON.parse(rawdata);
};

const initialize = async (tokenId: TokenId) => {
  console.log(`\nInitialize contract for text proposal `);
  const votingDelay = 0;
  const votingPeriod = 12;

  console.log(`\ntransparentContractId ${transparentContractId}`);
  console.log(`\nupgradeContractId ${upgradeContractId}`);
  console.log(`\contractId ${contractId}`);

  let contractFunctionParameters = new ContractFunctionParameters()
    .addAddress(tokenId.toSolidityAddress())
    .addAddress(transparentContractId.toSolidityAddress())
    .addAddress(upgradeContractId.toSolidityAddress())
    .addUint256(votingDelay)
    .addUint256(votingPeriod);

  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("initialize", contractFunctionParameters)
    .setGas(900000)
    .execute(client);

  const receipt = await tx.getReceipt(client);

  console.log(`Initialize contract with token done with status - ${receipt}`);
};

const execute = async (
  targets: Array<string>,
  ethFees: Array<number>,
  calls: Array<Uint8Array>,
  description: string
) => {
  console.log(`\nExecuting  proposal - `);
  const contractFunctionParameters = new ContractFunctionParameters()
    .addAddressArray(targets)
    .addUint256Array(ethFees)
    .addBytesArray(calls)
    .addString(description);

  const contractAllotTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("execute", contractFunctionParameters)
    .setPayableAmount(new Hbar(70))
    .setMaxTransactionFee(new Hbar(70))
    .setGas(900000)
    .freezeWith(client) // admin client
    .sign(key); //Admin of token

  const executedTx = await contractAllotTx.execute(client);

  const record = await executedTx.getRecord(client);
  const contractAllotRx = await executedTx.getReceipt(client);

  const status = contractAllotRx.status;

  console.log(
    `Execute tx status ${status} for proposal id ${record.contractFunctionResult?.getUint256(
      0
    )}`
  );
};

const quorumReached = async (proposalId: BigNumber) => {
  console.log(`\nGetting quorumReached `);

  let contractFunctionParameters = new ContractFunctionParameters().addUint256(
    proposalId
  );

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("quorumReached", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt = await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const status = record.contractFunctionResult!.getBool(0);

  console.log(
    `quorumReached tx status ${receipt.status} with quorumReached ${status}`
  );
};

const fetchUpgradeContractAddresses = async (proposalId: BigNumber) => {
  console.log(`\nGetting ContractAddresses `);

  let contractFunctionParameters = new ContractFunctionParameters().addUint256(
    proposalId
  );

  const contractTokenTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("getContractAddresses", contractFunctionParameters)
    .setGas(500000)
    .execute(client);

  const receipt = await contractTokenTx.getReceipt(client);
  const record = await contractTokenTx.getRecord(client);
  const proxy = record.contractFunctionResult!.getAddress(0);
  const contractToUgrade = record.contractFunctionResult!.getAddress(1);
  
  console.log(
    `quorumReached tx status ${receipt.status}}`
  );
  return {proxy, contractToUgrade};
};

const associateTokenPublicCallData = async (
  tokenId: TokenId
): Promise<Uint8Array> => {
  const contractJson = readFileContent(
    "./artifacts/contracts/common/BaseHTS.sol/BaseHTS.json"
  );
  const contractInterface = new ethers.utils.Interface(contractJson.abi);

  const receiver = adminId.toSolidityAddress();
  const callData = contractInterface.encodeFunctionData(
    "associateTokenPublic",
    [receiver, tokenId.toSolidityAddress()]
  );
  return ethers.utils.toUtf8Bytes(callData);
};

const upgradeTo = async (newImplementation: string) => {
  const liquidityPool = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(2000000)
      .setFunction(
        "upgradeTo",
        new ContractFunctionParameters()
          .addAddress(newImplementation)
      )
      .freezeWith(adminClient)
      .sign(adminKey);
    const liquidityPoolTx = await liquidityPool.execute(adminClient);
    const transferTokenRx = await liquidityPoolTx.getReceipt(adminClient);
    console.log(`upgradedTo: ${transferTokenRx.status}`);
};

// TODO: It is only to check factory contract's method, remove if not required.
// const checkFactory = async () => {
//   const liquidityPool = await new ContractExecuteTransaction()
//       .setContractId(contractId)
//       .setGas(9000000)
//       .setFunction(
//         "getCount",
//         new ContractFunctionParameters()
//       )

//     const liquidityPoolTx = await liquidityPool.execute(client);
//     const transferTokenRx = await liquidityPoolTx.getReceipt(client);
//     console.log(`checkFactory: ${transferTokenRx.status}`);
// };

const setupFactory = async () => {
  console.log(`\nSetupFactory`);
  const baseContract = contractService.getContract(contractService.baseContractName);
  let contractFunctionParameters = new ContractFunctionParameters()
                                        .addAddress(baseContract.address)
  const contractSetPairsTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("setUpFactory", contractFunctionParameters)
    .setGas(9000000)
    .execute(client);
  const contractSetPairRx = await contractSetPairsTx.getReceipt(client);
  const response = await contractSetPairsTx.getRecord(client);
  const status = contractSetPairRx.status;
  console.log(`\nSetupFactory Result ${status} code: ${response.contractFunctionResult!.getAddress()}`);
};


async function main() {
  console.log(`\nUsing governor proxy contract id ${contractId}`);
  //const tokenId = await createToken();
  const tokenId = TokenId.fromString("0.0.48602743");
  await initialize(tokenId);

  const targets = [htsServiceAddress];
  const ethFees = [0];
  const associateToken = await associateTokenPublicCallData(tokenId);
  const calls = [associateToken];
  const description = "Create Upgrade proposal 9 OSR";

  const proposalId = await governor.propose(
    targets,
    ethFees,
    calls,
    description,
    contractId
  );
  await governor.vote(proposalId, 1, contractId); //1 is for vote.
  await quorumReached(proposalId);
  await governor.voteSucceeded(proposalId, contractId);
  await governor.proposalVotes(proposalId, contractId);
  await governor.state(proposalId, contractId);
  console.log(`\nWaiting for voting period to get over.`);
  await new Promise((f) => setTimeout(f, 15 * 1000)); //Wait till waiting period is over. It's current deadline as per Governance.
  await governor.state(proposalId, contractId); //4 means succeeded
  await execute(targets, ethFees, calls, description);
  const contracts = await fetchUpgradeContractAddresses(proposalId);
  console.log(contracts);
  contractId = ContractId.fromSolidityAddress(contracts.proxy);
  await upgradeTo(contracts.contractToUgrade);
  // await setupFactory();
  // await checkFactory();
  console.log(`\nDone`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
