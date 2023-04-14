import { Contract } from "ethers";
import { ethers, upgrades } from "hardhat";

export class TestHelper {
  static ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  static ONE_ADDRESS = "0x0000000000000000000000000000000000000001";

  static async readLastEvent(transaction: any) {
    const lastEvent = (await transaction.wait()).events.pop();
    return { name: lastEvent.event, args: lastEvent.args };
  }

  static getAccountBalance = async (tokenCont: Contract, account: string) => {
    return await tokenCont.balanceOf(account);
  };

  static async getSigners() {
    return await ethers.getSigners();
  }

  static async getDexOwner() {
    return (await ethers.getSigners()).at(-1)!;
  }

  static async getDAOAdminOne() {
    return (await ethers.getSigners()).at(-2)!;
  }

  static async getDAOAdminTwo() {
    return (await ethers.getSigners()).at(-3)!;
  }

  static async getDAOSigners() {
    return (await ethers.getSigners()).slice(4, 6)!;
  }

  static async deployLogic(name: string, ...args: any) {
    return await this.deployInternally(name, false, args);
  }

  static async deployProxy(name: string, ...args: any) {
    return await this.deployInternally(name, true, args);
  }

  static async getContract(name: string, address: string) {
    return ethers.getContractAt(name, address);
  }

  private static async deployInternally(
    name: string,
    isProxy: boolean,
    args: Array<any>
  ) {
    const Contract = await ethers.getContractFactory(name);
    const contractInstance = !isProxy
      ? await Contract.deploy(...args)
      : await upgrades.deployProxy(Contract, args);
    await contractInstance.deployed();
    return contractInstance;
  }
}
