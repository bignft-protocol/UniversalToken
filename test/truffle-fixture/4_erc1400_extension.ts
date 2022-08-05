import { ethers } from 'hardhat';
import { ERC1400TokensValidator__factory } from '../../typechain-types';

export default async function () {
  const owner = ethers.provider.getSigner();
  const extension = await new ERC1400TokensValidator__factory(owner).deploy();
  ERC1400TokensValidator__factory.setAsDeployed(extension);
  console.log('\n   > Extension deployment: Success -->', extension.address);
}
