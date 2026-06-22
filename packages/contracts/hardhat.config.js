require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../../.env" });

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    fuji: {
      url: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: (() => {
        const key = process.env.DEPLOYER_PRIVATE_KEY || "";
        const isValid = /^(0x)?[0-9a-fA-F]{64}$/.test(key) && !key.includes("your");
        return isValid ? [key] : [];
      })(),
    },
    hardhat: { chainId: 31337 }
  }
};
