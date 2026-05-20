import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "solidity-coverage";
import "@nomicfoundation/hardhat-ignition-ethers";
import * as dotenv from "dotenv";
dotenv.config();
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 1000 } },
  },
  typechain: { outDir: "typechain-types", target: "ethers-v6" },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
    },
  },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || "" },
  sourcify: { enabled: true },
};
export default config;
