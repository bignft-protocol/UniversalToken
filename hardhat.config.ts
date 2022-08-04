import 'dotenv/config';
import { task, types } from 'hardhat/config';
import { HardhatUserConfig } from 'hardhat/types';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-contract-sizer';
import path from 'path';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];
if (process.env.PRIVATE_KEYS_EXTRAS) {
  accounts.push(...process.env.PRIVATE_KEYS_EXTRAS.split(/\s*,\s*/));
}

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {},
    bscTestnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      accounts
    },
    balconyTestnet: {
      url: 'https://endpoint-testnet.bignft.app',
      accounts
    }
  },
  paths: {
    sources: 'contracts'
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
    timeout: process.env.TIMEOUT || 100000
  }
};

task('task', 'Run a script task with custom input')
  .addPositionalParam('script', 'The deploy script')
  .addParam('input', 'The json input for deploy script', {}, types.json)
  .setAction(async (args) => {
    const { script, input } = args;
    const { default: fn } = await import(path.resolve(__dirname, script));
    await fn(input);
  });

export default config;
