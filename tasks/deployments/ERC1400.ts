import { ERC1400__factory } from '../../typechain-types';
import fs from 'fs';
import { getSigner } from 'hardhat';
import { partitions } from '../../test/utils/bytes';

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
