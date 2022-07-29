import { ethers, artifacts } from 'hardhat';
import type { ERC1400 } from 'typechain-types';

const ERC1400 = artifacts.require('ERC1400');

const partition1 =
  '0x7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
const partition2 =
  '0x6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
const partition3 =
  '0x6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

type Args = {
  address: string;
  amount: number;
  holder?: string;
};

export default async function (args: Args) {
  const [owner] = await ethers.getSigners();

  const erc1400: ERC1400 = await ERC1400.at(args.address);

  console.log('ERC1400 deployed at: ' + erc1400.address);
  const tokenHolder = args.holder ?? owner.address;
  await erc1400.issueByPartition(
    partition1,
    tokenHolder,
    args.amount,
    ZERO_BYTES32,
    { from: owner.address }
  );

  const balance = await erc1400.balanceOf(tokenHolder);
  console.log('balance of', tokenHolder, balance.toString());
}
