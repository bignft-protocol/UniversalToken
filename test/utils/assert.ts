import { ethers, BigNumber, BigNumberish, BytesLike, Event } from 'ethers';
import assert from 'assert';
import {
  ERC1400,
  ERC1400HoldableCertificateToken,
  ERC1400TokensValidator,
  ERC1820Registry,
  ERC20,
  ERC721,
  FundIssuer,
  Swaps
} from '../../typechain-types';
import {
  extractTokenAccepted,
  extractTokenAddress,
  extractTokenAmount,
  extractTokenApproved,
  extractTokenId,
  extractTokenStandard
} from './extract';

import { ERC1400_TOKENS_VALIDATOR } from '../common/extension';
import { provider } from '../../test/common/wallet';
import { PromiseOrValue } from 'typechain-types/common';

export const STATE_PENDING = 1;
export const STATE_EXECUTED = 2;
export const STATE_FORCED = 3;
export const STATE_CANCELLED = 4;

export const TYPE_ESCROW = 2;
export const TYPE_HOLD = 1;
export const TYPE_SWAP = 0;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ZERO_BYTE = '0x';
export const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

export const OFFCHAIN =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
export const ETHSTANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000001';
export const ERC20STANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000002';
export const ERC721STANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000003';
export const ERC1400STANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000004';

export const TRUE_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000001';
export const FALSE_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

export const assertBalanceOf = async (
  _contract: ERC20,
  _tokenHolder: PromiseOrValue<string>,
  _amount: BigNumberish,
  _balanceIsExact: boolean
) => {
  const balance = await _contract.balanceOf(_tokenHolder);
  assert.strictEqual(
    _balanceIsExact ? balance.eq(_amount) : balance.gte(_amount),
    true
  );
};

export const assertBalanceOfByPartition = async (
  _contract: ERC1400,
  _tokenHolder: PromiseOrValue<string>,
  _partition: BytesLike,
  _amount: BigNumberish
) => {
  const balanceByPartition = await _contract.balanceOfByPartition(
    _partition,
    _tokenHolder
  );

  assert.strictEqual(
    balanceByPartition.isZero() || balanceByPartition.eq(_amount),
    true
  );
};

export const assertTokenOf = async (
  _contract: ERC721,
  _tokenHolder: string,
  _tokenId: BigNumberish
) => {
  const ownerOf = await _contract.ownerOf(_tokenId);

  assert.strictEqual(ownerOf, _tokenHolder);
};

export const assertERC20Allowance = async (
  _contract: ERC20,
  _tokenHolder: PromiseOrValue<string>,
  _spender: string,
  _amount: number
) => {
  const allowance = (
    await _contract.allowance(_tokenHolder, _spender)
  ).toNumber();
  assert.strictEqual(allowance, _amount);
};

export const assertERC1400Allowance = async (
  _partition: BytesLike,
  _contract: ERC1400,
  _tokenHolder: PromiseOrValue<string>,
  _spender: string,
  _amount: number
) => {
  const allowance = (
    await _contract.allowanceByPartition(_partition, _tokenHolder, _spender)
  ).toNumber();
  assert.strictEqual(allowance, _amount);
};

export const assertERC721Allowance = async (
  _contract: ERC721,
  _tokenHolder: string,
  _tokenId: number
) => {
  const approvedOf = await _contract.getApproved(_tokenId);
  assert.strictEqual(approvedOf, _tokenHolder);
};

export const assertEtherBalance = async (
  _etherHolder: PromiseOrValue<string>,
  _balance: BigNumberish,
  _balanceIsExact: boolean
) => {
  const balance = await provider.getBalance(_etherHolder);
  assert.strictEqual(
    _balanceIsExact ? balance.eq(_balance) : balance.sub(_balance).lt(0.1),
    true
  );
};

