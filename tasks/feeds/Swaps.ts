import { ethers } from 'hardhat';
import { TradeRequestInputStruct } from 'typechain-types/Swaps';
import { ContractHelper } from '../../typechain-types';

const TYPE_SWAP = 0;
const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
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
  const [owner, tokenHolder1, executer] = await ethers.getSigners();
  const recipient1 = '0xe39d4ffC89A780e5214ed6D2d8528Cb058c60472';
  const token1Amount = args.amount;
  ContractHelper.setSigner(owner);

  const dvp = ContractHelper.Swaps.attach(args.address);

  console.log('Swaps address:', dvp.address);

  let security20, emoney20;

  if (args.security20) {
    security20 = ContractHelper.ERC20Token.attach(args.security20);
  } else {
    security20 = await ContractHelper.ERC20Token.deploy(
      'ERC20Token',
      'DAU',
      18
    );

    await security20.mint(tokenHolder1.address, issuanceAmount);
  }

  if (args.emoney20) {
    emoney20 = ContractHelper.ERC20Token.attach(args.emoney20);
  } else {
    emoney20 = await ContractHelper.ERC20Token.deploy('ERC20Token', 'DAU', 18);
    await emoney20.mint(recipient1, issuanceAmount);
  }

  console.log('emoney20 address:', emoney20.address);
  console.log('security20 address:', security20.address);

  if (token1Amount) {
    // approve swap to token1Amount from tokenHolder1
    await security20.connect(tokenHolder1).approve(dvp.address, token1Amount);
  }

  const chainTime = (await ethers.provider.getBlock('latest')).timestamp;
  const SECONDS_IN_A_WEEK = 86400 * 7;
  const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
  const tradeInputData: TradeRequestInputStruct = {
    holder1: tokenHolder1.address,
    holder2: recipient1,
    executer: executer.address,
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
