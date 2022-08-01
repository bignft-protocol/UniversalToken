import { ethers } from 'hardhat';
import { ContractHelper, Swaps } from '../../typechain-types';

const ERC20STANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000002';
const OFFCHAIN =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
const issuanceAmount = 1000;
const token2Amount = 400;
const TYPE_ESCROW = 2;

type Args = {
  address: string;
  security20?: string;
  amount?: number;
};

// const fullCreateTradeRequest = async (
//     dvp: Swaps,
//     token1: { address: any },
//     token2: { address: any },
//     tokenStandard1: string,
//     tokenStandard2: string,
//     holder1: any,
//     holder2: any,
//     executer: any,
//     requester: any,
//     realExpirationDate: any,
//     tradeType1: any,
//     tradeType2: any,
//     tokenAmount1: any,
//     tokenAmount2: any,
//     settlementDate: number,
//     preimage: string
//   ) => {
//     const tokenAmount =
//       requester === holder1
//         ? tokenAmount1
//         : requester === holder2
//         ? tokenAmount2
//         : 0;
//     const tokenStandard =
//       requester === holder1
//         ? tokenStandard1
//         : requester === holder2
//         ? tokenStandard2
//         : OFFCHAIN;

//     const chainTime = (await ethers.provider.getBlock('latest')).timestamp;
//     const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;

//     const initialNumberOfTrades = (await dvp.getNbTrades()).toNumber();

//     await assertTokenTransferred(
//       dvp,
//       token1,
//       token2,
//       holder1,
//       holder2,
//       tokenStandard1,
//       tokenStandard2,
//       0,
//       0
//     );

//     /*
//     struct TradeRequestInput {
//       address holder1;
//       address holder2;
//       address executer; // Set to address(0) if no executer is required for the trade
//       uint256 expirationDate;
//       address tokenAddress1;
//       uint256 tokenValue1;
//       bytes32 tokenId1;
//       Standard tokenStandard1;
//       address tokenAddress2; // Set to address(0) if no token is expected in return (for example in case of an off-chain payment)
//       uint256 tokenValue2;
//       bytes32 tokenId2;
//       Standard tokenStandard2;
//       TradeType tradeType1;
//       TradeType tradeType2;
//       uint256 settlementDate;
//     }
//     */
//     const tradeInputData = {
//       holder1: holder1,
//       holder2: holder2,
//       executer: executer,
//       expirationDate: realExpirationDate ? expirationDate : 0,
//       tokenAddress1: token1 ? token1.address : ZERO_ADDRESS,
//       tokenValue1: tokenStandard1 === ERC721STANDARD ? 0 : tokenAmount1,
//       tokenId1:
//         tokenStandard1 === ERC721STANDARD
//           ? NumToNumBytes32(issuanceTokenId)
//           : tokenStandard1 === ERC1400STANDARD
//           ? partition1
//           : ZERO_BYTES32,
//       tokenStandard1: tokenStandard1,
//       tokenAddress2: token2 ? token2.address : ZERO_ADDRESS,
//       tokenValue2: tokenStandard2 === ERC721STANDARD ? 0 : tokenAmount2,
//       tokenId2:
//         tokenStandard2 === ERC721STANDARD
//           ? NumToNumBytes32(issuanceTokenId)
//           : tokenStandard2 === ERC1400STANDARD
//           ? partition1
//           : ZERO_BYTES32,
//       tokenStandard2: tokenStandard2,
//       tradeType1: tradeType1,
//       tradeType2: tradeType2,
//       settlementDate: settlementDate
//     };

//     await dvp.requestTrade(tradeInputData, preimage, {
//       from: requester,
//       value: tokenStandard === ETHSTANDARD ? tokenAmount : 0
//     });

//     const tradeIndex = (await dvp.getNbTrades()).toNumber();
//     assert.equal(tradeIndex, initialNumberOfTrades + 1);

//     await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);

//     await fullAssertTrade(
//       dvp,
//       tradeIndex,
//       holder1,
//       holder2,
//       executer,
//       realExpirationDate ? expirationDate : chainTime + 86400 * 30,
//       tradeType1,
//       tradeType2,
//       STATE_PENDING,
//       token1 ? token1.address : ZERO_ADDRESS,
//       tokenStandard1 === ERC721STANDARD ? 0 : tokenAmount1,
//       tokenStandard1 === ERC721STANDARD
//         ? NumToNumBytes32(issuanceTokenId)
//         : tokenStandard1 === ERC1400STANDARD
//         ? partition1
//         : ZERO_BYTES32,
//       tokenStandard1,
//       requester === holder1,
//       false,
//       token2 ? token2.address : ZERO_ADDRESS,
//       tokenStandard2 === ERC721STANDARD ? 0 : tokenAmount2,
//       tokenStandard2 === ERC721STANDARD
//         ? NumToNumBytes32(issuanceTokenId)
//         : tokenStandard2 === ERC1400STANDARD
//         ? partition1
//         : ZERO_BYTES32,
//       tokenStandard2,
//       requester === holder2,
//       false
//     );
//   };

export default async function (args: Args) {
  const [owner, tokenHolder1] = await ethers.getSigners();
  const token1Amount = args.amount;
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

  if (token1Amount) {
    // approve swap to token1Amount from tokenHolder1
    await security20.connect(tokenHolder1).approve(dvp.address, token1Amount);
  }

  const _txSender = '0xe39d4ffC89A780e5214ed6D2d8528Cb058c60472';
  const _token = '0x427189A2a402C5a11D0960EF169622Af6538Eb38';
  const rawTxPayload =
    '0x67c84919526573657276656400000000000000000000000000000000000000000000000000000000000000000000000015d34aaf54267db7d7c367839aaf71a00a2c6a6500000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000000080';
  const expirationTimeAsNumber = 123456;
  const nonce = 1;
}
