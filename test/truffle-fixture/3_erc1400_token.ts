import { ethers } from 'hardhat';
import { ERC1400__factory } from '../../typechain-types';

const controller = '0xb5747835141b46f7C472393B31F8F5A57F74A44f';

const partition1 =
  '0x7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
const partition2 =
  '0x6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
const partition3 =
  '0x6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex
const partitions = [partition1, partition2, partition3];

export default async function () {
  const owner = ethers.provider.getSigner();
  const erc1400Token = await new ERC1400__factory(owner).deploy(
    'ERC1400Token',
    'DAU',
    1,
    [controller],
    partitions
  );
  ERC1400__factory.setAsDeployed(erc1400Token);
  console.log(
    '\n   > ERC1400 token deployment: Success -->',
    erc1400Token.address
  );
}
