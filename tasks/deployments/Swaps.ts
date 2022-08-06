import { getSigner } from '../../test/common/wallet';
import { Swaps__factory } from '../../typechain-types';

export default async function () {
  const owner = getSigner();

  const swaps = await new Swaps__factory(owner).deploy(false);

  console.log('Swaps deployed at:', swaps.address);
}
