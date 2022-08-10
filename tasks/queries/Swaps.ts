import { getSigners } from 'hardhat';
import { ERC20Token__factory, Swaps__factory } from '../../typechain-types';

export default async function () {
  const [owner] = getSigners(1);
  const dvp = Swaps__factory.connect(
    '0xC8fF8db0aAe90C0cAaFB3f0D60599CF20ba36339',
    owner
  );
  const security20 = ERC20Token__factory.connect(
    '0xB63bAd9e830493D3aF167A7b3933EaF1c05985a8',
    owner
  );
  const emoney20 = ERC20Token__factory.connect(
    '0x8486175a0911533ca170AEcE02A12aE24b3114be',
    owner
  );

  const trade = await dvp.getTrade(0);
  console.log(trade);
}