export const assertAssetRules = async (
  _contract: FundIssuer,
  _assetAddress: PromiseOrValue<string>,
  _assetClass: BytesLike,
  _firstStartTime: BigNumberish,
  _subscriptionPeriodLength: BigNumberish,
  _valuationPeriodLength: BigNumberish,
  _paymentPeriodLength: BigNumberish,
  _assetValueType: number,
  _assetValue: number,
  _reverseAssetValue: number,
  _paymentType: number,
  _paymentAddress: string,
  _paymentPartition: string,
  _fundAddress: string,
  _subscriptionsOpened: boolean
) => {
  const rules = await _contract.getAssetRules(_assetAddress, _assetClass);

  assert.strictEqual(BigNumber.from(rules[0]).eq(_firstStartTime), true);
  assert.strictEqual(
    BigNumber.from(rules[1]).eq(_subscriptionPeriodLength),
    true
  );
  assert.strictEqual(BigNumber.from(rules[2]).eq(_valuationPeriodLength), true);
  assert.strictEqual(BigNumber.from(rules[3]).eq(_paymentPeriodLength), true);
  assert.strictEqual(rules[4], _paymentType);
  assert.strictEqual(rules[5], _paymentAddress);
  assert.strictEqual(rules[6], _paymentPartition);
  assert.strictEqual(rules[7], _fundAddress);

  assert.strictEqual(rules[8] === _subscriptionsOpened, true);

  const assetValueRules = await _contract.getAssetValueRules(
    _assetAddress,
    _assetClass
  );
  assert.strictEqual(assetValueRules[0], _assetValueType);
  assert.strictEqual(assetValueRules[1].toNumber(), _assetValue);
  assert.strictEqual(assetValueRules[2].toNumber(), _reverseAssetValue);
};

export const assertCycle = async (
  _contract: FundIssuer,
  _cycleIndex: number,
  _assetAddress: string,
  _assetClass: any,
  _startTime: any,
  _subscriptionPeriodLength: BigNumberish,
  _valuationPeriodLength: BigNumberish,
  _paymentPeriodLength: BigNumberish,
  _paymentType: number,
  _paymentAddress: string,
  _paymentPartition: string,
  _finalized: boolean
) => {
  const cycle = await _contract.getCycle(_cycleIndex);

  assert.strictEqual(cycle[0], _assetAddress);
  assert.strictEqual(cycle[1], _assetClass);
  assert.strictEqual(cycle[2], _startTime);
  assert.strictEqual(cycle[3], _subscriptionPeriodLength);
  assert.strictEqual(cycle[4], _valuationPeriodLength);
  assert.strictEqual(cycle[5], _paymentPeriodLength);
  assert.strictEqual(cycle[6], _paymentType);
  assert.strictEqual(cycle[7], _paymentAddress);
  assert.strictEqual(cycle[8], _paymentPartition);
  assert.strictEqual(cycle[9] === _finalized, true);
};

export const assertCycleState = async (
  _contract: FundIssuer,
  _assetAddress: any,
  _assetClass: string,
  _state: number
) => {
  const cycleIndex = (
    await _contract.getLastCycleIndex(_assetAddress, _assetClass)
  ).toNumber();
  const cycleState = await _contract.getCycleState(cycleIndex);

  assert.strictEqual(cycleState, _state);
};

export const assertCycleAssetValue = async (
  _contract: FundIssuer,
  _cycleIndex: number,
  _assetValueType: number,
  _assetValue: number,
  _reverseAssetValue: number
) => {
  const valueData = await _contract.getCycleAssetValue(_cycleIndex);

  assert.strictEqual(valueData[0], _assetValueType);
  assert.strictEqual(valueData[1].toNumber(), _assetValue);
  assert.strictEqual(valueData[2].toNumber(), _reverseAssetValue);
};

export const assertOrder = async (
  _contract: FundIssuer,
  _orderIndex: any,
  _cycleIndex: number,
  _investor: string,
  _value: number,
  _amount: number,
  _orderType: number,
  _state: number
) => {
  const order = await _contract.getOrder(_orderIndex);

  assert.strictEqual(order[0].toNumber(), _cycleIndex);
  assert.strictEqual(order[1], _investor);
  assert.strictEqual(order[2].toNumber(), _value);
  assert.strictEqual(order[3].toNumber(), _amount);
  assert.strictEqual(order[4], _orderType);

  assert.strictEqual(order[5], _state);
};

