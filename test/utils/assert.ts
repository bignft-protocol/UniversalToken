import { BigNumber, BigNumberish, BytesLike } from 'ethers';
import { assert, ethers } from 'hardhat';
import { ERC1400, ERC20, ERC721, FundIssuer, Swaps } from 'typechain-types';
import {
  extractTokenAccepted,
  extractTokenAddress,
  extractTokenAmount,
  extractTokenApproved,
  extractTokenId,
  extractTokenStandard
} from './extract';

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

const OFFCHAIN =
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
  _tokenHolder: string,
  _amount: BigNumberish,
  _balanceIsExact: boolean
) => {
  const balance = await _contract.balanceOf(_tokenHolder);
  assert.isTrue(_balanceIsExact ? balance.eq(_amount) : balance.gte(_amount));
};

export const assertBalanceOfByPartition = async (
  _contract: ERC1400,
  _tokenHolder: string,
  _partition: BytesLike,
  _amount: BigNumberish
) => {
  const balanceByPartition = await _contract.balanceOfByPartition(
    _partition,
    _tokenHolder
  );
  assert.equal(balanceByPartition.eq(_amount), true);
};

export const assertTokenOf = async (
  _contract: ERC721,
  _tokenHolder: string,
  _tokenId: number
) => {
  const ownerOf = await _contract.ownerOf(_tokenId);

  assert.equal(ownerOf, _tokenHolder);
};

export const assertERC20Allowance = async (
  _contract: ERC20,
  _tokenHolder: string,
  _spender: string,
  _amount: number
) => {
  const allowance = (
    await _contract.allowance(_tokenHolder, _spender)
  ).toNumber();
  assert.equal(allowance, _amount);
};

export const assertERC1400Allowance = async (
  _partition: BytesLike,
  _contract: ERC1400,
  _tokenHolder: string,
  _spender: string,
  _amount: number
) => {
  const allowance = (
    await _contract.allowanceByPartition(_partition, _tokenHolder, _spender)
  ).toNumber();
  assert.equal(allowance, _amount);
};

export const assertERC721Allowance = async (
  _contract: ERC721,
  _tokenHolder: string,
  _tokenId: number
) => {
  const approvedOf = await _contract.getApproved(_tokenId);
  assert.equal(approvedOf, _tokenHolder);
};

export const assertEtherBalance = async (
  _etherHolder: string,
  _balance: BigNumberish,
  _balanceIsExact: boolean
) => {
  const balance = await ethers.provider.getBalance(_etherHolder);
  assert.isTrue(
    _balanceIsExact ? balance.eq(_balance) : balance.sub(_balance).lt(0.1)
  );
};

export const assertAssetRules = async (
  _contract: FundIssuer,
  _assetAddress: string,
  _assetClass: any,
  _firstStartTime: any,
  _subscriptionPeriodLength: any,
  _valuationPeriodLength: any,
  _paymentPeriodLength: any,
  _assetValueType: number,
  _assetValue: number,
  _reverseAssetValue: number,
  _paymentType: any,
  _paymentAddress: any,
  _paymentPartition: any,
  _fundAddress: any,
  _subscriptionsOpened: any
) => {
  const rules = await _contract.getAssetRules(_assetAddress, _assetClass);

  assert.equal(rules[0], _firstStartTime);
  assert.equal(rules[1], _subscriptionPeriodLength);
  assert.equal(rules[2], _valuationPeriodLength);
  assert.equal(rules[3], _paymentPeriodLength);
  assert.equal(rules[4], _paymentType);
  assert.equal(rules[5], _paymentAddress);
  assert.equal(rules[6], _paymentPartition);
  assert.equal(rules[7], _fundAddress);
  if (_subscriptionsOpened) {
    assert.isTrue(rules[8]);
  } else {
    assert.isFalse(rules[8]);
  }

  const assetValueRules = await _contract.getAssetValueRules(
    _assetAddress,
    _assetClass
  );
  assert.equal(assetValueRules[0], _assetValueType);
  assert.equal(assetValueRules[1].toNumber(), _assetValue);
  assert.equal(assetValueRules[2].toNumber(), _reverseAssetValue);
};

export const assertCycle = async (
  _contract: FundIssuer,
  _cycleIndex: number,
  _assetAddress: string,
  _assetClass: any,
  _startTime: any,
  _subscriptionPeriodLength: any,
  _valuationPeriodLength: any,
  _paymentPeriodLength: any,
  _paymentType: any,
  _paymentAddress: string,
  _paymentPartition: BytesLike,
  _finalized: boolean
) => {
  const cycle = await _contract.getCycle(_cycleIndex);

  assert.equal(cycle[0], _assetAddress);
  assert.equal(cycle[1], _assetClass);
  assert.equal(cycle[2], _startTime);
  assert.equal(cycle[3], _subscriptionPeriodLength);
  assert.equal(cycle[4], _valuationPeriodLength);
  assert.equal(cycle[5], _paymentPeriodLength);
  assert.equal(cycle[6], _paymentType);
  assert.equal(cycle[7], _paymentAddress);
  assert.equal(cycle[8], _paymentPartition);
  if (_finalized) {
    assert.isTrue(cycle[9]);
  } else {
    assert.isFalse(cycle[9]);
  }
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

  assert.equal(cycleState, _state);
};

