const {
    Client,
    PrivateKey,
    Hbar,
    TransferTransaction,
    AccountId,
  } = require("@hashgraph/sdk");
  const dotenv = require("dotenv");
  const axios = require("axios");
  dotenv.config();
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  
  async function main() {
    //Grab your Hedera testnet account ID and private key from your .env file
    const myAccountId = process.env.TOKEN_USER_ID;
    const myPrivateKey = process.env.TOKEN_USER_KEY;
  
    // If we weren't able to grab it, we should throw a new error
    if (myAccountId == null || myPrivateKey == null) {
      throw new Error(
        "Environment variables myAccountId and myPrivateKey must be present"
      );
    }
  
    // Create our connection to the Hedera network
    // The Hedera JS SDK makes this really easy!
    //Create your local client
    const client = Client.forTestnet();
  
    client.setOperator(myAccountId, myPrivateKey);
  
    //Create new keys
    const newAccountPrivateKey = await PrivateKey.generateECDSA();
    const publicKey = newAccountPrivateKey.publicKey;
  
    // Assuming that the target shard and realm are known.
    // For now they are virtually always 0 and 0.
    const aliasAccountId = publicKey.toAccountId(0, 0);
    console.log("account alias", aliasAccountId.toString());
  
    const sendHbar = await new TransferTransaction()
      .addHbarTransfer(myAccountId, Hbar.from(-200)) //Sending account
      .addHbarTransfer(aliasAccountId, Hbar.from(200)) //Receiving account
      .execute(client);
    const transactionReceipt = await sendHbar.getReceipt(client);
    console.log(
      "The transfer transaction from my account to the new account was: " +
        transactionReceipt.status.toString()
    );
    await delay(10000); // wait for 5 seconds before querying account id
    const mirrorNodeUrl = "https://testnet.mirrornode.hedera.com/api/v1/";
    try {
      const account = await axios.get(
        mirrorNodeUrl +
          "accounts?account.publickey=" +
          newAccountPrivateKey.publicKey.toStringRaw()
      );
      console.log("new account id", account.data?.accounts[0].account);
    } catch (err) {
      console.log(err);
    }
  
    //https://testnet.mirrornode.hedera.com/api/v1/accounts?account.publickey=02a1a832ec5ea22b1796b4af034a9788791c49da4a889d54bdb8e1ca2261729bc9&balance=true&limit=2&order=desc
  
    console.log(
      "new account private key(raw)",
      newAccountPrivateKey.toStringRaw()
    );
    console.log("new account private key", newAccountPrivateKey.toString());
    console.log(
      "new account public key (raw)",
      newAccountPrivateKey.publicKey.toStringRaw()
    );
  }
  main();