export const assertTokenTransferred = async (
  dvp: Swaps,
  token1: ERC20 | ERC721 | ERC1400 | undefined,
  token2: ERC20 | ERC721 | ERC1400 | undefined,
  holder1: string,
  holder2: string,
  tokenStandard1: BigNumberish,
  tokenStandard2: BigNumberish,
  tokenAmount1: BigNumberish,
  tokenAmount2: BigNumberish,
  issuanceAmount: BigNumberish,
  issuanceTokenId: number,
  partition: BytesLike
) => {
  if (BigNumber.from(tokenStandard1).eq(ERC20STANDARD)) {
    await assertBalanceOf(
      token1 as ERC20,
      holder1,
      BigNumber.from(issuanceAmount).sub(tokenAmount1),
      true
    );
    await assertBalanceOf(
      token1 as ERC20,
      holder2,
      holder2 !== ZERO_ADDRESS ? tokenAmount1 : 0,
      true
    );
    await assertBalanceOf(token1 as ERC20, dvp.address, 0, true);
  }
  if (BigNumber.from(tokenStandard2).eq(ERC20STANDARD)) {
    await assertBalanceOf(
      token2 as ERC20,
      holder2,
      holder2 !== ZERO_ADDRESS
        ? BigNumber.from(issuanceAmount).sub(tokenAmount2)
        : 0,
      true
    );
    await assertBalanceOf(token2 as ERC20, holder1, tokenAmount2, true);
    await assertBalanceOf(token2 as ERC20, dvp.address, 0, true);
  }
  if (BigNumber.from(tokenStandard1).eq(ERC721STANDARD)) {
    await assertTokenOf(
      token1 as ERC721,
      BigNumber.from(tokenAmount1).eq(1) ? holder2 : holder1,
      issuanceTokenId
    );
  }
  if (BigNumber.from(tokenStandard2).eq(ERC721STANDARD)) {
    await assertTokenOf(
      token2 as ERC721,
      BigNumber.from(tokenAmount2).eq(1) ? holder1 : holder2,
      issuanceTokenId
    );
  }
  if (BigNumber.from(tokenStandard1).eq(ERC1400STANDARD)) {
    await assertBalanceOfByPartition(
      token1 as ERC1400,
      holder1,
      partition,
      BigNumber.from(issuanceAmount).sub(tokenAmount1)
    );
    await assertBalanceOfByPartition(
      token1 as ERC1400,
      holder2,
      partition,
      holder2 !== ZERO_ADDRESS ? tokenAmount1 : 0
    );
    await assertBalanceOfByPartition(
      token1 as ERC1400,
      dvp.address,
      partition,
      0
    );
  }
  if (BigNumber.from(tokenStandard2).eq(ERC1400STANDARD)) {
    await assertBalanceOfByPartition(
      token2 as ERC1400,
      holder2,
      partition,
      holder2 !== ZERO_ADDRESS
        ? BigNumber.from(issuanceAmount).sub(tokenAmount2)
        : 0
    );
    await assertBalanceOfByPartition(
      token2 as ERC1400,
      holder1,
      partition,
      tokenAmount2
    );
    await assertBalanceOfByPartition(
      token2 as ERC1400,
      dvp.address,
      partition,
      0
    );
  }
};

