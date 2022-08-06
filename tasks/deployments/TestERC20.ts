import { getSigner } from 'hardhat';
import { ERC20HoldableToken__factory } from '../../typechain-types';

type Args = {
  name?: string;
  symbol?: string;
  decimal?: number;
};

export default async function (args: Args) {
  const owner = getSigner();

  const erc20 = await new ERC20HoldableToken__factory(owner).deploy(
    args.name ?? 'Test Holdable ERC20',
    args.symbol ?? 'TEST',
    args.decimal ?? 18
  );

  await erc20.mint(owner.getAddress(), '1000000000000000000000000000');
  console.log('ERC20HoldableToken deployed at: ' + erc20.address);
}
