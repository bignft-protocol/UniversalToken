import { BytesLike } from 'ethers';
import { assert, ethers } from 'hardhat';
import { ERC1400, ERC20, ERC721, FundIssuer, Swaps } from 'typechain-types';

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
  _amount: number,
  _balanceIsExact: boolean
) => {
  const balance = (await _contract.balanceOf(_tokenHolder)).toNumber();

  if (_balanceIsExact) {
    assert.equal(balance, _amount);
  } else {
    assert.equal(balance >= _amount, true);
  }
};

export const assertBalanceOfByPartition = async (
  _contract: ERC1400,
  _tokenHolder: string,
  _partition: BytesLike,
  _amount: number
) => {
  const balanceByPartition = (
    await _contract.balanceOfByPartition(_partition, _tokenHolder)
  ).toNumber();
  assert.equal(balanceByPartition, _amount);
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
  _balance: number,
  _balanceIsExact: boolean
) => {
  const balance = (await ethers.provider.getBalance(_etherHolder)).toNumber();
  if (_balanceIsExact) {
    assert.equal(balance, _balance);
  } else {
    assert.isTrue(balance - _balance < 0.1);
  }
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
