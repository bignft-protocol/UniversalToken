import { ethers } from 'hardhat';
import { ContractHelper } from '../../typechain-types';

type Args = {
  address: string;
};

export default async function (args: Args) {
  const [owner] = await ethers.getSigners();
  ContractHelper.setSigner(owner);

  const dvp = ContractHelper.Swaps.attach(args.address);
  const tradeIndex = (await dvp.getNbTrades()).toNumber();
  console.log('tradeNumber', tradeIndex);
}
