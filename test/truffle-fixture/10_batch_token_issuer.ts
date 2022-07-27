import { artifacts, ethers } from 'hardhat';
import type { ERC1820Registry, BatchTokenIssuer } from '../../typechain-types';

const BatchTokenIssuer = artifacts.require('BatchTokenIssuer');

const ERC1820Registry = artifacts.require('ERC1820Registry');

const BATCH_ISSUER = 'BatchTokenIssuer';

export default async function () {
  const [owner] = await ethers.getSigners();

  const batchTokenIssuer: BatchTokenIssuer = await BatchTokenIssuer.new();
  BatchTokenIssuer.setAsDeployed(batchTokenIssuer);
  console.log(
    '\n   > Batch issuer deployment: Success -->',
    batchTokenIssuer.address
  );

  const registry: ERC1820Registry = await ERC1820Registry.deployed();

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