export const assertTokenAuthorized = async (
  dvp: Swaps,
  token1: ERC20 | ERC721 | ERC1400,
  token2: any,
  holder1: any,
  holder2: any,
  tokenStandard1: BigNumberish,
  tokenStandard2: BigNumberish,
  tokenAmount1: number,
  tokenAmount2: number,
  issuanceAmount: number,
  issuanceTokenId: number,
  partition: BytesLike
) => {
  await assertTokenTransferred(
    dvp,
    token1 as ERC20,
    token2,
    holder1,
    holder2,
    tokenStandard1,
    tokenStandard2,
    0,
    0,
    issuanceAmount,
    issuanceTokenId,
    partition
  );

  if (BigNumber.from(tokenStandard1).eq(ERC20STANDARD)) {
    await assertERC20Allowance(
      token1 as ERC20,
      holder1,
      dvp.address,
      tokenAmount1
    );
  }
  if (BigNumber.from(tokenStandard2).eq(ERC20STANDARD)) {
    await assertERC20Allowance(token2, holder2, dvp.address, tokenAmount2);
  }
  if (BigNumber.from(tokenStandard1).eq(ERC721STANDARD) && tokenAmount1 === 1) {
    await assertERC721Allowance(token1 as ERC721, dvp.address, issuanceTokenId);
  }
  if (BigNumber.from(tokenStandard2).eq(ERC721STANDARD) && tokenAmount2 === 1) {
    await assertERC721Allowance(token2, dvp.address, issuanceTokenId);
  }
  if (BigNumber.from(tokenStandard1).eq(ERC1400STANDARD)) {
    await assertERC1400Allowance(
      partition,
      token1 as ERC1400,
      holder1,
      dvp.address,
      tokenAmount1
    );
  }
  if (BigNumber.from(tokenStandard2).eq(ERC1400STANDARD)) {
    await assertERC1400Allowance(
      partition,
      token2,
      holder2,
      dvp.address,
      tokenAmount2
    );
  }
  if (BigNumber.from(tokenStandard1).eq(ETHSTANDARD)) {
    throw new Error('Shall never happen as ETH needs to be escrowed 1');
  }
  if (BigNumber.from(tokenStandard2).eq(ETHSTANDARD)) {
    throw new Error('Shall never happen as ETH needs to be escrowed 2');
  }
};

export const assertTokenEscrowed = async (
  dvp: Swaps,
  token: ERC20 | ERC1400 | ERC721 | undefined,
  holder: string,
  tokenStandard: BigNumberish,
  tokenAmount: BigNumberish,
  issuanceAmount: number,
  issuanceTokenId: number,
  partition: BytesLike
) => {
  if (BigNumber.from(tokenStandard).eq(ERC20STANDARD)) {
    await assertBalanceOf(
      token as ERC20,
      holder,
      BigNumber.from(issuanceAmount).sub(tokenAmount),
      true
    );
    await assertBalanceOf(token as ERC20, dvp.address, tokenAmount, true);
  }
  if (BigNumber.from(tokenStandard).eq(ERC721STANDARD)) {
    await assertTokenOf(
      token as ERC721,
      BigNumber.from(tokenAmount).eq(1) ? dvp.address : holder,
      issuanceTokenId
    );
  }
  if (BigNumber.from(tokenStandard).eq(ERC1400STANDARD)) {
    await assertBalanceOfByPartition(
      token as ERC1400,
      holder,
      partition,
      BigNumber.from(issuanceAmount).sub(tokenAmount)
    );
    await assertBalanceOfByPartition(
      token as ERC1400,
      dvp.address,
      partition,
      tokenAmount
    );
  }
  if (BigNumber.from(tokenStandard).eq(ETHSTANDARD)) {
    await assertEtherBalance(dvp.address, tokenAmount, true);
  }
};

