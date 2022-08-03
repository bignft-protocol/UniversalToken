import { ethers } from 'hardhat';
import { Swaps__factory } from '../../typechain-types';

export default async function () {
  const [owner] = await ethers.getSigners();

  const swaps = await new Swaps__factory(owner).deploy(false);

  console.log('Swaps deployed at:', swaps.address);
}
