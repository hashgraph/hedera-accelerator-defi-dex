import { Contract, Event } from "ethers";
import { Result } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import { isIterable } from "./utils";

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

  static async readLastEvent(
    transaction: any
  ): Promise<{ name: string; args: Result }> {
    const lastEvent: Event = (await transaction.wait()).events.pop();
    return { name: lastEvent.event ?? "", args: lastEvent.args ?? [] };
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

  /**
   * Returns the [named key]:value pairs in a Result object. String keys
   * are assumed to be the named arguments of an Event.
   * @remarks
   * The ethers Result object is an associative array that contains both number indexed
   * and string named key:value pairs.
   * @example Result args
   * ```typescript
   * [
   *  "0x8aCd85898458400f7Db866d53FCFF6f0D49741FF"
   *  daoAddress: "0x8aCd85898458400f7Db866d53FCFF6f0D49741FF",
   * ]
   * ```
   * getEventArgumentsByName(args)
   * ```typescript
   * {
   *  daoAddress: "0x8aCd85898458400f7Db866d53FCFF6f0D49741FF"
   * }
   * ```
   * @param args - The Result of an emitted Event.
   * @param excludedKeys - An optional array of keys to exclude from the Result object filtering.
   * This is typically useful for differentiating between a value that is an Array and
   * a Result (associative array created by an emitted event).
   * @returns A Record containing the [named key]:value pairs in a Result.
   */
  static getEventArgumentsByName<EventLog extends Record<string, any>>(
    args: Result,
    excludedKeys: string[] = []
  ): EventLog {
    const namedArguments: Record<string, any> = {} as EventLog;
    for (const key in args) {
      const isNamedArgument = Number.isNaN(Number(key));
      if (isNamedArgument) {
        const arg = args[key];
        const shouldFilterArg =
          isIterable(arg) &&
          typeof arg !== "string" &&
          !excludedKeys.includes(key);
        namedArguments[key] = shouldFilterArg
          ? TestHelper.getEventArgumentsByName<EventLog>(arg, excludedKeys)
          : arg;
      }
    }
    return namedArguments as EventLog;
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
