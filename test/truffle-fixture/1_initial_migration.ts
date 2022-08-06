import { getSigner } from '../../test/common/wallet';
import { Migrations__factory } from '../../typechain-types';

export default async function () {
  const owner = getSigner();
  const migration = await new Migrations__factory(owner).deploy();

  Migrations__factory.setAsDeployed(migration);
}
