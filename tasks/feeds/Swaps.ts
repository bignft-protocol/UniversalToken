import { getSigners } from 'hardhat';
import { ZERO_BYTES32 } from '../../test/utils/assert';

import {
  ERC20Token__factory,
  Swaps,
  Swaps__factory
} from '../../typechain-types';

const TYPE_SWAP = 0;

const ERC20STANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000002';
const OFFCHAIN =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
const issuanceAmount = 1000;
const tokenAmount1 = 100;
const token2Amount = 400;
const TYPE_ESCROW = 2;

type Args = {
  address: string;
  security20?: string;
  emoney20?: string;
  amount?: number;
};

export default async function (args: Args) {
  const [owner, tokenHolder1, executer] = getSigners();
  const recipient1 = '0xe39d4ffC89A780e5214ed6D2d8528Cb058c60472';
  const token1Amount = args.amount;

  const dvp = Swaps__factory.connect(args.address, owner);

  console.log('Swaps address:', dvp.address);

  let security20, emoney20;

  if (args.security20) {
    security20 = ERC20Token__factory.connect(args.security20, owner);
  } else {
    security20 = await new ERC20Token__factory(owner).deploy(
      'ERC20Token',
      'DAU',
      18
    );

    await security20.mint(tokenHolder1.getAddress(), issuanceAmount);
  }

  if (args.emoney20) {
    emoney20 = ERC20Token__factory.connect(args.emoney20, owner);
  } else {
    emoney20 = await new ERC20Token__factory(owner).deploy(
      'ERC20Token',
      'DAU',
      18
    );
    await emoney20.mint(recipient1, issuanceAmount);
  }

  console.log('emoney20 address:', emoney20.address);
  console.log('security20 address:', security20.address);

  if (token1Amount) {
    // approve swap to token1Amount from tokenHolder1
    await security20.connect(tokenHolder1).approve(dvp.address, token1Amount);
  }

  const chainTime = (await owner.provider.getBlock('latest')).timestamp;
  const SECONDS_IN_A_WEEK = 86400 * 7;
  const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
  const tradeInputData: Swaps.TradeRequestInputStruct = {
    holder1: tokenHolder1.getAddress(),
    holder2: recipient1,
    executer: executer.getAddress(),
    expirationDate: expirationDate,
    tokenAddress1: security20.address,
    tokenValue1: tokenAmount1,
    tokenId1: ZERO_BYTES32,
    tokenStandard1: ERC20STANDARD,
    tokenAddress2: emoney20.address,
    tokenValue2: token2Amount,
    tokenId2: ZERO_BYTES32,
    tokenStandard2: ERC20STANDARD,
    tradeType1: TYPE_SWAP,
    tradeType2: TYPE_SWAP,
    settlementDate: 0
  };

  const res = await dvp.requestTrade(tradeInputData, ZERO_BYTES32, {
    value: 0
  });

  console.log(res);
}
