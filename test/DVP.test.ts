import { ethers, BigNumber, BigNumberish, Signer } from 'ethers';
import assert from 'assert';
import {
  Swaps,
  ERC1400,
  FakeERC1400Mock,
  ERC20Token,
  ERC721Token,
  Swaps__factory,
  ERC1400__factory,
  FakeERC1400Mock__factory,
  ERC20Token__factory,
  ERC721Token__factory,
  ERC20,
  ERC721
} from '../typechain-types';
import { advanceTimeAndBlock } from './utils/time';
import {
  addressToBytes32,
  numTostringBytes32,
  numToNumBytes32
} from './utils/bytes';

import {
  assertBalanceOfByPartition,
  assertEtherBalance,
  assertGlobalBalancesAreCorrect,
  assertRevert,
  assertTokenTransferred,
  assertTrade,
  assertTradeAccepted,
  assertTradeState,
  ERC1400STANDARD,
  ERC20STANDARD,
  ERC721STANDARD,
  ETHSTANDARD,
  fullAssertTrade,
  OFFCHAIN,
  STATE_CANCELLED,
  STATE_EXECUTED,
  STATE_FORCED,
  STATE_PENDING,
  TYPE_ESCROW,
  TYPE_SWAP,
  ZERO_ADDRESS,
  ZERO_BYTE,
  ZERO_BYTES32
} from './utils/assert';
import { extractTokenAmount, extractTokenStandard } from './utils/extract';
import truffleFixture from './truffle-fixture';
import { getSigners, provider } from 'hardhat';

const HEX_TYPE_ESCROW =
  '0x0000000000000000000000000000000000000000000000000000000000000002';
const HEX_TYPE_SWAP =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const VALID_CERTIFICATE =
  '0x1000000000000000000000000000000000000000000000000000000000000000';

const partition1 =
  '0x7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
const partition2 =
  '0x6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
const partition3 =
  '0x6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex
const partitions = [partition1, partition2, partition3];

const ALL_PARTITIONS =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

const MOCK_CERTIFICATE =
  '0x1000000000000000000000000000000000000000000000000000000000000000';

const partitionFlag =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'; // Flag to indicate a partition change
const dvpTradeProposalFlag =
  '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'; // Flag to indicate an DVP securities transfer
const dvpTradeAcceptanceFlag =
  '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'; // Flag to indicate an DVP e-money transfer

const ERC1400_TOKENS_RECIPIENT_INTERFACE_HASH = ethers.utils.id(
  'ERC1400TokensRecipient'
);
const ERC1400_TOKENS_SENDER_INTERFACE_HASH = ethers.utils.id(
  'ERC1400TokensSender'
);

const ERC1820_ACCEPT_MAGIC = ethers.utils.id('ERC1820_ACCEPT_MAGIC');

const ACCEPTED_TRUE = true;
const ACCEPTED_FALSE = false;

const APPROVED_TRUE = true;
const APPROVED_FALSE = false;

const issuanceAmount = 1000;
const token1Amount = 10;
const token2Amount = 400;
const token3Amount = 400;
const token4Amount = 10;
const issuanceTokenId = 123456789;

const SECONDS_IN_A_WEEK = 86400 * 7;

const getTradeProposalData = (
  _tradeRecipient: string,
  _tradeExecuter: string,
  _expirationDate: number,
  _settlementDate: number,
  _token2Address: string,
  _token2Amount: number,
  _token2Id: string,
  _token2Standard: BigNumberish,
  _tradeType2: number,
  isFake?: boolean
) => {
  const flag = isFake ? partitionFlag : dvpTradeProposalFlag;
  const hexTradeRecipient = addressToBytes32(_tradeRecipient);
  const hexTradeExecuter = addressToBytes32(_tradeExecuter);
  const hexExpirationDate = numTostringBytes32(_expirationDate);
  const hexSettlementDate = numTostringBytes32(_settlementDate);

  const hexTradeTokenAddress2 = addressToBytes32(_token2Address);
  const hexTradeTokenAmount2 = numTostringBytes32(_token2Amount);
  let hexTradeTokenId;
  if (typeof _token2Id === 'string' && _token2Id.length === 66) {
    hexTradeTokenId = _token2Id.substring(2);
  } else if (typeof _token2Id === 'number') {
    hexTradeTokenId = numTostringBytes32(_token2Id);
  } else {
    throw new Error('getTradeProposalData: Invalid type for tokenId');
  }

  const hexTradeTokenStandard2 = ethers.utils
    .hexlify(_token2Standard)
    .substring(2);
  const hexTradeType = numTostringBytes32(_tradeType2);
  const tradeTokenData = `${hexTradeTokenAddress2}${hexTradeTokenAmount2}${hexTradeTokenId}${hexTradeTokenStandard2}${hexTradeType}`;

  return `${flag}${hexTradeRecipient}${hexTradeExecuter}${hexExpirationDate}${hexSettlementDate}${tradeTokenData}`;
};

const getTradeAcceptanceData = (
  tradeIndex: number,
  isFake: boolean | undefined = false
) => {
  const flag = isFake ? partitionFlag : dvpTradeAcceptanceFlag;
  const hexTradeIndex = numTostringBytes32(tradeIndex);

  return `${flag}${hexTradeIndex}`;
};

const createTradeRequest = async (
  dvp: Swaps,
  token1: ERC1400 | ERC20 | ERC721 | undefined,
  token2: ERC1400 | ERC20 | ERC721 | undefined,
  tokenStandard1: BigNumberish,
  tokenStandard2: BigNumberish,
  holder1: string,
  holder2: string,
  executer: string,
  requesterSigner: Signer,
  realExpirationDate: boolean,
  tradeType: number,
  tokenAmount1: BigNumberish,
  tokenAmount2: BigNumberish
) => {
  await fullCreateTradeRequest(
    dvp,
    token1,
    token2,
    tokenStandard1,
    tokenStandard2,
    holder1,
    holder2,
    executer,
    requesterSigner,
    realExpirationDate,
    tradeType,
    tradeType,
    tokenAmount1,
    tokenAmount2,
    0,
    ZERO_BYTES32
  );
};

const fullCreateTradeRequest = async (
  dvp: Swaps,
  token1: ERC1400 | ERC20 | ERC721 | undefined,
  token2: ERC1400 | ERC20 | ERC721 | undefined,
  tokenStandard1: BigNumberish,
  tokenStandard2: BigNumberish,
  holder1: string,
  holder2: string,
  executer: string,
  requesterSigner: Signer,
  realExpirationDate: boolean,
  tradeType1: any,
  tradeType2: any,
  tokenAmount1: BigNumberish,
  tokenAmount2: BigNumberish,
  settlementDate: number,
  preimage: string
) => {
  const requester = await requesterSigner.getAddress();
  const tokenAmount =
    requester === holder1
      ? tokenAmount1
      : requester === holder2
      ? tokenAmount2
      : 0;
  const tokenStandard =
    requester === holder1
      ? tokenStandard1
      : requester === holder2
      ? tokenStandard2
      : OFFCHAIN;

  const chainTime = (await provider.getBlock('latest')).timestamp;
  const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;

  const initialNumberOfTrades = (await dvp.getNbTrades()).toNumber();

  await assertTokenTransferred(
    dvp,
    token1,
    token2,
    holder1,
    holder2,
    tokenStandard1,
    tokenStandard2,
    0,
    0,
    issuanceAmount,
    issuanceTokenId,
    partition1
  );

  /*
  struct TradeRequestInput {
    address holder1;
    address holder2;
    address executer; // Set to address(0) if no executer is required for the trade
    uint256 expirationDate;
    address tokenAddress1;
    uint256 tokenValue1;
    bytes32 tokenId1;
    Standard tokenStandard1;
    address tokenAddress2; // Set to address(0) if no token is expected in return (for example in case of an off-chain payment)
    uint256 tokenValue2;
    bytes32 tokenId2;
    Standard tokenStandard2;
    TradeType tradeType1;
    TradeType tradeType2;
    uint256 settlementDate;
  }
  */
  const tradeInputData = {
    holder1: holder1,
    holder2: holder2,
    executer,
    expirationDate: realExpirationDate ? expirationDate : 0,
    tokenAddress1: token1 ? token1.address : ZERO_ADDRESS,
    tokenValue1: BigNumber.from(tokenStandard1).eq(ERC721STANDARD)
      ? 0
      : tokenAmount1,
    tokenId1: BigNumber.from(tokenStandard1).eq(ERC721STANDARD)
      ? numToNumBytes32(issuanceTokenId)
      : BigNumber.from(tokenStandard1).eq(ERC1400STANDARD)
      ? partition1
      : ZERO_BYTES32,
    tokenStandard1: tokenStandard1,
    tokenAddress2: token2 ? token2.address : ZERO_ADDRESS,
    tokenValue2: BigNumber.from(tokenStandard2).eq(ERC721STANDARD)
      ? 0
      : tokenAmount2,
    tokenId2: BigNumber.from(tokenStandard2).eq(ERC721STANDARD)
      ? numToNumBytes32(issuanceTokenId)
      : BigNumber.from(tokenStandard2).eq(ERC1400STANDARD)
      ? partition1
      : ZERO_BYTES32,
    tokenStandard2: tokenStandard2,
    tradeType1: tradeType1,
    tradeType2: tradeType2,
    settlementDate: settlementDate
  };

  await dvp.connect(requesterSigner).requestTrade(tradeInputData, preimage, {
    value: BigNumber.from(tokenStandard).eq(ETHSTANDARD) ? tokenAmount : 0
  });

  const tradeIndex = (await dvp.getNbTrades()).toNumber();
  assert.strictEqual(tradeIndex, initialNumberOfTrades + 1);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  await fullAssertTrade(
    dvp,
    tradeIndex,
    holder1,
    holder2,
    executer,
    realExpirationDate ? expirationDate : chainTime + 86400 * 30,
    tradeType1,
    tradeType2,
    STATE_PENDING,
    token1 ? token1.address : ZERO_ADDRESS,
    BigNumber.from(tokenStandard1).eq(ERC721STANDARD) ? 0 : tokenAmount1,
    BigNumber.from(tokenStandard1).eq(ERC721STANDARD)
      ? numToNumBytes32(issuanceTokenId)
      : BigNumber.from(tokenStandard1).eq(ERC1400STANDARD)
      ? partition1
      : ZERO_BYTES32,
    tokenStandard1,
    requester === holder1,
    false,
    token2 ? token2.address : ZERO_ADDRESS,
    BigNumber.from(tokenStandard2).eq(ERC721STANDARD) ? 0 : tokenAmount2,
    BigNumber.from(tokenStandard2).eq(ERC721STANDARD)
      ? numToNumBytes32(issuanceTokenId)
      : BigNumber.from(tokenStandard2).eq(ERC1400STANDARD)
      ? partition1
      : ZERO_BYTES32,
    tokenStandard2,
    requester === holder2,
    false
  );
};

const createTradeRequestWithoutCallingDVP = async (
  dvp: Swaps,
  token1: ERC1400 | ERC20 | ERC721,
  token2: ERC1400 | ERC20 | ERC721,
  tokenStandard2: BigNumberish,
  tokenId2: string,
  holder1Signer: Signer,
  holder2: string,
  executer: string,
  realExpirationDate: boolean,
  tokenAmount1: number,
  tokenAmount2: number,
  openMarketplace: boolean = false
) => {
  const recipient = openMarketplace ? ZERO_ADDRESS : holder2;

  const chainTime = (await provider.getBlock('latest')).timestamp;
  const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;

  const initialNumberOfTrades = (await dvp.getNbTrades()).toNumber();

  const holder1 = await holder1Signer.getAddress();
  await assertTokenTransferred(
    dvp,
    token1,
    token2,
    holder1,
    holder2,
    ERC1400STANDARD,
    tokenStandard2,
    0,
    0,
    issuanceAmount,
    issuanceTokenId,
    partition1
  );

  const tradeProposalData = getTradeProposalData(
    recipient,
    executer,
    expirationDate,
    0,
    token2.address,
    tokenAmount2,
    tokenId2,
    tokenStandard2,
    TYPE_ESCROW
  );

  await (token1 as ERC1400)
    .connect(holder1Signer)
    .operatorTransferByPartition(
      partition1,
      holder1,
      dvp.address,
      tokenAmount1,
      tradeProposalData,
      MOCK_CERTIFICATE
    );

  const tradeIndex = (await dvp.getNbTrades()).toNumber();
  assert.strictEqual(tradeIndex, initialNumberOfTrades + 1);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    holder2,

    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  await assertTrade(
    dvp,
    tradeIndex,
    holder1,
    recipient,
    executer,
    realExpirationDate ? expirationDate : chainTime + 86400 * 30,
    TYPE_ESCROW,
    STATE_PENDING,
    token1 ? token1.address : ZERO_ADDRESS,
    tokenAmount1,
    partition1,
    ERC1400STANDARD,
    true,
    false,
    token2 ? token2.address : ZERO_ADDRESS,
    BigNumber.from(tokenStandard2).eq(ERC721STANDARD) ? 0 : tokenAmount2,
    BigNumber.from(tokenStandard2).eq(ERC721STANDARD)
      ? numToNumBytes32(issuanceTokenId)
      : tokenId2,
    tokenStandard2,
    false,
    false
  );
};

const acceptTradeRequest = async (
  dvp: Swaps,
  token1: ERC1400 | ERC20 | ERC721 | undefined,
  token2: ERC1400 | ERC20 | ERC721 | undefined,
  tradeIndex: number,
  requesterSigner: Signer,
  newTradeState: number,
  acceptedTrade: boolean
) => {
  await acceptTradeRequestWithPreimage(
    dvp,
    token1,
    token2,
    tradeIndex,
    requesterSigner,
    newTradeState,
    acceptedTrade,
    ZERO_BYTES32
  );
};

const acceptTradeRequestWithPreimage = async (
  dvp: Swaps,
  token1: ERC1400 | ERC20 | ERC721 | undefined,
  token2: ERC1400 | ERC20 | ERC721 | undefined,
  tradeIndex: BigNumberish,
  requesterSigner: Signer,
  newTradeState: any,
  acceptedTrade: any,
  preimage: string
) => {
  const trade = await dvp.getTrade(tradeIndex);
  const holder1 = trade.holder1;
  const holder2 = trade.holder2;

  const tokenData1 = trade.userTradeData1;
  const tokenStandard1 = extractTokenStandard(tokenData1);
  const tokenAmount1 = extractTokenAmount(tokenData1);

  const tokenData2 = trade.userTradeData2;
  const tokenStandard2 = extractTokenStandard(tokenData2);
  const tokenAmount2 = extractTokenAmount(tokenData2);

  const requester = await requesterSigner.getAddress();

  const tokenAmount =
    requester === holder1
      ? tokenAmount1
      : requester === holder2
      ? tokenAmount2
      : 0;
  const tokenStandard =
    requester === holder1
      ? tokenStandard1
      : requester === holder2
      ? tokenStandard2
      : OFFCHAIN;

  assert.strictEqual(await dvp.getTradeAcceptanceStatus(tradeIndex), false);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  await dvp.connect(requesterSigner).acceptTrade(tradeIndex, preimage, {
    value: BigNumber.from(tokenStandard).eq(ETHSTANDARD) ? tokenAmount : 0
  });
  await assertTradeState(dvp, tradeIndex, newTradeState);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  await assertTradeAccepted(dvp, tradeIndex, requester, true);

  assert.strictEqual(
    await dvp.getTradeAcceptanceStatus(tradeIndex),
    acceptedTrade
  );
};

