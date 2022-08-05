import { ethers } from 'hardhat';
import { getSigners } from '../../test/common/wallet';
import {
  BatchReader__factory,
  ERC1820Registry__factory,
  BatchBalanceReader__factory
} from '../../typechain-types';

const BALANCE_READER = 'BatchBalanceReader';
const READER = 'BatchReader';

export default async function () {
  const [owner] = getSigners(1);

  const batchReader = await new BatchReader__factory(owner).deploy();
  BatchReader__factory.setAsDeployed(batchReader);
  console.log(
    '\n   > Batch Reader deployment: Success -->',
    batchReader.address
  );

  const registry = ERC1820Registry__factory.deployed;

  await registry.setInterfaceImplementer(
    owner.address,
    ethers.utils.id(READER),
    batchReader.address,
    { from: owner.address }
  );

  const registeredBatchReaderAddress = await registry.getInterfaceImplementer(
    owner.address,
    ethers.utils.id(READER)
  );

  if (registeredBatchReaderAddress === batchReader.address) {
    console.log(
      '\n   > Batch Reader registry in ERC1820: Success -->',
      registeredBatchReaderAddress
    );
  }

  // Deprecated
  const batchBalanceReader = await new BatchBalanceReader__factory(
    owner
  ).deploy();
  BatchBalanceReader__factory.setAsDeployed(batchBalanceReader);
  console.log(
    '\n   > Batch Balance Reader deployment: Success -->',
    batchBalanceReader.address
  );

  await registry.setInterfaceImplementer(
    owner.address,
    ethers.utils.id(BALANCE_READER),
    batchBalanceReader.address,
    { from: owner.address }
  );

  const registeredBatchBalanceReaderAddress =
    await registry.getInterfaceImplementer(
      owner.address,
      ethers.utils.id(BALANCE_READER)
    );

  if (registeredBatchBalanceReaderAddress === batchBalanceReader.address) {
    console.log(
      '\n   > BatchBalance Reader registry in ERC1820: Success -->',
      registeredBatchBalanceReaderAddress
    );
  }
  //
}
