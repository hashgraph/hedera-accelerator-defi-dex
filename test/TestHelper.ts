import { Contract } from "ethers";
import { ethers, upgrades } from "hardhat";

export class TestHelper {
  static ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  static ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
  static TWO_ADDRESS = "0x0000000000000000000000000000000000000002";

  static async mineNBlocks(n: number) {
    for (let index = 0; index < n; index++) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  static toPrecision(targetAmount: number) {
    return targetAmount * 1e8;
  }

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

  static async deployGodHolder(baseHTS: Contract, token: Contract) {
    const instance = await this.deployLogic("GODHolder");
    await instance.initialize(baseHTS.address, token.address);
    return instance;
  }

  static async deployGodTokenHolderFactory(
    baseHTS: Contract,
    godHolder: Contract,
    admin: string
  ) {
    const instance = await this.deployLogic("GODTokenHolderFactory");
    await instance.initialize(baseHTS.address, godHolder.address, admin);
    return instance;
  }

  static async deployERC20Mock(
    total: number = this.toPrecision(100),
    name: String = "TEST",
    symbol: String = "TEST"
  ) {
    return await this.deployLogic("ERC20Mock", name, symbol, total, 0);
  }

  static async deployMockBaseHTS(
    tokenTesting: boolean = true,
    hBarAddress: string = this.ZERO_ADDRESS
  ) {
    return await this.deployLogic("MockBaseHTS", tokenTesting, hBarAddress);
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
