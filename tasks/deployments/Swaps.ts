import { ethers } from 'hardhat';
import { ContractHelper } from '../../typechain-types';

export default async function () {
  const [owner] = await ethers.getSigners();
  ContractHelper.setSigner(owner);

  const swaps = await ContractHelper.Swaps.deploy(false);

  console.log('Swaps deployed at:', swaps.address);
}