const acceptTradeRequestWithoutCallingDVP = async (
  dvp: Swaps,
  token1: ERC1400 | ERC20 | ERC721,
  token2: ERC1400 | ERC20 | ERC721,
  tradeIndex: number,
  requesterSigner: Signer,
  newTradeState: number,
  acceptedTrade: boolean
) => {
  const trade = await dvp.getTrade(tradeIndex);
  const requester = await requesterSigner.getAddress();
  const holder1 = trade.holder1;
  const holder2 = trade.holder2 !== ZERO_ADDRESS ? trade.holder2 : requester;

  const tokenData1 = trade.userTradeData1;
  const tokenAmount1 = extractTokenAmount(tokenData1);

  const tokenData2 = trade.userTradeData2;
  const tokenAmount2 = extractTokenAmount(tokenData2);

  const tokenAmount =
    requester === holder1
      ? tokenAmount1
      : requester === holder2
      ? tokenAmount2
      : 0;

  assert.strictEqual(await dvp.getTradeAcceptanceStatus(tradeIndex), false);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  const tradeAcceptanceData = getTradeAcceptanceData(tradeIndex);

  await (token2 as ERC1400)
    .connect(requesterSigner)
    .operatorTransferByPartition(
      partition1,
      requester,
      dvp.address,
      tokenAmount,
      tradeAcceptanceData,
      MOCK_CERTIFICATE
    );

  await assertTradeState(dvp, tradeIndex, newTradeState);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  await assertTradeAccepted(dvp, tradeIndex, requester, true);

  assert.strictEqual(
    await dvp.getTradeAcceptanceStatus(tradeIndex),
    acceptedTrade
  );

  if (trade.holder2 === ZERO_ADDRESS) {
    const updatedtrade = await dvp.getTrade(tradeIndex);
    assert.strictEqual(updatedtrade.holder2, requester);
  }
};

const approveTradeRequest = async (
  dvp: Swaps,
  token1: ERC1400 | ERC20 | ERC721,
  token2: ERC1400 | ERC20 | ERC721,
  tradeIndex: BigNumberish,
  requesterSigner: Signer,
  newTradeState: number,
  approvedTrade: boolean
) => {
  assert.strictEqual(await dvp.getTradeApprovalStatus(tradeIndex), false);
  const requester = await requesterSigner.getAddress();
  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  await dvp.connect(requesterSigner).approveTrade(tradeIndex, true);
  await assertTradeState(dvp, tradeIndex, newTradeState);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  assert.strictEqual(
    await dvp.getTradeApprovalStatus(tradeIndex),
    approvedTrade
  );
};

const executeTradeRequest = async (
  dvp: Swaps,
  token1: ERC1400 | ERC20 | ERC721 | undefined,
  token2: ERC1400 | ERC20 | ERC721 | undefined,
  tradeIndex: BigNumberish,
  requesterSigner: Signer
) => {
  const requester = await requesterSigner.getAddress();
  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  await dvp.connect(requesterSigner).executeTrade(tradeIndex);
  await assertTradeState(dvp, tradeIndex, STATE_EXECUTED);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );
};

const forceTradeRequest = async (
  dvp: Swaps,
  token1: ERC1400 | ERC20 | ERC721,
  token2: ERC1400 | ERC20 | ERC721,
  tradeIndex: BigNumberish,
  requesterSigner: Signer
) => {
  const requester = await requesterSigner.getAddress();
  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  await dvp.connect(requesterSigner).forceTrade(tradeIndex);
  await assertTradeState(dvp, tradeIndex, STATE_FORCED);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );
};

const cancelTradeRequest = async (
  dvp: Swaps,
  token1: ERC1400 | ERC20 | ERC721,
  token2: ERC1400 | ERC20 | ERC721,
  tradeIndex: BigNumberish,
  requesterSigner: Signer
) => {
  const requester = await requesterSigner.getAddress();
  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );

  await dvp.connect(requesterSigner).cancelTrade(tradeIndex);
  await assertTradeState(dvp, tradeIndex, STATE_CANCELLED);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    issuanceAmount,
    issuanceTokenId,
    partition1,
    partition2
  );
};

