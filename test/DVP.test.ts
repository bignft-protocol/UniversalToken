// @ts-nocheck
import { artifacts, web3, assert, ethers, contract } from 'hardhat';
import type {
  Swaps,
  ERC1400,
  FakeERC1400Mock,
  ERC20Token,
  ERC721Token
} from 'typechain-types';
import { advanceTimeAndBlock } from './utils/time';

import { expectRevert } from '@openzeppelin/test-helpers';

const DVPContract = artifacts.require('Swaps');
const ERC1400 = artifacts.require('ERC1400');
const ERC20 = artifacts.require('ERC20Token');
const ERC721 = artifacts.require('ERC721Token');

const FakeERC1400 = artifacts.require('FakeERC1400Mock');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTE = '0x';
const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

const TRUE_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000001';
const FALSE_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

const OFFCHAIN =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
const ETHSTANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000001';
const ERC20STANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000002';
const ERC721STANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000003';
const ERC1400STANDARD =
  '0x0000000000000000000000000000000000000000000000000000000000000004';

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

const STATE_PENDING = 1;
const STATE_EXECUTED = 2;
const STATE_FORCED = 3;
const STATE_CANCELLED = 4;

const TYPE_ESCROW = 2;
const TYPE_HOLD = 1;
const TYPE_SWAP = 0;

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

const assertBalanceOf = async (
  _contract: { balanceOf: (arg0: any) => any },
  _tokenHolder: any,
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

const assertBalanceOfByPartition = async (
  _contract: { balanceOfByPartition: (arg0: any, arg1: any) => any },
  _tokenHolder: any,
  _partition: string,
  _amount: number
) => {
  const balanceByPartition = (
    await _contract.balanceOfByPartition(_partition, _tokenHolder)
  ).toNumber();
  assert.equal(balanceByPartition, _amount);
};

const assertTokenOf = async (
  _contract: { ownerOf: (arg0: any) => any },
  _tokenHolder: any,
  _tokenId: number
) => {
  const ownerOf = await _contract.ownerOf(_tokenId);

  assert.equal(ownerOf, _tokenHolder);
};

const assertERC20Allowance = async (
  _contract: { allowance: (arg0: any, arg1: any) => any },
  _tokenHolder: any,
  _spender: any,
  _amount: any
) => {
  const allowance = (
    await _contract.allowance(_tokenHolder, _spender)
  ).toNumber();
  assert.equal(allowance, _amount);
};

const assertERC1400Allowance = async (
  _contract: {
    allowanceByPartition: (arg0: string, arg1: any, arg2: any) => any;
  },
  _tokenHolder: any,
  _spender: any,
  _amount: any
) => {
  const allowance = (
    await _contract.allowanceByPartition(partition1, _tokenHolder, _spender)
  ).toNumber();
  assert.equal(allowance, _amount);
};

const assertERC721Allowance = async (
  _contract: { getApproved: (arg0: any) => any },
  _tokenHolder: any,
  _tokenId: number
) => {
  const approvedOf = await _contract.getApproved(_tokenId);
  assert.equal(approvedOf, _tokenHolder);
};

const assertEtherBalance = async (
  _etherHolder: string,
  _balance: number,
  _balanceIsExact: boolean
) => {
  const balance = await web3.eth.getBalance(_etherHolder);
  if (_balanceIsExact) {
    assert.equal(balance, _balance);
  } else {
    assert.equal(balance - _balance < 0.1);
  }
};

const assertTrade = (
  _contract: any,
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

const fullAssertTrade = async (
  _contract: { getTrade: (arg0: any) => any },
  _tradeIndex: any,
  _holder1: any,
  _holder2: any,
  _executer: any,
  _expirationDate: number,
  _tradeType1: any,
  _tradeType2: any,
  _tradeState: number,
  _token1Address: any,
  _token1Amount: any,
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
  assert.equal(parseInt(trade.expirationDate) - _expirationDate <= 1, true);

  const tokenData1 = trade.userTradeData1;
  const tokenAddress1 = extractTokenAddress(tokenData1);
  const tokenAmount1 = extractTokenAmount(tokenData1);
  const tokenId1 = extractTokenId(tokenData1);

  const tokenStandard1 = extractTokenStandard(tokenData1);
  let tokenAccepted1 = extractTokenAccepted(tokenData1);
  let tokenApproved1 = extractTokenApproved(tokenData1);
  assert.equal(tokenAddress1, _token1Address);
  assert.equal(tokenAmount1, _token1Amount);
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

const assertTradeState = async (
  _contract: { getTrade: (arg0: any) => any },
  _tradeIndex: number,
  _tradeState: number
) => {
  const trade = await _contract.getTrade(_tradeIndex);
  assert.equal(Number(trade.state), _tradeState);
};

const assertTradeAccepted = async (
  _contract: { getTrade: (arg0: any) => any },
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

const addressToBytes32 = (_addr: string, _fillTo = 32) => {
  const _addr2 = _addr.substring(2);
  const arr1 = [];
  for (let n = 0, l = _addr2.length; n < l; n++) {
    arr1.push(_addr2[n]);
  }
  for (let m = _addr2.length; m < 2 * _fillTo; m++) {
    arr1.unshift(0);
  }
  return arr1.join('');
};

const NumToHexBytes32 = (_num: number, _fillTo = 32) => {
  const arr1 = [];
  const _str = _num.toString(16);
  for (let n = 0, l = _str.length; n < l; n++) {
    arr1.push(_str[n]);
  }
  for (let m = _str.length; m < 2 * _fillTo; m++) {
    arr1.unshift(0);
  }
  return arr1.join('');
};

const NumToNumBytes32 = (_num: number, _fillTo = 32) => {
  const arr1 = [];
  const _str = _num.toString(16);
  for (let n = 0, l = _str.length; n < l; n++) {
    arr1.push(_str[n]);
  }
  for (let m = _str.length; m < 2 * _fillTo; m++) {
    arr1.unshift(0);
  }
  return `0x${arr1.join('')}`;
};

const extractTokenAddress = (tokenData: { tokenAddress: string }) => {
  return web3.utils.toChecksumAddress(tokenData.tokenAddress);
  //return web3.utils.toChecksumAddress(`0x${tokenData.substr(26, 40)}`);
};
const extractTokenAmount = (tokenData: { tokenValue: string }) => {
  return parseInt(tokenData.tokenValue);
  //return parseInt(tokenData.substr(66, 64), 16);
};
const extractTokenId = (tokenData: { tokenId: any }) => {
  return tokenData.tokenId;
  //return `0x${tokenData.substr(130, 64)}`;
};
const extractTokenStandard = (tokenData: { tokenStandard: string }) => {
  return parseInt(tokenData.tokenStandard);
  //return parseInt(`0x${tokenData.substr(194, 64)}`);
};
const extractTokenAccepted = (tokenData: { accepted: any }) => {
  return tokenData.accepted;
  //return `0x${tokenData.substr(258, 64)}`;
};
const extractTokenApproved = (tokenData: { approved: any }) => {
  return tokenData.approved;
  //return `0x${tokenData.substr(322, 64)}`;
};

const getTradeProposalData = (
  _tradeRecipient: any,
  _tradeExecuter: any,
  _expirationDate: any,
  _settlementDate: number,
  _token2Address: any,
  _token2Amount: number,
  _token2Id: string,
  _token2Standard: string,
  _tradeType2: number,
  isFake: boolean | undefined
) => {
  const flag = isFake ? partitionFlag : dvpTradeProposalFlag;
  const hexTradeRecipient = addressToBytes32(_tradeRecipient);
  const hexTradeExecuter = addressToBytes32(_tradeExecuter);
  const hexExpirationDate = NumToHexBytes32(_expirationDate);
  const hexSettlementDate = NumToHexBytes32(_settlementDate);

  const hexTradeTokenAddress2 = addressToBytes32(_token2Address);
  const hexTradeTokenAmount2 = NumToHexBytes32(_token2Amount);
  let hexTradeTokenId;
  if (typeof _token2Id === 'string' && _token2Id.length === 66) {
    hexTradeTokenId = _token2Id.substring(2);
  } else if (typeof _token2Id === 'number') {
    hexTradeTokenId = NumToHexBytes32(_token2Id);
  } else {
    throw new Error('getTradeProposalData: Invalid type for tokenId');
  }
  const hexTradeTokenStandard2 = _token2Standard.substring(2);
  const hexTradeType = NumToHexBytes32(_tradeType2);
  const tradeTokenData = `${hexTradeTokenAddress2}${hexTradeTokenAmount2}${hexTradeTokenId}${hexTradeTokenStandard2}${hexTradeType}`;

  return `${flag}${hexTradeRecipient}${hexTradeExecuter}${hexExpirationDate}${hexSettlementDate}${tradeTokenData}`;
};

const getTradeAcceptanceData = (
  tradeIndex: number,
  isFake: boolean | undefined
) => {
  const flag = isFake ? partitionFlag : dvpTradeAcceptanceFlag;
  const hexTradeIndex = NumToHexBytes32(tradeIndex);

  return `${flag}${hexTradeIndex}`;
};

const assertTokenEscrowed = async (
  dvp: { address: any },
  token: any,
  holder: any,
  tokenStandard: string | number,
  tokenAmount: number,
  partition: string
) => {
  if (tokenStandard === ERC20STANDARD) {
    await assertBalanceOf(token, holder, issuanceAmount - tokenAmount, true);
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
      issuanceAmount - tokenAmount
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

const assertBothTokenEscrowed = async (
  dvp: { address: any },
  token1: any,
  token2: any,
  holder1: any,
  holder2: any,
  tokenStandard1: string,
  tokenStandard2: string,
  tokenAmount1: number,
  tokenAmount2: number
) => {
  if (tokenStandard1 === ERC20STANDARD) {
    await assertBalanceOf(token1, holder1, issuanceAmount - tokenAmount1, true);
    await assertBalanceOf(token1, holder2, 0, true);
    await assertBalanceOf(token1, dvp.address, tokenAmount1, true);
  }
  if (tokenStandard2 === ERC20STANDARD) {
    await assertBalanceOf(token2, holder2, issuanceAmount - tokenAmount2, true);
    await assertBalanceOf(token2, holder1, 0, true);
    await assertBalanceOf(token2, dvp.address, tokenAmount2, true);
  }
  if (tokenStandard1 === ERC721STANDARD) {
    await assertTokenOf(
      token1,
      tokenAmount1 === 1 ? dvp.address : holder1,
      issuanceTokenId
    );
  }
  if (tokenStandard2 === ERC721STANDARD) {
    await assertTokenOf(
      token2,
      tokenAmount2 === 1 ? dvp.address : holder2,
      issuanceTokenId
    );
  }
  if (tokenStandard1 === ERC1400STANDARD) {
    await assertBalanceOfByPartition(
      token1,
      holder1,
      partition1,
      issuanceAmount - tokenAmount1
    );
    await assertBalanceOfByPartition(token1, holder2, partition1, 0);
    await assertBalanceOfByPartition(
      token1,
      dvp.address,
      partition1,
      tokenAmount1
    );
  }
  if (tokenStandard2 === ERC1400STANDARD) {
    await assertBalanceOfByPartition(
      token2,
      holder2,
      partition1,
      issuanceAmount - tokenAmount2
    );
    await assertBalanceOfByPartition(token2, holder1, partition1, 0);
    await assertBalanceOfByPartition(
      token2,
      dvp.address,
      partition1,
      tokenAmount2
    );
  }
  if (tokenStandard1 === ETHSTANDARD) {
    await assertEtherBalance(dvp.address, tokenAmount1, true);
  }
  if (tokenStandard2 === ETHSTANDARD) {
    await assertEtherBalance(dvp.address, tokenAmount2, true);
  }
};

const assertTokenAuthorized = async (
  dvp: any,
  token1: any,
  token2: any,
  holder1: any,
  holder2: any,
  tokenStandard1: string,
  tokenStandard2: string,
  tokenAmount1: number,
  tokenAmount2: number
) => {
  await assertTokenTransferred(
    dvp,
    token1,
    token2,
    holder1,
    holder2,
    tokenStandard1,
    tokenStandard2,
    0,
    0
  );

  if (tokenStandard1 === ERC20STANDARD) {
    await assertERC20Allowance(token1, holder1, dvp.address, tokenAmount1);
  }
  if (tokenStandard2 === ERC20STANDARD) {
    await assertERC20Allowance(token2, holder2, dvp.address, tokenAmount2);
  }
  if (tokenStandard1 === ERC721STANDARD && tokenAmount1 === 1) {
    await assertERC721Allowance(token1, dvp.address, issuanceTokenId);
  }
  if (tokenStandard2 === ERC721STANDARD && tokenAmount2 === 1) {
    await assertERC721Allowance(token2, dvp.address, issuanceTokenId);
  }
  if (tokenStandard1 === ERC1400STANDARD) {
    await assertERC1400Allowance(token1, holder1, dvp.address, tokenAmount1);
  }
  if (tokenStandard2 === ERC1400STANDARD) {
    await assertERC1400Allowance(token2, holder2, dvp.address, tokenAmount2);
  }
  if (tokenStandard1 === ETHSTANDARD) {
    throw new Error('Shall never happen as ETH needs to be escrowed 1');
  }
  if (tokenStandard2 === ETHSTANDARD) {
    throw new Error('Shall never happen as ETH needs to be escrowed 2');
  }
};

const assertTokenTransferred = async (
  dvp: { address: any },
  token1: any,
  token2: any,
  holder1: any,
  holder2: string,
  tokenStandard1: string | number,
  tokenStandard2: string | number,
  tokenAmount1: number,
  tokenAmount2: number
) => {
  if (tokenStandard1 === ERC20STANDARD) {
    await assertBalanceOf(token1, holder1, issuanceAmount - tokenAmount1, true);
    await assertBalanceOf(
      token1,
      holder2,
      holder2 !== ZERO_ADDRESS ? tokenAmount1 : 0,
      true
    );
    await assertBalanceOf(token1, dvp.address, 0, true);
  }
  if (tokenStandard2 === ERC20STANDARD) {
    await assertBalanceOf(
      token2,
      holder2,
      holder2 !== ZERO_ADDRESS ? issuanceAmount - tokenAmount2 : 0,
      true
    );
    await assertBalanceOf(token2, holder1, tokenAmount2, true);
    await assertBalanceOf(token2, dvp.address, 0, true);
  }
  if (tokenStandard1 === ERC721STANDARD) {
    await assertTokenOf(
      token1,
      tokenAmount1 === 1 ? holder2 : holder1,
      issuanceTokenId
    );
  }
  if (tokenStandard2 === ERC721STANDARD) {
    await assertTokenOf(
      token2,
      tokenAmount2 === 1 ? holder1 : holder2,
      issuanceTokenId
    );
  }
  if (tokenStandard1 === ERC1400STANDARD) {
    await assertBalanceOfByPartition(
      token1,
      holder1,
      partition1,
      issuanceAmount - tokenAmount1
    );
    await assertBalanceOfByPartition(
      token1,
      holder2,
      partition1,
      holder2 !== ZERO_ADDRESS ? tokenAmount1 : 0
    );
    await assertBalanceOfByPartition(token1, dvp.address, partition1, 0);
  }
  if (tokenStandard2 === ERC1400STANDARD) {
    await assertBalanceOfByPartition(
      token2,
      holder2,
      partition1,
      holder2 !== ZERO_ADDRESS ? issuanceAmount - tokenAmount2 : 0
    );
    await assertBalanceOfByPartition(token2, holder1, partition1, tokenAmount2);
    await assertBalanceOfByPartition(token2, dvp.address, partition1, 0);
  }
};

const assertGlobalBalancesAreCorrect = async (
  dvp: { getTrade: (arg0: any) => any },
  token1: { address: any },
  token2: { address: any },
  tradeIndex: any,
  requester: undefined
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
          partition1
        );
      } else {
        await assertTokenEscrowed(
          dvp,
          token1,
          holder1,
          tokenStandard1,
          0,
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
          tokenAmount2 || 1,
          partition2
        );
      } else {
        await assertTokenEscrowed(
          dvp,
          token2,
          holder2,
          tokenStandard2,
          0,
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
      tokenAmount2 || 1
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
        0
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
        tokenAmount2 || 1
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
      0
    );
  } else {
    throw new Error('Trade is in an unknown state: shall never happen');
  }
};

const createTradeRequest = async (
  dvp: any,
  token1: undefined,
  token2: undefined,
  tokenStandard1: string,
  tokenStandard2: string,
  holder1: any,
  holder2: any,
  executer: string,
  requester: any,
  realExpirationDate: boolean,
  tradeType: number,
  tokenAmount1: string | number,
  tokenAmount2: number
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
    requester,
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
  dvp: {
    getNbTrades: () => any;
    requestTrade: (
      arg0: {
        holder1: any;
        holder2: any;
        executer: any;
        expirationDate: any;
        tokenAddress1: any;
        tokenValue1: any;
        tokenId1: string;
        tokenStandard1: any;
        tokenAddress2: any;
        tokenValue2: any;
        tokenId2: string;
        tokenStandard2: any;
        tradeType1: any;
        tradeType2: any;
        settlementDate: any;
      },
      arg1: any,
      arg2: { from: any; value: any }
    ) => any;
  },
  token1: { address: any },
  token2: { address: any },
  tokenStandard1: string,
  tokenStandard2: string,
  holder1: any,
  holder2: any,
  executer: any,
  requester: any,
  realExpirationDate: any,
  tradeType1: any,
  tradeType2: any,
  tokenAmount1: any,
  tokenAmount2: any,
  settlementDate: number,
  preimage: string
) => {
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

  const chainTime = (await web3.eth.getBlock('latest')).timestamp;
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
    0
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
    executer: executer,
    expirationDate: realExpirationDate ? expirationDate : 0,
    tokenAddress1: token1 ? token1.address : ZERO_ADDRESS,
    tokenValue1: tokenStandard1 === ERC721STANDARD ? 0 : tokenAmount1,
    tokenId1:
      tokenStandard1 === ERC721STANDARD
        ? NumToNumBytes32(issuanceTokenId)
        : tokenStandard1 === ERC1400STANDARD
        ? partition1
        : ZERO_BYTES32,
    tokenStandard1: tokenStandard1,
    tokenAddress2: token2 ? token2.address : ZERO_ADDRESS,
    tokenValue2: tokenStandard2 === ERC721STANDARD ? 0 : tokenAmount2,
    tokenId2:
      tokenStandard2 === ERC721STANDARD
        ? NumToNumBytes32(issuanceTokenId)
        : tokenStandard2 === ERC1400STANDARD
        ? partition1
        : ZERO_BYTES32,
    tokenStandard2: tokenStandard2,
    tradeType1: tradeType1,
    tradeType2: tradeType2,
    settlementDate: settlementDate
  };

  await dvp.requestTrade(tradeInputData, preimage, {
    from: requester,
    value: tokenStandard === ETHSTANDARD ? tokenAmount : 0
  });

  const tradeIndex = (await dvp.getNbTrades()).toNumber();
  assert.equal(tradeIndex, initialNumberOfTrades + 1);

  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);

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
    tokenStandard1 === ERC721STANDARD ? 0 : tokenAmount1,
    tokenStandard1 === ERC721STANDARD
      ? NumToNumBytes32(issuanceTokenId)
      : tokenStandard1 === ERC1400STANDARD
      ? partition1
      : ZERO_BYTES32,
    tokenStandard1,
    requester === holder1,
    false,
    token2 ? token2.address : ZERO_ADDRESS,
    tokenStandard2 === ERC721STANDARD ? 0 : tokenAmount2,
    tokenStandard2 === ERC721STANDARD
      ? NumToNumBytes32(issuanceTokenId)
      : tokenStandard2 === ERC1400STANDARD
      ? partition1
      : ZERO_BYTES32,
    tokenStandard2,
    requester === holder2,
    false
  );
};

const createTradeRequestWithoutCallingDVP = async (
  dvp: { getNbTrades: () => any; address: any },
  token1: {
    operatorTransferByPartition: (
      arg0: string,
      arg1: any,
      arg2: any,
      arg3: any,
      arg4: string,
      arg5: string,
      arg6: { from: any }
    ) => any;
    address: any;
  },
  token2: { address: any },
  tokenStandard2: string,
  tokenId2: string,
  holder1: any,
  holder2: any,
  executer: string,
  realExpirationDate: boolean,
  tokenAmount1: number,
  tokenAmount2: number,
  openMarketplace: boolean | undefined
) => {
  const recipient = openMarketplace ? ZERO_ADDRESS : holder2;

  const chainTime = (await web3.eth.getBlock('latest')).timestamp;
  const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;

  const initialNumberOfTrades = (await dvp.getNbTrades()).toNumber();

  await assertTokenTransferred(
    dvp,
    token1,
    token2,
    holder1,
    holder2,
    ERC1400STANDARD,
    tokenStandard2,
    0,
    0
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

  await token1.operatorTransferByPartition(
    partition1,
    holder1,
    dvp.address,
    tokenAmount1,
    tradeProposalData,
    MOCK_CERTIFICATE,
    { from: holder1 }
  );

  const tradeIndex = (await dvp.getNbTrades()).toNumber();
  assert.equal(tradeIndex, initialNumberOfTrades + 1);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    holder2
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
    tokenStandard2 === ERC721STANDARD ? 0 : tokenAmount2,
    tokenStandard2 === ERC721STANDARD
      ? NumToNumBytes32(issuanceTokenId)
      : tokenId2,
    tokenStandard2,
    false,
    false
  );
};

const acceptTradeRequest = async (
  dvp: any,
  token1: undefined,
  token2: undefined,
  tradeIndex: number,
  requester: any,
  newTradeState: number,
  acceptedTrade: boolean
) => {
  await acceptTradeRequestWithPreimage(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester,
    newTradeState,
    acceptedTrade,
    ZERO_BYTES32
  );
};

const acceptTradeRequestWithPreimage = async (
  dvp: {
    getTrade: (arg0: any) => any;
    getTradeAcceptanceStatus: (arg0: any) => any;
    acceptTrade: (
      arg0: any,
      arg1: any,
      arg2: { from: any; value: number }
    ) => any;
  },
  token1: any,
  token2: any,
  tradeIndex: any,
  requester: any,
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

  assert.equal(await dvp.getTradeAcceptanceStatus(tradeIndex), false);

  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);

  await dvp.acceptTrade(tradeIndex, preimage, {
    from: requester,
    value: tokenStandard === ETHSTANDARD ? tokenAmount : 0
  });
  await assertTradeState(dvp, tradeIndex, newTradeState);

  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);

  await assertTradeAccepted(dvp, tradeIndex, requester, true);

  assert.equal(await dvp.getTradeAcceptanceStatus(tradeIndex), acceptedTrade);
};

