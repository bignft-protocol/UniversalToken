import { ethers, artifacts } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  const ERC1400 = artifacts.require('ERC1400');

  const [owner] = await ethers.getSigners();

  const partition1 =
    '0x7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
  const partition2 =
    '0x6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
  const partition3 =
    '0x6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex

  const partitions = [partition1, partition2, partition3];

  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'contract-arguments.js'),
    `module.exports = [
    'ERC1400Token',
    'DAU',
    1,
    ['${owner.address}'],
    ${JSON.stringify(partitions)},
  ];
  `
  );

  const erc1400 = await ERC1400.new(
    'ERC1400Token',
    'DAU',
    1,
    [owner.address],
    partitions,
    { from: owner.address }
  );

  ERC1400.setAsDeployed(erc1400);

  console.log('ERC1400 deployed at: ' + erc1400.address);

  process.exit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
