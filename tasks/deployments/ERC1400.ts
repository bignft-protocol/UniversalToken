import { ethers, artifacts } from 'hardhat';
import fs from 'fs';
import path from 'path';

const ERC1400 = artifacts.require('ERC1400');

const partition1 =
  '0x7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
const partition2 =
  '0x6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
const partition3 =
  '0x6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex

const partitions = [partition1, partition2, partition3];

type Args = {
  name: string;
  symbol: string;
  address?: string;
};

export default async function (args: Args) {
  const [owner] = await ethers.getSigners();

  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'contract-arguments.js'),
    `module.exports = [
    '${args.name}',
    '${args.symbol}',
    1,
    ['${args.address ?? owner.address}'],
    ${JSON.stringify(partitions)},
  ];
  `
  );

  const erc1400 = await ERC1400.new(
    args.name,
    args.symbol,
    1,
    [args.address ?? owner.address],
    partitions,
    { from: owner.address }
  );

  ERC1400.setAsDeployed(erc1400);

  console.log('ERC1400 deployed at: ' + erc1400.address);
}