const acceptTradeRequestWithoutCallingDVP = async (
  dvp: {
    getTrade: (arg0: any) => any;
    getTradeAcceptanceStatus: (arg0: any) => any;
    address: any;
  },
  token1: any,
  token2: {
    operatorTransferByPartition: (
      arg0: string,
      arg1: any,
      arg2: any,
      arg3: number,
      arg4: string,
      arg5: string,
      arg6: { from: any }
    ) => any;
  },
  tradeIndex: number,
  requester: any,
  newTradeState: number,
  acceptedTrade: boolean
) => {
  const trade = await dvp.getTrade(tradeIndex);
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

  assert.equal(await dvp.getTradeAcceptanceStatus(tradeIndex), false);

  await assertGlobalBalancesAreCorrect(
    dvp,
    token1,
    token2,
    tradeIndex,
    requester
  );

  const tradeAcceptanceData = getTradeAcceptanceData(tradeIndex);

  await token2.operatorTransferByPartition(
    partition1,
    requester,
    dvp.address,
    tokenAmount,
    tradeAcceptanceData,
    MOCK_CERTIFICATE,
    { from: requester }
  );

  await assertTradeState(dvp, tradeIndex, newTradeState);

  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);

  await assertTradeAccepted(dvp, tradeIndex, requester, true);

  assert.equal(await dvp.getTradeAcceptanceStatus(tradeIndex), acceptedTrade);

  if (trade.holder2 === ZERO_ADDRESS) {
    const updatedtrade = await dvp.getTrade(tradeIndex);
    assert.equal(updatedtrade.holder2, requester);
  }
};

const approveTradeRequest = async (
  dvp: {
    getTradeApprovalStatus: (arg0: any) => any;
    approveTrade: (arg0: any, arg1: boolean, arg2: { from: any }) => any;
  },
  token1: any,
  token2: any,
  tradeIndex: number,
  requester: any,
  newTradeState: number,
  approvedTrade: boolean
) => {
  assert.equal(await dvp.getTradeApprovalStatus(tradeIndex), false);

  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);

  await dvp.approveTrade(tradeIndex, true, { from: requester });
  await assertTradeState(dvp, tradeIndex, newTradeState);

  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);

  assert.equal(await dvp.getTradeApprovalStatus(tradeIndex), approvedTrade);
};

const executeTradeRequest = async (
  dvp: { executeTrade: (arg0: any, arg1: { from: any }) => any },
  token1: undefined,
  token2: undefined,
  tradeIndex: number,
  requester: any
) => {
  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);

  await dvp.executeTrade(tradeIndex, { from: requester });
  await assertTradeState(dvp, tradeIndex, STATE_EXECUTED);

  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);
};

const forceTradeRequest = async (
  dvp: { forceTrade: (arg0: any, arg1: { from: any }) => any },
  token1: any,
  token2: any,
  tradeIndex: number,
  requester: any
) => {
  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);

  await dvp.forceTrade(tradeIndex, { from: requester });
  await assertTradeState(dvp, tradeIndex, STATE_FORCED);

  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);
};

const cancelTradeRequest = async (
  dvp: { cancelTrade: (arg0: any, arg1: { from: any }) => any },
  token1: any,
  token2: any,
  tradeIndex: number,
  requester: any
) => {
  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);

  await dvp.cancelTrade(tradeIndex, { from: requester });
  await assertTradeState(dvp, tradeIndex, STATE_CANCELLED);

  await assertGlobalBalancesAreCorrect(dvp, token1, token2, tradeIndex);
};