export const assertGlobalBalancesAreCorrect = async (
  dvp: Swaps,
  token1: ERC20 | ERC1400 | ERC721 | undefined,
  token2: ERC20 | ERC1400 | ERC721 | undefined,
  tradeIndex: BigNumberish,
  requester: string,
  issuanceAmount: number,
  issuanceTokenId: number,
  partition1: BytesLike,
  partition2: BytesLike
) => {
  const trade = await dvp.getTrade(tradeIndex);

  const holder1 = trade.holder1;
  const holder2 = trade.holder2 !== ZERO_ADDRESS ? trade.holder2 : requester;
  //const tradeType = trade[6].toNumber();

  let tokenData1 = trade.userTradeData1;
  const tokenAddress1 = extractTokenAddress(tokenData1);
  const tokenAmount1 = extractTokenAmount(tokenData1);
  const tokenStandard1 = extractTokenStandard(tokenData1);
  const tokenAccepted1 = extractTokenAccepted(tokenData1);
  const tradeType1 = tokenData1.tradeType;
  assert.strictEqual(tokenAddress1, token1 ? token1.address : ZERO_ADDRESS);

  let tokenData2 = trade.userTradeData2;
  const tokenAddress2 = extractTokenAddress(tokenData2);
  const tokenAmount2 = extractTokenAmount(tokenData2);
  const tokenStandard2 = extractTokenStandard(tokenData2);
  const tokenAccepted2 = extractTokenAccepted(tokenData2);
  const tradeType2 = tokenData2.tradeType;
  assert.strictEqual(tokenAddress2, token2 ? token2.address : ZERO_ADDRESS);

  const tradeState = Number(trade.state);

  if (tradeState === STATE_PENDING) {
    if (tradeType1 == TYPE_ESCROW) {
      if (tokenAccepted1) {
        await assertTokenEscrowed(
          dvp,
          token1,
          holder1,
          tokenStandard1,
          tokenAmount1.isZero() ? BigNumber.from(1) : tokenAmount1,
          issuanceAmount,
          issuanceTokenId,
          partition1
        );
      } else {
        await assertTokenEscrowed(
          dvp,
          token1,
          holder1,
          tokenStandard1,
          0,
          issuanceAmount,
          issuanceTokenId,
          partition1
        );
      }
    } else if (tradeType1 == TYPE_SWAP) {
      if (tokenAccepted1) {
        // await assertTokenAuthorized(dvp, token1, token2, holder1, holder2, tokenStandard1, tokenStandard2, 0, 0); // 1 used in case of ERC721
      } else {
        // await assertTokenAuthorized(dvp, token1, token2, holder1, holder2, tokenStandard1, tokenStandard2, 0, 0);
      }
    } else {
      throw new Error('Invalid trade type');
    }

    if (tradeType2 == TYPE_ESCROW) {
      if (tokenAccepted2) {
        await assertTokenEscrowed(
          dvp,
          token2,
          holder2,
          tokenStandard2,
          tokenAmount2 ?? 1,
          issuanceAmount,
          issuanceTokenId,
          partition2
        );
      } else {
        await assertTokenEscrowed(
          dvp,
          token2,
          holder2,
          tokenStandard2,
          0,
          issuanceAmount,
          issuanceTokenId,
          partition2
        );
      }
    } else if (tradeType2 == TYPE_SWAP) {
      if (tokenAccepted2) {
        // await assertTokenAuthorized(dvp, token1, token2, holder1, holder2, tokenStandard1, tokenStandard2, 0, 0); // 1 used in case of ERC721
      } else {
        // await assertTokenAuthorized(dvp, token1, token2, holder1, holder2, tokenStandard1, tokenStandard2, 0, 0);
      }
    } else {
      throw new Error('Invalid trade type');
    }
  } else if (tradeState === STATE_EXECUTED) {
    await assertTokenTransferred(
      dvp,
      token1,
      token2,
      holder1,
      holder2,
      tokenStandard1,
      tokenStandard2,
      tokenAmount1.isZero() ? BigNumber.from(1) : tokenAmount1,
      tokenAmount2.isZero() ? BigNumber.from(1) : tokenAmount2,
      issuanceAmount,
      issuanceTokenId,
      partition1
    ); // 1 used in case of ERC721
  } else if (tradeState === STATE_FORCED) {
    if (tokenAccepted1 && tokenAccepted2) {
      throw new Error('Transfer cant be forced when accepted by both holders');
    } else if (tokenAccepted1) {
      await assertTokenTransferred(
        dvp,
        token1,
        token2,
        holder1,
        holder2,
        tokenStandard1,
        tokenStandard2,
        tokenAmount1.isZero() ? BigNumber.from(1) : tokenAmount1,
        0,
        issuanceAmount,
        issuanceTokenId,
        partition1
      ); // 1 used in case of ERC721
    } else if (tokenAccepted2) {
      await assertTokenTransferred(
        dvp,
        token1,
        token2,
        holder1,
        holder2,
        tokenStandard1,
        tokenStandard2,
        0,
        tokenAmount2.isZero() ? BigNumber.from(1) : tokenAmount2,
        issuanceAmount,
        issuanceTokenId,
        partition1
      ); // 1 used in case of ERC721
    } else {
      throw new Error(
        'Transfer cant be forced when accepted by none of the holders'
      );
    }
  } else if (tradeState === STATE_CANCELLED) {
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
  } else {
    throw new Error('Trade is in an unknown state: shall never happen');
  }
};

