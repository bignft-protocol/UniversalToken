const { soliditySha3 } = require('web3-utils');

const BatchBalanceReader = artifacts.require('./BatchBalanceReader.sol'); // deprecated
const BatchReader = artifacts.require('./BatchReader.sol');

const ERC1820Registry = artifacts.require('IERC1820Registry');

const BALANCE_READER = 'BatchBalanceReader';
const READER = 'BatchReader';

module.exports = async function () {
  const accounts = await web3.eth.getAccounts();

  const batchReader = await BatchReader.new();
  BatchReader.setAsDeployed(batchReader);
  console.log(
    '\n   > Batch Reader deployment: Success -->',
    batchReader.address
  );

  const registry = await ERC1820Registry.at(
    '0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24'
  );

  await registry.setInterfaceImplementer(
    accounts[0],
    soliditySha3(READER),
    batchReader.address,
    { from: accounts[0] }
  );

  const registeredBatchReaderAddress = await registry.getInterfaceImplementer(
    accounts[0],
    soliditySha3(READER)
  );

  if (registeredBatchReaderAddress === batchReader.address) {
    console.log(
      '\n   > Batch Reader registry in ERC1820: Success -->',
      registeredBatchReaderAddress
    );
  }

  // Deprecated
  const batchBalanceReader = await BatchBalanceReader.new();
  BatchBalanceReader.setAsDeployed(batchBalanceReader);
  console.log(
    '\n   > Batch Balance Reader deployment: Success -->',
    batchBalanceReader.address
  );

  await registry.setInterfaceImplementer(
    accounts[0],
    soliditySha3(BALANCE_READER),
    batchBalanceReader.address,
    { from: accounts[0] }
  );

  const registeredBatchBalanceReaderAddress =
    await registry.getInterfaceImplementer(
      accounts[0],
      soliditySha3(BALANCE_READER)
    );

  if (registeredBatchBalanceReaderAddress === batchBalanceReader.address) {
    console.log(
      '\n   > BatchBalance Reader registry in ERC1820: Success -->',
      registeredBatchBalanceReaderAddress
    );
  }
  //
};