contract(
  'DVP',
  function ([
    owner,
    tokenController1,
    tokenController2,
    executer,
    oracle,
    tokenHolder1,
    tokenHolder2,
    recipient1,
    recipient2,
    unknown
  ]) {
    before(async function () {
      // console.log('Owner: ', owner);
      // console.log('Controller: ', controller);
      // console.log('TokenHolder1: ', tokenHolder1);
      // console.log('TokenHolder2: ', tokenHolder2);
      // console.log('Recipient1: ', recipient1);
      // console.log('Recipient2: ', recipient2);
    });

    // PARAMETERS

    describe('parameters', function () {
      describe('owner', function () {
        it('returns the owner of the contract', async function () {
          const dvp: Swaps = await DVPContract.new(false);

          const contractOwner = await dvp.owner();
          assert.equal(contractOwner, owner);
        });
      });
      describe('tradeExecuters', function () {
        it('returns the list of trade executers', async function () {
          const dvp: Swaps = await DVPContract.new(true);

          const tradeExecuters = await dvp.tradeExecuters();

          assert.equal(tradeExecuters.length, 1);
          assert.equal(tradeExecuters[0], owner);
        });
        it('returns empty list of trade executers', async function () {
          const dvp: Swaps = await DVPContract.new(false);

          const tradeExecuters = await dvp.tradeExecuters();

          assert.equal(tradeExecuters.length, 0);
        });
      });
    });

    // CANIMPLEMENTINTERFACEFORADDRESS

    describe('canImplementInterfaceForAddress', function () {
      let dvp: Swaps;
      beforeEach(async function () {
        dvp = await DVPContract.new(false);
      });
      describe('when the interface label is ERC777TokensRecipient', function () {
        it('returns ERC1820_ACCEPT_MAGIC', async function () {
          const answer = await dvp.canImplementInterfaceForAddress(
            ERC1400_TOKENS_RECIPIENT_INTERFACE_HASH,
            unknown
          );
          assert.equal(answer, ERC1820_ACCEPT_MAGIC);
        });
      });
      describe('when the interface label is not ERC777TokensRecipient', function () {
        it('returns empty bytes32', async function () {
          const answer = await dvp.canImplementInterfaceForAddress(
            ERC1400_TOKENS_SENDER_INTERFACE_HASH,
            unknown
          );
          assert.equal(answer, ZERO_BYTES32);
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
        dvp = await DVPContract.new(false);

        emoney1400 = await ERC1400.new(
          'ERC1400Token',
          'DAU',
          1,
          [owner],
          partitions,
          { from: owner }
        );

        const chainTime = (await web3.eth.getBlock('latest')).timestamp;
        const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
        tradeProposalData = getTradeProposalData(
          recipient1,
          executer,
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
          recipient1,
          executer,
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
                  unknown,
                  unknown,
                  unknown,
                  1,
                  tradeProposalData,
                  MOCK_CERTIFICATE
                );
                assert.equal(answer, true);
              });
            });
            describe('when data is formatted for a trade acceptance', function () {
              it('returns true', async function () {
                const answer = await dvp.canReceive(
                  '0x00000000',
                  partition1,
                  unknown,
                  unknown,
                  unknown,
                  1,
                  tradeAcceptanceData,
                  MOCK_CERTIFICATE
                );
                assert.equal(answer, true);
              });
            });
          });
          describe('when data does not have the right format', function () {
            it('returns false', async function () {
              const answer = await dvp.canReceive(
                '0x00000000',
                partition1,
                unknown,
                unknown,
                unknown,
                1,
                fakeTradeProposalData,
                MOCK_CERTIFICATE
              );
              assert.equal(answer, false);
            });
            it('returns false', async function () {
              const answer = await dvp.canReceive(
                '0x00000000',
                partition1,
                unknown,
                unknown,
                unknown,
                1,
                fakeTradeAcceptanceData,
                MOCK_CERTIFICATE
              );
              assert.equal(answer, false);
            });
          });
        });
        describe('when data does not have the correct length', function () {
          it('returns false', async function () {
            const answer = await dvp.canReceive(
              '0x00000000',
              partition1,
              unknown,
              unknown,
              unknown,
              1,
              tradeProposalData.substring(0, tradeProposalData.length - 1),
              MOCK_CERTIFICATE
            );
            assert.equal(answer, false);
          });
        });
      });
      describe('when operatorData is empty', function () {
        it('returns false', async function () {
          const answer = await dvp.canReceive(
            '0x00000000',
            partition1,
            unknown,
            unknown,
            unknown,
            1,
            tradeProposalData,
            ZERO_BYTE
          );
          assert.equal(answer, false);
        });
      });
    });

    // TOKENSRECEIVED (HOOK)

    describe('tokensReceived', function () {
      let dvp: Swaps;
      let security1400: ERC1400;
      let emoney1400: ERC1400;
      beforeEach(async function () {
        dvp = await DVPContract.new(false);

        security1400 = await ERC1400.new(
          'ERC1400Token',
          'DAU',
          1,
          [owner],
          partitions,
          { from: owner }
        );
        await security1400.issueByPartition(
          partition1,
          tokenHolder1,
          issuanceAmount,
          MOCK_CERTIFICATE,
          { from: owner }
        );

        emoney1400 = await ERC1400.new(
          'ERC1400Token',
          'DAU',
          1,
          [owner],
          partitions,
          { from: owner }
        );
        await emoney1400.issueByPartition(
          partition1,
          recipient1,
          issuanceAmount,
          MOCK_CERTIFICATE,
          { from: owner }
        );
      });
      describe('when hook is called from ERC1400 contract', function () {
        describe('when recipient is the DVP contract', function () {
          describe('when data field is valid', function () {
            describe('when received tokens correspond to a new trade proposal', function () {
              it('creates and accepts the trade request', async function () {
                assert.equal(await dvp.getNbTrades(), 0);
                await createTradeRequestWithoutCallingDVP(
                  dvp,
                  security1400,
                  emoney1400,
                  ERC1400STANDARD,
                  partition1,
                  tokenHolder1,
                  recipient1,
                  executer,
                  true,
                  token1Amount,
                  token2Amount
                );
                assert.equal(await dvp.getNbTrades(), 1);
              });
              it('creates and accepts a second trade request', async function () {
                assert.equal(await dvp.getNbTrades(), 0);
                await createTradeRequestWithoutCallingDVP(
                  dvp,
                  security1400,
                  emoney1400,
                  ERC1400STANDARD,
                  partition1,
                  tokenHolder1,
                  recipient1,
                  executer,
                  true,
                  token1Amount,
                  token2Amount
                );

                const chainTime = (await web3.eth.getBlock('latest')).timestamp;
                const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
                const tradeProposalData = getTradeProposalData(
                  recipient1,
                  executer,
                  expirationDate,
                  0,
                  emoney1400.address,
                  token2Amount,
                  partition1,
                  ERC1400STANDARD,
                  TYPE_ESCROW
                );
                await security1400.operatorTransferByPartition(
                  partition1,
                  tokenHolder1,
                  dvp.address,
                  token1Amount,
                  tradeProposalData,
                  MOCK_CERTIFICATE,
                  { from: tokenHolder1 }
                );
                assert.equal(await dvp.getNbTrades(), 2);
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
                                  tokenHolder1,
                                  recipient1,
                                  executer,
                                  true,
                                  token1Amount,
                                  token2Amount
                                );
                                await acceptTradeRequestWithoutCallingDVP(
                                  dvp,
                                  security1400,
                                  emoney1400,
                                  1,
                                  recipient1,
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
                                  tokenHolder1,
                                  recipient1,
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
                                  recipient1,
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
                                  tokenHolder1,
                                  recipient1,
                                  ZERO_ADDRESS,
                                  true,
                                  token1Amount,
                                  token2Amount
                                );
                                const tradeAcceptanceData =
                                  getTradeAcceptanceData(1);
                                await expectRevert.unspecified(
                                  emoney1400.operatorTransferByPartition(
                                    partition1,
                                    recipient1,
                                    dvp.address,
                                    token2Amount + 1,
                                    tradeAcceptanceData,
                                    MOCK_CERTIFICATE,
                                    { from: recipient1 }
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
                              tokenHolder1,
                              recipient1,
                              executer,
                              true,
                              token1Amount,
                              token2Amount
                            );
                            const tradeAcceptanceData =
                              getTradeAcceptanceData(1);
                            await expectRevert.unspecified(
                              emoney1400.operatorTransferByPartition(
                                partition1,
                                recipient1,
                                dvp.address,
                                token2Amount,
                                tradeAcceptanceData,
                                MOCK_CERTIFICATE,
                                { from: recipient1 }
                              )
                            );
                          });
                        });
                      });
                      describe('when partition is not the correct partition', function () {
                        beforeEach(async function () {
                          await emoney1400.issueByPartition(
                            partition2,
                            recipient1,
                            issuanceAmount,
                            MOCK_CERTIFICATE,
                            { from: owner }
                          );
                        });
                        it('reverts', async function () {
                          await createTradeRequestWithoutCallingDVP(
                            dvp,
                            security1400,
                            emoney1400,
                            ERC1400STANDARD,
                            partition1,
                            tokenHolder1,
                            recipient1,
                            executer,
                            true,
                            token1Amount,
                            token2Amount
                          );
                          const tradeAcceptanceData = getTradeAcceptanceData(1);
                          await expectRevert.unspecified(
                            emoney1400.operatorTransferByPartition(
                              partition2,
                              recipient1,
                              dvp.address,
                              token2Amount,
                              tradeAcceptanceData,
                              MOCK_CERTIFICATE,
                              { from: recipient1 }
                            )
                          );
                        });
                      });
                    });
                    describe('when token is not the correct token', function () {
                      let wrongEmoney1400: ERC1400;
                      beforeEach(async function () {
                        wrongEmoney1400 = await ERC1400.new(
                          'ERC1400Token',
                          'DAU',
                          1,
                          [owner],
                          partitions,
                          { from: owner }
                        );
                        await wrongEmoney1400.issueByPartition(
                          partition1,
                          recipient1,
                          issuanceAmount,
                          MOCK_CERTIFICATE,
                          { from: owner }
                        );
                      });
                      it('reverts', async function () {
                        await createTradeRequestWithoutCallingDVP(
                          dvp,
                          security1400,
                          emoney1400,
                          ERC1400STANDARD,
                          partition1,
                          tokenHolder1,
                          recipient1,
                          executer,
                          true,
                          token1Amount,
                          token2Amount
                        );
                        const tradeAcceptanceData = getTradeAcceptanceData(1);
                        await expectRevert.unspecified(
                          wrongEmoney1400.operatorTransferByPartition(
                            partition1,
                            recipient1,
                            dvp.address,
                            token2Amount,
                            tradeAcceptanceData,
                            MOCK_CERTIFICATE,
                            { from: recipient1 }
                          )
                        );
                      });
                    });
                  });
                  describe('when token sender is not the holder registered in the trade', function () {
                    beforeEach(async function () {
                      await emoney1400.issueByPartition(
                        partition1,
                        recipient2,
                        issuanceAmount,
                        MOCK_CERTIFICATE,
                        { from: owner }
                      );
                    });
                    it('reverts', async function () {
                      await createTradeRequestWithoutCallingDVP(
                        dvp,
                        security1400,
                        emoney1400,
                        ERC1400STANDARD,
                        partition1,
                        tokenHolder1,
                        recipient1,
                        executer,
                        true,
                        token1Amount,
                        token2Amount
                      );
                      const tradeAcceptanceData = getTradeAcceptanceData(1);
                      await expectRevert.unspecified(
                        emoney1400.operatorTransferByPartition(
                          partition1,
                          recipient2,
                          dvp.address,
                          token2Amount,
                          tradeAcceptanceData,
                          MOCK_CERTIFICATE,
                          { from: recipient2 }
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
                        tokenHolder1,
                        recipient1,
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
                        recipient1,
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
                    tokenHolder1,
                    recipient1,
                    executer,
                    true,
                    token1Amount,
                    token2Amount
                  );
                  await acceptTradeRequestWithoutCallingDVP(
                    dvp,
                    security1400,
                    emoney1400,
                    1,
                    recipient1,
                    STATE_PENDING,
                    ACCEPTED_TRUE
                  );
                  const tradeAcceptanceData = getTradeAcceptanceData(1);
                  await expectRevert.unspecified(
                    emoney1400.operatorTransferByPartition(
                      partition1,
                      recipient1,
                      dvp.address,
                      token2Amount,
                      tradeAcceptanceData,
                      MOCK_CERTIFICATE,
                      { from: recipient1 }
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
                tokenHolder1,
                recipient1,
                executer,
                true,
                token1Amount,
                token2Amount
              );
              const fakeTradeAcceptanceData = getTradeAcceptanceData(1, true);
              await expectRevert.unspecified(
                emoney1400.operatorTransferByPartition(
                  partition1,
                  recipient1,
                  dvp.address,
                  token2Amount,
                  fakeTradeAcceptanceData,
                  MOCK_CERTIFICATE,
                  { from: recipient1 }
                )
              );
            });
          });
        });
        describe('when recipient is not the DVP contract', function () {
          let fakeSecurity1400: FakeERC1400Mock;
          beforeEach(async function () {
            fakeSecurity1400 = await FakeERC1400.new(
              'ERC1400Token',
              'DAU20',
              1,
              [owner],
              partitions,
              ZERO_ADDRESS,
              ZERO_ADDRESS
            );
            await fakeSecurity1400.issueByPartition(
              partition1,
              tokenHolder1,
              issuanceAmount,
              MOCK_CERTIFICATE,
              { from: owner }
            );
          });
          it('reverts', async function () {
            const chainTime = (await web3.eth.getBlock('latest')).timestamp;
            const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
            const tradeProposalData = getTradeProposalData(
              recipient1,
              executer,
              expirationDate,
              0,
              emoney1400.address,
              token2Amount,
              partition1,
              ERC1400STANDARD,
              TYPE_ESCROW
            );
            await expectRevert.unspecified(
              fakeSecurity1400.operatorTransferByPartition(
                partition1,
                tokenHolder1,
                dvp.address,
                token1Amount,
                tradeProposalData,
                MOCK_CERTIFICATE,
                { from: tokenHolder1 }
              )
            );
          });
        });
      });
      describe('when hook is not called from ERC1400 contract', function () {
        it('reverts', async function () {
          const chainTime = (await web3.eth.getBlock('latest')).timestamp;
          const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
          const tradeProposalData = getTradeProposalData(
            recipient1,
            executer,
            expirationDate,
            0,
            emoney1400.address,
            token2Amount,
            partition1,
            ERC1400STANDARD,
            TYPE_ESCROW
          );
          await expectRevert.unspecified(
            dvp.tokensReceived(
              '0x',
              partition1,
              tokenHolder1,
              tokenHolder1,
              dvp.address,
              token1Amount,
              tradeProposalData,
              MOCK_CERTIFICATE,
              { from: tokenHolder1 }
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
        dvp = await DVPContract.new(false);

        security20 = await ERC20.new('ERC20Token', 'DAU', 18);
        emoney20 = await ERC20.new('ERC20Token', 'DAU', 18);

        await security20.mint(tokenHolder1, issuanceAmount, {
          from: owner
        });
        await emoney20.mint(recipient1, issuanceAmount, { from: owner });
      });
      describe('when none of the 2 tokens is ETH', function () {
        describe('when the DVP contract is not controllable', function () {
          describe('when escrowable is not forbidden', function () {
            describe('when expiration date is defined', function () {
              describe('when sender is holder 1', function () {
                describe('when DVP request is of type Escrow', function () {
                  describe('when token standard is ERC20', function () {
                    it('creates and accepts the trade request', async function () {
                      await security20.approve(dvp.address, token1Amount, {
                        from: tokenHolder1
                      });
                      await createTradeRequest(
                        dvp,
                        security20,
                        emoney20,
                        ERC20STANDARD,
                        ERC20STANDARD,
                        tokenHolder1,
                        recipient1,
                        ZERO_ADDRESS,
                        tokenHolder1,
                        true,
                        TYPE_ESCROW,
                        token1Amount,
                        token2Amount
                      );
                    });
                  });
                  describe('when token standard is ERC721', function () {
                    it('creates and accepts the trade request', async function () {
                      const security721: ERC721Token = await ERC721.new(
                        'ERC721Token',
                        'DAU721',
                        '',
                        ''
                      );
                      await security721.mint(tokenHolder1, issuanceTokenId, {
                        from: owner
                      });
                      await security721.approve(dvp.address, issuanceTokenId, {
                        from: tokenHolder1
                      });

                      await createTradeRequest(
                        dvp,
                        security721,
                        emoney20,
                        ERC721STANDARD,
                        ERC20STANDARD,
                        tokenHolder1,
                        recipient1,
                        ZERO_ADDRESS,
                        tokenHolder1,
                        true,
                        TYPE_ESCROW,
                        token1Amount,
                        token2Amount
                      );
                    });
                  });
                  describe('when token standard is ERC1400', function () {
                    it('creates and accepts the trade request', async function () {
                      const security1400: ERC1400 = await ERC1400.new(
                        'ERC1400Token',
                        'DAU',
                        1,
                        [],
                        partitions,
                        { from: owner }
                      );

                      await security1400.issueByPartition(
                        partition1,
                        tokenHolder1,
                        issuanceAmount,
                        VALID_CERTIFICATE,
                        { from: owner }
                      );
                      await security1400.approveByPartition(
                        partition1,
                        dvp.address,
                        token1Amount,
                        { from: tokenHolder1 }
                      );

                      await createTradeRequest(
                        dvp,
                        security1400,
                        emoney20,
                        ERC1400STANDARD,
                        ERC20STANDARD,
                        tokenHolder1,
                        recipient1,
                        ZERO_ADDRESS,
                        tokenHolder1,
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
                        tokenHolder1,
                        recipient1,
                        ZERO_ADDRESS,
                        recipient1,
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
                      await security20.approve(dvp.address, token1Amount, {
                        from: tokenHolder1
                      });
                      await createTradeRequest(
                        dvp,
                        security20,
                        emoney20,
                        ERC20STANDARD,
                        ERC20STANDARD,
                        tokenHolder1,
                        recipient1,
                        ZERO_ADDRESS,
                        tokenHolder1,
                        true,
                        TYPE_SWAP,
                        token1Amount,
                        token2Amount
                      );
                    });
                  });
                  describe('when token standard is ERC721', function () {
                    it('creates and accepts the trade request', async function () {
                      const security721: ERC721Token = await ERC721.new(
                        'ERC721Token',
                        'DAU721',
                        '',
                        ''
                      );
                      await security721.mint(tokenHolder1, issuanceTokenId, {
                        from: owner
                      });
                      await security721.approve(dvp.address, issuanceTokenId, {
                        from: tokenHolder1
                      });

                      await createTradeRequest(
                        dvp,
                        security721,
                        emoney20,
                        ERC721STANDARD,
                        ERC20STANDARD,
                        tokenHolder1,
                        recipient1,
                        ZERO_ADDRESS,
                        tokenHolder1,
                        true,
                        TYPE_SWAP,
                        token1Amount,
                        token2Amount
                      );
                    });
                  });
                  describe('when token standard is ERC1400', function () {
                    it('creates and accepts the trade request', async function () {
                      const security1400: ERC1400 = await ERC1400.new(
                        'ERC1400Token',
                        'DAU',
                        1,
                        [],
                        partitions,
                        { from: owner }
                      );
                      await security1400.issueByPartition(
                        partition1,
                        tokenHolder1,
                        issuanceAmount,
                        VALID_CERTIFICATE,
                        { from: owner }
                      );
                      await security1400.approveByPartition(
                        partition1,
                        dvp.address,
                        token1Amount,
                        { from: tokenHolder1 }
                      );

                      await createTradeRequest(
                        dvp,
                        security1400,
                        emoney20,
                        ERC1400STANDARD,
                        ERC20STANDARD,
                        tokenHolder1,
                        recipient1,
                        ZERO_ADDRESS,
                        tokenHolder1,
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
                        tokenHolder1,
                        recipient1,
                        ZERO_ADDRESS,
                        recipient1,
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
                  await emoney20.approve(dvp.address, token2Amount, {
                    from: recipient1
                  });
                  await createTradeRequest(
                    dvp,
                    security20,
                    emoney20,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    tokenHolder1,
                    recipient1,
                    ZERO_ADDRESS,
                    recipient1,
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
                      tokenHolder1,
                      recipient1,
                      ZERO_ADDRESS,
                      unknown,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                  });
                });
                describe('when the holder 1 is the zero address', function () {
                  it('reverts', async function () {
                    const chainTime = (await web3.eth.getBlock('latest'))
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
                      holder2: recipient1,
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
                    await expectRevert.unspecified(
                      dvp.requestTrade(tradeInputData, ZERO_BYTES32, {
                        from: unknown
                      })
                    );
                  });
                });
              });
            });
            describe('when expiration date is not defined', function () {
              it('creates the trade request', async function () {
                await security20.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  security20,
                  emoney20,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
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
            dvp = await DVPContract.new(true);
          });
          describe('when a valid trade executer is defined', function () {
            it('creates the trade request', async function () {
              await security20.approve(dvp.address, token1Amount, {
                from: tokenHolder1
              });
              await createTradeRequest(
                dvp,
                security20,
                emoney20,
                ERC20STANDARD,
                ERC20STANDARD,
                tokenHolder1,
                recipient1,
                owner,
                tokenHolder1,
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
                await security20.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await expectRevert.unspecified(
                  createTradeRequest(
                    dvp,
                    security20,
                    emoney20,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    tokenHolder1,
                    recipient1,
                    tokenHolder1,
                    tokenHolder1,
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
                await security20.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await expectRevert.unspecified(
                  createTradeRequest(
                    dvp,
                    security20,
                    emoney20,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    tokenHolder1,
                    recipient1,
                    ZERO_ADDRESS,
                    tokenHolder1,
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
              // const createTradeRequest(dvp, token1, token2, tokenStandard1, tokenStandard2, holder1, holder2, executer, requester, realExpirationDate, tradeType, tokenAmount1, tokenAmount2)
              await createTradeRequest(
                dvp,
                undefined,
                emoney20,
                ETHSTANDARD,
                ERC20STANDARD,
                tokenHolder1,
                recipient1,
                ZERO_ADDRESS,
                tokenHolder1,
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
                tokenHolder1,
                recipient1,
                ZERO_ADDRESS,
                recipient1,
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
            await expectRevert.unspecified(
              createTradeRequest(
                dvp,
                security20,
                emoney20,
                ETHSTANDARD,
                ERC20STANDARD,
                tokenHolder1,
                recipient1,
                ZERO_ADDRESS,
                tokenHolder1,
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
      let security20, token1: ERC20Token;
      let emoney20, token2: ERC20Token;
      beforeEach(async function () {
        dvp = await DVPContract.new(false);

        security20 = await ERC20.new('ERC20Token', 'DAU', 18);
        emoney20 = await ERC20.new('ERC20Token', 'DAU', 18);

        await security20.mint(tokenHolder1, issuanceAmount, {
          from: owner
        });
        await emoney20.mint(recipient1, issuanceAmount, { from: owner });

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
                    await token1.approve(dvp.address, token1Amount, {
                      from: tokenHolder1
                    });
                    await createTradeRequest(
                      dvp,
                      token1,
                      token2,
                      ERC20STANDARD,
                      ERC20STANDARD,
                      tokenHolder1,
                      recipient1,
                      ZERO_ADDRESS,
                      tokenHolder1,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                    await token2.approve(dvp.address, token2Amount, {
                      from: recipient1
                    });
                    await acceptTradeRequest(
                      dvp,
                      token1,
                      token2,
                      1,
                      recipient1,
                      STATE_EXECUTED,
                      ACCEPTED_TRUE
                    );
                  });
                });
                describe('when trade doesnt get executed', function () {
                  it('accepts the trade', async function () {
                    // await token1.approve(dvp.address, token1Amount, { from: tokenHolder1 });
                    await createTradeRequest(
                      dvp,
                      token1,
                      token2,
                      ERC20STANDARD,
                      ERC20STANDARD,
                      tokenHolder1,
                      recipient1,
                      ZERO_ADDRESS,
                      unknown,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                    await token2.approve(dvp.address, token2Amount, {
                      from: recipient1
                    });
                    await acceptTradeRequest(
                      dvp,
                      token1,
                      token2,
                      1,
                      recipient1,
                      STATE_PENDING,
                      ACCEPTED_FALSE
                    );
                  });
                });
              });
              describe('when there are token controllers', function () {
                beforeEach(async function () {
                  await dvp.setTokenControllers(
                    security20.address,
                    [tokenController1],
                    { from: owner }
                  );
                });
                it('accepts the trade', async function () {
                  await token1.approve(dvp.address, token1Amount, {
                    from: tokenHolder1
                  });
                  await createTradeRequest(
                    dvp,
                    token1,
                    token2,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    tokenHolder1,
                    recipient1,
                    ZERO_ADDRESS,
                    tokenHolder1,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await token2.approve(dvp.address, token2Amount, {
                    from: recipient1
                  });
                  await acceptTradeRequest(
                    dvp,
                    token1,
                    token2,
                    1,
                    recipient1,
                    STATE_PENDING,
                    ACCEPTED_TRUE
                  );
                });
              });
            });
            describe('when trade has predefined executer', function () {
              it('accepts the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );
              });
            });
          });
          describe('when tokens are not available', function () {
            describe('when token standard is ETH', function () {
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  undefined,
                  ERC20STANDARD,
                  ETHSTANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await expectRevert.unspecified(
                  dvp.acceptTrade(1, ZERO_BYTES32, {
                    from: recipient1,
                    value: token2Amount - 1
                  })
                );
              });
            });
            describe('when token standard is ERC20', function () {
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount - 1, {
                  from: recipient1
                });
                await expectRevert.unspecified(
                  acceptTradeRequest(
                    dvp,
                    token1,
                    token2,
                    1,
                    recipient1,
                    STATE_EXECUTED,
                    ACCEPTED_TRUE
                  )
                );
              });
            });
            describe('when token standard is ERC1400', function () {
              let security1400: ERC1400;
              beforeEach(async function () {
                security1400 = await ERC1400.new(
                  'ERC1400Token',
                  'DAU',
                  1,
                  [],
                  partitions,
                  { from: owner }
                );
                await security1400.issueByPartition(
                  partition1,
                  recipient1,
                  issuanceAmount,
                  VALID_CERTIFICATE,
                  { from: owner }
                );
              });
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  security1400,
                  ERC20STANDARD,
                  ERC1400STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await security1400.approveByPartition(
                  partition1,
                  dvp.address,
                  token2Amount - 1,
                  { from: recipient1 }
                );
                await expectRevert.unspecified(
                  dvp.acceptTrade(1, ZERO_BYTES32, { from: recipient1 })
                );
              });
            });
          });
        });
        describe('when tokens do not need to be escrowed', function () {
          describe('when token standard is ERC20', function () {
            describe('when tokens have been reserved before', function () {
              it('accepts and executes the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_SWAP,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_EXECUTED,
                  ACCEPTED_TRUE
                );
              });
            });
            describe('when tokens have not been reserved before', function () {
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_SWAP,
                  token1Amount,
                  token2Amount
                );
                // await token2.approve(dvp.address, token2Amount, { from: recipient1 });
                await expectRevert.unspecified(
                  acceptTradeRequest(
                    dvp,
                    token1,
                    token2,
                    1,
                    recipient1,
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
              security721 = await ERC721.new('ERC721Token', 'DAU721', '', '');
              token2 = security721;
              await token2.mint(recipient1, issuanceTokenId, {
                from: owner
              });
            });
            describe('when tokens have been reserved before', function () {
              it('accepts and executes the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC721STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_SWAP,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, issuanceTokenId, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_EXECUTED,
                  ACCEPTED_TRUE
                );
              });
            });
            describe('when tokens have not been reserved before', function () {
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC721STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_SWAP,
                  token1Amount,
                  token2Amount
                );
                // await token2.approve(dvp.address, issuanceTokenId, { from: recipient1 });
                await expectRevert.unspecified(
                  acceptTradeRequest(
                    dvp,
                    token1,
                    token2,
                    1,
                    recipient1,
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
              security1400 = await ERC1400.new(
                'ERC1400Token',
                'DAU',
                1,
                [],
                partitions,
                { from: owner }
              );
              await security1400.issueByPartition(
                partition1,
                recipient1,
                issuanceAmount,
                VALID_CERTIFICATE,
                { from: owner }
              );
              token2 = security1400;
            });
            describe('when tokens have been reserved before', function () {
              it('accepts and executes the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC1400STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_SWAP,
                  token1Amount,
                  token2Amount
                );
                await token2.approveByPartition(
                  partition1,
                  dvp.address,
                  token2Amount,
                  { from: recipient1 }
                );
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_EXECUTED,
                  ACCEPTED_TRUE
                );
              });
            });
            describe('when tokens have not been reserved before', function () {
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC1400STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_SWAP,
                  token1Amount,
                  token2Amount
                );
                // await token2.approveByPartition(partition1, dvp.address, token2Amount, { from: recipient1 });
                await expectRevert.unspecified(
                  acceptTradeRequest(
                    dvp,
                    token1,
                    token2,
                    1,
                    recipient1,
                    STATE_EXECUTED,
                    ACCEPTED_TRUE
                  )
                );
              });
            });
          });
          describe('when payment is made off-chain', function () {
            it('accepts and executes the trade', async function () {
              await token1.approve(dvp.address, token1Amount, {
                from: tokenHolder1
              });
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                OFFCHAIN,
                tokenHolder1,
                recipient1,
                ZERO_ADDRESS,
                tokenHolder1,
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
                recipient1,
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
            await token1.approve(dvp.address, token1Amount, {
              from: tokenHolder1
            });
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              tokenHolder1,
              recipient1,
              ZERO_ADDRESS,
              tokenHolder1,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );
            await token2.approve(dvp.address, token2Amount, {
              from: recipient1
            });
            await expectRevert.unspecified(
              dvp.acceptTrade(999, ZERO_BYTES32, { from: recipient1 })
            );
          });
        });
        describe('when trade with indicated index is not in state pending', function () {
          it('reverts', async function () {
            await token1.approve(dvp.address, token1Amount, {
              from: tokenHolder1
            });
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              tokenHolder1,
              recipient1,
              ZERO_ADDRESS,
              tokenHolder1,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );
            await token2.approve(dvp.address, token2Amount, {
              from: recipient1
            });
            await dvp.acceptTrade(1, ZERO_BYTES32, { from: recipient1 });
            await expectRevert.unspecified(
              dvp.acceptTrade(1, ZERO_BYTES32, { from: recipient1 })
            );
          });
        });
      });
    });

    // APPROVE TRADE

    describe('approveTrade', function () {
      let dvp: Swaps;
      let security20, token1: ERC20Token;
      let emoney20, token2: ERC20Token;
      beforeEach(async function () {
        dvp = await DVPContract.new(false);

        security20 = await ERC20.new('ERC20Token', 'DAU', 18);
        emoney20 = await ERC20.new('ERC20Token', 'DAU', 18);

        await security20.mint(tokenHolder1, issuanceAmount, {
          from: owner
        });
        await emoney20.mint(recipient1, issuanceAmount, { from: owner });

        token1 = security20;
        token2 = emoney20;

        await dvp.setTokenControllers(token1.address, [tokenController1], {
          from: owner
        });
      });
      describe('when trade index is valid', function () {
        describe('when sender is token controller', function () {
          describe('when one single approval is required', function () {
            describe('when trade is executed', function () {
              it('approves and executes the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                await approveTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  tokenController1,
                  STATE_EXECUTED,
                  APPROVED_TRUE
                );
              });
            });
            describe('when trade is not executed', function () {
              it('approves the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                await approveTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  tokenController1,
                  STATE_PENDING,
                  APPROVED_TRUE
                );
              });
              it('approves, disapproves and re-approves the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                assert.equal(await dvp.getTradeApprovalStatus(1), false);

                await dvp.approveTrade(1, true, {
                  from: tokenController1
                });
                assert.equal(await dvp.getTradeApprovalStatus(1), true);

                await dvp.approveTrade(1, false, {
                  from: tokenController1
                });
                assert.equal(await dvp.getTradeApprovalStatus(1), false);

                await approveTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  tokenController1,
                  STATE_PENDING,
                  APPROVED_TRUE
                );
              });
            });
          });
          describe('when two approvals are required', function () {
            beforeEach(async function () {
              await dvp.setTokenControllers(
                token2.address,
                [tokenController2],
                { from: owner }
              );
            });
            describe('when trade is executed', function () {
              it('approves and executes the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  ZERO_ADDRESS,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                await approveTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  tokenController1,
                  STATE_PENDING,
                  APPROVED_FALSE
                );
                await approveTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  tokenController2,
                  STATE_EXECUTED,
                  APPROVED_TRUE
                );
              });
            });
            describe('when trade is not executed', function () {
              it('approves the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                await approveTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  tokenController1,
                  STATE_PENDING,
                  APPROVED_FALSE
                );
                await approveTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  tokenController2,
                  STATE_PENDING,
                  APPROVED_TRUE
                );
              });
            });
          });
        });
        describe('when sender is not token controller', function () {
          it('reverts', async function () {
            await token1.approve(dvp.address, token1Amount, {
              from: tokenHolder1
            });
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              tokenHolder1,
              recipient1,
              ZERO_ADDRESS,
              tokenHolder1,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );
            await token2.approve(dvp.address, token2Amount, {
              from: recipient1
            });
            await acceptTradeRequest(
              dvp,
              token1,
              token2,
              1,
              recipient1,
              STATE_PENDING,
              ACCEPTED_TRUE
            );

            assert.equal(await dvp.getTradeApprovalStatus(1), false);

            await expectRevert.unspecified(
              dvp.approveTrade(1, true, { from: unknown })
            );
          });
        });
      });
      describe('when trade index is not valid', function () {
        describe('when trade with indicated index doesn t exist', function () {
          it('reverts', async function () {
            await token1.approve(dvp.address, token1Amount, {
              from: tokenHolder1
            });
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              tokenHolder1,
              recipient1,
              ZERO_ADDRESS,
              tokenHolder1,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );
            await token2.approve(dvp.address, token2Amount, {
              from: recipient1
            });
            await acceptTradeRequest(
              dvp,
              token1,
              token2,
              1,
              recipient1,
              STATE_PENDING,
              ACCEPTED_TRUE
            );

            assert.equal(await dvp.getTradeApprovalStatus(1), false);

            await expectRevert.unspecified(
              dvp.approveTrade(999, true, { from: tokenController1 })
            );
          });
        });
        describe('when trade with indicated index is not in state pending', function () {
          it('reverts', async function () {
            await token1.approve(dvp.address, token1Amount, {
              from: tokenHolder1
            });
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              tokenHolder1,
              recipient1,
              ZERO_ADDRESS,
              tokenHolder1,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );
            await token2.approve(dvp.address, token2Amount, {
              from: recipient1
            });
            await acceptTradeRequest(
              dvp,
              token1,
              token2,
              1,
              recipient1,
              STATE_PENDING,
              ACCEPTED_TRUE
            );

            assert.equal(await dvp.getTradeApprovalStatus(1), false);

            await dvp.approveTrade(1, true, { from: tokenController1 });
            await assertTradeState(dvp, 1, STATE_EXECUTED);

            await expectRevert.unspecified(
              dvp.approveTrade(1, true, { from: tokenController1 })
            );
          });
        });
      });
    });

    // EXECUTE TRADE

    describe('executeTrade', function () {
      let dvp: Swaps;
      let security20, token1: ERC20Token;
      let emoney20, token2: ERC20Token;
      beforeEach(async function () {
        dvp = await DVPContract.new(false);

        security20 = await ERC20.new('ERC20Token', 'DAU', 18);
        emoney20 = await ERC20.new('ERC20Token', 'DAU', 18);

        await security20.mint(tokenHolder1, issuanceAmount, {
          from: owner
        });
        await emoney20.mint(recipient1, issuanceAmount, { from: owner });

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
                        await token1.approve(dvp.address, token1Amount, {
                          from: tokenHolder1
                        });
                        await createTradeRequest(
                          dvp,
                          token1,
                          token2,
                          ERC20STANDARD,
                          ERC20STANDARD,
                          tokenHolder1,
                          recipient1,
                          executer,
                          tokenHolder1,
                          true,
                          TYPE_ESCROW,
                          token1Amount,
                          token2Amount
                        );
                        await token2.approve(dvp.address, token2Amount, {
                          from: recipient1
                        });
                        await acceptTradeRequest(
                          dvp,
                          token1,
                          token2,
                          1,
                          recipient1,
                          STATE_PENDING,
                          ACCEPTED_TRUE
                        );
                        await executeTradeRequest(
                          dvp,
                          token1,
                          token2,
                          1,
                          executer
                        );
                      });
                    });
                    describe('when trade type is Swap', function () {
                      describe('when trade is executed by an executer', function () {
                        describe('when tokens are available', function () {
                          it('executes the trade', async function () {
                            await token1.approve(dvp.address, token1Amount, {
                              from: tokenHolder1
                            });
                            await createTradeRequest(
                              dvp,
                              token1,
                              token2,
                              ERC20STANDARD,
                              ERC20STANDARD,
                              tokenHolder1,
                              recipient1,
                              executer,
                              tokenHolder1,
                              true,
                              TYPE_SWAP,
                              token1Amount,
                              token2Amount
                            );
                            await token2.approve(dvp.address, token2Amount, {
                              from: recipient1
                            });
                            await acceptTradeRequest(
                              dvp,
                              token1,
                              token2,
                              1,
                              recipient1,
                              STATE_PENDING,
                              ACCEPTED_TRUE
                            );
                            await executeTradeRequest(
                              dvp,
                              token1,
                              token2,
                              1,
                              executer
                            );
                          });
                        });
                        describe('when tokens are not available', function () {
                          it('executes the trade', async function () {
                            await token1.approve(dvp.address, token1Amount, {
                              from: tokenHolder1
                            });
                            await createTradeRequest(
                              dvp,
                              token1,
                              token2,
                              ERC20STANDARD,
                              ERC20STANDARD,
                              tokenHolder1,
                              recipient1,
                              executer,
                              tokenHolder1,
                              true,
                              TYPE_SWAP,
                              token1Amount,
                              token2Amount
                            );
                            await token2.approve(dvp.address, token2Amount, {
                              from: recipient1
                            });
                            await acceptTradeRequest(
                              dvp,
                              token1,
                              token2,
                              1,
                              recipient1,
                              STATE_PENDING,
                              ACCEPTED_TRUE
                            );
                            await token2.approve(dvp.address, 0, {
                              from: recipient1
                            });
                            await expectRevert.unspecified(
                              executeTradeRequest(
                                dvp,
                                token1,
                                token2,
                                1,
                                executer
                              )
                            );
                          });
                        });
                      });
                      describe('when trade is executed by a holder', function () {
                        beforeEach(async function () {
                          await dvp.setTokenControllers(
                            token1.address,
                            [tokenController1],
                            { from: owner }
                          );
                        });
                        it('executes the trade', async function () {
                          await token1.approve(dvp.address, token1Amount, {
                            from: tokenHolder1
                          });
                          await createTradeRequest(
                            dvp,
                            token1,
                            token2,
                            ERC20STANDARD,
                            ERC20STANDARD,
                            tokenHolder1,
                            recipient1,
                            ZERO_ADDRESS,
                            tokenHolder1,
                            true,
                            TYPE_SWAP,
                            token1Amount,
                            token2Amount
                          );
                          await token2.approve(dvp.address, token2Amount, {
                            from: recipient1
                          });
                          await acceptTradeRequest(
                            dvp,
                            token1,
                            token2,
                            1,
                            recipient1,
                            STATE_PENDING,
                            ACCEPTED_TRUE
                          );
                          await token1.decreaseAllowance(
                            dvp.address,
                            token1Amount,
                            { from: tokenHolder1 }
                          );
                          await dvp.approveTrade(1, true, {
                            from: tokenController1
                          });
                          // -- trade doesn't get executed because allowance had been decreased
                          await token1.increaseAllowance(
                            dvp.address,
                            token1Amount,
                            { from: tokenHolder1 }
                          );
                          await executeTradeRequest(
                            dvp,
                            token1,
                            token2,
                            1,
                            tokenHolder1
                          );
                        });
                      });
                    });
                  });
                  describe('when token standard is ERC20 vs ETH', function () {
                    describe('when trade type is Escrow', function () {
                      it('executes the trade', async function () {
                        const token0Amount = '0x6F05B59D3B20000'; // 5 * 10**18

                        const initialEthBalance1 =
                          parseInt(await web3.eth.getBalance(tokenHolder1)) /
                          10 ** 18;
                        const initialEthBalance2 =
                          parseInt(await web3.eth.getBalance(recipient1)) /
                          10 ** 18;

                        await createTradeRequest(
                          dvp,
                          undefined,
                          token2,
                          ETHSTANDARD,
                          ERC20STANDARD,
                          tokenHolder1,
                          recipient1,
                          executer,
                          tokenHolder1,
                          true,
                          TYPE_ESCROW,
                          token0Amount,
                          token2Amount
                        );
                        await token2.approve(dvp.address, token2Amount, {
                          from: recipient1
                        });
                        await acceptTradeRequest(
                          dvp,
                          undefined,
                          token2,
                          1,
                          recipient1,
                          STATE_PENDING,
                          ACCEPTED_TRUE
                        );
                        await executeTradeRequest(
                          dvp,
                          undefined,
                          token2,
                          1,
                          executer
                        );

                        const finalEthBalance1 =
                          parseInt(await web3.eth.getBalance(tokenHolder1)) /
                          10 ** 18;
                        const finalEthBalance2 =
                          parseInt(await web3.eth.getBalance(recipient1)) /
                          10 ** 18;

                        await assertEtherBalance(dvp.address, 0, true);
                        assert.equal(
                          Math.abs(
                            initialEthBalance1 - finalEthBalance1 - 0.5
                          ) < 0.1,
                          true
                        );
                        assert.equal(
                          Math.abs(
                            finalEthBalance2 - initialEthBalance2 - 0.5
                          ) < 0.1,
                          true
                        );
                      });
                    });
                  });
                  describe('when token standard is ERC20 vs off-chain payment', function () {
                    describe('when trade type is Escrow', function () {
                      it('executes the trade', async function () {
                        await token1.approve(dvp.address, token1Amount, {
                          from: tokenHolder1
                        });
                        await createTradeRequest(
                          dvp,
                          token1,
                          undefined,
                          ERC20STANDARD,
                          OFFCHAIN,
                          tokenHolder1,
                          recipient1,
                          executer,
                          tokenHolder1,
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
                          recipient1,
                          STATE_PENDING,
                          ACCEPTED_TRUE
                        );
                        await executeTradeRequest(
                          dvp,
                          token1,
                          undefined,
                          1,
                          executer
                        );
                      });
                    });
                  });
                  describe('when token standard is ERC721 vs ERC20', function () {
                    let security721: ERC721Token;
                    beforeEach(async function () {
                      security721 = await ERC721.new(
                        'ERC721Token',
                        'DAU721',
                        '',
                        ''
                      );
                      await security721.mint(tokenHolder1, issuanceTokenId, {
                        from: owner
                      });
                    });
                    it('setTokenURI sets the URI for the tokenId', async function () {
                      await security721.setTokenURI(
                        issuanceTokenId,
                        'https://consensys.org/' + issuanceTokenId
                      );
                      const uri = await security721.tokenURI(issuanceTokenId);

                      assert.equal(
                        uri,
                        'https://consensys.org/' + issuanceTokenId
                      );
                    });
                    describe('when trade type is Escrow', function () {
                      it('executes the trade', async function () {
                        await security721.approve(
                          dvp.address,
                          issuanceTokenId,
                          { from: tokenHolder1 }
                        );
                        await createTradeRequest(
                          dvp,
                          security721,
                          token2,
                          ERC721STANDARD,
                          ERC20STANDARD,
                          tokenHolder1,
                          recipient1,
                          executer,
                          tokenHolder1,
                          true,
                          TYPE_ESCROW,
                          0,
                          token2Amount
                        );
                        await token2.approve(dvp.address, token2Amount, {
                          from: recipient1
                        });
                        await acceptTradeRequest(
                          dvp,
                          security721,
                          token2,
                          1,
                          recipient1,
                          STATE_PENDING,
                          ACCEPTED_TRUE
                        );
                        await executeTradeRequest(
                          dvp,
                          security721,
                          token2,
                          1,
                          executer
                        );
                      });
                    });
                  });
                  describe('when token standard is ERC1400 vs ERC20', function () {
                    describe('when trade type is Escrow', function () {
                      let security1400: ERC1400;
                      beforeEach(async function () {
                        security1400 = await ERC1400.new(
                          'ERC1400Token',
                          'DAU',
                          1,
                          [owner],
                          partitions,
                          { from: owner }
                        );
                        await security1400.issueByPartition(
                          partition1,
                          tokenHolder1,
                          issuanceAmount,
                          MOCK_CERTIFICATE,
                          { from: owner }
                        );
                      });
                      it('executes the trade', async function () {
                        await security1400.approveByPartition(
                          partition1,
                          dvp.address,
                          token1Amount,
                          { from: tokenHolder1 }
                        );
                        await createTradeRequest(
                          dvp,
                          security1400,
                          token2,
                          ERC1400STANDARD,
                          ERC20STANDARD,
                          tokenHolder1,
                          recipient1,
                          executer,
                          tokenHolder1,
                          true,
                          TYPE_ESCROW,
                          token1Amount,
                          token2Amount
                        );
                        await token2.approve(dvp.address, token2Amount, {
                          from: recipient1
                        });
                        await acceptTradeRequest(
                          dvp,
                          security1400,
                          token2,
                          1,
                          recipient1,
                          STATE_PENDING,
                          ACCEPTED_TRUE
                        );
                        await executeTradeRequest(
                          dvp,
                          security1400,
                          token2,
                          1,
                          executer
                        );
                      });
                    });
                  });
                });
                describe('when expiration date is past', function () {
                  it('reverts', async function () {
                    await token1.approve(dvp.address, token1Amount, {
                      from: tokenHolder1
                    });
                    await createTradeRequest(
                      dvp,
                      token1,
                      token2,
                      ERC20STANDARD,
                      ERC20STANDARD,
                      tokenHolder1,
                      recipient1,
                      executer,
                      tokenHolder1,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                    await token2.approve(dvp.address, token2Amount, {
                      from: recipient1
                    });
                    await acceptTradeRequest(
                      dvp,
                      token1,
                      token2,
                      1,
                      recipient1,
                      STATE_PENDING,
                      ACCEPTED_TRUE
                    );

                    // Wait for 1 hour
                    await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

                    await expectRevert.unspecified(
                      executeTradeRequest(dvp, token1, token2, 1, executer)
                    );
                  });
                });
              });
              describe('when trade is not executed at initially defined price', function () {
                it('creates and accepts the trade request', async function () {
                  await dvp.setPriceOracles(token1.address, [oracle], {
                    from: owner
                  });
                  let chainTime = (await web3.eth.getBlock('latest')).timestamp;
                  let variablePriceStartDate =
                    chainTime + SECONDS_IN_A_WEEK + 10;
                  await dvp.setVariablePriceStartDate(
                    token1.address,
                    variablePriceStartDate,
                    { from: oracle }
                  );
                  assert.equal(
                    await dvp.variablePriceStartDate(token1.address),
                    variablePriceStartDate
                  );
                  // Wait for 1 week
                  await advanceTimeAndBlock(SECONDS_IN_A_WEEK + 100);

                  await dvp.setPriceOwnership(
                    token1.address,
                    token2.address,
                    true,
                    { from: oracle }
                  );
                  const multiple2 = 2;
                  await dvp.setTokenPrice(
                    token1.address,
                    token2.address,
                    ALL_PARTITIONS,
                    ALL_PARTITIONS,
                    multiple2,
                    { from: oracle }
                  );

                  await token1.approve(dvp.address, token1Amount, {
                    from: tokenHolder1
                  });
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
                    holder1: tokenHolder1,
                    holder2: recipient1,
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
                  await dvp.requestTrade(tradeInputData, ZERO_BYTES32, {
                    from: tokenHolder1
                  });

                  await token2.approve(dvp.address, token2Amount, {
                    from: recipient1
                  });
                  await dvp.acceptTrade(1, ZERO_BYTES32, {
                    from: recipient1
                  });
                });
              });
            });
            describe('when trade has not been accepted', function () {
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                // await acceptTradeRequest(dvp, token1, token2, 1, recipient1, STATE_PENDING, ACCEPTED_TRUE);
                await expectRevert.unspecified(
                  executeTradeRequest(dvp, token1, token2, 1, executer)
                );
              });
            });
          });
          describe('when trade has not been approved', function () {
            beforeEach(async function () {
              await dvp.setTokenControllers(
                token1.address,
                [tokenController1],
                { from: owner }
              );
            });
            it('reverts', async function () {
              await token1.approve(dvp.address, token1Amount, {
                from: tokenHolder1
              });
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                tokenHolder1,
                recipient1,
                executer,
                tokenHolder1,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await token2.approve(dvp.address, token2Amount, {
                from: recipient1
              });
              await acceptTradeRequest(
                dvp,
                token1,
                token2,
                1,
                recipient1,
                STATE_PENDING,
                ACCEPTED_TRUE
              );
              await expectRevert.unspecified(
                executeTradeRequest(dvp, token1, token2, 1, executer)
              );
            });
          });
        });
        describe('when caller is not executer defined at trade creation', function () {
          it('reverts', async function () {
            await token1.approve(dvp.address, token1Amount, {
              from: tokenHolder1
            });
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              tokenHolder1,
              recipient1,
              executer,
              tokenHolder1,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );
            await token2.approve(dvp.address, token2Amount, {
              from: recipient1
            });
            await acceptTradeRequest(
              dvp,
              token1,
              token2,
              1,
              recipient1,
              STATE_PENDING,
              ACCEPTED_TRUE
            );
            await expectRevert.unspecified(
              executeTradeRequest(dvp, token1, token2, 1, unknown)
            );
          });
        });
      });
      describe('when trade index is not valid', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            dvp.executeTrade(999, { from: executer })
          );
        });
      });
    });

    // FORCE TRADE

    describe('forceTrade', function () {
      let dvp: Swaps;
      let security20, token1: ERC20Token;
      let emoney20, token2: ERC20Token;

      beforeEach(async function () {
        dvp = await DVPContract.new(false);

        security20 = await ERC20.new('ERC20Token', 'DAU', 18);
        emoney20 = await ERC20.new('ERC20Token', 'DAU', 18);

        await security20.mint(tokenHolder1, issuanceAmount, {
          from: owner
        });
        await emoney20.mint(recipient1, issuanceAmount, { from: owner });

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
                    await token1.approve(dvp.address, token1Amount, {
                      from: tokenHolder1
                    });
                    await createTradeRequest(
                      dvp,
                      token1,
                      token2,
                      ERC20STANDARD,
                      ERC20STANDARD,
                      tokenHolder1,
                      recipient1,
                      ZERO_ADDRESS,
                      tokenHolder1,
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
                      tokenHolder1
                    );
                  });
                });
                describe('when sender is not holder1', function () {
                  it('reverts', async function () {
                    await token1.approve(dvp.address, token1Amount, {
                      from: tokenHolder1
                    });
                    await createTradeRequest(
                      dvp,
                      token1,
                      token2,
                      ERC20STANDARD,
                      ERC20STANDARD,
                      tokenHolder1,
                      recipient1,
                      ZERO_ADDRESS,
                      tokenHolder1,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                    await expectRevert.unspecified(
                      forceTradeRequest(dvp, token1, token2, 1, recipient1)
                    );
                  });
                });
              });
              describe('when trade has been accepted by holder2', function () {
                describe('when sender is holder2', function () {
                  it('forces the trade', async function () {
                    await token2.approve(dvp.address, token2Amount, {
                      from: recipient1
                    });
                    await createTradeRequest(
                      dvp,
                      token1,
                      token2,
                      ERC20STANDARD,
                      ERC20STANDARD,
                      tokenHolder1,
                      recipient1,
                      ZERO_ADDRESS,
                      recipient1,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                    await forceTradeRequest(dvp, token1, token2, 1, recipient1);
                  });
                });
                describe('when sender is not holder2', function () {
                  it('reverts', async function () {
                    await token2.approve(dvp.address, token2Amount, {
                      from: recipient1
                    });
                    await createTradeRequest(
                      dvp,
                      token1,
                      token2,
                      ERC20STANDARD,
                      ERC20STANDARD,
                      tokenHolder1,
                      recipient1,
                      ZERO_ADDRESS,
                      recipient1,
                      true,
                      TYPE_ESCROW,
                      token1Amount,
                      token2Amount
                    );
                    await expectRevert.unspecified(
                      forceTradeRequest(dvp, token1, token2, 1, tokenHolder1)
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
                    tokenHolder1,
                    recipient1,
                    ZERO_ADDRESS,
                    unknown,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await expectRevert.unspecified(
                    forceTradeRequest(dvp, token1, token2, 1, unknown)
                  );
                });
              });
            });
            describe('when executer has been defined at trade creation', function () {
              describe('when caller is executer defined at trade creation', function () {
                it('executes the trade', async function () {
                  await token1.approve(dvp.address, token1Amount, {
                    from: tokenHolder1
                  });
                  await createTradeRequest(
                    dvp,
                    token1,
                    token2,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    tokenHolder1,
                    recipient1,
                    executer,
                    tokenHolder1,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await forceTradeRequest(dvp, token1, token2, 1, executer);
                });
              });
              describe('when caller is not executer defined at trade creation', function () {
                it('executes the trade', async function () {
                  await token1.approve(dvp.address, token1Amount, {
                    from: tokenHolder1
                  });
                  await createTradeRequest(
                    dvp,
                    token1,
                    token2,
                    ERC20STANDARD,
                    ERC20STANDARD,
                    tokenHolder1,
                    recipient1,
                    executer,
                    tokenHolder1,
                    true,
                    TYPE_ESCROW,
                    token1Amount,
                    token2Amount
                  );
                  await expectRevert.unspecified(
                    forceTradeRequest(dvp, token1, token2, 1, tokenHolder1)
                  );
                });
              });
            });
          });
          describe('when at least one of traded tokens has controllers', function () {
            beforeEach(async function () {
              await dvp.setTokenControllers(
                token1.address,
                [tokenController1],
                { from: owner }
              );
            });
            it('reverts', async function () {
              await token1.approve(dvp.address, token1Amount, {
                from: tokenHolder1
              });
              await createTradeRequest(
                dvp,
                token1,
                token2,
                ERC20STANDARD,
                ERC20STANDARD,
                tokenHolder1,
                recipient1,
                ZERO_ADDRESS,
                tokenHolder1,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );
              await expectRevert.unspecified(
                forceTradeRequest(dvp, token1, token2, 1, tokenHolder1)
              );
            });
          });
        });
        describe('when trade has been accepted by both parties', function () {
          it('reverts', async function () {
            await token1.approve(dvp.address, token1Amount, {
              from: tokenHolder1
            });
            await createTradeRequest(
              dvp,
              token1,
              token2,
              ERC20STANDARD,
              ERC20STANDARD,
              tokenHolder1,
              recipient1,
              executer,
              tokenHolder1,
              true,
              TYPE_ESCROW,
              token1Amount,
              token2Amount
            );
            await token2.approve(dvp.address, token2Amount, {
              from: recipient1
            });
            await acceptTradeRequest(
              dvp,
              token1,
              token2,
              1,
              recipient1,
              STATE_PENDING,
              ACCEPTED_TRUE
            );
            await expectRevert.unspecified(
              forceTradeRequest(dvp, token1, token2, 1, executer)
            );
          });
        });
      });
      describe('when trade index is not valid', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            dvp.forceTrade(999, { from: executer })
          );
        });
      });
    });

    // CANCEL TRADE

    describe('cancelTrade', function () {
      let dvp: Swaps;
      let security20, token1: ERC20Token;
      let emoney20, token2: ERC20Token;
      beforeEach(async function () {
        dvp = await DVPContract.new(false);

        security20 = await ERC20.new('ERC20Token', 'DAU', 18);
        emoney20 = await ERC20.new('ERC20Token', 'DAU', 18);

        await security20.mint(tokenHolder1, issuanceAmount, {
          from: owner
        });
        await emoney20.mint(recipient1, issuanceAmount, { from: owner });

        token1 = security20;
        token2 = emoney20;
      });
      describe('when trade index is valid', function () {
        describe('when trade has been accepted by both parties', function () {
          describe('when caller is trade executer', function () {
            describe('when trade type is Escrow', function () {
              it('cancels the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                await cancelTradeRequest(dvp, token1, token2, 1, executer);
              });
            });
            describe('when trade type is Swap', function () {
              it('cancels the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_SWAP,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                await cancelTradeRequest(dvp, token1, token2, 1, executer);
              });
            });
          });
          describe('when caller is holder1', function () {
            describe('when expiration date is past', function () {
              it('cancels the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                // Wait for 1 hour
                await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

                await cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1);
              });
            });
            describe('when expiration date is not past', function () {
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                await expectRevert.unspecified(
                  cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1)
                );
              });
            });
          });
          describe('when caller is holder2', function () {
            describe('when expiration date is past', function () {
              it('cancels the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                // Wait for 1 hour
                await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

                await cancelTradeRequest(dvp, token1, token2, 1, recipient1);
              });
            });
            describe('when expiration date is not past', function () {
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_TRUE
                );

                await expectRevert.unspecified(
                  cancelTradeRequest(dvp, token1, token2, 1, recipient1)
                );
              });
            });
          });
        });
        describe('when trade has been accepted by holder1', function () {
          describe('when caller is trade executer', function () {
            describe('when trade type is Escrow', function () {
              it('cancels the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                // await token2.approve(dvp.address, token2Amount, { from: recipient1 });
                // await acceptTradeRequest(dvp, token1, token2, 1, recipient1, STATE_PENDING, ACCEPTED_TRUE);

                await cancelTradeRequest(dvp, token1, token2, 1, executer);
              });
            });
            describe('when trade type is Swap', function () {
              it('cancels the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_SWAP,
                  token1Amount,
                  token2Amount
                );
                // await token2.approve(dvp.address, token2Amount, { from: recipient1 });
                // await acceptTradeRequest(dvp, token1, token2, 1, recipient1, STATE_PENDING, ACCEPTED_TRUE);

                await cancelTradeRequest(dvp, token1, token2, 1, executer);
              });
            });
          });
          describe('when caller is holder1', function () {
            describe('when expiration date is past', function () {
              it('cancels the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                // await token2.approve(dvp.address, token2Amount, { from: recipient1 });
                // await acceptTradeRequest(dvp, token1, token2, 1, recipient1, STATE_PENDING, ACCEPTED_TRUE);

                // Wait for 1 hour
                await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

                await cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1);
              });
            });
            describe('when expiration date is not past', function () {
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                // await token2.approve(dvp.address, token2Amount, { from: recipient1 });
                // await acceptTradeRequest(dvp, token1, token2, 1, recipient1, STATE_PENDING, ACCEPTED_TRUE);

                await expectRevert.unspecified(
                  cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1)
                );
              });
            });
          });
          describe('when caller is holder2', function () {
            describe('when expiration date is past', function () {
              it('cancels the trade', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                // await token2.approve(dvp.address, token2Amount, { from: recipient1 });
                // await acceptTradeRequest(dvp, token1, token2, 1, recipient1, STATE_PENDING, ACCEPTED_TRUE);

                // Wait for 1 hour
                await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

                await expectRevert.unspecified(
                  cancelTradeRequest(dvp, token1, token2, 1, recipient1)
                );
              });
            });
            describe('when expiration date is not past', function () {
              it('reverts', async function () {
                await token1.approve(dvp.address, token1Amount, {
                  from: tokenHolder1
                });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  tokenHolder1,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                // await token2.approve(dvp.address, token2Amount, { from: recipient1 });
                // await acceptTradeRequest(dvp, token1, token2, 1, recipient1, STATE_PENDING, ACCEPTED_TRUE);

                await expectRevert.unspecified(
                  cancelTradeRequest(dvp, token1, token2, 1, recipient1)
                );
              });
            });
          });
        });
        describe('when trade has been accepted by holder2', function () {
          describe('when caller is trade executer', function () {
            describe('when trade type is Escrow', function () {
              it('cancels the trade', async function () {
                // await token1.approve(dvp.address, token1Amount, { from: tokenHolder1 });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  executer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_FALSE
                );

                await cancelTradeRequest(dvp, token1, token2, 1, executer);
              });
            });
            describe('when trade type is Swap', function () {
              it('cancels the trade', async function () {
                // await token1.approve(dvp.address, token1Amount, { from: tokenHolder1 });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  executer,
                  true,
                  TYPE_SWAP,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_FALSE
                );

                await cancelTradeRequest(dvp, token1, token2, 1, executer);
              });
            });
          });
          describe('when caller is holder1', function () {
            describe('when expiration date is past', function () {
              it('cancels the trade', async function () {
                // await token1.approve(dvp.address, token1Amount, { from: tokenHolder1 });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  executer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_FALSE
                );

                // Wait for 1 hour
                await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

                await expectRevert.unspecified(
                  cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1)
                );
              });
            });
            describe('when expiration date is not past', function () {
              it('reverts', async function () {
                // await token1.approve(dvp.address, token1Amount, { from: tokenHolder1 });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  executer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_FALSE
                );

                await expectRevert.unspecified(
                  cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1)
                );
              });
            });
          });
          describe('when caller is holder2', function () {
            describe('when expiration date is past', function () {
              it('cancels the trade', async function () {
                // await token1.approve(dvp.address, token1Amount, { from: tokenHolder1 });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  executer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_FALSE
                );

                // Wait for 1 hour
                await advanceTimeAndBlock(2 * SECONDS_IN_A_WEEK + 1);

                await cancelTradeRequest(dvp, token1, token2, 1, recipient1);
              });
            });
            describe('when expiration date is not past', function () {
              it('reverts', async function () {
                // await token1.approve(dvp.address, token1Amount, { from: tokenHolder1 });
                await createTradeRequest(
                  dvp,
                  token1,
                  token2,
                  ERC20STANDARD,
                  ERC20STANDARD,
                  tokenHolder1,
                  recipient1,
                  executer,
                  executer,
                  true,
                  TYPE_ESCROW,
                  token1Amount,
                  token2Amount
                );
                await token2.approve(dvp.address, token2Amount, {
                  from: recipient1
                });
                await acceptTradeRequest(
                  dvp,
                  token1,
                  token2,
                  1,
                  recipient1,
                  STATE_PENDING,
                  ACCEPTED_FALSE
                );

                await expectRevert.unspecified(
                  cancelTradeRequest(dvp, token1, token2, 1, recipient1)
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
                tokenHolder1,
                recipient1,
                executer,
                executer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );

              await cancelTradeRequest(dvp, token1, token2, 1, executer);
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
                tokenHolder1,
                recipient1,
                executer,
                executer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );

              await cancelTradeRequest(dvp, token1, token2, 1, tokenHolder1);
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
                tokenHolder1,
                recipient1,
                executer,
                executer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );

              await cancelTradeRequest(dvp, token1, token2, 1, recipient1);
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
                tokenHolder1,
                recipient1,
                executer,
                executer,
                true,
                TYPE_ESCROW,
                token1Amount,
                token2Amount
              );

              await expectRevert.unspecified(
                dvp.cancelTrade(1, { from: unknown })
              );
            });
          });
        });
      });
      describe('when trade index is not valid', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            dvp.cancelTrade(999, { from: executer })
          );
        });
      });
    });

    // RENOUNCE OWNERSHIP

    describe('renounceOwnership', function () {
      let dvp: Swaps;
      beforeEach(async function () {
        dvp = await DVPContract.new(true);
      });
      describe('when the caller is the contract owner', function () {
        it('renounces to ownership', async function () {
          assert.equal(await dvp.owner(), owner);

          // can set trade executers
          await dvp.setTradeExecuters([owner, executer], { from: owner });

          await dvp.renounceOwnership({ from: owner });
          assert.equal(await dvp.owner(), ZERO_ADDRESS);

          // can not set trade executers anymore
          await expectRevert.unspecified(
            dvp.setTradeExecuters([owner, executer], { from: owner })
          );
        });
      });
      describe('when the caller is not the contract owner', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            dvp.renounceOwnership({ from: unknown })
          );
        });
      });
    });

    // SET TRADE EXECUTER

    describe('setTradeExecuters', function () {
      let dvp: Swaps;
      beforeEach(async function () {
        dvp = await DVPContract.new(true);
      });
      describe('when the caller is the contract owner', function () {
        describe('when the dvp contract is owned', function () {
          it('sets the operators as trade executers', async function () {
            const tradeExecuters1 = await dvp.tradeExecuters();
            assert.equal(tradeExecuters1.length, 1);
            assert.equal(tradeExecuters1[0], owner);
            await dvp.setTradeExecuters([owner, executer], {
              from: owner
            });
            const tradeExecuters2 = await dvp.tradeExecuters();
            assert.equal(tradeExecuters2.length, 2);
            assert.equal(tradeExecuters2[0], owner);
            assert.equal(tradeExecuters2[1], executer);
          });
        });
        describe('when the dvp contract is not owned', function () {
          let dvp: Swaps;
          beforeEach(async function () {
            dvp = await DVPContract.new(false);
          });
          it('reverts', async function () {
            await expectRevert.unspecified(
              dvp.setTradeExecuters([owner, executer], { from: owner })
            );
          });
        });
      });
      describe('when the caller is not the contract owner', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            dvp.setTradeExecuters([owner, executer], { from: executer })
          );
        });
      });
    });

    // SET TOKEN CONTROLLERS

    describe('setTokenControllers', function () {
      let dvp: Swaps;
      let token1: ERC20Token;
      beforeEach(async function () {
        dvp = await DVPContract.new(false);

        token1 = await ERC20.new('ERC20Token', 'DAU', 18, {
          from: tokenHolder1
        });
      });
      describe('when the caller is the token contract owner', function () {
        it('sets the operators as token controllers', async function () {
          let tokenControllers = await dvp.tokenControllers(token1.address);
          assert.equal(tokenControllers.length, 0);

          await dvp.setTokenControllers(
            token1.address,
            [tokenController1, tokenController2],
            { from: tokenHolder1 }
          );

          tokenControllers = await dvp.tokenControllers(token1.address);
          assert.equal(tokenControllers.length, 2);
          assert.equal(tokenControllers[0], tokenController1);
          assert.equal(tokenControllers[1], tokenController2);
        });
      });
      describe('when the caller is an other token controller', function () {
        it('sets the operators as token controllers', async function () {
          let tokenControllers = await dvp.tokenControllers(token1.address);
          assert.equal(tokenControllers.length, 0);

          await dvp.setTokenControllers(token1.address, [tokenController2], {
            from: tokenHolder1
          });

          tokenControllers = await dvp.tokenControllers(token1.address);
          assert.equal(tokenControllers.length, 1);
          assert.equal(tokenControllers[0], tokenController2);

          await dvp.setTokenControllers(
            token1.address,
            [tokenController1, unknown],
            { from: tokenController2 }
          );

          tokenControllers = await dvp.tokenControllers(token1.address);
          assert.equal(tokenControllers.length, 2);
          assert.equal(tokenControllers[0], tokenController1);
          assert.equal(tokenControllers[1], unknown);
        });
      });
      describe('when the caller is neither the token contract owner nor a token controller', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            dvp.setTokenControllers(
              token1.address,
              [tokenController1, tokenController2],
              { from: tokenHolder2 }
            )
          );
        });
      });
    });

    // SET PRICE ORACLES

    describe('setPriceOracles', function () {
      let dvp: Swaps;
      let token1: ERC20Token;
      beforeEach(async function () {
        dvp = await DVPContract.new(false);

        token1 = await ERC20.new('ERC20Token', 'DAU', 18, {
          from: tokenHolder1
        });
      });
      describe('when the caller is the token contract owner', function () {
        it('sets the operators as token price oracle', async function () {
          let priceOracles = await dvp.priceOracles(token1.address);
          assert.equal(priceOracles.length, 0);

          await dvp.setPriceOracles(token1.address, [oracle, unknown], {
            from: tokenHolder1
          });

          priceOracles = await dvp.priceOracles(token1.address);
          assert.equal(priceOracles.length, 2);
          assert.equal(priceOracles[0], oracle);
          assert.equal(priceOracles[1], unknown);
        });
      });
      describe('when the caller is an other price oracle', function () {
        it('sets the operators as token price oracle', async function () {
          let priceOracles = await dvp.priceOracles(token1.address);
          assert.equal(priceOracles.length, 0);

          await dvp.setPriceOracles(token1.address, [oracle], {
            from: tokenHolder1
          });

          priceOracles = await dvp.priceOracles(token1.address);
          assert.equal(priceOracles.length, 1);
          assert.equal(priceOracles[0], oracle);

          await dvp.setPriceOracles(token1.address, [oracle, unknown], {
            from: oracle
          });

          priceOracles = await dvp.priceOracles(token1.address);
          assert.equal(priceOracles.length, 2);
          assert.equal(priceOracles[0], oracle);
          assert.equal(priceOracles[1], unknown);
        });
      });
      describe('when the caller is neither the token contract owner nor a token price oracle', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            dvp.setPriceOracles(token1.address, [oracle, unknown], {
              from: tokenHolder2
            })
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
        dvp = await DVPContract.new(false);

        token1 = await ERC20.new('ERC20Token', 'DAU', 18, { from: owner });
        await dvp.setPriceOracles(token1.address, [oracle], {
          from: owner
        });

        token2 = await ERC20.new('ERC20Token', 'DAU', 18, { from: owner });
        await dvp.setPriceOracles(token2.address, [unknown], {
          from: owner
        });
      });
      describe('when sender is price oracle of the token', function () {
        it('takes the price ownership for a given token', async function () {
          assert.equal(
            await dvp.getPriceOwnership(token1.address, token2.address),
            false
          );

          await dvp.setPriceOwnership(token1.address, token2.address, true, {
            from: oracle
          });
          assert.equal(
            await dvp.getPriceOwnership(token1.address, token2.address),
            true
          );

          await dvp.setPriceOwnership(token1.address, token2.address, false, {
            from: oracle
          });
          assert.equal(
            await dvp.getPriceOwnership(token1.address, token2.address),
            false
          );
        });
      });
      describe('when sender is not price oracle of the token', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            dvp.setPriceOwnership(token1.address, token2.address, true, {
              from: unknown
            })
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
        dvp = await DVPContract.new(false);

        token1 = await ERC20.new('ERC20Token', 'DAU', 18, { from: owner });
        await dvp.setPriceOracles(token1.address, [oracle], {
          from: owner
        });

        token2 = await ERC20.new('ERC20Token', 'DAU', 18, { from: owner });
        await dvp.setPriceOracles(token2.address, [unknown], {
          from: owner
        });
      });
      describe('when there is no competition on the price ownership', function () {
        describe('when the price ownership is taken', function () {
          describe('when the price ownership is taken by the right person', function () {
            it('sets the price for token1', async function () {
              await dvp.setPriceOwnership(
                token1.address,
                token2.address,
                true,
                { from: oracle }
              );
              assert.equal(
                await dvp.getPriceOwnership(token1.address, token2.address),
                true
              );
              assert.equal(
                await dvp.getPriceOwnership(token2.address, token1.address),
                false
              );

              assert.equal(
                await dvp.getTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2
                ),
                0
              );
              await dvp.setTokenPrice(
                token1.address,
                token2.address,
                partition1,
                partition2,
                newTokenPrice,
                { from: oracle }
              );
              assert.equal(
                await dvp.getTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2
                ),
                newTokenPrice
              );
            });
            it('sets the price for token2', async function () {
              await dvp.setPriceOwnership(
                token2.address,
                token1.address,
                true,
                { from: unknown }
              );
              assert.equal(
                await dvp.getPriceOwnership(token1.address, token2.address),
                false
              );
              assert.equal(
                await dvp.getPriceOwnership(token2.address, token1.address),
                true
              );

              assert.equal(
                await dvp.getTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2
                ),
                0
              );
              await dvp.setTokenPrice(
                token1.address,
                token2.address,
                partition1,
                partition2,
                newTokenPrice,
                { from: unknown }
              );
              assert.equal(
                await dvp.getTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2
                ),
                newTokenPrice
              );
            });
          });
          describe('when the price ownership is not taken by the right person', function () {
            it('reverts', async function () {
              await dvp.setPriceOwnership(
                token1.address,
                token2.address,
                true,
                { from: oracle }
              );
              assert.equal(
                await dvp.getPriceOwnership(token1.address, token2.address),
                true
              );
              assert.equal(
                await dvp.getPriceOwnership(token2.address, token1.address),
                false
              );

              await expectRevert.unspecified(
                dvp.setTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2,
                  newTokenPrice,
                  { from: unknown }
                )
              );
            });
            it('reverts', async function () {
              await dvp.setPriceOwnership(
                token2.address,
                token1.address,
                true,
                { from: unknown }
              );
              assert.equal(
                await dvp.getPriceOwnership(token1.address, token2.address),
                false
              );
              assert.equal(
                await dvp.getPriceOwnership(token2.address, token1.address),
                true
              );

              await expectRevert.unspecified(
                dvp.setTokenPrice(
                  token1.address,
                  token2.address,
                  partition1,
                  partition2,
                  newTokenPrice,
                  { from: oracle }
                )
              );
            });
          });
        });
        describe('when the price ownership is not taken', function () {
          it('sets the price for token1', async function () {
            await expectRevert.unspecified(
              dvp.setTokenPrice(
                token1.address,
                token2.address,
                partition1,
                partition2,
                newTokenPrice,
                { from: oracle }
              )
            );
          });
        });
      });
      describe('when there is competition on the price ownership', function () {
        beforeEach(async function () {
          await dvp.setPriceOwnership(token1.address, token2.address, true, {
            from: oracle
          });
          await dvp.setPriceOwnership(token2.address, token1.address, true, {
            from: unknown
          });
        });
        it('reverts', async function () {
          await expectRevert.unspecified(
            dvp.setTokenPrice(
              token1.address,
              token2.address,
              partition1,
              partition2,
              newTokenPrice,
              { from: oracle }
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
        dvp = await DVPContract.new(false);

        token1 = await ERC20.new('ERC20Token', 'DAU', 18, { from: owner });
        await dvp.setPriceOracles(token1.address, [oracle], {
          from: owner
        });
      });
      describe('when sender is price oracle of the token', function () {
        describe('when start date is further than a week', function () {
          it('sets the variable price start date for a given token', async function () {
            let chainTime = (await web3.eth.getBlock('latest')).timestamp;
            let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
            assert.equal(await dvp.variablePriceStartDate(token1.address), 0);

            await dvp.setVariablePriceStartDate(
              token1.address,
              variablePriceStartDate,
              { from: oracle }
            );
            assert.equal(
              await dvp.variablePriceStartDate(token1.address),
              variablePriceStartDate
            );

            await dvp.setVariablePriceStartDate(token1.address, 0, {
              from: oracle
            });
            assert.equal(await dvp.variablePriceStartDate(token1.address), 0);
          });
        });
        describe('when start date is not further than a week', function () {
          it('reverts', async function () {
            let chainTime = (await web3.eth.getBlock('latest')).timestamp;
            let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK - 1;
            await expectRevert.unspecified(
              dvp.setVariablePriceStartDate(
                token1.address,
                variablePriceStartDate,
                { from: oracle }
              )
            );
          });
        });
      });
      describe('when sender is not price oracle of the token', function () {
        it('reverts', async function () {
          let chainTime = (await web3.eth.getBlock('latest')).timestamp;
          let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
          await expectRevert.unspecified(
            dvp.setVariablePriceStartDate(
              token1.address,
              variablePriceStartDate,
              { from: unknown }
            )
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
      let token1, token2: ERC1400;
      beforeEach(async function () {
        dvp = await DVPContract.new(false);

        token1 = await ERC1400.new(
          'ERC1400Token',
          'DAU',
          1,
          [owner],
          partitions,
          { from: owner }
        );
        await token1.issueByPartition(
          partition1,
          tokenHolder1,
          issuanceAmount,
          MOCK_CERTIFICATE,
          { from: owner }
        );
        await dvp.setPriceOracles(token1.address, [oracle], {
          from: owner
        });

        token2 = await ERC1400.new(
          'ERC1400Token',
          'DAU',
          1,
          [owner],
          partitions,
          { from: owner }
        );
        await token2.issueByPartition(
          partition2,
          recipient1,
          issuanceAmount,
          MOCK_CERTIFICATE,
          { from: owner }
        );
        await dvp.setPriceOracles(token2.address, [unknown], {
          from: owner
        });

        // Create and accept a first trade
        let chainTime = (await web3.eth.getBlock('latest')).timestamp;
        let expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
        let tradeProposalData = getTradeProposalData(
          recipient1,
          executer,
          expirationDate,
          0,
          token2.address,
          token2Amount,
          partition2,
          ERC1400STANDARD,
          TYPE_ESCROW
        );
        await token1.operatorTransferByPartition(
          partition1,
          tokenHolder1,
          dvp.address,
          token1Amount,
          tradeProposalData,
          MOCK_CERTIFICATE,
          { from: tokenHolder1 }
        );
        let tradeAcceptanceData = getTradeAcceptanceData(1);
        await token2.operatorTransferByPartition(
          partition2,
          recipient1,
          dvp.address,
          token2Amount,
          tradeAcceptanceData,
          MOCK_CERTIFICATE,
          { from: recipient1 }
        );

        let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
        assert.equal(await dvp.variablePriceStartDate(token1.address), 0);

        await dvp.setVariablePriceStartDate(
          token1.address,
          variablePriceStartDate,
          { from: oracle }
        );
      });
      describe('when the variable price start date has been set', function () {
        beforeEach(async function () {
          let chainTime = (await web3.eth.getBlock('latest')).timestamp;
          let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
          await dvp.setVariablePriceStartDate(
            token1.address,
            variablePriceStartDate,
            { from: oracle }
          );
          // Wait for 1 week
          await advanceTimeAndBlock(SECONDS_IN_A_WEEK + 100);
        });
        describe('when there is no competition on the price ownership', function () {
          describe('when the price ownership is taken', function () {
            describe('when the first token has more value than the second token', function () {
              describe('when the price ownership is taken for the first token', function () {
                beforeEach(async function () {
                  await dvp.setPriceOwnership(
                    token1.address,
                    token2.address,
                    true,
                    { from: oracle }
                  );
                });
                describe('when the price is set (case 1)', function () {
                  const multiple2 = 2;
                  beforeEach(async function () {
                    await dvp.setTokenPrice(
                      token1.address,
                      token2.address,
                      ALL_PARTITIONS,
                      ALL_PARTITIONS,
                      multiple2,
                      { from: oracle }
                    );
                  });
                  it('returns the updatedprice', async function () {
                    assert.equal(
                      await dvp.getPrice(1),
                      multiple2 * token1Amount
                    );
                  });
                  describe('when the price is set (case 2)', function () {
                    const multiple3 = 3;
                    beforeEach(async function () {
                      await dvp.setTokenPrice(
                        token1.address,
                        token2.address,
                        ALL_PARTITIONS,
                        partition2,
                        multiple3,
                        { from: oracle }
                      );
                    });
                    it('returns the updatedprice', async function () {
                      assert.equal(
                        await dvp.getPrice(1),
                        multiple3 * token1Amount
                      );
                    });
                    describe('when the price is set (case 3)', function () {
                      const multiple4 = 4;
                      beforeEach(async function () {
                        await dvp.setTokenPrice(
                          token1.address,
                          token2.address,
                          partition1,
                          ALL_PARTITIONS,
                          multiple4,
                          { from: oracle }
                        );
                      });
                      it('returns the updatedprice', async function () {
                        assert.equal(
                          await dvp.getPrice(1),
                          multiple4 * token1Amount
                        );
                      });
                      describe('when the price is set (case 4)', function () {
                        const multiple5 = 5;
                        beforeEach(async function () {
                          await dvp.setTokenPrice(
                            token1.address,
                            token2.address,
                            partition1,
                            partition2,
                            multiple5,
                            { from: oracle }
                          );
                        });
                        it('returns the updatedprice', async function () {
                          assert.equal(
                            await dvp.getPrice(1),
                            multiple5 * token1Amount
                          );
                        });
                        it('executes the trade at correct price', async function () {
                          await assertBalanceOfByPartition(
                            token1,
                            tokenHolder1,
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
                            recipient1,
                            partition1,
                            0
                          );
                          await assertBalanceOfByPartition(
                            token2,
                            recipient1,
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
                            tokenHolder1,
                            partition2,
                            0
                          );
                          await dvp.executeTrade(1, { from: executer });
                          await assertBalanceOfByPartition(
                            token1,
                            tokenHolder1,
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
                            recipient1,
                            partition1,
                            token1Amount
                          );
                          await assertBalanceOfByPartition(
                            token2,
                            recipient1,
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
                            tokenHolder1,
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
                    assert.equal(await dvp.getPrice(1), token2Amount);
                  });
                });
              });
              describe('when the price ownership is taken for the second token', function () {
                beforeEach(async function () {
                  await dvp.setPriceOwnership(
                    token2.address,
                    token1.address,
                    true,
                    { from: unknown }
                  );
                });
                describe('when the price is set (case 1)', function () {
                  const multiple2 = 2;
                  beforeEach(async function () {
                    await dvp.setTokenPrice(
                      token1.address,
                      token2.address,
                      ALL_PARTITIONS,
                      ALL_PARTITIONS,
                      multiple2,
                      { from: unknown }
                    );
                  });
                  it('returns the updatedprice', async function () {
                    assert.equal(
                      await dvp.getPrice(1),
                      multiple2 * token1Amount
                    );
                  });
                });
              });
            });
            describe('when the second token has more value than the first token', function () {
              let token3, token4: ERC1400;
              beforeEach(async function () {
                token3 = await ERC1400.new(
                  'ERC1400Token',
                  'DAU',
                  1,
                  [owner],
                  partitions,
                  { from: owner }
                );
                await token3.issueByPartition(
                  partition1,
                  tokenHolder1,
                  issuanceAmount,
                  MOCK_CERTIFICATE,
                  { from: owner }
                );
                await dvp.setPriceOracles(token3.address, [oracle], {
                  from: owner
                });

                token4 = await ERC1400.new(
                  'ERC1400Token',
                  'DAU',
                  1,
                  [owner],
                  partitions,
                  { from: owner }
                );
                await token4.issueByPartition(
                  partition2,
                  recipient1,
                  issuanceAmount,
                  MOCK_CERTIFICATE,
                  { from: owner }
                );
                await dvp.setPriceOracles(token4.address, [unknown], {
                  from: owner
                });

                // Create and accept a second trade
                const chainTime = (await web3.eth.getBlock('latest')).timestamp;
                const expirationDate = chainTime + 2 * SECONDS_IN_A_WEEK;
                const tradeProposalData = getTradeProposalData(
                  recipient1,
                  executer,
                  expirationDate,
                  0,
                  token4.address,
                  token4Amount,
                  partition2,
                  ERC1400STANDARD,
                  TYPE_ESCROW
                );
                await token3.operatorTransferByPartition(
                  partition1,
                  tokenHolder1,
                  dvp.address,
                  token3Amount,
                  tradeProposalData,
                  MOCK_CERTIFICATE,
                  { from: tokenHolder1 }
                );
                const tradeAcceptanceData = getTradeAcceptanceData(2);
                await token4.operatorTransferByPartition(
                  partition2,
                  recipient1,
                  dvp.address,
                  token4Amount,
                  tradeAcceptanceData,
                  MOCK_CERTIFICATE,
                  { from: recipient1 }
                );

                let variablePriceStartDate = chainTime + SECONDS_IN_A_WEEK + 10;
                await dvp.setVariablePriceStartDate(
                  token3.address,
                  variablePriceStartDate,
                  { from: oracle }
                );
                // Wait for 1 week
                await advanceTimeAndBlock(SECONDS_IN_A_WEEK + 100);
              });
              describe('when the price ownership is taken for the first token', function () {
                beforeEach(async function () {
                  await dvp.setPriceOwnership(
                    token3.address,
                    token4.address,
                    true,
                    { from: oracle }
                  );
                });
                describe('when the price is set (case 1)', function () {
                  const multiple2 = 2;
                  beforeEach(async function () {
                    await dvp.setTokenPrice(
                      token4.address,
                      token3.address,
                      ALL_PARTITIONS,
                      ALL_PARTITIONS,
                      multiple2,
                      { from: oracle }
                    );
                  });
                  it('returns the updatedprice', async function () {
                    assert.equal(
                      await dvp.getPrice(2),
                      Math.round(token3Amount / multiple2)
                    );
                  });
                  describe('when the price is set (case 2)', function () {
                    const multiple3 = 3;
                    beforeEach(async function () {
                      await dvp.setTokenPrice(
                        token4.address,
                        token3.address,
                        partition2,
                        ALL_PARTITIONS,
                        multiple3,
                        { from: oracle }
                      );
                    });
                    it('returns the updatedprice', async function () {
                      assert.equal(
                        await dvp.getPrice(2),
                        Math.round(token3Amount / multiple3)
                      );
                    });
                    describe('when the price is set (case 3)', function () {
                      const multiple4 = 4;
                      beforeEach(async function () {
                        await dvp.setTokenPrice(
                          token4.address,
                          token3.address,
                          ALL_PARTITIONS,
                          partition1,
                          multiple4,
                          { from: oracle }
                        );
                      });
                      it('returns the updatedprice', async function () {
                        assert.equal(
                          await dvp.getPrice(2),
                          Math.round(token3Amount / multiple4)
                        );
                      });
                      describe('when the price is set (case 4)', function () {
                        const multiple5 = 5;
                        beforeEach(async function () {
                          await dvp.setTokenPrice(
                            token4.address,
                            token3.address,
                            partition2,
                            partition1,
                            multiple5,
                            { from: oracle }
                          );
                        });
                        it('returns the updatedprice', async function () {
                          assert.equal(
                            await dvp.getPrice(2),
                            Math.round(token3Amount / multiple5)
                          );
                        });
                        it('reverts when price is higher than amount escrowed/authorized', async function () {
                          await assertBalanceOfByPartition(
                            token3,
                            tokenHolder1,
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
                            recipient1,
                            partition1,
                            0
                          );
                          await assertBalanceOfByPartition(
                            token4,
                            recipient1,
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
                            tokenHolder1,
                            partition2,
                            0
                          );
                          await expectRevert.unspecified(
                            dvp.executeTrade(2, { from: executer })
                          );
                          // await assertBalanceOfByPartition(token3, tokenHolder1, partition1, issuanceAmount - token3Amount);
                          // await assertBalanceOfByPartition(token3, dvp.address, partition1, 0);
                          // await assertBalanceOfByPartition(token3, recipient1, partition1, token3Amount);
                          // await assertBalanceOfByPartition(token4, recipient1, partition2, issuanceAmount - Math.round(token3Amount/multiple5));
                          // await assertBalanceOfByPartition(token4, dvp.address, partition2, 0);
                          // await assertBalanceOfByPartition(token4, tokenHolder1, partition2, Math.round(token3Amount/multiple5));
                        });
                      });
                    });
                  });
                });
                describe('when the price is not set', function () {
                  it('returns the price defined in the trade', async function () {
                    assert.equal(await dvp.getPrice(2), token4Amount);
                  });
                });
              });
              describe('when the price ownership is taken for the second token', function () {
                beforeEach(async function () {
                  await dvp.setPriceOwnership(
                    token4.address,
                    token3.address,
                    true,
                    { from: unknown }
                  );
                });
                describe('when the price is set (case 1)', function () {
                  const multiple2 = 2;
                  beforeEach(async function () {
                    await dvp.setTokenPrice(
                      token4.address,
                      token3.address,
                      ALL_PARTITIONS,
                      ALL_PARTITIONS,
                      multiple2,
                      { from: unknown }
                    );
                  });
                  it('returns the updatedprice', async function () {
                    assert.equal(
                      await dvp.getPrice(2),
                      token3Amount / multiple2
                    );
                  });
                });
              });
            });
          });
          describe('when the price ownership is not taken', function () {
            it('returns the price defined in the trade', async function () {
              assert.equal(await dvp.getPrice(1), token2Amount);
            });
          });
        });
        describe('when there is competition on the price ownership', function () {
          beforeEach(async function () {
            await dvp.setPriceOwnership(token1.address, token2.address, true, {
              from: oracle
            });
            await dvp.setPriceOwnership(token2.address, token1.address, true, {
              from: unknown
            });
          });
          it('reverts', async function () {
            await expectRevert.unspecified(dvp.getPrice(1));
          });
        });
      });
      describe('when the variable price start date has been set', function () {
        it('returns the non-updated price', async function () {
          await dvp.setPriceOwnership(token1.address, token2.address, true, {
            from: oracle
          });
          const multiple2 = 2;
          await dvp.setTokenPrice(
            token1.address,
            token2.address,
            ALL_PARTITIONS,
            ALL_PARTITIONS,
            multiple2,
            { from: oracle }
          );
          assert.equal(await dvp.getPrice(1), token2Amount);
        });
      });
    });
  }
);