export const assertTradeState = async (
  _contract: Swaps,
  _tradeIndex: BigNumberish,
  _tradeState: number
) => {
  const trade = await _contract.getTrade(_tradeIndex);
  assert.strictEqual(Number(trade.state), _tradeState);
};

export const assertTradeAccepted = async (
  _contract: Swaps,
  _tradeIndex: any,
  _requester: any,
  _accepted: boolean
) => {
  const trade = await _contract.getTrade(_tradeIndex);
  const holder1 = trade.holder1;
  const holder2 = trade.holder2;

  if (_requester === holder1) {
    assert.strictEqual(extractTokenAccepted(trade.userTradeData1), _accepted);
  }

  if (_requester === holder2) {
    assert.strictEqual(extractTokenAccepted(trade.userTradeData2), _accepted);
  }
};

export const assertTrade = (
  _contract: Swaps,
  _tradeIndex: number,
  _holder1: string,
  _holder2: string,
  _executer: string,
  _expirationDate: number,
  _tradeType: number,
  _tradeState: number,
  _token1Address: string,
  _token1Amount: BigNumberish,
  _token1Id: string,
  _token1Standard: BigNumberish,
  _token1Accepted: boolean,
  _token1Approved: boolean,
  _token2Address: string,
  _token2Amount: BigNumberish,
  _token2Id: string,
  _token2Standard: BigNumberish,
  _token2Accepted: boolean,
  _token2Approved: boolean
) => {
  return fullAssertTrade(
    _contract,
    _tradeIndex,
    _holder1,
    _holder2,
    _executer,
    _expirationDate,
    _tradeType,
    _tradeType,
    _tradeState,
    _token1Address,
    _token1Amount,
    _token1Id,
    _token1Standard,
    _token1Accepted,
    _token1Approved,
    _token2Address,
    _token2Amount,
    _token2Id,
    _token2Standard,
    _token2Accepted,
    _token2Approved
  );
};

export const fullAssertTrade = async (
  _contract: Swaps,
  _tradeIndex: number,
  _holder1: string,
  _holder2: string,
  _executer: string,
  _expirationDate: number,
  _tradeType1: number,
  _tradeType2: number,
  _tradeState: number,
  _token1Address: string,
  _token1Amount: BigNumberish,
  _token1Id: string,
  _token1Standard: BigNumberish,
  _token1Accepted: boolean,
  _token1Approved: boolean,
  _token2Address: string,
  _token2Amount: BigNumberish,
  _token2Id: string,
  _token2Standard: BigNumberish,
  _token2Accepted: boolean,
  _token2Approved: boolean
) => {
  const trade = await _contract.getTrade(_tradeIndex);

  assert.strictEqual(trade.holder1, _holder1);
  assert.strictEqual(trade.holder2, _holder2);
  assert.strictEqual(trade.executer, _executer);
  assert.strictEqual(trade.expirationDate.sub(_expirationDate).lte(1), true);

  const tokenData1 = trade.userTradeData1;
  const tokenAddress1 = extractTokenAddress(tokenData1);
  const tokenAmount1 = extractTokenAmount(tokenData1);
  const tokenId1 = extractTokenId(tokenData1);

  const tokenStandard1 = extractTokenStandard(tokenData1);
  let tokenAccepted1 = extractTokenAccepted(tokenData1);
  let tokenApproved1 = extractTokenApproved(tokenData1);
  assert.strictEqual(tokenAddress1, _token1Address);
  assert.strictEqual(tokenAmount1.eq(_token1Amount), true);
  assert.strictEqual(tokenId1, _token1Id);
  assert.strictEqual(
    tokenStandard1,
    BigNumber.from(_token1Standard).toNumber()
  );
  assert.strictEqual(tokenAccepted1, _token1Accepted);
  assert.strictEqual(tokenApproved1, _token1Approved);
  assert.strictEqual(tokenData1.tradeType, _tradeType1);

  const tokenData2 = trade.userTradeData2;
  const tokenAddress2 = extractTokenAddress(tokenData2);
  const tokenAmount2 = extractTokenAmount(tokenData2);
  const tokenId2 = extractTokenId(tokenData2);
  const tokenStandard2 = extractTokenStandard(tokenData2);
  let tokenAccepted2 = extractTokenAccepted(tokenData2);
  let tokenApproved2 = extractTokenApproved(tokenData2);
  assert.strictEqual(tokenAddress2, _token2Address);
  assert.strictEqual(tokenAmount2.eq(_token2Amount), true);
  assert.strictEqual(tokenId2, _token2Id);
  assert.strictEqual(
    tokenStandard2,
    BigNumber.from(_token2Standard).toNumber()
  );
  assert.strictEqual(tokenAccepted2, _token2Accepted);
  assert.strictEqual(tokenApproved2, _token2Approved);
  assert.strictEqual(tokenData2.tradeType, _tradeType2);

  assert.strictEqual(trade.state, _tradeState);
};

