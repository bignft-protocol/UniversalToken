import { artifacts, ethers } from 'hardhat';
import type { ERC1400TokensValidator } from 'typechain-types';

const Extension = artifacts.require('ERC1400TokensValidator');

export default async function () {
  const extension: ERC1400TokensValidator = await Extension.new();
  Extension.setAsDeployed(extension);
  console.log('\n   > Extension deployment: Success -->', extension.address);
}
