import 'dotenv/config';
import { extendEnvironment, task, types } from 'hardhat/config';
import {
  HardhatNetworkAccountsUserConfig,
  HardhatUserConfig
} from 'hardhat/types';
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-contract-sizer';
import path from 'path';
import { ethers } from 'ethers';

let accounts: HardhatNetworkAccountsUserConfig | undefined = undefined;

if (process.env.MNEMONIC) {
  accounts = {
    mnemonic: process.env.MNEMONIC,
    path: "m/44'/60'/0'/0",
    initialIndex: 0,
    count: 20,
    passphrase: ''
  };
} else if (process.env.PRIVATE_KEY) {
  accounts = process.env.PRIVATE_KEY.split(/\s*,\s*/).map((pv) => ({
    privateKey: pv,
    balance: '10000000000000000000000'
  }));
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
      url: 'https://ethrpc-balcony-testnet.orai.us',
      chainId: 0xa2c2a,
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

declare module 'hardhat/types/runtime' {
  export interface HardhatRuntimeEnvironment {
    provider: ethers.providers.Web3Provider;
    getSigner: (
      addressOrIndex?: string | number
    ) => ethers.providers.JsonRpcSigner;
    getSigners: (num?: number) => ethers.providers.JsonRpcSigner[];
  }
}

extendEnvironment((hre) => {
  // @ts-ignore
  hre.provider = new ethers.providers.Web3Provider(hre.network.provider);
  hre.getSigners = (num = 20) =>
    [...new Array(num)].map((_, i) => hre.provider.getSigner(i));
  hre.getSigner = (addressOrIndex) => hre.provider.getSigner(addressOrIndex);
});

export default config;
