import { Contract } from "ethers";
import { ethers, upgrades } from "hardhat";

export class TestHelper {
  static getAccountBalance = async (tokenCont: Contract, account: string) => {
    return await tokenCont.balanceOf(account);
  };

  static getZeroAddress() {
    return "0x0000000000000000000000000000000000000000";
  }

  static async getSigners() {
    return await ethers.getSigners();
  }

  static async getDexOwner() {
    return (await ethers.getSigners()).pop()!;
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
