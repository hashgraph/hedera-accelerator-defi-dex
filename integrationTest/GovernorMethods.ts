import { BigNumber } from "bignumber.js";
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
} from "@hashgraph/sdk";

import ClientManagement from "./utils/utils";

import dotenv from "dotenv";

dotenv.config();

const clientManagement = new ClientManagement();

let client = clientManagement.createOperatorClient();

const treasurerClient = clientManagement.createClient();

export default class GovernorMethods {
  public vote = async (
    proposalId: BigNumber,
    voteId: number,
    contractId: string | ContractId
  ) => {
    console.log(`\nVote for proposal id ${proposalId} `);
    const contractFunctionParameters = new ContractFunctionParameters()
      .addUint256(proposalId)
      .addUint8(voteId);

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("castVote", contractFunctionParameters)
      .setGas(900000)
      .freezeWith(treasurerClient);

    const executedTx = await tx.execute(treasurerClient);

    const response = await executedTx.getRecord(client);
    const receipt = await executedTx.getReceipt(treasurerClient);

    // const logs = await eventConsumer.getEventsFromRecord(response.contractFunctionResult?.logs, "VoteCast");
    // logs.forEach(log => {
    //   console.log(JSON.stringify(log));
    //});

    const status = receipt.status;

    console.log(
      `Vote tx status ${status} for proposal id ${response.contractFunctionResult?.getUint256(
        0
      )}`
    );
  };

  public voteSucceeded = async (proposalId: BigNumber, contractId: string | ContractId) => {
    console.log(`\nvoteSucceeded `);

    let contractFunctionParameters =
      new ContractFunctionParameters().addUint256(proposalId);

    const contractTokenTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("voteSucceeded", contractFunctionParameters)
      .setGas(500000)
      .execute(client);

    const receipt = await contractTokenTx.getReceipt(client);
    const record = await contractTokenTx.getRecord(client);
    const status = record.contractFunctionResult!.getBool(0);

    console.log(
      `voteSucceeded tx status ${receipt.status} with status ${status}`
    );
  };

  public proposalVotes = async (proposalId: BigNumber, contractId: string | ContractId) => {
    console.log(`\nGetting proposalVotes - `);

    let contractFunctionParameters =
      new ContractFunctionParameters().addUint256(proposalId);

    const contractTokenTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("proposalVotes", contractFunctionParameters)
      .setGas(500000)
      .execute(client);

    const receipt = await contractTokenTx.getReceipt(client);
    const record = await contractTokenTx.getRecord(client);
    const against = record.contractFunctionResult!.getInt256(0);
    const forVote = record.contractFunctionResult!.getInt256(1);
    const abstain = record.contractFunctionResult!.getInt256(2);

    console.log(
      `proposalVotes tx status ${receipt.status}, Votes detail - against ${against}  forVote ${forVote}  abstain ${abstain}`
    );
  };

  public state = async (proposalId: BigNumber, contractId: string | ContractId) => {
    console.log(`\nGet state `);

    let contractFunctionParameters =
      new ContractFunctionParameters().addUint256(proposalId);

    const contractTokenTx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("state", contractFunctionParameters)
      .setGas(500000)
      .execute(client);

    const receipt = await contractTokenTx.getReceipt(client);
    const record = await contractTokenTx.getRecord(client);
    const state = record.contractFunctionResult!.getInt256(0);

    console.log(`state tx status ${receipt.status}, state ${state} `);
  };

  public propose = async (
    targets: Array<string>,
    ethFees: Array<number>,
    calls: Array<Uint8Array>,
    description: string,
    contractId: string | ContractId
  ) => {
    console.log(`\nCreating proposal `);

    const contractFunctionParameters = new ContractFunctionParameters()
      .addAddressArray(targets)
      .addUint256Array(ethFees)
      .addBytesArray(calls)
      .addString(description);

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("propose", contractFunctionParameters)
      .setGas(900000)
      .freezeWith(client);

    const executedTx = await tx.execute(client);

    const record = await executedTx.getRecord(client);
    const receipt = await executedTx.getReceipt(client);

    const status = receipt.status;
    const proposalId = record.contractFunctionResult?.getUint256(0)!;
    console.log(`Proposal tx status ${status} with proposal id ${proposalId}`);

    return proposalId;
  };
}
