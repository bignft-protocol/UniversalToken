import { ethers, artifacts } from 'hardhat';

export default async function () {
  const Swaps = artifacts.require('Swaps');

  const [owner] = await ethers.getSigners();

  const swaps = await Swaps.new(false, {
    from: owner.address
  });

  Swaps.setAsDeployed(swaps);

  console.log('Swaps deployed at: ' + swaps.address);
}
