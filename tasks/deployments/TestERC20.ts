import { ethers, artifacts } from 'hardhat';

export default async function () {
  const ERC20HoldableToken = artifacts.require('ERC20HoldableToken');

  const [owner] = await ethers.getSigners();

  const erc20 = await ERC20HoldableToken.new(
    'Test Holdable ERC20',
    'TEST',
    18,
    {
      from: owner
    }
  );

  ERC20HoldableToken.setAsDeployed(erc20);

  await erc20.mint(owner, '1000000000000000000000000000');

  console.log('ERC20HoldableToken deployed at: ' + erc20.address);
}
