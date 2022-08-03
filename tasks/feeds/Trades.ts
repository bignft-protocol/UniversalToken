import { ethers } from 'hardhat';
import { Swaps__factory } from '../../typechain-types';

type Args = {
  address: string;
};

export default async function (args: Args) {
  const [owner] = await ethers.getSigners();

  const dvp = Swaps__factory.connect(args.address, owner);
  const tradeIndex = (await dvp.getNbTrades()).toNumber();
  const trade = await dvp.getTrade(tradeIndex);
  console.log('trade', trade);
}