export const assertTransferEvent = (
  _logs: Event[],
  _fromPartition: string,
  _operator: string,
  _from: string,
  _to: string,
  _amount: number,
  _data: string | null,
  _operatorData: string | null
) => {
  let i = 0;
  if (_logs.length === 3) {
    assert.strictEqual(_logs[0].event, 'Checked');
    assert.strictEqual(_logs[0].args?.sender, _operator);
    i = 1;
  }

  assert.strictEqual(_logs[i].event, 'Transfer');
  assert.strictEqual(_logs[i].args?.from, _from);
  assert.strictEqual(_logs[i].args?.to, _to);
  assert.strictEqual(BigNumber.from(_logs[i].args?.value).toNumber(), _amount);

  assert.strictEqual(_logs[i + 1].event, 'TransferByPartition');
  assert.strictEqual(_logs[i + 1].args?.fromPartition, _fromPartition);
  assert.strictEqual(_logs[i + 1].args?.operator, _operator);
  assert.strictEqual(_logs[i + 1].args?.from, _from);
  assert.strictEqual(_logs[i + 1].args?.to, _to);
  assert.strictEqual(
    BigNumber.from(_logs[i + 1].args?.value).toNumber(),
    _amount
  );
  assert.strictEqual(_logs[i + 1].args?.data, _data);
  assert.strictEqual(_logs[i + 1].args?.operatorData, _operatorData);
};

export const assertBurnEvent = (
  _logs: Event[],
  _fromPartition: string,
  _operator: string,
  _from: string,
  _amount: number,
  _data: string | null,
  _operatorData: string | null
) => {
  let i = 0;
  if (_logs.length === 4) {
    assert.strictEqual(_logs[0].event, 'Checked');
    assert.strictEqual(_logs[0].args?.sender, _operator);
    i = 1;
  }

  assert.strictEqual(_logs[i].event, 'Redeemed');
  assert.strictEqual(_logs[i].args?.operator, _operator);
  assert.strictEqual(_logs[i].args?.from, _from);
  assert.strictEqual(BigNumber.from(_logs[i].args?.value).toNumber(), _amount);
  assert.strictEqual(_logs[i].args?.data, _data);

  assert.strictEqual(_logs[i + 1].event, 'Transfer');
  assert.strictEqual(_logs[i + 1].args?.from, _from);
  assert.strictEqual(_logs[i + 1].args?.to, ZERO_ADDRESS);
  assert.strictEqual(
    BigNumber.from(_logs[i + 1].args?.value).toNumber(),
    _amount
  );

  assert.strictEqual(_logs[i + 2].event, 'RedeemedByPartition');
  assert.strictEqual(_logs[i + 2].args?.partition, _fromPartition);
  assert.strictEqual(_logs[i + 2].args?.operator, _operator);
  assert.strictEqual(_logs[i + 2].args?.from, _from);
  assert.strictEqual(
    BigNumber.from(_logs[i + 2].args?.value).toNumber(),
    _amount
  );
  assert.strictEqual(_logs[i + 2].args?.operatorData, _operatorData);
};

