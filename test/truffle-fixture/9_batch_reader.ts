import { artifacts, ethers } from 'hardhat';
import type {
  ERC1820Registry,
  BatchReader,
  BatchBalanceReader
} from '../../typechain-types';

const BatchBalanceReader = artifacts.require('BatchBalanceReader'); // deprecated
const BatchReader = artifacts.require('BatchReader');
const ERC1820Registry = artifacts.require('IERC1820Registry');

const BALANCE_READER = 'BatchBalanceReader';
const READER = 'BatchReader';

export default async function () {
  const [owner] = await ethers.getSigners();

  const batchReader: BatchReader = await BatchReader.new();
  BatchReader.setAsDeployed(batchReader);
  console.log(
    '\n   > Batch Reader deployment: Success -->',
    batchReader.address
  );

  const registry: ERC1820Registry = await ERC1820Registry.at(
    '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
  );

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
  const batchBalanceReader: BatchBalanceReader = await BatchBalanceReader.new();
  BatchBalanceReader.setAsDeployed(batchBalanceReader);
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
