import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract } from "ethers";
import { ethers, upgrades } from "hardhat";

export class TestHelper {
  static ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  static ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
  static TWO_ADDRESS = "0x0000000000000000000000000000000000000002";

  static NFT_FOR_VOTING = 1;
  static NFT_FOR_TRANSFER = 2;
  static NFT_FOR_PROPOSAL_CREATION = 3;
  static NFT_FOR_PROPOSAL_CREATION2 = 4;

  static NFT_IDS = [
    TestHelper.NFT_FOR_VOTING,
    TestHelper.NFT_FOR_TRANSFER,
    TestHelper.NFT_FOR_PROPOSAL_CREATION,
    TestHelper.NFT_FOR_PROPOSAL_CREATION2,
  ];

  static getCurrentBlockNumber = async () => {
    return await ethers.provider.getBlockNumber();
  };

  static nonZeroAddress(address: any): boolean {
    return address !== TestHelper.ZERO_ADDRESS;
  }

  static async getAccountHBars(address: string): Promise<BigNumber> {
    return await ethers.provider.getBalance(address);
  }

  static async transferBalance(
    address: string,
    amount: number,
    sender: SignerWithAddress,
  ) {
    const tx = {
      to: address,
      value: amount,
    };
    await sender.sendTransaction(tx);
  }

  static async mineNBlocks(n: number) {
    for (let index = 0; index < n; index++) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  static async increaseEVMTime(seconds: number) {
    await time.increase(seconds);
  }

  static toPrecision(targetAmount: number) {
    return targetAmount * 1e8;
  }

  static async readLastEvent(transaction: any) {
    const lastEvent = (await transaction.wait()).events.pop();
    return { name: lastEvent.event, args: lastEvent.args };
  }

  static async readEvents(transaction: any, eventsName: string[] = []) {
    const events = (await transaction.wait()).events;
    return eventsName.length > 0
      ? events.filter((_event: any) => eventsName.includes(_event.event))
      : events;
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

  static async getDAOTreasure() {
    return (await ethers.getSigners()).at(11)!;
  }

  static async getDAOSigners() {
    return (await ethers.getSigners()).slice(4, 6)!;
  }

  static async systemUsersSigners() {
    const signers = await TestHelper.getSigners();
    return {
      superAdmin: signers[5],
      proxyAdmin: signers[6],
      childProxyAdmin: signers[7],
      vaultAddRewardUser: signers[8],
    };
  }

  static async vaultAddRewardUser() {
    return (await TestHelper.systemUsersSigners()).vaultAddRewardUser;
  }

  static regularExpressionForMissingRole() {
    return /AccessControl: account .* is missing role .*/;
  }

  static async deployGodHolder(hederaService: Contract, token: Contract) {
    const instance = await this.deployLogic("GODHolderMock");
    await instance.initialize(hederaService.address, token.address);
    return instance;
  }

  static async deployNftGodHolder(hederaService: Contract, token: Contract) {
    const instance = await this.deployLogic("NFTHolderMock");
    await instance.initialize(hederaService.address, token.address);
    return instance;
  }

  static async deployGodTokenHolderFactory(
    hederaService: Contract,
    ftTokenHolder: Contract,
    proxyAdmin: string,
  ) {
    return await this.deployProxy(
      "GODTokenHolderFactoryMock",
      hederaService.address,
      ftTokenHolder.address,
      proxyAdmin,
    );
  }

  static async deployNFTTokenHolderFactory(
    hederaService: Contract,
    nftTokenHolder: Contract,
    proxyAdmin: string,
  ) {
    return await this.deployProxy(
      "NFTTokenHolderFactoryMock",
      hederaService.address,
      nftTokenHolder.address,
      proxyAdmin,
    );
  }

  static async deployFTDAOFactory(args: any[]) {
    return this.deployProxy("FTDAOFactory", ...args);
  }

  static async deployNFTDAOFactory(args: any[]) {
    return this.deployProxy("NFTDAOFactory", ...args);
  }

  static async deploySystemRoleBasedAccess() {
    const systemUsersSigners = await TestHelper.systemUsersSigners();
    const systemUsersAddresses = Object.values(systemUsersSigners).map(
      (user: SignerWithAddress) => user.address,
    );
    const contract = await this.deployLogic("SystemRoleBasedAccess");
    await contract.initialize(systemUsersAddresses);
    return contract;
  }

  static async deployERC20Mock(
    total: number = this.toPrecision(100),
    name: String = "TEST",
    symbol: String = "TEST",
  ) {
    return await this.deployLogic("ERC20Mock", name, symbol, total, 0);
  }

  static async deployERC721Mock(
    treasure: SignerWithAddress,
    nftIds: number[] = TestHelper.NFT_IDS,
  ) {
    const erc721 = await this.deployLogic("ERC721Mock");
    for (const nftId of nftIds) {
      await erc721.setUserBalance(treasure.address, nftId);
    }
    return erc721;
  }

  static async deployAssetsHolder() {
    return await this.deployLogic("AssetsHolderMock");
  }

  static async deployMockHederaService(tokenTesting: boolean = true) {
    return await this.deployLogic("MockHederaService", tokenTesting);
  }

  static async deployGovernor(args: any[] = []) {
    if (args.length > 0) {
      return this.deployProxy("HederaGovernor", ...args);
    }
    return this.deployLogic("HederaGovernor");
  }

  static async getDeployGovernorAt(address: string) {
    return await TestHelper.getContract("HederaGovernor", address);
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
    args: Array<any>,
  ) {
    const Contract = await ethers.getContractFactory(name);
    const options = name === "Factory" ? { initializer: "setUpFactory" } : {};
    const contractInstance = !isProxy
      ? await Contract.deploy(...args)
      : await upgrades.deployProxy(Contract, args, options);
    await contractInstance.deployed();
    return contractInstance;
  }
}