export const assertCycleAssetValue = async (
  _contract: FundIssuer,
  _cycleIndex: number,
  _assetValueType: number,
  _assetValue: number,
  _reverseAssetValue: number
) => {
  const valueData = await _contract.getCycleAssetValue(_cycleIndex);

  assert.equal(valueData[0], _assetValueType);
  assert.equal(valueData[1].toNumber(), _assetValue);
  assert.equal(valueData[2].toNumber(), _reverseAssetValue);
};

export const assertOrder = async (
  _contract: FundIssuer,
  _orderIndex: any,
  _cycleIndex: number,
  _investor: any,
  _value: number,
  _amount: number,
  _orderType: number,
  _state: number
) => {
  const order = await _contract.getOrder(_orderIndex);

  assert.equal(order[0].toNumber(), _cycleIndex);
  assert.equal(order[1], _investor);
  assert.equal(order[2].toNumber(), _value);
  assert.equal(order[3].toNumber(), _amount);
  assert.equal(order[4], _orderType);

  assert.equal(order[5], _state);
};

export const assertTokenTransferred = async (
  dvp: Swaps,
  token1: ERC20 | ERC721 | ERC1400 | undefined,
  token2: ERC20 | ERC721 | ERC1400 | undefined,
  holder1: any,
  holder2: string,
  tokenStandard1: string | number,
  tokenStandard2: string | number,
  tokenAmount1: BigNumberish,
  tokenAmount2: BigNumberish,
  issuanceAmount: BigNumberish,
  issuanceTokenId: number,
  partition: BytesLike
) => {
  if (tokenStandard1 === ERC20STANDARD) {
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
  if (tokenStandard2 === ERC20STANDARD) {
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
  if (tokenStandard1 === ERC721STANDARD) {
    await assertTokenOf(
      token1 as ERC721,
      tokenAmount1 === 1 ? holder2 : holder1,
      issuanceTokenId
    );
  }
  if (tokenStandard2 === ERC721STANDARD) {
    await assertTokenOf(
      token2 as ERC721,
      tokenAmount2 === 1 ? holder1 : holder2,
      issuanceTokenId
    );
  }
  if (tokenStandard1 === ERC1400STANDARD) {
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
  if (tokenStandard2 === ERC1400STANDARD) {
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
  tokenStandard1: string,
  tokenStandard2: string,
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

  if (tokenStandard1 === ERC20STANDARD) {
    await assertERC20Allowance(
      token1 as ERC20,
      holder1,
      dvp.address,
      tokenAmount1
    );
  }
  if (tokenStandard2 === ERC20STANDARD) {
    await assertERC20Allowance(token2, holder2, dvp.address, tokenAmount2);
  }
  if (tokenStandard1 === ERC721STANDARD && tokenAmount1 === 1) {
    await assertERC721Allowance(token1 as ERC721, dvp.address, issuanceTokenId);
  }
  if (tokenStandard2 === ERC721STANDARD && tokenAmount2 === 1) {
    await assertERC721Allowance(token2, dvp.address, issuanceTokenId);
  }
  if (tokenStandard1 === ERC1400STANDARD) {
    await assertERC1400Allowance(
      partition,
      token1 as ERC1400,
      holder1,
      dvp.address,
      tokenAmount1
    );
  }
  if (tokenStandard2 === ERC1400STANDARD) {
    await assertERC1400Allowance(
      partition,
      token2,
      holder2,
      dvp.address,
      tokenAmount2
    );
  }
  if (tokenStandard1 === ETHSTANDARD) {
    throw new Error('Shall never happen as ETH needs to be escrowed 1');
  }
  if (tokenStandard2 === ETHSTANDARD) {
    throw new Error('Shall never happen as ETH needs to be escrowed 2');
  }
};

export const assertTokenEscrowed = async (
  dvp: Swaps,
  token: any,
  holder: string,
  tokenStandard: string | number,
  tokenAmount: BigNumberish,
  issuanceAmount: number,
  issuanceTokenId: number,
  partition: BytesLike
) => {
  if (tokenStandard === ERC20STANDARD) {
    await assertBalanceOf(
      token,
      holder,
      BigNumber.from(issuanceAmount).sub(tokenAmount),
      true
    );
    await assertBalanceOf(token, dvp.address, tokenAmount, true);
  }
  if (tokenStandard === ERC721STANDARD) {
    await assertTokenOf(
      token,
      tokenAmount === 1 ? dvp.address : holder,
      issuanceTokenId
    );
  }
  if (tokenStandard === ERC1400STANDARD) {
    await assertBalanceOfByPartition(
      token,
      holder,
      partition,
      BigNumber.from(issuanceAmount).sub(tokenAmount)
    );
    await assertBalanceOfByPartition(
      token,
      dvp.address,
      partition,
      tokenAmount
    );
  }
  if (tokenStandard === ETHSTANDARD) {
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
  assert.equal(tokenAddress1, token1 ? token1.address : ZERO_ADDRESS);

  let tokenData2 = trade.userTradeData2;
  const tokenAddress2 = extractTokenAddress(tokenData2);
  const tokenAmount2 = extractTokenAmount(tokenData2);
  const tokenStandard2 = extractTokenStandard(tokenData2);
  const tokenAccepted2 = extractTokenAccepted(tokenData2);
  const tradeType2 = tokenData2.tradeType;
  assert.equal(tokenAddress2, token2 ? token2.address : ZERO_ADDRESS);

  const tradeState = Number(trade.state);

  if (tradeState === STATE_PENDING) {
    if (tradeType1 == TYPE_ESCROW) {
      if (tokenAccepted1) {
        await assertTokenEscrowed(
          dvp,
          token1,
          holder1,
          tokenStandard1,
          tokenAmount1 || 1,
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
      tokenAmount1 || 1,
      tokenAmount2 || 1,
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
        tokenAmount1 || 1,
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
        tokenAmount2 || 1,
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
  assert.equal(Number(trade.state), _tradeState);
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
    assert.equal(extractTokenAccepted(trade.userTradeData1), _accepted);
  }

  if (_requester === holder2) {
    assert.equal(extractTokenAccepted(trade.userTradeData2), _accepted);
  }
};

export const assertTrade = (
  _contract: Swaps,
  _tradeIndex: any,
  _holder1: any,
  _holder2: any,
  _executer: any,
  _expirationDate: any,
  _tradeType: number,
  _tradeState: number,
  _token1Address: any,
  _token1Amount: any,
  _token1Id: string,
  _token1Standard: string,
  _token1Accepted: boolean,
  _token1Approved: boolean,
  _token2Address: any,
  _token2Amount: any,
  _token2Id: any,
  _token2Standard: any,
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
  _tradeIndex: any,
  _holder1: any,
  _holder2: any,
  _executer: any,
  _expirationDate: number,
  _tradeType1: any,
  _tradeType2: any,
  _tradeState: number,
  _token1Address: any,
  _token1Amount: BigNumberish,
  _token1Id: string,
  _token1Standard: any,
  _token1Accepted: boolean,
  _token1Approved: boolean,
  _token2Address: any,
  _token2Amount: any,
  _token2Id: string,
  _token2Standard: any,
  _token2Accepted: boolean,
  _token2Approved: boolean
) => {
  const trade = await _contract.getTrade(_tradeIndex);

  assert.equal(trade.holder1, _holder1);
  assert.equal(trade.holder2, _holder2);
  assert.equal(trade.executer, _executer);
  assert.equal(trade.expirationDate.sub(_expirationDate).lte(1), true);

  const tokenData1 = trade.userTradeData1;
  const tokenAddress1 = extractTokenAddress(tokenData1);
  const tokenAmount1 = extractTokenAmount(tokenData1);
  const tokenId1 = extractTokenId(tokenData1);

  const tokenStandard1 = extractTokenStandard(tokenData1);
  let tokenAccepted1 = extractTokenAccepted(tokenData1);
  let tokenApproved1 = extractTokenApproved(tokenData1);
  assert.equal(tokenAddress1, _token1Address);
  assert.isTrue(tokenAmount1.eq(_token1Amount));
  assert.equal(tokenId1, _token1Id);
  assert.equal(tokenStandard1, _token1Standard);
  assert.equal(tokenAccepted1, _token1Accepted);
  assert.equal(tokenApproved1, _token1Approved);
  assert.equal(tokenData1.tradeType, _tradeType1);

  const tokenData2 = trade.userTradeData2;
  const tokenAddress2 = extractTokenAddress(tokenData2);
  const tokenAmount2 = extractTokenAmount(tokenData2);
  const tokenId2 = extractTokenId(tokenData2);
  const tokenStandard2 = extractTokenStandard(tokenData2);
  let tokenAccepted2 = extractTokenAccepted(tokenData2);
  let tokenApproved2 = extractTokenApproved(tokenData2);
  assert.equal(tokenAddress2, _token2Address);
  assert.equal(tokenAmount2, _token2Amount);
  assert.equal(tokenId2, _token2Id);
  assert.equal(tokenStandard2, _token2Standard);
  assert.equal(tokenAccepted2, _token2Accepted);
  assert.equal(tokenApproved2, _token2Approved);
  assert.equal(tokenData2.tradeType, _tradeType2);

  assert.equal(Number(trade.state), _tradeState);
};
