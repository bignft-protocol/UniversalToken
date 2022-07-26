import 'dotenv/config';

import { HardhatUserConfig } from 'hardhat/types';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-truffle5';
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-contract-sizer';

const MAINNET_RPC_URL =
  process.env.MAINNET_RPC_URL ||
  process.env.ALCHEMY_MAINNET_RPC_URL ||
  'https://eth-mainnet.alchemyapi.io/v2/your-api-key';
const RINKEBY_RPC_URL =
  process.env.RINKEBY_RPC_URL ||
  'https://eth-rinkeby.alchemyapi.io/v2/your-api-key';
const KOVAN_RPC_URL =
  process.env.KOVAN_RPC_URL ||
  'https://eth-kovan.alchemyapi.io/v2/your-api-key';
const MUMBAI_RPC_URL =
  process.env.MUMBAI_RPC_URL ||
  'https://polygon-mumbai.alchemyapi.io/v2/your-api-key';
const POLYGON_MAINNET_RPC_URL =
  process.env.POLYGON_MAINNET_RPC_URL ||
  'https://polygon-mainnet.alchemyapi.io/v2/your-api-key';

const BSC_TESTNET_RPC_URL =
  process.env.BSC_TESTNET_RPC_URL ||
  'https://data-seed-prebsc-1-s1.binance.org:8545';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {},
    kovan: {
      url: KOVAN_RPC_URL,
      accounts
    },
    rinkeby: {
      url: RINKEBY_RPC_URL,
      accounts
    },
    mainnet: {
      url: MAINNET_RPC_URL,
      accounts
    },
    mumbai: {
      url: MUMBAI_RPC_URL,
      accounts
    },
    polygon: {
      url: POLYGON_MAINNET_RPC_URL,
      accounts
    },
    bscTestnet: {
      url: BSC_TESTNET_RPC_URL,
      accounts
    }
  },
  paths: {
    sources: 'src'
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true, // Default: false
            runs: 0 // Default: 200
          }
        }
      }
    ]
  },
  mocha: {
    timeout: 100000
  }
};

export default config;
