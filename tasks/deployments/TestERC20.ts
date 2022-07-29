import { ethers } from 'hardhat';
import { ContractHelper } from '../../typechain-types';

type Args = {
  name?: string;
  symbol?: string;
  decimal?: number;
};

export default async function (args: Args) {
  const [owner] = await ethers.getSigners();
  ContractHelper.setSigner(owner);
  const erc20 = await ContractHelper.ERC20HoldableToken.deploy(
    args.name ?? 'Test Holdable ERC20',
    args.symbol ?? 'TEST',
    args.decimal ?? 18
  );

  await erc20.mint(owner.address, '1000000000000000000000000000');
  console.log('ERC20HoldableToken deployed at: ' + erc20.address);
}
