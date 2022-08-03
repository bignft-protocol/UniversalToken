import { ethers } from 'hardhat';
import { Migrations__factory } from '../../typechain-types';

export default async function () {
  const [owner] = await ethers.getSigners();
  const migration = await new Migrations__factory(owner).deploy();

  Migrations__factory.setAsDeployed(migration);
}
