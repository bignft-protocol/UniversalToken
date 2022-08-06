import { ethers } from 'ethers';
import { getSigner } from '../../test/common/wallet';
import { ERC1400__factory } from '../../typechain-types';

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
  name?: string;
  uri?: string;
};

export default async function (args: Args) {
  const owner = getSigner();

  const erc1400 = ERC1400__factory.connect(args.address, owner);

  console.log('ERC1400 deployed at: ' + erc1400.address);

  if (args.name && args.uri) {
    const documentHash = ethers.utils.id(args.uri);
    const documentName = ethers.utils.id(args.name);
    const documentURI = args.uri;

    await erc1400.setDocument(documentName, documentURI, documentHash);
  }

  if (args.holder) {
    const tokenHolder = args.holder ?? owner.getAddress();
    await erc1400.issueByPartition(
      partition1,
      tokenHolder,
      args.amount,
      ZERO_BYTES32
    );

    const balance = await erc1400.balanceOf(tokenHolder);
    console.log('balance of', tokenHolder, balance.toString());
  }
}
