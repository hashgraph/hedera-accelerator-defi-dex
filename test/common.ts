import { expect } from "chai";
import { Contract } from "ethers";
import { TestHelper } from "./TestHelper";

export async function verifyFeeConfigUpdatedEvent(
  contract: Contract,
  feeConfigPassed: any,
) {
  const { args } = (await contract.queryFilter("FeeConfigUpdated")).at(-1)!;
  const feeConfigInContract = args!.feeConfig;
  expect(feeConfigInContract.receiver).equals(feeConfigPassed.receiver);
  expect(feeConfigInContract.tokenAddress).equals(feeConfigPassed.tokenAddress);
  expect(feeConfigInContract.amountOrId).equals(feeConfigPassed.amountOrId);
}

export async function verifyDAOCreatedEvent(txn: any) {
  const event = await TestHelper.readLastEvent(txn);
  expect(event.name).equal("DAOCreated");
  expect(event.args.length).equal(5);
  expect(event.args.daoAddress).not.equal(TestHelper.ZERO_ADDRESS);
  expect(event.args.governorAddress).not.equal(TestHelper.ZERO_ADDRESS);
  expect(event.args.tokenHolderAddress).not.equal(TestHelper.ZERO_ADDRESS);
  expect(event.args.assetsHolderAddress).not.equal(TestHelper.ZERO_ADDRESS);

  const dao = await TestHelper.getContract("FTDAO", event.args.daoAddress);
  const governor = await TestHelper.getDeployGovernorAt(
    event.args.governorAddress,
  );
  return { dao, governor };
}

export async function verifyDAOInfoUpdatedEvent(
  txn: any,
  admin: string,
  daoName: string,
  logoUrl: string,
  infoUrl: string,
  description: string,
  webLinks: string[],
) {
  const lastEvent = (
    await TestHelper.readEvents(txn, ["DAOInfoUpdated"])
  ).pop();
  const { name, args } = { name: lastEvent.event, args: lastEvent.args };
  expect(name).equals("DAOInfoUpdated");
  const daoInfo = args.daoInfo;

  expect(daoInfo.name).equals(daoName);
  expect(daoInfo.admin).equals(admin);
  expect(daoInfo.logoUrl).equals(logoUrl);
  expect(daoInfo.infoUrl).equals(infoUrl);
  expect(daoInfo.description).equals(description);
  expect(daoInfo.webLinks.join(",")).equals(webLinks.join(","));
}
