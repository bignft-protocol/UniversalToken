import { ethers } from 'hardhat';
import {
  BatchTokenIssuer__factory,
  ERC1820Registry__factory
} from '../../typechain-types';

const BATCH_ISSUER = 'BatchTokenIssuer';

export default async function () {
  const [owner] = await ethers.getSigners();

  const batchTokenIssuer = await new BatchTokenIssuer__factory(owner).deploy();
  BatchTokenIssuer__factory.setAsDeployed(batchTokenIssuer);
  console.log(
    '\n   > Batch issuer deployment: Success -->',
    batchTokenIssuer.address
  );

  const registry = ERC1820Registry__factory.deployed;

  await registry.setInterfaceImplementer(
    owner.address,
    ethers.utils.id(BATCH_ISSUER),
    batchTokenIssuer.address,
    { from: owner.address }
  );

  const registeredBatchTokenIssuerAddress =
    await registry.getInterfaceImplementer(
      owner.address,
      ethers.utils.id(BATCH_ISSUER)
    );

  if (registeredBatchTokenIssuerAddress === batchTokenIssuer.address) {
    console.log(
      '\n   > Batch issuer registry in ERC1820: Success -->',
      registeredBatchTokenIssuerAddress
    );
  }
}
