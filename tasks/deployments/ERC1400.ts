import { ERC1400__factory } from '../../typechain-types';
import fs from 'fs';
import { getSigner } from '../../test/common/wallet';

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
  ['contract-arguments']?: string;
};

export default async function (args: Args) {
  const owner = getSigner();

  if (args['contract-arguments']) {
    fs.writeFileSync(
      args['contract-arguments'],
      `module.exports = [
    '${args.name}',
    '${args.symbol}',
    1,
    ['${args.address ?? (await owner.getAddress())}'],
    ${JSON.stringify(partitions)},
  ];
`
    );
  }

  const erc1400 = await new ERC1400__factory(owner).deploy(
    args.name,
    args.symbol,
    1,
    [args.address ?? (await owner.getAddress())],
    partitions
  );

  console.log('ERC1400 deployed at: ' + erc1400.address);
}
