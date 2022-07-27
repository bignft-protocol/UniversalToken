import { artifacts, ethers } from 'hardhat';
import type { ERC1820Registry } from '../../typechain-types';

const ERC1820Registry = artifacts.require('ERC1820Registry');

export default async function () {
  const [owner] = await ethers.getSigners();

  const erc1820Registry: ERC1820Registry = await ERC1820Registry.new(false, {
    from: owner
  });

  ERC1820Registry.setAsDeployed(erc1820Registry);

  console.log(
    '\n   > ERC1820Registry token deployment: Success -->',
    erc1820Registry.address
  );
}
