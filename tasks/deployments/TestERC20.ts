import { ethers, artifacts } from 'hardhat';
import type { ERC20HoldableToken } from 'typechain-types';

export default async function () {
  const ERC20HoldableToken = artifacts.require('ERC20HoldableToken');
  const [owner] = await ethers.getSigners();
  const erc20: ERC20HoldableToken = await ERC20HoldableToken.new(
    'Test Holdable ERC20',
    'TEST',
    18,
    {
      from: owner.address
    }
  );
  ERC20HoldableToken.setAsDeployed(erc20);
  await erc20.mint(owner.address, '1000000000000000000000000000');
  console.log('ERC20HoldableToken deployed at: ' + erc20.address);
}
