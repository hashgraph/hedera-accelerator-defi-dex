const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Ballot", function () {
  it("Verify the voted is winner ", async function () {
    const Ballot = await ethers.getContractFactory("Ballot");
    const tea = ethers.utils.formatBytes32String("tea");
    const coffee = ethers.utils.formatBytes32String("coffee");

    const proposals = [tea, coffee];
    const ballot = await Ballot.deploy(proposals);
    await ballot.deployed();

    const voteTx = await ballot.vote(0);//tea index
    await voteTx.wait();

    const winnerNamer = await ballot.winnerName();
    expect(winnerNamer).to.equal(tea);
  });

  it("Verify the winner index based on proposal ", async function () {
    const Ballot = await ethers.getContractFactory("Ballot");
    const tea = ethers.utils.formatBytes32String("tea");
    const coffee = ethers.utils.formatBytes32String("coffee");
    
    const proposals = [tea, coffee];
    const ballot = await Ballot.deploy(proposals);
    await ballot.deployed();

    const voteTx = await ballot.vote(1);//coffee index

    expect(await ballot.winningProposal()).to.equal(1);//coffee
  });

  it("Verify the user cannot vote twice ", async function () {
    const Ballot = await ethers.getContractFactory("Ballot");
    const tea = ethers.utils.formatBytes32String("tea");
    const coffee = ethers.utils.formatBytes32String("coffee");
    
    const proposals = [tea, coffee];
    const ballot = await Ballot.deploy(proposals);
    await ballot.deployed();

    const voteForTeaTx = await ballot.vote(0);//tea index

    await expect(ballot.vote(1)).to.be.revertedWith("Already voted.");
  });
});