export const assertBalances = async (
  _contract: ERC1400,
  _tokenHolder: PromiseOrValue<string>,
  _partitions: BytesLike[],
  _amounts: BigNumberish[]
) => {
  let totalBalance = BigNumber.from(0);
  for (let i = 0; i < _partitions.length; i++) {
    totalBalance = totalBalance.add(_amounts[i]);
    await assertBalanceOfByPartition(
      _contract as ERC1400,
      _tokenHolder,
      _partitions[i],
      _amounts[i]
    );
  }
  await assertBalance(_contract, _tokenHolder, totalBalance);
};

export const assertBalanceOfSecurityToken = async (
  _contract: ERC1400 | ERC20,
  _tokenHolder: PromiseOrValue<string>,
  _partition: string,
  _amount: number
) => {
  await assertBalance(_contract as ERC20, _tokenHolder, _amount);
  await assertBalanceOfByPartition(
    _contract as ERC1400,
    _tokenHolder,
    _partition,
    _amount
  );
};

export const assertBalance = async (
  _contract: ERC1400 | ERC20,
  _tokenHolder: PromiseOrValue<string>,
  _amount: BigNumberish
) => {
  const balance = await _contract.balanceOf(_tokenHolder);
  assert.strictEqual(balance.eq(_amount), true);
};

export const assertTotalSupply = async (
  _contract: ERC20 | ERC1400,
  _amount: BigNumberish
) => {
  const totalSupply = await _contract.totalSupply();
  assert.strictEqual(totalSupply.eq(_amount), true);
};

export const assertTokenHasExtension = async (
  _registry: ERC1820Registry,
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken
) => {
  let extensionImplementer = await _registry.getInterfaceImplementer(
    _token.address,
    ethers.utils.id(ERC1400_TOKENS_VALIDATOR)
  );
  assert.strictEqual(extensionImplementer, _extension.address);
};

export const assertCertificateActivated = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _expectedValue: number
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  assert.strictEqual(_expectedValue, tokenSetup[0]);
};

export const assertAllowListActivated = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _expectedValue: boolean
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  assert.strictEqual(_expectedValue, tokenSetup[1]);
};

export const assertBlockListActivated = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _expectedValue: boolean
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  assert.strictEqual(_expectedValue, tokenSetup[2]);
};

export const assertGranularityByPartitionActivated = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _expectedValue: boolean
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  assert.strictEqual(_expectedValue, tokenSetup[3]);
};

export const assertHoldsActivated = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _expectedValue: boolean
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  assert.strictEqual(_expectedValue, tokenSetup[4]);
};

export const assertIsTokenController = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _controller: string,
  _value: boolean
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  const controllerList = tokenSetup[5];
  assert.strictEqual(_value, controllerList.includes(_controller));
};

export const assertEscResponse = async (
  _response: string[],
  _escCode: string,
  _additionalCode: string,
  _destinationPartition: string
) => {
  assert.strictEqual(_response[0], _escCode);
  assert.strictEqual(_response[1], _additionalCode);
  assert.strictEqual(_response[2], _destinationPartition);
};

export async function assertRevert(
  promise: Promise<any>,
  revert: string = 'revert'
) {
  try {
    await promise;
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.indexOf(revert) === -1) {
      // When the exception was a revert, the resulting string will include only
      // the revert reason, otherwise it will be the type of exception (e.g. 'invalid opcode')
      const actualError = msg.replace(
        /Returned error: VM Exception while processing transaction: (revert )?/,
        ''
      );
      assert.strictEqual(
        actualError,
        revert,
        'Wrong kind of exception received'
      );
    }
    return;
  }

  assert.fail('Expected an exception but none was received');
}