describe('DVP', function () {
  const [
    signer,
    tokenController1Signer,
    tokenController2Signer,
    executerSigner,
    oracleSigner,
    tokenHolder1Signer,
    tokenHolder2Signer,
    recipient1Signer,
    recipient2Signer,
    unknownSigner
  ] = getSigners(10);

  before(async function () {
    await truffleFixture([2]);
  });

  // PARAMETERS

  describe('parameters', function () {
    describe('owner', function () {
      it('returns the owner of the contract', async function () {
        const dvp = await new Swaps__factory(signer).deploy(false);

        assert.strictEqual(await dvp.owner(), await signer.getAddress());
      });
    });
    describe('tradeExecuters', function () {
      it('returns the list of trade executers', async function () {
        const dvp = await new Swaps__factory(signer).deploy(true);

        const tradeExecuters = await dvp.tradeExecuters();

        assert.strictEqual(tradeExecuters.length, 1);
        assert.strictEqual(tradeExecuters[0], await signer.getAddress());
      });
      it('returns empty list of trade executers', async function () {
        const dvp = await new Swaps__factory(signer).deploy(false);

        const tradeExecuters = await dvp.tradeExecuters();

        assert.strictEqual(tradeExecuters.length, 0);
      });
    });
  });

  // CANIMPLEMENTINTERFACEFORADDRESS

  describe('canImplementInterfaceForAddress', function () {
    let dvp: Swaps;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);
    });
    describe('when the interface label is ERC777TokensRecipient', function () {
      it('returns ERC1820_ACCEPT_MAGIC', async function () {
        const answer = await dvp.canImplementInterfaceForAddress(
          ERC1400_TOKENS_RECIPIENT_INTERFACE_HASH,
          unknownSigner.getAddress()
        );
        assert.strictEqual(answer, ERC1820_ACCEPT_MAGIC);
      });
    });
    describe('when the interface label is not ERC777TokensRecipient', function () {
      it('returns empty bytes32', async function () {
        const answer = await dvp.canImplementInterfaceForAddress(
          ERC1400_TOKENS_SENDER_INTERFACE_HASH,
          unknownSigner.getAddress()
        );
        assert.strictEqual(answer, ZERO_BYTES32);
      });
    });
  });

  // CANRECEIVE

  describe('canReceive', function () {
    let dvp: Swaps;
    let emoney1400: ERC1400;
    let tradeProposalData: string;
    let tradeAcceptanceData: string;
    let fakeTradeProposalData: string;
    let fakeTradeAcceptanceData: string;

    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      emoney1400 = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [signer.getAddress()],
        partitions
      );

      const chainTime = (await provider.getBlock('latest')).timestamp;
      const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
      tradeProposalData = getTradeProposalData(
        await recipient1Signer.getAddress(),
        await executerSigner.getAddress(),
        expirationDate,
        0,
        emoney1400.address,
        token2Amount,
        partition1,
        ERC1400STANDARD,
        TYPE_ESCROW
      );
      tradeAcceptanceData = getTradeAcceptanceData(1);

      fakeTradeProposalData = getTradeProposalData(
        await recipient1Signer.getAddress(),
        await executerSigner.getAddress(),
        expirationDate,
        0,
        emoney1400.address,
        token2Amount,
        partition1,
        ERC1400STANDARD,
        TYPE_ESCROW,
        true
      );
      fakeTradeAcceptanceData = getTradeAcceptanceData(1, true);
    });
    describe('when operatorData is not empty', function () {
      describe('when data has the correct length', function () {
        describe('when data has the right format', function () {
          describe('when data is formatted for a trade proposal', function () {
            it('returns true', async function () {
              const answer = await dvp.canReceive(
                '0x00000000',
                partition1,
                unknownSigner.getAddress(),
                unknownSigner.getAddress(),
                unknownSigner.getAddress(),
                1,
                tradeProposalData,
                MOCK_CERTIFICATE
              );
              assert.strictEqual(answer, true);
            });
          });
          describe('when data is formatted for a trade acceptance', function () {
            it('returns true', async function () {
              const answer = await dvp.canReceive(
                '0x00000000',
                partition1,
                unknownSigner.getAddress(),
                unknownSigner.getAddress(),
                unknownSigner.getAddress(),
                1,
                tradeAcceptanceData,
                MOCK_CERTIFICATE
              );
              assert.strictEqual(answer, true);
            });
          });
        });
        describe('when data does not have the right format', function () {
          it('returns false', async function () {
            const answer = await dvp.canReceive(
              '0x00000000',
              partition1,
              unknownSigner.getAddress(),
              unknownSigner.getAddress(),
              unknownSigner.getAddress(),
              1,
              fakeTradeProposalData,
              MOCK_CERTIFICATE
            );
            assert.strictEqual(answer, false);
          });
          it('returns false', async function () {
            const answer = await dvp.canReceive(
              '0x00000000',
              partition1,
              unknownSigner.getAddress(),
              unknownSigner.getAddress(),
              unknownSigner.getAddress(),
              1,
              fakeTradeAcceptanceData,
              MOCK_CERTIFICATE
            );
            assert.strictEqual(answer, false);
          });
        });
      });
      describe('when data does not have the correct length', function () {
        it('returns false', async function () {
          const answer = await dvp.canReceive(
            '0x00000000',
            partition1,
            unknownSigner.getAddress(),
            unknownSigner.getAddress(),
            unknownSigner.getAddress(),
            1,
            tradeProposalData.substring(0, tradeProposalData.length - 2),
            MOCK_CERTIFICATE
          );
          assert.strictEqual(answer, false);
        });
      });
    });
    describe('when operatorData is empty', function () {
      it('returns false', async function () {
        const answer = await dvp.canReceive(
          '0x00000000',
          partition1,
          unknownSigner.getAddress(),
          unknownSigner.getAddress(),
          unknownSigner.getAddress(),
          1,
          tradeProposalData,
          ZERO_BYTE
        );
        assert.strictEqual(answer, false);
      });
    });
  });

  // TOKENSRECEIVED (HOOK)

  describe('tokensReceived', function () {
    let dvp: Swaps;
    let security1400: ERC1400;
    let emoney1400: ERC1400;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      security1400 = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [signer.getAddress()],
        partitions
      );
      await security1400.issueByPartition(
        partition1,
        tokenHolder1Signer.getAddress(),
        issuanceAmount,
        MOCK_CERTIFICATE
      );

      emoney1400 = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [signer.getAddress()],
        partitions
      );
      await emoney1400.issueByPartition(
        partition1,
        recipient1Signer.getAddress(),
        issuanceAmount,
        MOCK_CERTIFICATE
      );
    });
    describe('when hook is called from ERC1400 contract', function () {
      describe('when recipient is the DVP contract', function () {
        describe('when data field is valid', function () {
          describe('when received tokens correspond to a new trade proposal', function () {
            it('creates and accepts the trade request', async function () {
              assert.strictEqual((await dvp.getNbTrades()).eq(0), true);
              // await createTradeRequestWithoutCallingDVP(
              //   dvp,
              //   security1400,
              //   emoney1400,
              //   ERC1400STANDARD,
              //   partition1,
              //   tokenHolder1Signer,
              //   recipient1Signer.getAddress(),
              //   executerSigner.getAddress(),
              //   true,
              //   token1Amount,
              //   token2Amount
              // );
              // assert.strictEqual((await dvp.getNbTrades()).eq(1), true);
            });
            it('creates and accepts a second trade request', async function () {
              assert.strictEqual((await dvp.getNbTrades()).eq(0), true);
              await createTradeRequestWithoutCallingDVP(
                dvp,
                security1400,
                emoney1400,
                ERC1400STANDARD,
                partition1,
                tokenHolder1Signer,
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                true,
                token1Amount,
                token2Amount
              );

              const chainTime = (await provider.getBlock('latest')).timestamp;
              const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
              const tradeProposalData = getTradeProposalData(
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                expirationDate,
                0,
                emoney1400.address,
                token2Amount,
                partition1,
                ERC1400STANDARD,
                TYPE_ESCROW
              );
              await security1400
                .connect(tokenHolder1Signer)
                .operatorTransferByPartition(
                  partition1,
                  tokenHolder1Signer.getAddress(),
                  dvp.address,
                  token1Amount,
                  tradeProposalData,
                  MOCK_CERTIFICATE
                );
              assert.strictEqual((await dvp.getNbTrades()).eq(2), true);
            });
          });
          describe('when received tokens correspond to an existing trade acceptance', function () {
            describe('when trade state is PENDING', function () {
              describe('when trade recipient is defined', function () {
                describe('when token sender is the holder registered in the trade', function () {
                  describe('when token is the correct token', function () {
                    describe('when partition is the correct partition', function () {
                      describe('when token standard for the trade is ERC1400', function () {
                        describe('when token amount is correct', function () {
                          describe('when there is an executer', function () {
                            it('accepts the trade request', async function () {
                              await createTradeRequestWithoutCallingDVP(
                                dvp,
                                security1400,
                                emoney1400,
                                ERC1400STANDARD,
                                partition1,
                                tokenHolder1Signer,
                                await recipient1Signer.getAddress(),
                                await executerSigner.getAddress(),
                                true,
                                token1Amount,
                                token2Amount
                              );
                              await acceptTradeRequestWithoutCallingDVP(
                                dvp,
                                security1400,
                                emoney1400,
                                1,
                                recipient1Signer,
                                STATE_PENDING,
                                ACCEPTED_TRUE
                              );
                            });
                          });
                          describe('when there is no executer', function () {
                            it('accepts and executes the trade request [USE CASE - ATOMIC DELIVERY VS PAYMENT IN 2 TRANSACTIONS ONLY]', async function () {
                              await createTradeRequestWithoutCallingDVP(
                                dvp,
                                security1400,
                                emoney1400,
                                ERC1400STANDARD,
                                partition1,
                                tokenHolder1Signer,
                                await recipient1Signer.getAddress(),
                                ZERO_ADDRESS,
                                true,
                                token1Amount,
                                token2Amount
                              );
                              await acceptTradeRequestWithoutCallingDVP(
                                dvp,
                                security1400,
                                emoney1400,
                                1,
                                recipient1Signer,
                                STATE_EXECUTED,
                                ACCEPTED_TRUE
                              );
                            });
                          });
                        });
                        describe('when token amount is not correct', function () {
                          describe('when there is no executer', function () {
                            it('reverts', async function () {
                              await createTradeRequestWithoutCallingDVP(
                                dvp,
                                security1400,
                                emoney1400,
                                ERC1400STANDARD,
                                partition1,
                                tokenHolder1Signer,
                                await recipient1Signer.getAddress(),
                                ZERO_ADDRESS,
                                true,
                                token1Amount,
                                token2Amount
                              );
                              const tradeAcceptanceData =
                                getTradeAcceptanceData(1);
                              await assertRevert(
                                emoney1400
                                  .connect(recipient1Signer)
                                  .operatorTransferByPartition(
                                    partition1,
                                    recipient1Signer.getAddress(),
                                    dvp.address,
                                    token2Amount + 1,
                                    tradeAcceptanceData,
                                    MOCK_CERTIFICATE
                                  )
                              );
                            });
                          });
                        });
                      });
                      describe('when token standard for the trade is not ERC1400', function () {
                        it('reverts', async function () {
                          await createTradeRequestWithoutCallingDVP(
                            dvp,
                            security1400,
                            emoney1400,
                            ERC20STANDARD,
                            partition1,
                            tokenHolder1Signer,
                            await recipient1Signer.getAddress(),
                            await executerSigner.getAddress(),
                            true,
                            token1Amount,
                            token2Amount
                          );
                          const tradeAcceptanceData = getTradeAcceptanceData(1);
                          await assertRevert(
                            emoney1400
                              .connect(recipient1Signer)
                              .operatorTransferByPartition(
                                partition1,
                                recipient1Signer.getAddress(),
                                dvp.address,
                                token2Amount,
                                tradeAcceptanceData,
                                MOCK_CERTIFICATE
                              )
                          );
                        });
                      });
                    });
                    describe('when partition is not the correct partition', function () {
                      beforeEach(async function () {
                        await emoney1400.issueByPartition(
                          partition2,
                          recipient1Signer.getAddress(),
                          issuanceAmount,
                          MOCK_CERTIFICATE
                        );
                      });
                      it('reverts', async function () {
                        await createTradeRequestWithoutCallingDVP(
                          dvp,
                          security1400,
                          emoney1400,
                          ERC1400STANDARD,
                          partition1,
                          tokenHolder1Signer,
                          await recipient1Signer.getAddress(),
                          await executerSigner.getAddress(),
                          true,
                          token1Amount,
                          token2Amount
                        );
                        const tradeAcceptanceData = getTradeAcceptanceData(1);
                        await assertRevert(
                          emoney1400
                            .connect(recipient1Signer)
                            .operatorTransferByPartition(
                              partition2,
                              recipient1Signer.getAddress(),
                              dvp.address,
                              token2Amount,
                              tradeAcceptanceData,
                              MOCK_CERTIFICATE
                            )
                        );
                      });
                    });
                  });
                  describe('when token is not the correct token', function () {
                    let wrongEmoney1400: ERC1400;
                    beforeEach(async function () {
                      wrongEmoney1400 = await new ERC1400__factory(
                        signer
                      ).deploy(
                        'ERC1400Token',
                        'DAU',
                        1,
                        [signer.getAddress()],
                        partitions
                      );
                      await wrongEmoney1400.issueByPartition(
                        partition1,
                        recipient1Signer.getAddress(),
                        issuanceAmount,
                        MOCK_CERTIFICATE
                      );
                    });
                    it('reverts', async function () {
                      await createTradeRequestWithoutCallingDVP(
                        dvp,
                        security1400,
                        emoney1400,
                        ERC1400STANDARD,
                        partition1,
                        tokenHolder1Signer,
                        await recipient1Signer.getAddress(),
                        await executerSigner.getAddress(),
                        true,
                        token1Amount,
                        token2Amount
                      );
                      const tradeAcceptanceData = getTradeAcceptanceData(1);
                      await assertRevert(
                        wrongEmoney1400
                          .connect(recipient1Signer)
                          .operatorTransferByPartition(
                            partition1,
                            recipient1Signer.getAddress(),
                            dvp.address,
                            token2Amount,
                            tradeAcceptanceData,
                            MOCK_CERTIFICATE
                          )
                      );
                    });
                  });
                });
                describe('when token sender is not the holder registered in the trade', function () {
                  beforeEach(async function () {
                    await emoney1400.issueByPartition(
                      partition1,
                      recipient2Signer.getAddress(),
                      issuanceAmount,
                      MOCK_CERTIFICATE
                    );
                  });
                  it('reverts', async function () {
                    await createTradeRequestWithoutCallingDVP(
                      dvp,
                      security1400,
                      emoney1400,
                      ERC1400STANDARD,
                      partition1,
                      tokenHolder1Signer,
                      await recipient1Signer.getAddress(),
                      await executerSigner.getAddress(),
                      true,
                      token1Amount,
                      token2Amount
                    );
                    const tradeAcceptanceData = getTradeAcceptanceData(1);
                    await assertRevert(
                      emoney1400
                        .connect(recipient2Signer)
                        .operatorTransferByPartition(
                          partition1,
                          recipient2Signer.getAddress(),
                          dvp.address,
                          token2Amount,
                          tradeAcceptanceData,
                          MOCK_CERTIFICATE
                        )
                    );
                  });
                });
              });
              describe('when trade recipient is not defined', function () {
                describe('when there is an executer', function () {
                  it('accepts and executes the trade request [USE CASE - ATOMIC DELIVERY VS PAYMENT IN 2 TRANSACTIONS ONLY - MARKETPLACE]', async function () {
                    await createTradeRequestWithoutCallingDVP(
                      dvp,
                      security1400,
                      emoney1400,
                      ERC1400STANDARD,
                      partition1,
                      tokenHolder1Signer,
                      await recipient1Signer.getAddress(),
                      ZERO_ADDRESS,
                      true,
                      token1Amount,
                      token2Amount,
                      true
                    );
                    await acceptTradeRequestWithoutCallingDVP(
                      dvp,
                      security1400,
                      emoney1400,
                      1,
                      recipient1Signer,
                      STATE_EXECUTED,
                      ACCEPTED_TRUE
                    );
                  });
                });
              });
            });
            describe('when trade state is not PENDING', function () {
              it('reverts', async function () {
                await createTradeRequestWithoutCallingDVP(
                  dvp,
                  security1400,
                  emoney1400,
                  ERC1400STANDARD,
                  partition1,
                  tokenHolder1Signer,
                  await recipient1Signer.getAddress(),
                  await executerSigner.getAddress(),
                  true,
                  token1Amount,
                  token2Amount
                );
                await acceptTradeRequestWithoutCallingDVP(
                  dvp,
                  security1400,
                  emoney1400,
                  1,
                  recipient1Signer,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );
                const tradeAcceptanceData = getTradeAcceptanceData(1);
                await assertRevert(
                  emoney1400
                    .connect(recipient1Signer)
                    .operatorTransferByPartition(
                      partition1,
                      recipient1Signer.getAddress(),
                      dvp.address,
                      token2Amount,
                      tradeAcceptanceData,
                      MOCK_CERTIFICATE
                    )
                );
              });
            });
          });
        });
        describe('when data field is not valid', function () {
          it('reverts', async function () {
            await createTradeRequestWithoutCallingDVP(
              dvp,
              security1400,
              emoney1400,
              ERC1400STANDARD,
              partition1,
              tokenHolder1Signer,
              await recipient1Signer.getAddress(),
              await executerSigner.getAddress(),
              true,
              token1Amount,
              token2Amount
            );
            const fakeTradeAcceptanceData = getTradeAcceptanceData(1, true);
            await assertRevert(
              emoney1400
                .connect(recipient1Signer)
                .operatorTransferByPartition(
                  partition1,
                  recipient1Signer.getAddress(),
                  dvp.address,
                  token2Amount,
                  fakeTradeAcceptanceData,
                  MOCK_CERTIFICATE
                )
            );
          });
        });
      });
      describe('when recipient is not the DVP contract', function () {
        let fakeSecurity1400: FakeERC1400Mock;
        beforeEach(async function () {
          fakeSecurity1400 = await new FakeERC1400Mock__factory(signer).deploy(
            'ERC1400Token',
            'DAU20',
            1,
            [signer.getAddress()],
            partitions,
            ZERO_ADDRESS,
            ZERO_ADDRESS
          );
          await fakeSecurity1400.issueByPartition(
            partition1,
            tokenHolder1Signer.getAddress(),
            issuanceAmount,
            MOCK_CERTIFICATE
          );
        });
        it('reverts', async function () {
          const chainTime = (await provider.getBlock('latest')).timestamp;
          const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
          const tradeProposalData = getTradeProposalData(
            await recipient1Signer.getAddress(),
            await executerSigner.getAddress(),
            expirationDate,
            0,
            emoney1400.address,
            token2Amount,
            partition1,
            ERC1400STANDARD,
            TYPE_ESCROW
          );
          await assertRevert(
            fakeSecurity1400
              .connect(tokenHolder1Signer)
              .operatorTransferByPartition(
                partition1,
                tokenHolder1Signer.getAddress(),
                dvp.address,
                token1Amount,
                tradeProposalData,
                MOCK_CERTIFICATE
              )
          );
        });
      });
    });
    describe('when hook is not called from ERC1400 contract', function () {
      it('reverts', async function () {
        const chainTime = (await provider.getBlock('latest')).timestamp;
        const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
        const tradeProposalData = getTradeProposalData(
          await recipient1Signer.getAddress(),
          await executerSigner.getAddress(),
          expirationDate,
          0,
          emoney1400.address,
          token2Amount,
          partition1,
          ERC1400STANDARD,
          TYPE_ESCROW
        );
        await assertRevert(
          dvp
            .connect(tokenHolder1Signer)
            .tokensReceived(
              ZERO_BYTE,
              partition1,
              tokenHolder1Signer.getAddress(),
              tokenHolder1Signer.getAddress(),
              dvp.address,
              token1Amount,
              tradeProposalData,
              MOCK_CERTIFICATE
            )
        );
      });
    });
  });

  // REQUESTTRADE

  describe('requestTrade', function () {
    let dvp: Swaps;
    let security20: ERC20Token;
    let emoney20: ERC20Token;

    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      security20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      emoney20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );

      await security20.mint(tokenHolder1Signer.getAddress(), issuanceAmount);
      await emoney20.mint(recipient1Signer.getAddress(), issuanceAmount);
    });
    describe('when none of the 2 tokens is ETH', function () {
      describe('when the DVP contract is not controllable', function () {
        describe('when escrowable is not forbidden', function () {
          describe('when expiration date is defined', function () {
            describe('when sender is holder 1', function () {
              describe('when DVP request is of type Escrow', function () {
                describe('when token standard is ERC20', function () {
                  it('creates and accepts the trade request', async function () {
                    await security20
                      .connect(tokenHolder1Signer)
                      .approve(dvp.address, token1Amount);
                    await createTradeRequest(
                      dvp,
                      security20,
                      emoney20,
                      ERC20STANDARD,
                      ERC20STANDARD,
                      await tokenHolder1Signer.getAddress(),
                      await recipient1Signer.getAddress(),
                      ZERO_ADDRESS,
                      tokenHolder1Signer,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                  });
                });
                describe('when token standard is ERC721', function () {
                  it('creates and accepts the trade request', async function () {
                    const security721 = await new ERC721Token__factory(
                      signer
                    ).deploy('ERC721Token', 'DAU721', '', '');
                    await security721.mint(
                      tokenHolder1Signer.getAddress(),
                      issuanceTokenId
                    );
                    await security721
                      .connect(tokenHolder1Signer)
                      .approve(dvp.address, issuanceTokenId);

                    await createTradeRequest(
                      dvp,
                      security721,
                      emoney20,
                      ERC721STANDARD,
                      ERC20STANDARD,
                      await tokenHolder1Signer.getAddress(),
                      await recipient1Signer.getAddress(),
                      ZERO_ADDRESS,
                      tokenHolder1Signer,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                  });
                });
                describe('when token standard is ERC1400', function () {
                  it('creates and accepts the trade request', async function () {
                    const security1400 = await new ERC1400__factory(
                      signer
                    ).deploy('ERC1400Token', 'DAU', 1, [], partitions);

                    await security1400.issueByPartition(
                      partition1,
                      tokenHolder1Signer.getAddress(),
                      issuanceAmount,
                      VALID_CERTIFICATE
                    );
                    await security1400
                      .connect(tokenHolder1Signer)
                      .approveByPartition(
                        partition1,
                        dvp.address,
                        token1Amount
                      );

                    await createTradeRequest(
                      dvp,
                      security1400,
                      emoney20,
                      ERC1400STANDARD,
                      ERC20STANDARD,
                      await tokenHolder1Signer.getAddress(),
                      await recipient1Signer.getAddress(),
                      ZERO_ADDRESS,
                      tokenHolder1Signer,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                  });
                });
                describe('when payment is made off-chain', function () {
                  it('creates and accepts the trade request', async function () {
                    await createTradeRequest(
                      dvp,
                      security20,
                      undefined,
                      ERC20STANDARD,
                      OFFCHAIN,
                      await tokenHolder1Signer.getAddress(),
                      await recipient1Signer.getAddress(),
                      ZERO_ADDRESS,
                      recipient1Signer,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                  });
                });
              });
              describe('when DVP request is of type Swap', function () {
                describe('when token standard is ERC20', function () {
                  it('creates and accepts the trade request', async function () {
                    await security20
                      .connect(tokenHolder1Signer)
                      .approve(dvp.address, token1Amount);
                    await createTradeRequest(
                      dvp,
                      security20,
                      emoney20,
                      ERC20STANDARD,
                      ERC20STANDARD,
                      await tokenHolder1Signer.getAddress(),
                      await recipient1Signer.getAddress(),
                      ZERO_ADDRESS,
                      tokenHolder1Signer,
                      true,
                      TYPE_SWAP,
                      token1Amount,
                      token2Amount
                    );
                  });
                });
                describe('when token standard is ERC721', function () {
                  it('creates and accepts the trade request', async function () {
                    const security721 = await new ERC721Token__factory(
                      signer
                    ).deploy('ERC721Token', 'DAU721', '', '');
                    await security721.mint(
                      tokenHolder1Signer.getAddress(),
                      issuanceTokenId
                    );
                    await security721
                      .connect(tokenHolder1Signer)
                      .approve(dvp.address, issuanceTokenId);

                    await createTradeRequest(
                      dvp,
                      security721,
                      emoney20,
                      ERC721STANDARD,
                      ERC20STANDARD,
                      await tokenHolder1Signer.getAddress(),
                      await recipient1Signer.getAddress(),
                      ZERO_ADDRESS,
                      tokenHolder1Signer,
                      true,
                      TYPE_SWAP,
                      token1Amount,
                      token2Amount
                    );
                  });
                });
                describe('when token standard is ERC1400', function () {
                  it('creates and accepts the trade request', async function () {
                    const security1400 = await new ERC1400__factory(
                      signer
                    ).deploy('ERC1400Token', 'DAU', 1, [], partitions);
                    await security1400.issueByPartition(
                      partition1,
                      tokenHolder1Signer.getAddress(),
                      issuanceAmount,
                      VALID_CERTIFICATE
                    );
                    await security1400
                      .connect(tokenHolder1Signer)
                      .approveByPartition(
                        partition1,
                        dvp.address,
                        token1Amount
                      );

                    await createTradeRequest(
                      dvp,
                      security1400,
                      emoney20,
                      ERC1400STANDARD,
                      ERC20STANDARD,
                      await tokenHolder1Signer.getAddress(),
                      await recipient1Signer.getAddress(),
                      ZERO_ADDRESS,
                      tokenHolder1Signer,
                      true,
                      TYPE_SWAP,
                      token1Amount,
                      token2Amount
                    );
                  });
                });
                describe('when payment is made off-chain', function () {
                  it('creates and accepts the trade request', async function () {
                    await createTradeRequest(
                      dvp,
                      security20,
                      undefined,
                      ERC20STANDARD,
                      OFFCHAIN,
                      await tokenHolder1Signer.getAddress(),
                      await recipient1Signer.getAddress(),
                      ZERO_ADDRESS,
                      recipient1Signer,
                      true,
                      TYPE_SWAP,
                      token1Amount,
                      token2Amount
                    );
                  });
                });
              });
            });
            describe('when sender is holder 2', function () {
              it('creates and accepts the trade request', async function () {
                await emoney20
                  .connect(recipient1Signer)
                  .approve(dvp.address, token2Amount);
                await createTradeRequest(
                  dvp,
                  security20,
                  emoney20,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  await tokenHolder1Signer.getAddress(),
                  await recipient1Signer.getAddress(),
                  ZERO_ADDRESS,
                  recipient1Signer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
              });
            });
            describe('when sender is neither holder 1 nor holder 2', function () {
              describe('when the holder 1 is not the zero address', function () {
                it('creates the trade request', async function () {
                  await createTradeRequest(
                    dvp,
                    security20,
                    emoney20,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    await tokenHolder1Signer.getAddress(),
                    await recipient1Signer.getAddress(),
                    ZERO_ADDRESS,
                    unknownSigner,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                });
              });
              describe('when the holder 1 is the zero address', function () {
                it('reverts', async function () {
                  const chainTime = (await provider.getBlock('latest'))
                    .timestamp;
                  const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
                  /*
                  struct TradeRequestInput {
                    address holder1;
                    address holder2;
                    address executer; // Set to address(0) if no executer is required for the trade
                    uint256 expirationDate;
                    address tokenAddress1;
                    uint256 tokenValue1;
                    bytes32 tokenId1;
                    Standard tokenStandard1;
                    address tokenAddress2; // Set to address(0) if no token is expected in return (for example in case of an off-chain payment)
                    uint256 tokenValue2;
                    bytes32 tokenId2;
                    Standard tokenStandard2;
                    TradeType tradeType;
                  }
                  */
                  const tradeInputData = {
                    holder1: ZERO_ADDRESS,
                    holder2: recipient1Signer.getAddress(),
                    executer: ZERO_ADDRESS,
                    expirationDate: expirationDate,
                    settlementDate: 0,
                    tokenAddress1: security20.address,
                    tokenValue1: token1Amount,
                    tokenId1: ZERO_BYTES32,
                    tokenStandard1: ERC20STANDARD,
                    tokenAddress2: emoney20.address,
                    tokenValue2: token2Amount,
                    tokenId2: ZERO_BYTES32,
                    tokenStandard2: ERC20STANDARD,
                    tradeType1: HEX_TYPE_SWAP,
                    tradeType2: HEX_TYPE_SWAP
                  };
                  await assertRevert(
                    dvp
                      .connect(unknownSigner)
                      .requestTrade(tradeInputData, ZERO_BYTES32)
                  );
                });
              });
            });
          });
          describe('when expiration date is not defined', function () {
            it('creates the trade request', async function () {
              await security20
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                security20,
                emoney20,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                false,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
            });
          });
        });
      });
      describe('when the DVP contract is owned', function () {
        let dvp: Swaps;
        beforeEach(async function () {
          dvp = await new Swaps__factory(signer).deploy(true);
        });
        describe('when a valid trade executer is defined', function () {
          it('creates the trade request', async function () {
            await security20
              .connect(tokenHolder1Signer)
              .approve(dvp.address, token1Amount);
            await createTradeRequest(
              dvp,
              security20,
              emoney20,
              ERC20STANDARD,
              ERC20STANDARD,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              await signer.getAddress(),
              tokenHolder1Signer,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );
          });
        });
        describe('when no valid trade executer is defined', function () {
          describe('when proposed executer for the trade is not in the list of DVP trade executers', function () {
            it('reverts', async function () {
              await security20
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await assertRevert(
                createTradeRequest(
                  dvp,
                  security20,
                  emoney20,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  await tokenHolder1Signer.getAddress(),
                  await recipient1Signer.getAddress(),
                  await tokenHolder1Signer.getAddress(),
                  tokenHolder1Signer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                )
              );
            });
          });
          describe('when proposed trade executer is zero address', function () {
            it('reverts', async function () {
              await security20
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await assertRevert(
                createTradeRequest(
                  dvp,
                  security20,
                  emoney20,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  await tokenHolder1Signer.getAddress(),
                  await recipient1Signer.getAddress(),
                  ZERO_ADDRESS,
                  tokenHolder1Signer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                )
              );
            });
          });
        });
      });
    });

    describe('when one of the 2 tokens is ETH', function () {
      describe('when proposed trade type is Escrow', function () {
        describe('when sender is holder 1', function () {
          it('creates the trade request', async function () {
            // const createTradeRequest(dvp, token1, token2, tokenStandard1, tokenStandard2, holder1, holder2, executerSigner.getAddress(), requester, realExpirationDate, tradeType, tokenAmount1, tokenAmount2)
            await createTradeRequest(
              dvp,
              undefined,
              emoney20,
              ETHSTANDARD,
              ERC20STANDARD,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              ZERO_ADDRESS,
              tokenHolder1Signer,
              true,
              TYPE_ESCROW,
              token1Amount,
              0
            );
          });
        });
        describe('when sender is holder 2', function () {
          it('creates the trade request', async function () {
            await createTradeRequest(
              dvp,
              security20,
              undefined,
              ERC20STANDARD,
              ETHSTANDARD,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              ZERO_ADDRESS,
              recipient1Signer,
              true,
              TYPE_ESCROW,
              0,
              token2Amount
            );
          });
        });
      });
      describe('when proposed trade type is Swap', function () {
        it('creates the trade request', async function () {
          await assertRevert(
            createTradeRequest(
              dvp,
              security20,
              emoney20,
              ETHSTANDARD,
              ERC20STANDARD,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              ZERO_ADDRESS,
              tokenHolder1Signer,
              true,
              TYPE_SWAP,
              token1Amount,
              0
            )
          );
        });
      });
    });
  });

  // ACCEPT TRADE

  describe('acceptTrade', function () {
    let dvp: Swaps;
    let security20: ERC20Token;
    let token1: ERC20Token;
    let emoney20, token2: ERC20Token;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      security20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      emoney20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );

      await security20.mint(tokenHolder1Signer.getAddress(), issuanceAmount);
      await emoney20.mint(recipient1Signer.getAddress(), issuanceAmount);

      token1 = security20;
      token2 = emoney20;
    });
    describe('when trade index is valid', function () {
      describe('when tokens need to be escrowed', function () {
        describe('when tokens are available', function () {
          describe('when trade has no predefined executer', function () {
            describe('when there are no token controllers', function () {
              describe('when trade gets executed', function () {
                it('accepts and executes the trade', async function () {
                  await token1
                    .connect(tokenHolder1Signer)
                    .approve(dvp.address, token1Amount);
                  await createTradeRequest(
                    dvp,
                    token1,
                    token2,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    await tokenHolder1Signer.getAddress(),
                    await recipient1Signer.getAddress(),
                    ZERO_ADDRESS,
                    tokenHolder1Signer,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await token2
                    .connect(recipient1Signer)
                    .approve(dvp.address, token2Amount);
                  await acceptTradeRequest(
                    dvp,
                    token1,
                    token2,
                    1,
                    recipient1Signer,
                    STATE_EXECUTED,
                    ACCEPTED_TRUE
                  );
                });
              });
              describe('when trade doesnt get executed', function () {
                it('accepts the trade', async function () {
                  // await token1.connect(tokenHolder1Signer).approve(dvp.address, token1Amount);
                  await createTradeRequest(
                    dvp,
                    token1,
                    token2,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    await tokenHolder1Signer.getAddress(),
                    await recipient1Signer.getAddress(),
                    ZERO_ADDRESS,
                    unknownSigner,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await token2
                    .connect(recipient1Signer)
                    .approve(dvp.address, token2Amount);
                  await acceptTradeRequest(
                    dvp,
                    token1,
                    token2,
                    1,
                    recipient1Signer,
                    STATE_PENDING,
                    ACCEPTED_FALSE
                  );
                });
              });
            });
            describe('when there are token controllers', function () {
              beforeEach(async function () {
                await dvp.setTokenControllers(security20.address, [
                  tokenController1Signer.getAddress()
                ]);
              });
              it('accepts the trade', async function () {
                await token1
                  .connect(tokenHolder1Signer)
                  .approve(dvp.address, token1Amount);
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  await tokenHolder1Signer.getAddress(),
                  await recipient1Signer.getAddress(),
                  ZERO_ADDRESS,
                  tokenHolder1Signer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2
                  .connect(recipient1Signer)
                  .approve(dvp.address, token2Amount);
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1Signer,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );
              });
            });
          });
          describe('when trade has predefined executer', function () {
            it('accepts the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );
            });
          });
        });
        describe('when tokens are not available', function () {
          describe('when token standard is ETH', function () {
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                undefined,
                ERC20STANDARD,
                ETHSTANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await assertRevert(
                dvp.connect(recipient1Signer).acceptTrade(1, ZERO_BYTES32, {
                  value: token2Amount - 1
                })
              );
            });
          });
          describe('when token standard is ERC20', function () {
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount - 1);
              await assertRevert(
                acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1Signer,
                  STATE_EXECUTED,
                  ACCEPTED_TRUE
                )
              );
            });
          });
          describe('when token standard is ERC1400', function () {
            let security1400: ERC1400;
            beforeEach(async function () {
              security1400 = await new ERC1400__factory(signer).deploy(
                'ERC1400Token',
                'DAU',
                1,
                [],
                partitions
              );
              await security1400.issueByPartition(
                partition1,
                recipient1Signer.getAddress(),
                issuanceAmount,
                VALID_CERTIFICATE
              );
            });
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                security1400,
                ERC20STANDARD,
                ERC1400STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await security1400
                .connect(recipient1Signer)
                .approveByPartition(partition1, dvp.address, token2Amount - 1);
              await assertRevert(
                dvp.connect(recipient1Signer).acceptTrade(1, ZERO_BYTES32)
              );
            });
          });
        });
      });
      describe('when tokens do not need to be escrowed', function () {
        describe('when token standard is ERC20', function () {
          describe('when tokens have been reserved before', function () {
            it('accepts and executes the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_SWAP,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_EXECUTED,
                ACCEPTED_TRUE
              );
            });
          });
          describe('when tokens have not been reserved before', function () {
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_SWAP,
                token1Amount,
                token2Amount
              );
              // await token2.connect(recipient1Signer).approve(dvp.address, token2Amount, );
              await assertRevert(
                acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1Signer,
                  STATE_EXECUTED,
                  ACCEPTED_TRUE
                )
              );
            });
          });
        });
        describe('when token standard is ERC721', function () {
          let security721, token2: ERC721Token;
          beforeEach(async function () {
            security721 = await new ERC721Token__factory(signer).deploy(
              'ERC721Token',
              'DAU721',
              '',
              ''
            );
            token2 = security721;
            await token2.mint(recipient1Signer.getAddress(), issuanceTokenId);
          });
          describe('when tokens have been reserved before', function () {
            it('accepts and executes the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC721STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_SWAP,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, issuanceTokenId);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_EXECUTED,
                ACCEPTED_TRUE
              );
            });
          });
          describe('when tokens have not been reserved before', function () {
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC721STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_SWAP,
                token1Amount,
                token2Amount
              );
              // await token2.connect(recipient1Signer).approve(dvp.address, issuanceTokenId, );
              await assertRevert(
                acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1Signer,
                  STATE_EXECUTED,
                  ACCEPTED_TRUE
                )
              );
            });
          });
        });
        describe('when token standard is ERC1400', function () {
          let security1400, token2: ERC1400;
          beforeEach(async function () {
            security1400 = await new ERC1400__factory(signer).deploy(
              'ERC1400Token',
              'DAU',
              1,
              [],
              partitions
            );
            await security1400.issueByPartition(
              partition1,
              recipient1Signer.getAddress(),
              issuanceAmount,
              VALID_CERTIFICATE
            );
            token2 = security1400;
          });
          describe('when tokens have been reserved before', function () {
            it('accepts and executes the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC1400STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_SWAP,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approveByPartition(partition1, dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_EXECUTED,
                ACCEPTED_TRUE
              );
            });
          });
          describe('when tokens have not been reserved before', function () {
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC1400STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_SWAP,
                token1Amount,
                token2Amount
              );
              // await token2.connect(recipient1Signer).approveByPartition(partition1, dvp.address, token2Amount, );
              await assertRevert(
                acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1Signer,
                  STATE_EXECUTED,
                  ACCEPTED_TRUE
                )
              );
            });
          });
        });
        describe('when payment is made off-chain', function () {
          it('accepts and executes the trade', async function () {
            await token1
              .connect(tokenHolder1Signer)
              .approve(dvp.address, token1Amount);
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              OFFCHAIN,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              ZERO_ADDRESS,
              tokenHolder1Signer,
              true,
              TYPE_SWAP,
              token1Amount,
              token2Amount
            );
            await acceptTradeRequest(
              dvp,
              token1,
              token2,
              1,
              recipient1Signer,
              STATE_EXECUTED,
              ACCEPTED_TRUE
            );
          });
        });
      });
    });
    describe('when trade index is not valid', function () {
      describe('when trade with indicated index doesn t exist', function () {
        it('reverts', async function () {
          await token1
            .connect(tokenHolder1Signer)
            .approve(dvp.address, token1Amount);
          await createTradeRequest(
            dvp,
            token1,
            token2,
            ERC20STANDARD,
            ERC20STANDARD,
            await tokenHolder1Signer.getAddress(),
            await recipient1Signer.getAddress(),
            ZERO_ADDRESS,
            tokenHolder1Signer,
            true,
            TYPE_ESCROW,
            token1Amount,
            token2Amount
          );
          await token2
            .connect(recipient1Signer)
            .approve(dvp.address, token2Amount);
          await assertRevert(
            dvp.connect(recipient1Signer).acceptTrade(999, ZERO_BYTES32)
          );
        });
      });
      describe('when trade with indicated index is not in state pending', function () {
        it('reverts', async function () {
          await token1
            .connect(tokenHolder1Signer)
            .approve(dvp.address, token1Amount);
          await createTradeRequest(
            dvp,
            token1,
            token2,
            ERC20STANDARD,
            ERC20STANDARD,
            await tokenHolder1Signer.getAddress(),
            await recipient1Signer.getAddress(),
            ZERO_ADDRESS,
            tokenHolder1Signer,
            true,
            TYPE_ESCROW,
            token1Amount,
            token2Amount
          );
          await token2
            .connect(recipient1Signer)
            .approve(dvp.address, token2Amount);
          await dvp.connect(recipient1Signer).acceptTrade(1, ZERO_BYTES32);
          await assertRevert(
            dvp.connect(recipient1Signer).acceptTrade(1, ZERO_BYTES32)
          );
        });
      });
    });
  });

  // APPROVE TRADE

  describe('approveTrade', function () {
    let dvp: Swaps;
    let security20: ERC20Token;
    let token1: ERC20Token;
    let emoney20: ERC20Token;
    let token2: ERC20Token;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      security20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      emoney20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );

      await security20.mint(tokenHolder1Signer.getAddress(), issuanceAmount);
      await emoney20.mint(recipient1Signer.getAddress(), issuanceAmount);

      token1 = security20;
      token2 = emoney20;

      await dvp.setTokenControllers(token1.address, [
        tokenController1Signer.getAddress()
      ]);
    });
    describe('when trade index is valid', function () {
      describe('when sender is token controller', function () {
        describe('when one single approval is required', function () {
          describe('when trade is executed', function () {
            it('approves and executes the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              await approveTradeRequest(
                dvp,
                token1,
                token2,
                1,
                tokenController1Signer,
                STATE_EXECUTED,
                APPROVED_TRUE
              );
            });
          });
          describe('when trade is not executed', function () {
            it('approves the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              await approveTradeRequest(
                dvp,
                token1,
                token2,
                1,
                tokenController1Signer,
                STATE_PENDING,
                APPROVED_TRUE
              );
            });
            it('approves, disapproves and re-approves the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              assert.strictEqual(await dvp.getTradeApprovalStatus(1), false);

              await dvp.connect(tokenController1Signer).approveTrade(1, true);
              assert.strictEqual(await dvp.getTradeApprovalStatus(1), true);

              await dvp.connect(tokenController1Signer).approveTrade(1, false);
              assert.strictEqual(await dvp.getTradeApprovalStatus(1), false);

              await approveTradeRequest(
                dvp,
                token1,
                token2,
                1,
                tokenController1Signer,
                STATE_PENDING,
                APPROVED_TRUE
              );
            });
          });
        });
        describe('when two approvals are required', function () {
          beforeEach(async function () {
            await dvp.setTokenControllers(token2.address, [
              tokenController2Signer.getAddress()
            ]);
          });
          describe('when trade is executed', function () {
            it('approves and executes the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                ZERO_ADDRESS,
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              await approveTradeRequest(
                dvp,
                token1,
                token2,
                1,
                tokenController1Signer,
                STATE_PENDING,
                APPROVED_FALSE
              );
              await approveTradeRequest(
                dvp,
                token1,
                token2,
                1,
                tokenController2Signer,
                STATE_EXECUTED,
                APPROVED_TRUE
              );
            });
          });
          describe('when trade is not executed', function () {
            it('approves the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              await approveTradeRequest(
                dvp,
                token1,
                token2,
                1,
                tokenController1Signer,
                STATE_PENDING,
                APPROVED_FALSE
              );
              await approveTradeRequest(
                dvp,
                token1,
                token2,
                1,
                tokenController2Signer,
                STATE_PENDING,
                APPROVED_TRUE
              );
            });
          });
        });
      });
      describe('when sender is not token controller', function () {
        it('reverts', async function () {
          await token1
            .connect(tokenHolder1Signer)
            .approve(dvp.address, token1Amount);
          await createTradeRequest(
            dvp,
            token1,
            token2,
            ERC20STANDARD,
            ERC20STANDARD,
            await tokenHolder1Signer.getAddress(),
            await recipient1Signer.getAddress(),
            ZERO_ADDRESS,
            tokenHolder1Signer,
            true,
            TYPE_ESCROW,
            token1Amount,
            token2Amount
          );
          await token2
            .connect(recipient1Signer)
            .approve(dvp.address, token2Amount);
          await acceptTradeRequest(
            dvp,
            token1,
            token2,
            1,
            recipient1Signer,
            STATE_PENDING,
            ACCEPTED_TRUE
          );

          assert.strictEqual(await dvp.getTradeApprovalStatus(1), false);

          await assertRevert(dvp.connect(unknownSigner).approveTrade(1, true));
        });
      });
    });
    describe('when trade index is not valid', function () {
      describe('when trade with indicated index doesn t exist', function () {
        it('reverts', async function () {
          await token1
            .connect(tokenHolder1Signer)
            .approve(dvp.address, token1Amount);
          await createTradeRequest(
            dvp,
            token1,
            token2,
            ERC20STANDARD,
            ERC20STANDARD,
            await tokenHolder1Signer.getAddress(),
            await recipient1Signer.getAddress(),
            ZERO_ADDRESS,
            tokenHolder1Signer,
            true,
            TYPE_ESCROW,
            token1Amount,
            token2Amount
          );
          await token2
            .connect(recipient1Signer)
            .approve(dvp.address, token2Amount);
          await acceptTradeRequest(
            dvp,
            token1,
            token2,
            1,
            recipient1Signer,
            STATE_PENDING,
            ACCEPTED_TRUE
          );

          assert.strictEqual(await dvp.getTradeApprovalStatus(1), false);

          await assertRevert(
            dvp.connect(tokenController1Signer).approveTrade(999, true)
          );
        });
      });
      describe('when trade with indicated index is not in state pending', function () {
        it('reverts', async function () {
          await token1
            .connect(tokenHolder1Signer)
            .approve(dvp.address, token1Amount);
          await createTradeRequest(
            dvp,
            token1,
            token2,
            ERC20STANDARD,
            ERC20STANDARD,
            await tokenHolder1Signer.getAddress(),
            await recipient1Signer.getAddress(),
            ZERO_ADDRESS,
            tokenHolder1Signer,
            true,
            TYPE_ESCROW,
            token1Amount,
            token2Amount
          );
          await token2
            .connect(recipient1Signer)
            .approve(dvp.address, token2Amount);
          await acceptTradeRequest(
            dvp,
            token1,
            token2,
            1,
            recipient1Signer,
            STATE_PENDING,
            ACCEPTED_TRUE
          );

          assert.strictEqual(await dvp.getTradeApprovalStatus(1), false);

          await dvp.connect(tokenController1Signer).approveTrade(1, true);
          await assertTradeState(dvp, 1, STATE_EXECUTED);

          await assertRevert(
            dvp.connect(tokenController1Signer).approveTrade(1, true)
          );
        });
      });
    });
  });

  // EXECUTE TRADE

  describe('executeTrade', function () {
    let dvp: Swaps;
    let security20: ERC20Token;
    let token1: ERC20Token;
    let emoney20: ERC20Token;
    let token2: ERC20Token;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      security20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      emoney20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );

      await security20.mint(tokenHolder1Signer.getAddress(), issuanceAmount);
      await emoney20.mint(recipient1Signer.getAddress(), issuanceAmount);

      token1 = security20;
      token2 = emoney20;
    });
    describe('when trade index is valid', function () {
      describe('when caller is executer defined at trade creation', function () {
        describe('when trade has been approved', function () {
          describe('when trade has been accepted', function () {
            describe('when trade is executed at initially defined price', function () {
              describe('when expiration date is not past', function () {
                describe('when token standard is ERC20 vs ERC20', function () {
                  describe('when trade type is Escrow', function () {
                    it('executes the trade', async function () {
                      await token1
                        .connect(tokenHolder1Signer)
                        .approve(dvp.address, token1Amount);
                      await createTradeRequest(
                        dvp,
                        token1,
                        token2,
                        ERC20STANDARD,
                        ERC20STANDARD,
                        await tokenHolder1Signer.getAddress(),
                        await recipient1Signer.getAddress(),
                        await executerSigner.getAddress(),
                        tokenHolder1Signer,
                        true,
                        TYPE_ESCROW,
                        token1Amount,
                        token2Amount
                      );
                      await token2
                        .connect(recipient1Signer)
                        .approve(dvp.address, token2Amount);
                      await acceptTradeRequest(
                        dvp,
                        token1,
                        token2,
                        1,
                        recipient1Signer,
                        STATE_PENDING,
                        ACCEPTED_TRUE
                      );
                      await executeTradeRequest(
                        dvp,
                        token1,
                        token2,
                        1,
                        executerSigner
                      );
                    });
                  });
                  describe('when trade type is Swap', function () {
                    describe('when trade is executed by an executer', function () {
                      describe('when tokens are available', function () {
                        it('executes the trade', async function () {
                          await token1
                            .connect(tokenHolder1Signer)
                            .approve(dvp.address, token1Amount);
                          await createTradeRequest(
                            dvp,
                            token1,
                            token2,
                            ERC20STANDARD,
                            ERC20STANDARD,
                            await tokenHolder1Signer.getAddress(),
                            await recipient1Signer.getAddress(),
                            await executerSigner.getAddress(),
                            tokenHolder1Signer,
                            true,
                            TYPE_SWAP,
                            token1Amount,
                            token2Amount
                          );
                          await token2
                            .connect(recipient1Signer)
                            .approve(dvp.address, token2Amount);
                          await acceptTradeRequest(
                            dvp,
                            token1,
                            token2,
                            1,
                            recipient1Signer,
                            STATE_PENDING,
                            ACCEPTED_TRUE
                          );
                          await executeTradeRequest(
                            dvp,
                            token1,
                            token2,
                            1,
                            executerSigner
                          );
                        });
                      });
                      describe('when tokens are not available', function () {
                        it('executes the trade', async function () {
                          await token1
                            .connect(tokenHolder1Signer)
                            .approve(dvp.address, token1Amount);
                          await createTradeRequest(
                            dvp,
                            token1,
                            token2,
                            ERC20STANDARD,
                            ERC20STANDARD,
                            await tokenHolder1Signer.getAddress(),
                            await recipient1Signer.getAddress(),
                            await executerSigner.getAddress(),
                            tokenHolder1Signer,
                            true,
                            TYPE_SWAP,
                            token1Amount,
                            token2Amount
                          );
                          await token2
                            .connect(recipient1Signer)
                            .approve(dvp.address, token2Amount);
                          await acceptTradeRequest(
                            dvp,
                            token1,
                            token2,
                            1,
                            recipient1Signer,
                            STATE_PENDING,
                            ACCEPTED_TRUE
                          );
                          await token2
                            .connect(recipient1Signer)
                            .approve(dvp.address, 0);
                          await assertRevert(
                            executeTradeRequest(
                              dvp,
                              token1,
                              token2,
                              1,
                              executerSigner
                            )
                          );
                        });
                      });
                    });
                    describe('when trade is executed by a holder', function () {
                      beforeEach(async function () {
                        await dvp.setTokenControllers(token1.address, [
                          tokenController1Signer.getAddress()
                        ]);
                      });
                      it('executes the trade', async function () {
                        await token1
                          .connect(tokenHolder1Signer)
                          .approve(dvp.address, token1Amount);
                        await createTradeRequest(
                          dvp,
                          token1,
                          token2,
                          ERC20STANDARD,
                          ERC20STANDARD,
                          await tokenHolder1Signer.getAddress(),
                          await recipient1Signer.getAddress(),
                          ZERO_ADDRESS,
                          tokenHolder1Signer,
                          true,
                          TYPE_SWAP,
                          token1Amount,
                          token2Amount
                        );
                        await token2
                          .connect(recipient1Signer)
                          .approve(dvp.address, token2Amount);
                        await acceptTradeRequest(
                          dvp,
                          token1,
                          token2,
                          1,
                          recipient1Signer,
                          STATE_PENDING,
                          ACCEPTED_TRUE
                        );
                        await token1
                          .connect(tokenHolder1Signer)
                          .decreaseAllowance(dvp.address, token1Amount);
                        await dvp
                          .connect(tokenController1Signer)
                          .approveTrade(1, true);
                        // -- trade doesn't get executed because allowance had been decreased
                        await token1
                          .connect(tokenHolder1Signer)
                          .increaseAllowance(dvp.address, token1Amount);
                        await executeTradeRequest(
                          dvp,
                          token1,
                          token2,
                          1,
                          tokenHolder1Signer
                        );
                      });
                    });
                  });
                });
                describe('when token standard is ERC20 vs ETH', function () {
                  describe('when trade type is Escrow', function () {
                    it('executes the trade', async function () {
                      const token0Amount = '0x6F05B59D3B20000'; // 5 * 10**18

                      const initialEthBalance1 = +ethers.utils.formatEther(
                        await provider.getBalance(
                          tokenHolder1Signer.getAddress()
                        )
                      );
                      const initialEthBalance2 = +ethers.utils.formatEther(
                        await provider.getBalance(recipient1Signer.getAddress())
                      );

                      await createTradeRequest(
                        dvp,
                        undefined,
                        token2,
                        ETHSTANDARD,
                        ERC20STANDARD,
                        await tokenHolder1Signer.getAddress(),
                        await recipient1Signer.getAddress(),
                        await executerSigner.getAddress(),
                        tokenHolder1Signer,
                        true,
                        TYPE_ESCROW,
                        token0Amount,
                        token2Amount
                      );
                      await token2
                        .connect(recipient1Signer)
                        .approve(dvp.address, token2Amount);
                      await acceptTradeRequest(
                        dvp,
                        undefined,
                        token2,
                        1,
                        recipient1Signer,
                        STATE_PENDING,
                        ACCEPTED_TRUE
                      );
                      await executeTradeRequest(
                        dvp,
                        undefined,
                        token2,
                        1,
                        executerSigner
                      );

                      const finalEthBalance1 = parseInt(
                        ethers.utils.formatEther(
                          await provider.getBalance(
                            tokenHolder1Signer.getAddress()
                          )
                        )
                      );
                      const finalEthBalance2 = parseInt(
                        ethers.utils.formatEther(
                          await provider.getBalance(
                            recipient1Signer.getAddress()
                          )
                        )
                      );

                      await assertEtherBalance(dvp.address, 0, true);

                      assert.strictEqual(
                        Math.abs(initialEthBalance1 - finalEthBalance1 - 0.5) >
                          0.1,
                        true
                      );
                      assert.strictEqual(
                        Math.abs(finalEthBalance2 - initialEthBalance2 - 0.5) >
                          0.1,
                        true
                      );
                    });
                  });
                });
                describe('when token standard is ERC20 vs off-chain payment', function () {
                  describe('when trade type is Escrow', function () {
                    it('executes the trade', async function () {
                      await token1
                        .connect(tokenHolder1Signer)
                        .approve(dvp.address, token1Amount);
                      await createTradeRequest(
                        dvp,
                        token1,
                        undefined,
                        ERC20STANDARD,
                        OFFCHAIN,
                        await tokenHolder1Signer.getAddress(),
                        await recipient1Signer.getAddress(),
                        await executerSigner.getAddress(),
                        tokenHolder1Signer,
                        true,
                        TYPE_ESCROW,
                        token1Amount,
                        token2Amount
                      );
                      await acceptTradeRequest(
                        dvp,
                        token1,
                        undefined,
                        1,
                        recipient1Signer,
                        STATE_PENDING,
                        ACCEPTED_TRUE
                      );
                      await executeTradeRequest(
                        dvp,
                        token1,
                        undefined,
                        1,
                        executerSigner
                      );
                    });
                  });
                });
                describe('when token standard is ERC721 vs ERC20', function () {
                  let security721: ERC721Token;
                  beforeEach(async function () {
                    security721 = await new ERC721Token__factory(signer).deploy(
                      'ERC721Token',
                      'DAU721',
                      '',
                      ''
                    );
                    await security721.mint(
                      tokenHolder1Signer.getAddress(),
                      issuanceTokenId
                    );
                  });
                  it('setTokenURI sets the URI for the tokenId', async function () {
                    await security721.setTokenURI(
                      issuanceTokenId,
                      'https://consensys.org/' + issuanceTokenId
                    );
                    const uri = await security721.tokenURI(issuanceTokenId);

                    assert.strictEqual(
                      uri,
                      'https://consensys.org/' + issuanceTokenId
                    );
                  });
                  describe('when trade type is Escrow', function () {
                    it('executes the trade', async function () {
                      await security721
                        .connect(tokenHolder1Signer)
                        .approve(dvp.address, issuanceTokenId);
                      await createTradeRequest(
                        dvp,
                        security721,
                        token2,
                        ERC721STANDARD,
                        ERC20STANDARD,
                        await tokenHolder1Signer.getAddress(),
                        await recipient1Signer.getAddress(),
                        await executerSigner.getAddress(),
                        tokenHolder1Signer,
                        true,
                        TYPE_ESCROW,
                        0,
                        token2Amount
                      );
                      await token2
                        .connect(recipient1Signer)
                        .approve(dvp.address, token2Amount);
                      await acceptTradeRequest(
                        dvp,
                        security721,
                        token2,
                        1,
                        recipient1Signer,
                        STATE_PENDING,
                        ACCEPTED_TRUE
                      );
                      await executeTradeRequest(
                        dvp,
                        security721,
                        token2,
                        1,
                        executerSigner
                      );
                    });
                  });
                });
                describe('when token standard is ERC1400 vs ERC20', function () {
                  describe('when trade type is Escrow', function () {
                    let security1400: ERC1400;
                    beforeEach(async function () {
                      security1400 = await new ERC1400__factory(signer).deploy(
                        'ERC1400Token',
                        'DAU',
                        1,
                        [signer.getAddress()],
                        partitions
                      );
                      await security1400.issueByPartition(
                        partition1,
                        tokenHolder1Signer.getAddress(),
                        issuanceAmount,
                        MOCK_CERTIFICATE
                      );
                    });
                    it('executes the trade', async function () {
                      await security1400
                        .connect(tokenHolder1Signer)
                        .approveByPartition(
                          partition1,
                          dvp.address,
                          token1Amount
                        );
                      await createTradeRequest(
                        dvp,
                        security1400,
                        token2,
                        ERC1400STANDARD,
                        ERC20STANDARD,
                        await tokenHolder1Signer.getAddress(),
                        await recipient1Signer.getAddress(),
                        await executerSigner.getAddress(),
                        tokenHolder1Signer,
                        true,
                        TYPE_ESCROW,
                        token1Amount,
                        token2Amount
                      );
                      await token2
                        .connect(recipient1Signer)
                        .approve(dvp.address, token2Amount);
                      await acceptTradeRequest(
                        dvp,
                        security1400,
                        token2,
                        1,
                        recipient1Signer,
                        STATE_PENDING,
                        ACCEPTED_TRUE
                      );
                      await executeTradeRequest(
                        dvp,
                        security1400,
                        token2,
                        1,
                        executerSigner
                      );
                    });
                  });
                });
              });
              describe('when expiration date is past', function () {
                it('reverts', async function () {
                  await token1
                    .connect(tokenHolder1Signer)
                    .approve(dvp.address, token1Amount);
                  await createTradeRequest(
                    dvp,
                    token1,
                    token2,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    await tokenHolder1Signer.getAddress(),
                    await recipient1Signer.getAddress(),
                    await executerSigner.getAddress(),
                    tokenHolder1Signer,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await token2
                    .connect(recipient1Signer)
                    .approve(dvp.address, token2Amount);
                  await acceptTradeRequest(
                    dvp,
                    token1,
                    token2,
                    1,
                    recipient1Signer,
                    STATE_PENDING,
                    ACCEPTED_TRUE
                  );

                  // Wait for 1 hour
                  await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

                  await assertRevert(
                    executeTradeRequest(dvp, token1, token2, 1, executerSigner)
                  );
                });
              });
            });
            describe('when trade is not executed at initially defined price', function () {
              it('creates and accepts the trade request', async function () {
                await dvp
                  .connect(signer)
                  .setPriceOracles(token1.address, [oracleSigner.getAddress()]);
                let chainTime = (await provider.getBlock('latest')).timestamp;
                let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
                await dvp
                  .connect(oracleSigner)
                  .setVariablePriceStartDate(
                    token1.address,
                    variablePriceStartDate
                  );
                assert.strictEqual(
                  (await dvp.variablePriceStartDate(token1.address)).toNumber(),
                  variablePriceStartDate
                );
                // Wait for 1 week
                await advanceTimeAndBlock(SECONDS_IN_A_WEEK + 100);

                await dvp
                  .connect(oracleSigner)
                  .setPriceOwnership(token1.address, token2.address, true);
                const multiple2 = 2;
                await dvp
                  .connect(oracleSigner)
                  .setTokenPrice(
                    token1.address,
                    token2.address,
                    ALL_PARTITIONS,
                    ALL_PARTITIONS,
                    multiple2
                  );

                await token1
                  .connect(tokenHolder1Signer)
                  .approve(dvp.address, token1Amount);
                const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
                /*
                struct TradeRequestInput {
                  address holder1;
                  address holder2;
                  address executer; // Set to address(0) if no executer is required for the trade
                  uint256 expirationDate;
                  address tokenAddress1;
                  uint256 tokenValue1;
                  bytes32 tokenId1;
                  Standard tokenStandard1;
                  address tokenAddress2; // Set to address(0) if no token is expected in return (for example in case of an off-chain payment)
                  uint256 tokenValue2;
                  bytes32 tokenId2;
                  Standard tokenStandard2;
                  TradeType tradeType;
                }
                */
                const tradeInputData = {
                  holder1: tokenHolder1Signer.getAddress(),
                  holder2: recipient1Signer.getAddress(),
                  executer: ZERO_ADDRESS,
                  expirationDate: expirationDate,
                  settlementDate: 0,
                  tokenAddress1: token1.address,
                  tokenValue1: token1Amount,
                  tokenId1: ZERO_BYTES32,
                  tokenStandard1: ERC20STANDARD,
                  tokenAddress2: token2.address,
                  tokenValue2: token2Amount,
                  tokenId2: ZERO_BYTES32,
                  tokenStandard2: ERC20STANDARD,
                  tradeType1: HEX_TYPE_SWAP,
                  tradeType2: HEX_TYPE_SWAP
                };
                await dvp
                  .connect(tokenHolder1Signer)
                  .requestTrade(tradeInputData, ZERO_BYTES32);

                await token2
                  .connect(recipient1Signer)
                  .approve(dvp.address, token2Amount);
                await dvp
                  .connect(recipient1Signer)
                  .acceptTrade(1, ZERO_BYTES32);
              });
            });
          });
          describe('when trade has not been accepted', function () {
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              // await acceptTradeRequest(dvp, token1, token2, 1, recipient1Signer.getAddress(), STATE_PENDING, ACCEPTED_TRUE);
              await assertRevert(
                executeTradeRequest(dvp, token1, token2, 1, executerSigner)
              );
            });
          });
        });
        describe('when trade has not been approved', function () {
          beforeEach(async function () {
            await dvp.setTokenControllers(token1.address, [
              tokenController1Signer.getAddress()
            ]);
          });
          it('reverts', async function () {
            await token1
              .connect(tokenHolder1Signer)
              .approve(dvp.address, token1Amount);
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              await executerSigner.getAddress(),
              tokenHolder1Signer,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );
            await token2
              .connect(recipient1Signer)
              .approve(dvp.address, token2Amount);
            await acceptTradeRequest(
              dvp,
              token1,
              token2,
              1,
              recipient1Signer,
              STATE_PENDING,
              ACCEPTED_TRUE
            );
            await assertRevert(
              executeTradeRequest(dvp, token1, token2, 1, executerSigner)
            );
          });
        });
      });
      describe('when caller is not executer defined at trade creation', function () {
        it('reverts', async function () {
          await token1
            .connect(tokenHolder1Signer)
            .approve(dvp.address, token1Amount);
          await createTradeRequest(
            dvp,
            token1,
            token2,
            ERC20STANDARD,
            ERC20STANDARD,
            await tokenHolder1Signer.getAddress(),
            await recipient1Signer.getAddress(),
            await executerSigner.getAddress(),
            tokenHolder1Signer,
            true,
            TYPE_ESCROW,
            token1Amount,
            token2Amount
          );
          await token2
            .connect(recipient1Signer)
            .approve(dvp.address, token2Amount);
          await acceptTradeRequest(
            dvp,
            token1,
            token2,
            1,
            recipient1Signer,
            STATE_PENDING,
            ACCEPTED_TRUE
          );
          await assertRevert(
            executeTradeRequest(dvp, token1, token2, 1, unknownSigner)
          );
        });
      });
    });
    describe('when trade index is not valid', function () {
      it('reverts', async function () {
        await assertRevert(dvp.connect(executerSigner).executeTrade(999));
      });
    });
  });

  // FORCE TRADE

  describe('forceTrade', function () {
    let dvp: Swaps;
    let security20: ERC20Token;
    let token1: ERC20Token;
    let emoney20: ERC20Token;
    let token2: ERC20Token;

    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      security20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      emoney20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );

      await security20.mint(tokenHolder1Signer.getAddress(), issuanceAmount);
      await emoney20.mint(recipient1Signer.getAddress(), issuanceAmount);

      token1 = security20;
      token2 = emoney20;
    });
    describe('when trade index is valid', function () {
      describe('when trade has not been accepted by both parties', function () {
        describe('when traded tokens have no controllers', function () {
          describe('when executer has not been defined at trade creation', function () {
            describe('when trade has been accepted by holder1', function () {
              describe('when sender is holder1', function () {
                it('forces the trade', async function () {
                  await token1
                    .connect(tokenHolder1Signer)
                    .approve(dvp.address, token1Amount);
                  await createTradeRequest(
                    dvp,
                    token1,
                    token2,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    await tokenHolder1Signer.getAddress(),
                    await recipient1Signer.getAddress(),
                    ZERO_ADDRESS,
                    tokenHolder1Signer,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await forceTradeRequest(
                    dvp,
                    token1,
                    token2,
                    1,
                    tokenHolder1Signer
                  );
                });
              });
              describe('when sender is not holder1', function () {
                it('reverts', async function () {
                  await token1
                    .connect(tokenHolder1Signer)
                    .approve(dvp.address, token1Amount);
                  await createTradeRequest(
                    dvp,
                    token1,
                    token2,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    await tokenHolder1Signer.getAddress(),
                    await recipient1Signer.getAddress(),
                    ZERO_ADDRESS,
                    tokenHolder1Signer,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await assertRevert(
                    forceTradeRequest(dvp, token1, token2, 1, recipient1Signer)
                  );
                });
              });
            });
            describe('when trade has been accepted by holder2', function () {
              describe('when sender is holder2', function () {
                it('forces the trade', async function () {
                  await token2
                    .connect(recipient1Signer)
                    .approve(dvp.address, token2Amount);
                  await createTradeRequest(
                    dvp,
                    token1,
                    token2,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    await tokenHolder1Signer.getAddress(),
                    await recipient1Signer.getAddress(),
                    ZERO_ADDRESS,
                    recipient1Signer,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await forceTradeRequest(
                    dvp,
                    token1,
                    token2,
                    1,
                    recipient1Signer
                  );
                });
              });
              describe('when sender is not holder2', function () {
                it('reverts', async function () {
                  await token2
                    .connect(recipient1Signer)
                    .approve(dvp.address, token2Amount);
                  await createTradeRequest(
                    dvp,
                    token1,
                    token2,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    await tokenHolder1Signer.getAddress(),
                    await recipient1Signer.getAddress(),
                    ZERO_ADDRESS,
                    recipient1Signer,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await assertRevert(
                    forceTradeRequest(
                      dvp,
                      token1,
                      token2,
                      1,
                      tokenHolder1Signer
                    )
                  );
                });
              });
            });
            describe('when trade has been accepted neither by holder1, nor by holder2', function () {
              it('reverts', async function () {
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  await tokenHolder1Signer.getAddress(),
                  await recipient1Signer.getAddress(),
                  ZERO_ADDRESS,
                  unknownSigner,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await assertRevert(
                  forceTradeRequest(dvp, token1, token2, 1, unknownSigner)
                );
              });
            });
          });
          describe('when executer has been defined at trade creation', function () {
            describe('when caller is executer defined at trade creation', function () {
              it('executes the trade', async function () {
                await token1
                  .connect(tokenHolder1Signer)
                  .approve(dvp.address, token1Amount);
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  await tokenHolder1Signer.getAddress(),
                  await recipient1Signer.getAddress(),
                  await executerSigner.getAddress(),
                  tokenHolder1Signer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await forceTradeRequest(dvp, token1, token2, 1, executerSigner);
              });
            });
            describe('when caller is not executer defined at trade creation', function () {
              it('executes the trade', async function () {
                await token1
                  .connect(tokenHolder1Signer)
                  .approve(dvp.address, token1Amount);
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  await tokenHolder1Signer.getAddress(),
                  await recipient1Signer.getAddress(),
                  await executerSigner.getAddress(),
                  tokenHolder1Signer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await assertRevert(
                  forceTradeRequest(dvp, token1, token2, 1, tokenHolder1Signer)
                );
              });
            });
          });
        });
        describe('when at least one of traded tokens has controllers', function () {
          beforeEach(async function () {
            await dvp.setTokenControllers(token1.address, [
              tokenController1Signer.getAddress()
            ]);
          });
          it('reverts', async function () {
            await token1
              .connect(tokenHolder1Signer)
              .approve(dvp.address, token1Amount);
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              ZERO_ADDRESS,
              tokenHolder1Signer,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );
            await assertRevert(
              forceTradeRequest(dvp, token1, token2, 1, tokenHolder1Signer)
            );
          });
        });
      });
      describe('when trade has been accepted by both parties', function () {
        it('reverts', async function () {
          await token1
            .connect(tokenHolder1Signer)
            .approve(dvp.address, token1Amount);
          await createTradeRequest(
            dvp,
            token1,
            token2,
            ERC20STANDARD,
            ERC20STANDARD,
            await tokenHolder1Signer.getAddress(),
            await recipient1Signer.getAddress(),
            await executerSigner.getAddress(),
            tokenHolder1Signer,
            true,
            TYPE_ESCROW,
            token1Amount,
            token2Amount
          );
          await token2
            .connect(recipient1Signer)
            .approve(dvp.address, token2Amount);
          await acceptTradeRequest(
            dvp,
            token1,
            token2,
            1,
            recipient1Signer,
            STATE_PENDING,
            ACCEPTED_TRUE
          );
          await assertRevert(
            forceTradeRequest(dvp, token1, token2, 1, executerSigner)
          );
        });
      });
    });
    describe('when trade index is not valid', function () {
      it('reverts', async function () {
        await assertRevert(dvp.connect(executerSigner).forceTrade(999));
      });
    });
  });

  // CANCEL TRADE

  describe('cancelTrade', function () {
    let dvp: Swaps;
    let security20: ERC20Token;
    let token1: ERC20Token;
    let emoney20: ERC20Token;
    let token2: ERC20Token;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      security20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      emoney20 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );

      await security20.mint(tokenHolder1Signer.getAddress(), issuanceAmount);
      await emoney20.mint(recipient1Signer.getAddress(), issuanceAmount);

      token1 = security20;
      token2 = emoney20;
    });
    describe('when trade index is valid', function () {
      describe('when trade has been accepted by both parties', function () {
        describe('when caller is trade executer', function () {
          describe('when trade type is Escrow', function () {
            it('cancels the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              await cancelTradeRequest(dvp, token1, token2, 1, executerSigner);
            });
          });
          describe('when trade type is Swap', function () {
            it('cancels the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_SWAP,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              await cancelTradeRequest(dvp, token1, token2, 1, executerSigner);
            });
          });
        });
        describe('when caller is holder1', function () {
          describe('when expiration date is past', function () {
            it('cancels the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              // Wait for 1 hour
              await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

              await cancelTradeRequest(
                dvp,
                token1,
                token2,
                1,
                tokenHolder1Signer
              );
            });
          });
          describe('when expiration date is not past', function () {
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              await assertRevert(
                cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1Signer)
              );
            });
          });
        });
        describe('when caller is holder2', function () {
          describe('when expiration date is past', function () {
            it('cancels the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              // Wait for 1 hour
              await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

              await cancelTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer
              );
            });
          });
          describe('when expiration date is not past', function () {
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_TRUE
              );

              await assertRevert(
                cancelTradeRequest(dvp, token1, token2, 1, recipient1Signer)
              );
            });
          });
        });
      });
      describe('when trade has been accepted by holder1', function () {
        describe('when caller is trade executer', function () {
          describe('when trade type is Escrow', function () {
            it('cancels the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              // await token2.connect(recipient1Signer).approve(dvp.address, token2Amount, );
              // await acceptTradeRequest(dvp, token1, token2, 1, recipient1Signer, STATE_PENDING, ACCEPTED_TRUE);

              await cancelTradeRequest(dvp, token1, token2, 1, executerSigner);
            });
          });
          describe('when trade type is Swap', function () {
            it('cancels the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_SWAP,
                token1Amount,
                token2Amount
              );
              // await token2.connect(recipient1Signer).approve(dvp.address, token2Amount, );
              // await acceptTradeRequest(dvp, token1, token2, 1, recipient1Signer, STATE_PENDING, ACCEPTED_TRUE);

              await cancelTradeRequest(dvp, token1, token2, 1, executerSigner);
            });
          });
        });
        describe('when caller is holder1', function () {
          describe('when expiration date is past', function () {
            it('cancels the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              // await token2.connect(recipient1Signer).approve(dvp.address, token2Amount, );
              // await acceptTradeRequest(dvp, token1, token2, 1, recipient1Signer, STATE_PENDING, ACCEPTED_TRUE);

              // Wait for 1 hour
              await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

              await cancelTradeRequest(
                dvp,
                token1,
                token2,
                1,
                tokenHolder1Signer
              );
            });
          });
          describe('when expiration date is not past', function () {
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              // await token2.connect(recipient1Signer).approve(dvp.address, token2Amount, );
              // await acceptTradeRequest(dvp, token1, token2, 1, recipient1Signer, STATE_PENDING, ACCEPTED_TRUE);

              await assertRevert(
                cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1Signer)
              );
            });
          });
        });
        describe('when caller is holder2', function () {
          describe('when expiration date is past', function () {
            it('cancels the trade', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              // await token2.connect(recipient1Signer).approve(dvp.address, token2Amount, );
              // await acceptTradeRequest(dvp, token1, token2, 1, recipient1Signer, STATE_PENDING, ACCEPTED_TRUE);

              // Wait for 1 hour
              await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

              await assertRevert(
                cancelTradeRequest(dvp, token1, token2, 1, recipient1Signer)
              );
            });
          });
          describe('when expiration date is not past', function () {
            it('reverts', async function () {
              await token1
                .connect(tokenHolder1Signer)
                .approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                tokenHolder1Signer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              // await token2.connect(recipient1Signer).approve(dvp.address, token2Amount, );
              // await acceptTradeRequest(dvp, token1, token2, 1, recipient1Signer, STATE_PENDING, ACCEPTED_TRUE);

              await assertRevert(
                cancelTradeRequest(dvp, token1, token2, 1, recipient1Signer)
              );
            });
          });
        });
      });
      describe('when trade has been accepted by holder2', function () {
        describe('when caller is trade executer', function () {
          describe('when trade type is Escrow', function () {
            it('cancels the trade', async function () {
              // await token1.connect(tokenHolder1Signer).approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                executerSigner,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_FALSE
              );

              await cancelTradeRequest(dvp, token1, token2, 1, executerSigner);
            });
          });
          describe('when trade type is Swap', function () {
            it('cancels the trade', async function () {
              // await token1.connect(tokenHolder1Signer).approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                executerSigner,
                true,
                TYPE_SWAP,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_FALSE
              );

              await cancelTradeRequest(dvp, token1, token2, 1, executerSigner);
            });
          });
        });
        describe('when caller is holder1', function () {
          describe('when expiration date is past', function () {
            it('cancels the trade', async function () {
              // await token1.connect(tokenHolder1Signer).approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                executerSigner,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_FALSE
              );

              // Wait for 1 hour
              await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

              await assertRevert(
                cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1Signer)
              );
            });
          });
          describe('when expiration date is not past', function () {
            it('reverts', async function () {
              // await token1.connect(tokenHolder1Signer).approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                executerSigner,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_FALSE
              );

              await assertRevert(
                cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1Signer)
              );
            });
          });
        });
        describe('when caller is holder2', function () {
          describe('when expiration date is past', function () {
            it('cancels the trade', async function () {
              // await token1.connect(tokenHolder1Signer).approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                executerSigner,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_FALSE
              );

              // Wait for 1 hour
              await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

              await cancelTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer
              );
            });
          });
          describe('when expiration date is not past', function () {
            it('reverts', async function () {
              // await token1.connect(tokenHolder1Signer).approve(dvp.address, token1Amount);
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                await tokenHolder1Signer.getAddress(),
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                executerSigner,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2
                .connect(recipient1Signer)
                .approve(dvp.address, token2Amount);
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1Signer,
                STATE_PENDING,
                ACCEPTED_FALSE
              );

              await assertRevert(
                cancelTradeRequest(dvp, token1, token2, 1, recipient1Signer)
              );
            });
          });
        });
      });
      describe('when trade has been accepted by no one', function () {
        describe('when caller is trade executer', function () {
          it('cancels the trade', async function () {
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              await executerSigner.getAddress(),
              executerSigner,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );

            await cancelTradeRequest(dvp, token1, token2, 1, executerSigner);
          });
        });
        describe('when caller is holder1', function () {
          it('cancels the trade', async function () {
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              await executerSigner.getAddress(),
              executerSigner,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );

            await cancelTradeRequest(
              dvp,
              token1,
              token2,
              1,
              tokenHolder1Signer
            );
          });
        });
        describe('when caller is holder2', function () {
          it('cancels the trade', async function () {
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              await executerSigner.getAddress(),
              executerSigner,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );

            await cancelTradeRequest(dvp, token1, token2, 1, recipient1Signer);
          });
        });
        describe('when caller is neither the executer nor one of the 2 holders', function () {
          it('cancels the trade', async function () {
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              await tokenHolder1Signer.getAddress(),
              await recipient1Signer.getAddress(),
              await executerSigner.getAddress(),
              executerSigner,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );

            await assertRevert(dvp.connect(unknownSigner).cancelTrade(1));
          });
        });
      });
    });
    describe('when trade index is not valid', function () {
      it('reverts', async function () {
        await assertRevert(dvp.connect(executerSigner).cancelTrade(999));
      });
    });
  });

  // RENOUNCE OWNERSHIP

  describe('renounceOwnership', function () {
    let dvp: Swaps;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(true);
    });
    describe('when the caller is the contract owner', function () {
      it('renounces to ownership', async function () {
        assert.strictEqual(await dvp.owner(), await signer.getAddress());

        // can set trade executers
        await dvp.setTradeExecuters([
          signer.getAddress(),
          executerSigner.getAddress()
        ]);

        await dvp.renounceOwnership();

        assert.strictEqual(await dvp.owner(), ZERO_ADDRESS);

        // can not set trade executers anymore
        await assertRevert(
          dvp.setTradeExecuters([
            signer.getAddress(),
            executerSigner.getAddress()
          ])
        );
      });
    });
    describe('when the caller is not the contract owner', function () {
      it('reverts', async function () {
        await assertRevert(dvp.connect(unknownSigner).renounceOwnership());
      });
    });
  });

  // SET TRADE EXECUTER

  describe('setTradeExecuters', function () {
    let dvp: Swaps;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(true);
    });
    describe('when the caller is the contract owner', function () {
      describe('when the dvp contract is owned', function () {
        it('sets the operators as trade executers', async function () {
          const tradeExecuters1 = await dvp.tradeExecuters();
          assert.strictEqual(tradeExecuters1.length, 1);
          assert.strictEqual(tradeExecuters1[0], await signer.getAddress());
          await dvp
            .connect(signer)
            .setTradeExecuters([
              signer.getAddress(),
              executerSigner.getAddress()
            ]);
          const tradeExecuters2 = await dvp.tradeExecuters();
          assert.strictEqual(tradeExecuters2.length, 2);
          assert.strictEqual(tradeExecuters2[0], await signer.getAddress());
          assert.strictEqual(
            tradeExecuters2[1],
            await executerSigner.getAddress()
          );
        });
      });
      describe('when the dvp contract is not owned', function () {
        let dvp: Swaps;
        beforeEach(async function () {
          dvp = await new Swaps__factory(signer).deploy(false);
        });
        it('reverts', async function () {
          await assertRevert(
            dvp.setTradeExecuters([
              signer.getAddress(),
              executerSigner.getAddress()
            ])
          );
        });
      });
    });
    describe('when the caller is not the contract owner', function () {
      it('reverts', async function () {
        await assertRevert(
          dvp
            .connect(executerSigner)
            .setTradeExecuters([
              signer.getAddress(),
              executerSigner.getAddress()
            ])
        );
      });
    });
  });

  // SET TOKEN CONTROLLERS

  describe('setTokenControllers', function () {
    let dvp: Swaps;
    let token1: ERC20Token;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      token1 = await new ERC20Token__factory(tokenHolder1Signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
    });
    describe('when the caller is the token contract owner', function () {
      it('sets the operators as token controllers', async function () {
        let tokenControllers = await dvp.tokenControllers(token1.address);
        assert.strictEqual(tokenControllers.length, 0);

        await dvp
          .connect(tokenHolder1Signer)
          .setTokenControllers(token1.address, [
            tokenController1Signer.getAddress(),
            tokenController2Signer.getAddress()
          ]);

        tokenControllers = await dvp.tokenControllers(token1.address);
        assert.strictEqual(tokenControllers.length, 2);
        assert.strictEqual(
          tokenControllers[0],
          await tokenController1Signer.getAddress()
        );
        assert.strictEqual(
          tokenControllers[1],
          await tokenController2Signer.getAddress()
        );
      });
    });
    describe('when the caller is an other token controller', function () {
      it('sets the operators as token controllers', async function () {
        let tokenControllers = await dvp.tokenControllers(token1.address);
        assert.strictEqual(tokenControllers.length, 0);

        await dvp
          .connect(tokenHolder1Signer)
          .setTokenControllers(token1.address, [
            tokenController2Signer.getAddress()
          ]);

        tokenControllers = await dvp.tokenControllers(token1.address);
        assert.strictEqual(tokenControllers.length, 1);
        assert.strictEqual(
          tokenControllers[0],
          await tokenController2Signer.getAddress()
        );

        await dvp
          .connect(tokenController2Signer)
          .setTokenControllers(token1.address, [
            tokenController1Signer.getAddress(),
            unknownSigner.getAddress()
          ]);

        tokenControllers = await dvp.tokenControllers(token1.address);
        assert.strictEqual(tokenControllers.length, 2);
        assert.strictEqual(
          tokenControllers[0],
          await tokenController1Signer.getAddress()
        );
        assert.strictEqual(
          tokenControllers[1],
          await unknownSigner.getAddress()
        );
      });
    });
    describe('when the caller is neither the token contract signer.getAddress() nor a token controller', function () {
      it('reverts', async function () {
        await assertRevert(
          dvp
            .connect(tokenHolder2Signer)
            .setTokenControllers(token1.address, [
              tokenController1Signer.getAddress(),
              tokenController2Signer.getAddress()
            ])
        );
      });
    });
  });

  // SET PRICE ORACLES

  describe('setPriceOracles', function () {
    let dvp: Swaps;
    let token1: ERC20Token;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      token1 = await new ERC20Token__factory(tokenHolder1Signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
    });
    describe('when the caller is the token contract owner', function () {
      it('sets the operators as token price oracle', async function () {
        let priceOracles = await dvp.priceOracles(token1.address);
        assert.strictEqual(priceOracles.length, 0);

        await dvp
          .connect(tokenHolder1Signer)
          .setPriceOracles(token1.address, [
            oracleSigner.getAddress(),
            unknownSigner.getAddress()
          ]);

        priceOracles = await dvp.priceOracles(token1.address);
        assert.strictEqual(priceOracles.length, 2);
        assert.strictEqual(priceOracles[0], await oracleSigner.getAddress());
        assert.strictEqual(priceOracles[1], await unknownSigner.getAddress());
      });
    });
    describe('when the caller is an other price oracle', function () {
      it('sets the operators as token price oracle', async function () {
        let priceOracles = await dvp.priceOracles(token1.address);
        assert.strictEqual(priceOracles.length, 0);

        await dvp
          .connect(tokenHolder1Signer)
          .setPriceOracles(token1.address, [oracleSigner.getAddress()]);

        priceOracles = await dvp.priceOracles(token1.address);
        assert.strictEqual(priceOracles.length, 1);
        assert.strictEqual(priceOracles[0], await oracleSigner.getAddress());

        await dvp
          .connect(oracleSigner)
          .setPriceOracles(token1.address, [
            oracleSigner.getAddress(),
            unknownSigner.getAddress()
          ]);

        priceOracles = await dvp.priceOracles(token1.address);
        assert.strictEqual(priceOracles.length, 2);
        assert.strictEqual(priceOracles[0], await oracleSigner.getAddress());
        assert.strictEqual(priceOracles[1], await unknownSigner.getAddress());
      });
    });
    describe('when the caller is neither the token contract signer.getAddress() nor a token price oracle', function () {
      it('reverts', async function () {
        await assertRevert(
          dvp
            .connect(tokenHolder2Signer)
            .setPriceOracles(token1.address, [
              oracleSigner.getAddress(),
              unknownSigner.getAddress()
            ])
        );
      });
    });
  });

  // SET PRICE OWNERSHIP
  describe('setPriceOwnership', function () {
    let dvp: Swaps;
    let token1: ERC20Token;
    let token2: ERC20Token;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      token1 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      await dvp.setPriceOracles(token1.address, [oracleSigner.getAddress()]);

      token2 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      await dvp.setPriceOracles(token2.address, [unknownSigner.getAddress()]);
    });
    describe('when sender is price oracle of the token', function () {
      it('takes the price signer.getAddress()ship for a given token', async function () {
        assert.strictEqual(
          await dvp.getPriceOwnership(token1.address, token2.address),
          false
        );

        await dvp
          .connect(oracleSigner)
          .setPriceOwnership(token1.address, token2.address, true);
        assert.strictEqual(
          await dvp.getPriceOwnership(token1.address, token2.address),
          true
        );

        await dvp
          .connect(oracleSigner)
          .setPriceOwnership(token1.address, token2.address, false);
        assert.strictEqual(
          await dvp.getPriceOwnership(token1.address, token2.address),
          false
        );
      });
    });
    describe('when sender is not price oracle of the token', function () {
      it('reverts', async function () {
        await assertRevert(
          dvp
            .connect(unknownSigner)
            .setPriceOwnership(token1.address, token2.address, true)
        );
      });
    });
  });

  // SET TOKEN PRICE
  describe('setTokenPrice', function () {
    const newTokenPrice = 2;
    let dvp: Swaps;
    let token1: ERC20Token;
    let token2: ERC20Token;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      token1 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      await dvp.setPriceOracles(token1.address, [oracleSigner.getAddress()]);

      token2 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      await dvp.setPriceOracles(token2.address, [unknownSigner.getAddress()]);
    });
    describe('when there is no competition on the price signer.getAddress()ship', function () {
      describe('when the price signer.getAddress()ship is taken', function () {
        describe('when the price signer.getAddress()ship is taken by the right person', function () {
          it('sets the price for token1', async function () {
            await dvp
              .connect(oracleSigner)
              .setPriceOwnership(token1.address, token2.address, true);
            assert.strictEqual(
              await dvp.getPriceOwnership(token1.address, token2.address),
              true
            );
            assert.strictEqual(
              await dvp.getPriceOwnership(token2.address, token1.address),
              false
            );

            assert.strictEqual(
              (
                await dvp.getTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2
                )
              ).eq(0),
              true
            );
            await dvp
              .connect(oracleSigner)
              .setTokenPrice(
                token1.address,
                token2.address,
                partition1,
                partition2,
                newTokenPrice
              );
            assert.strictEqual(
              (
                await dvp.getTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2
                )
              ).eq(newTokenPrice),
              true
            );
          });
          it('sets the price for token2', async function () {
            await dvp
              .connect(unknownSigner)
              .setPriceOwnership(token2.address, token1.address, true);
            assert.strictEqual(
              await dvp.getPriceOwnership(token1.address, token2.address),
              false
            );
            assert.strictEqual(
              await dvp.getPriceOwnership(token2.address, token1.address),
              true
            );

            assert.strictEqual(
              (
                await dvp.getTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2
                )
              ).eq(0),
              true
            );
            await dvp
              .connect(unknownSigner)
              .setTokenPrice(
                token1.address,
                token2.address,
                partition1,
                partition2,
                newTokenPrice
              );
            assert.strictEqual(
              (
                await dvp.getTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2
                )
              ).eq(newTokenPrice),
              true
            );
          });
        });
        describe('when the price signer.getAddress()ship is not taken by the right person', function () {
          it('reverts', async function () {
            await dvp
              .connect(oracleSigner)
              .setPriceOwnership(token1.address, token2.address, true);
            assert.strictEqual(
              await dvp.getPriceOwnership(token1.address, token2.address),
              true
            );
            assert.strictEqual(
              await dvp.getPriceOwnership(token2.address, token1.address),
              false
            );

            await assertRevert(
              dvp
                .connect(unknownSigner)
                .setTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2,
                  newTokenPrice
                )
            );
          });
          it('reverts', async function () {
            await dvp
              .connect(unknownSigner)
              .setPriceOwnership(token2.address, token1.address, true);
            assert.strictEqual(
              await dvp.getPriceOwnership(token1.address, token2.address),
              false
            );
            assert.strictEqual(
              await dvp.getPriceOwnership(token2.address, token1.address),
              true
            );

            await assertRevert(
              dvp
                .connect(oracleSigner)
                .setTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2,
                  newTokenPrice
                )
            );
          });
        });
      });
      describe('when the price signer.getAddress()ship is not taken', function () {
        it('sets the price for token1', async function () {
          await assertRevert(
            dvp
              .connect(oracleSigner)
              .setTokenPrice(
                token1.address,
                token2.address,
                partition1,
                partition2,
                newTokenPrice
              )
          );
        });
      });
    });
    describe('when there is competition on the price signer.getAddress()ship', function () {
      beforeEach(async function () {
        await dvp
          .connect(oracleSigner)
          .setPriceOwnership(token1.address, token2.address, true);
        await dvp
          .connect(unknownSigner)
          .setPriceOwnership(token2.address, token1.address, true);
      });
      it('reverts', async function () {
        await assertRevert(
          dvp
            .connect(oracleSigner)
            .setTokenPrice(
              token1.address,
              token2.address,
              partition1,
              partition2,
              newTokenPrice
            )
        );
      });
    });
  });

  // SET VARIABLE PRICE START DATE
  describe('setVariablePriceStartDate', function () {
    let dvp: Swaps;
    let token1: ERC20Token;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      token1 = await new ERC20Token__factory(signer).deploy(
        'ERC20Token',
        'DAU',
        18
      );
      await dvp.setPriceOracles(token1.address, [oracleSigner.getAddress()]);
    });
    describe('when sender is price oracle of the token', function () {
      describe('when start date is further than a week', function () {
        it('sets the variable price start date for a given token', async function () {
          let chainTime = (await provider.getBlock('latest')).timestamp;
          let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
          assert.strictEqual(
            (await dvp.variablePriceStartDate(token1.address)).eq(0),
            true
          );

          await dvp
            .connect(oracleSigner)
            .setVariablePriceStartDate(token1.address, variablePriceStartDate);
          assert.strictEqual(
            (await dvp.variablePriceStartDate(token1.address)).eq(
              variablePriceStartDate
            ),
            true
          );

          await dvp
            .connect(oracleSigner)
            .setVariablePriceStartDate(token1.address, 0);
          assert.strictEqual(
            (await dvp.variablePriceStartDate(token1.address)).eq(0),
            true
          );
        });
      });
      describe('when start date is not further than a week', function () {
        it('reverts', async function () {
          let chainTime = (await provider.getBlock('latest')).timestamp;
          let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK - 1;
          await assertRevert(
            dvp
              .connect(oracleSigner)
              .setVariablePriceStartDate(token1.address, variablePriceStartDate)
          );
        });
      });
    });
    describe('when sender is not price oracle of the token', function () {
      it('reverts', async function () {
        let chainTime = (await provider.getBlock('latest')).timestamp;
        let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
        await assertRevert(
          dvp
            .connect(unknownSigner)
            .setVariablePriceStartDate(token1.address, variablePriceStartDate)
        );
      });
    });
  });

  // GET PRICE

  /* const token1Amount = 10; */
  /* const token2Amount = 400; */
  /* const token3Amount = 400; */
  /* const token4Amount = 10; */

  describe('getPrice', function () {
    const newTokenPrice = 2;
    let dvp: Swaps;
    let token1: ERC1400;
    let token2: ERC1400;
    beforeEach(async function () {
      dvp = await new Swaps__factory(signer).deploy(false);

      token1 = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [signer.getAddress()],
        partitions
      );
      await token1.issueByPartition(
        partition1,
        tokenHolder1Signer.getAddress(),
        issuanceAmount,
        MOCK_CERTIFICATE
      );
      await dvp.setPriceOracles(token1.address, [oracleSigner.getAddress()]);

      token2 = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [signer.getAddress()],
        partitions
      );
      await token2.issueByPartition(
        partition2,
        recipient1Signer.getAddress(),
        issuanceAmount,
        MOCK_CERTIFICATE
      );
      await dvp.setPriceOracles(token2.address, [unknownSigner.getAddress()]);

      // Create and accept a first trade
      let chainTime = (await provider.getBlock('latest')).timestamp;
      let expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
      let tradeProposalData = getTradeProposalData(
        await recipient1Signer.getAddress(),
        await executerSigner.getAddress(),
        expirationDate,
        0,
        token2.address,
        token2Amount,
        partition2,
        ERC1400STANDARD,
        TYPE_ESCROW
      );
      await token1
        .connect(tokenHolder1Signer)
        .operatorTransferByPartition(
          partition1,
          tokenHolder1Signer.getAddress(),
          dvp.address,
          token1Amount,
          tradeProposalData,
          MOCK_CERTIFICATE
        );
      let tradeAcceptanceData = getTradeAcceptanceData(1);
      await token2
        .connect(recipient1Signer)
        .operatorTransferByPartition(
          partition2,
          recipient1Signer.getAddress(),
          dvp.address,
          token2Amount,
          tradeAcceptanceData,
          MOCK_CERTIFICATE
        );

      let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
      assert.strictEqual(
        (await dvp.variablePriceStartDate(token1.address)).eq(0),
        true
      );

      await dvp
        .connect(oracleSigner)
        .setVariablePriceStartDate(token1.address, variablePriceStartDate);
    });
    describe('when the variable price start date has been set', function () {
      beforeEach(async function () {
        let chainTime = (await provider.getBlock('latest')).timestamp;
        let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
        await dvp
          .connect(oracleSigner)
          .setVariablePriceStartDate(token1.address, variablePriceStartDate);
        // Wait for 1 week
        await advanceTimeAndBlock(SECONDS_IN_A_WEEK + 100);
      });
      describe('when there is no competition on the price signer.getAddress()ship', function () {
        describe('when the price signer.getAddress()ship is taken', function () {
          describe('when the first token has more value than the second token', function () {
            describe('when the price signer.getAddress()ship is taken for the first token', function () {
              beforeEach(async function () {
                await dvp
                  .connect(oracleSigner)
                  .setPriceOwnership(token1.address, token2.address, true);
              });
              describe('when the price is set (case 1)', function () {
                const multiple2 = 2;
                beforeEach(async function () {
                  await dvp
                    .connect(oracleSigner)
                    .setTokenPrice(
                      token1.address,
                      token2.address,
                      ALL_PARTITIONS,
                      ALL_PARTITIONS,
                      multiple2
                    );
                });

                it('returns the updatedprice', async function () {
                  assert.strictEqual(
                    (await dvp.getPrice(1)).eq(multiple2 * token1Amount),
                    true
                  );
                });

                describe('when the price is set (case 2)', function () {
                  const multiple3 = 3;
                  beforeEach(async function () {
                    await dvp
                      .connect(oracleSigner)
                      .setTokenPrice(
                        token1.address,
                        token2.address,
                        ALL_PARTITIONS,
                        partition2,
                        multiple3
                      );
                  });
                  it('returns the updatedprice', async function () {
                    assert.strictEqual(
                      (await dvp.getPrice(1)).eq(multiple3 * token1Amount),
                      true
                    );
                  });
                  describe('when the price is set (case 3)', function () {
                    const multiple4 = 4;
                    beforeEach(async function () {
                      await dvp
                        .connect(oracleSigner)
                        .setTokenPrice(
                          token1.address,
                          token2.address,
                          partition1,
                          ALL_PARTITIONS,
                          multiple4
                        );
                    });
                    it('returns the updatedprice', async function () {
                      assert.strictEqual(
                        (await dvp.getPrice(1)).eq(multiple4 * token1Amount),
                        true
                      );
                    });
                    describe('when the price is set (case 4)', function () {
                      const multiple5 = 5;
                      beforeEach(async function () {
                        await dvp
                          .connect(oracleSigner)
                          .setTokenPrice(
                            token1.address,
                            token2.address,
                            partition1,
                            partition2,
                            multiple5
                          );
                      });
                      it('returns the updatedprice', async function () {
                        assert.strictEqual(
                          (await dvp.getPrice(1)).eq(multiple5 * token1Amount),
                          true
                        );
                      });
                      it('executes the trade at correct price', async function () {
                        await assertBalanceOfByPartition(
                          token1,
                          tokenHolder1Signer.getAddress(),
                          partition1,
                          issuanceAmount - token1Amount
                        );
                        await assertBalanceOfByPartition(
                          token1,
                          dvp.address,
                          partition1,
                          token1Amount
                        );
                        await assertBalanceOfByPartition(
                          token1,
                          recipient1Signer.getAddress(),
                          partition1,
                          0
                        );
                        await assertBalanceOfByPartition(
                          token2,
                          recipient1Signer.getAddress(),
                          partition2,
                          issuanceAmount - token2Amount
                        );
                        await assertBalanceOfByPartition(
                          token2,
                          dvp.address,
                          partition2,
                          token2Amount
                        );
                        await assertBalanceOfByPartition(
                          token2,
                          tokenHolder1Signer.getAddress(),
                          partition2,
                          0
                        );
                        await dvp.connect(executerSigner).executeTrade(1);
                        await assertBalanceOfByPartition(
                          token1,
                          tokenHolder1Signer.getAddress(),
                          partition1,
                          issuanceAmount - token1Amount
                        );
                        await assertBalanceOfByPartition(
                          token1,
                          dvp.address,
                          partition1,
                          0
                        );
                        await assertBalanceOfByPartition(
                          token1,
                          recipient1Signer.getAddress(),
                          partition1,
                          token1Amount
                        );
                        await assertBalanceOfByPartition(
                          token2,
                          recipient1Signer.getAddress(),
                          partition2,
                          issuanceAmount - multiple5 * token1Amount
                        );
                        await assertBalanceOfByPartition(
                          token2,
                          dvp.address,
                          partition2,
                          0
                        );
                        await assertBalanceOfByPartition(
                          token2,
                          tokenHolder1Signer.getAddress(),
                          partition2,
                          multiple5 * token1Amount
                        );
                      });
                    });
                  });
                });
              });
              describe('when the price is not set', function () {
                it('returns the price defined in the trade', async function () {
                  assert.strictEqual(
                    (await dvp.getPrice(1)).eq(token2Amount),
                    true
                  );
                });
              });
            });
            describe('when the price signer.getAddress()ship is taken for the second token', function () {
              beforeEach(async function () {
                await dvp
                  .connect(unknownSigner)
                  .setPriceOwnership(token2.address, token1.address, true);
              });
              describe('when the price is set (case 1)', function () {
                const multiple2 = 2;
                beforeEach(async function () {
                  await dvp
                    .connect(unknownSigner)
                    .setTokenPrice(
                      token1.address,
                      token2.address,
                      ALL_PARTITIONS,
                      ALL_PARTITIONS,
                      multiple2
                    );
                });
                it('returns the updatedprice', async function () {
                  assert.strictEqual(
                    (await dvp.getPrice(1)).eq(multiple2 * token1Amount),
                    true
                  );
                });
              });
            });
          });
          describe('when the second token has more value than the first token', function () {
            let token3: ERC1400;
            let token4: ERC1400;
            beforeEach(async function () {
              token3 = await new ERC1400__factory(signer).deploy(
                'ERC1400Token',
                'DAU',
                1,
                [signer.getAddress()],
                partitions
              );
              await token3.issueByPartition(
                partition1,
                tokenHolder1Signer.getAddress(),
                issuanceAmount,
                MOCK_CERTIFICATE
              );
              await dvp.setPriceOracles(token3.address, [
                oracleSigner.getAddress()
              ]);

              token4 = await new ERC1400__factory(signer).deploy(
                'ERC1400Token',
                'DAU',
                1,
                [signer.getAddress()],
                partitions
              );
              await token4.issueByPartition(
                partition2,
                recipient1Signer.getAddress(),
                issuanceAmount,
                MOCK_CERTIFICATE
              );
              await dvp.setPriceOracles(token4.address, [
                unknownSigner.getAddress()
              ]);

              // Create and accept a second trade
              const chainTime = (await provider.getBlock('latest')).timestamp;
              const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
              const tradeProposalData = getTradeProposalData(
                await recipient1Signer.getAddress(),
                await executerSigner.getAddress(),
                expirationDate,
                0,
                token4.address,
                token4Amount,
                partition2,
                ERC1400STANDARD,
                TYPE_ESCROW
              );
              await token3
                .connect(tokenHolder1Signer)
                .operatorTransferByPartition(
                  partition1,
                  tokenHolder1Signer.getAddress(),
                  dvp.address,
                  token3Amount,
                  tradeProposalData,
                  MOCK_CERTIFICATE
                );
              const tradeAcceptanceData = getTradeAcceptanceData(2);
              await token4
                .connect(recipient1Signer)
                .operatorTransferByPartition(
                  partition2,
                  recipient1Signer.getAddress(),
                  dvp.address,
                  token4Amount,
                  tradeAcceptanceData,
                  MOCK_CERTIFICATE
                );

              let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
              await dvp
                .connect(oracleSigner)
                .setVariablePriceStartDate(
                  token3.address,
                  variablePriceStartDate
                );
              // Wait for 1 week
              await advanceTimeAndBlock(SECONDS_IN_A_WEEK + 100);
            });
            describe('when the price signer.getAddress()ship is taken for the first token', function () {
              beforeEach(async function () {
                await dvp
                  .connect(oracleSigner)
                  .setPriceOwnership(token3.address, token4.address, true);
              });
              describe('when the price is set (case 1)', function () {
                const multiple2 = 2;
                beforeEach(async function () {
                  await dvp
                    .connect(oracleSigner)
                    .setTokenPrice(
                      token4.address,
                      token3.address,
                      ALL_PARTITIONS,
                      ALL_PARTITIONS,
                      multiple2
                    );
                });
                it('returns the updatedprice', async function () {
                  assert.strictEqual(
                    (await dvp.getPrice(2)).eq(
                      Math.round(token3Amount / multiple2)
                    ),
                    true
                  );
                });
                describe('when the price is set (case 2)', function () {
                  const multiple3 = 3;
                  beforeEach(async function () {
                    await dvp
                      .connect(oracleSigner)
                      .setTokenPrice(
                        token4.address,
                        token3.address,
                        partition2,
                        ALL_PARTITIONS,
                        multiple3
                      );
                  });
                  it('returns the updatedprice', async function () {
                    assert.strictEqual(
                      (await dvp.getPrice(2)).eq(
                        Math.round(token3Amount / multiple3)
                      ),
                      true
                    );
                  });
                  describe('when the price is set (case 3)', function () {
                    const multiple4 = 4;
                    beforeEach(async function () {
                      await dvp
                        .connect(oracleSigner)
                        .setTokenPrice(
                          token4.address,
                          token3.address,
                          ALL_PARTITIONS,
                          partition1,
                          multiple4
                        );
                    });
                    it('returns the updatedprice', async function () {
                      assert.strictEqual(
                        (await dvp.getPrice(2)).eq(
                          Math.round(token3Amount / multiple4)
                        ),
                        true
                      );
                    });
                    describe('when the price is set (case 4)', function () {
                      const multiple5 = 5;
                      beforeEach(async function () {
                        await dvp
                          .connect(oracleSigner)
                          .setTokenPrice(
                            token4.address,
                            token3.address,
                            partition2,
                            partition1,
                            multiple5
                          );
                      });
                      it('returns the updatedprice', async function () {
                        assert.strictEqual(
                          (await dvp.getPrice(2)).eq(
                            Math.round(token3Amount / multiple5)
                          ),
                          true
                        );
                      });
                      it('reverts when price is higher than amount escrowed/authorized', async function () {
                        await assertBalanceOfByPartition(
                          token3,
                          await tokenHolder1Signer.getAddress(),
                          partition1,
                          issuanceAmount - token3Amount
                        );
                        await assertBalanceOfByPartition(
                          token3,
                          dvp.address,
                          partition1,
                          token3Amount
                        );
                        await assertBalanceOfByPartition(
                          token3,
                          await recipient1Signer.getAddress(),
                          partition1,
                          0
                        );
                        await assertBalanceOfByPartition(
                          token4,
                          await recipient1Signer.getAddress(),
                          partition2,
                          issuanceAmount - token4Amount
                        );
                        await assertBalanceOfByPartition(
                          token4,
                          dvp.address,
                          partition2,
                          token4Amount
                        );
                        await assertBalanceOfByPartition(
                          token4,
                          await tokenHolder1Signer.getAddress(),
                          partition2,
                          0
                        );
                        await assertRevert(
                          dvp.connect(executerSigner).executeTrade(2)
                        );
                        // await assertBalanceOfByPartition(token3, tokenHolder1Signer.getAddress(), partition1, issuanceAmount - token3Amount);
                        // await assertBalanceOfByPartition(token3, dvp.address, partition1, 0);
                        // await assertBalanceOfByPartition(token3, recipient1Signer.getAddress(), partition1, token3Amount);
                        // await assertBalanceOfByPartition(token4, recipient1Signer.getAddress(), partition2, issuanceAmount - Math.round(token3Amount/multiple5));
                        // await assertBalanceOfByPartition(token4, dvp.address, partition2, 0);
                        // await assertBalanceOfByPartition(token4, tokenHolder1Signer.getAddress(), partition2, Math.round(token3Amount/multiple5));
                      });
                    });
                  });
                });
              });
              describe('when the price is not set', function () {
                it('returns the price defined in the trade', async function () {
                  assert.strictEqual(
                    (await dvp.getPrice(2)).eq(token4Amount),
                    true
                  );
                });
              });
            });
            describe('when the price signer.getAddress()ship is taken for the second token', function () {
              beforeEach(async function () {
                await dvp
                  .connect(unknownSigner)
                  .setPriceOwnership(token4.address, token3.address, true);
              });
              describe('when the price is set (case 1)', function () {
                const multiple2 = 2;
                beforeEach(async function () {
                  await dvp
                    .connect(unknownSigner)
                    .setTokenPrice(
                      token4.address,
                      token3.address,
                      ALL_PARTITIONS,
                      ALL_PARTITIONS,
                      multiple2
                    );
                });
                it('returns the updatedprice', async function () {
                  assert.strictEqual(
                    (await dvp.getPrice(2)).eq(token3Amount / multiple2),
                    true
                  );
                });
              });
            });
          });
        });
        describe('when the price signer.getAddress()ship is not taken', function () {
          it('returns the price defined in the trade', async function () {
            assert.strictEqual((await dvp.getPrice(1)).eq(token2Amount), true);
          });
        });
      });
      describe('when there is competition on the price signer.getAddress()ship', function () {
        beforeEach(async function () {
          await dvp
            .connect(oracleSigner)
            .setPriceOwnership(token1.address, token2.address, true);
          await dvp
            .connect(unknownSigner)
            .setPriceOwnership(token2.address, token1.address, true);
        });
        it('reverts', async function () {
          await assertRevert(dvp.getPrice(1));
        });
      });
    });
    describe('when the variable price start date has been set', function () {
      it('returns the non-updated price', async function () {
        await dvp
          .connect(oracleSigner)
          .setPriceOwnership(token1.address, token2.address, true);
        const multiple2 = 2;
        await dvp
          .connect(oracleSigner)
          .setTokenPrice(
            token1.address,
            token2.address,
            ALL_PARTITIONS,
            ALL_PARTITIONS,
            multiple2
          );
        assert.strictEqual((await dvp.getPrice(1)).eq(token2Amount), true);
      });
    });
  });
});
