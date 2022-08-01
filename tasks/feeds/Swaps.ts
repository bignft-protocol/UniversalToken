import { ethers } from 'hardhat';
import { ContractHelper } from '../../typechain-types';

const ERC20STANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000002';
const issuanceAmount = 1000;
const token1Amount = 10;
const token2Amount = 400;
const TYPE_ESCROW = 2;

type Args = {
  address: string;
  security20?: string;
};

export default async function (args: Args) {
  const [owner, tokenHolder1] = await ethers.getSigners();
  //@ts-ignore
  ContractHelper.setSigner(owner);

  const dvp = ContractHelper.Swaps.attach(args.address);

  console.log('Swaps address:', dvp.address);

  let security20;

  if (args.security20) {
    security20 = ContractHelper.ERC20Token.attach(args.security20);
  } else {
    const recipient1 = '0xe39d4ffC89A780e5214ed6D2d8528Cb058c60472';

    security20 = await ContractHelper.ERC20Token.deploy(
      'ERC20Token',
      'DAU',
      18
    );

    const emoney20 = await ContractHelper.ERC20Token.deploy(
      'ERC20Token',
      'DAU',
      18
    );
    console.log('emoney20 address:', emoney20.address);

    await security20.mint(tokenHolder1.address, issuanceAmount);
    await emoney20.mint(recipient1, issuanceAmount);
  }

  console.log('security20 address:', security20.address);

  // approve swap to token1Amount from tokenHolder1
  await security20.connect(tokenHolder1).approve(dvp.address, token1Amount);
}
