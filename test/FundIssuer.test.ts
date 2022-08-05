/**
 ***************************************************************************************************************
 **************************************** CAUTION: work in progress ********************************************
 ***************************************************************************************************************
 *
 * CAUTION: This contract is a work in progress, tests are not finalized yet!
 *
 ***************************************************************************************************************
 **************************************** CAUTION: work in progress ********************************************
 ***************************************************************************************************************
 */

import { ethers } from 'hardhat';
import { assert } from 'chai';
import { advanceTimeAndBlock } from './utils/time';
// @ts-ignore
import { expectRevert } from '@openzeppelin/test-helpers';
import {
  FundIssuer,
  ERC1400,
  ERC1820Registry,
  ERC1820Registry__factory,
  ERC1400__factory,
  FundIssuer__factory
} from '../typechain-types';
import { BytesLike, Signer } from 'ethers';
import {
  assertAssetRules,
  assertCycle,
  assertCycleAssetValue,
  assertCycleState,
  assertOrder,
  ZERO_ADDRESS,
  ZERO_BYTE,
  ZERO_BYTES32
} from './utils/assert';
import { addressToBytes32, numTostringBytes32 } from './utils/bytes';
import truffleFixture from './truffle-fixture';
import { getSigners } from './common/wallet';

const ERC1400_TOKENS_RECIPIENT_INTERFACE = 'ERC1400TokensRecipient';

const CYCLE_UNDEFINED = 0;
const CYCLE_SUBSCRIPTION = 1;
const CYCLE_VALUATION = 2;
const CYCLE_PAYMENT = 3;
const CYCLE_SETTLEMENT = 4;
const CYCLE_FINALIZED = 5;

const ORDER_UNDEFINED = 0;
const ORDER_SUBSCRIBED = 1;
const ORDER_PAID = 2;
const ORDER_PAIDSETTLED = 3;
const ORDER_UNPAIDSETTLED = 4;
const ORDER_CANCELLED = 5;
const ORDER_REJECTED = 6;

const TYPE_UNDEFINED = 0;
const TYPE_VALUE = 1;
const TYPE_AMOUNT = 2;

const NEW_CYCLE_CREATED_TRUE = true;
const NEW_CYCLE_CREATED_FALSE = false;

const INIT_RULES_TRUE = true;
const INIT_RULES_FALSE = false;

// const OFFCHAIN_BYTE = '00';
// const ERC20STANDARD_BYTE = '01';
// const ERC1400STANDARD_BYTE = '02';

// const mapStandardToByte = {};
// mapStandardToByte[OFFCHAIN] = OFFCHAIN_BYTE;
// mapStandardToByte[ERC20STANDARD] = OFFCHAIN_BYTE;
// mapStandardToByte[ERC1400STANDARD] = OFFCHAIN_BYTE;

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const VALID_CERTIFICATE =
  '0x1000000000000000000000000000000000000000000000000000000000000000';

const partition0 =
  '0x0000000000000000000000000000000000000000000000000000000000000000'; // Empty hex

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
// const INMOCK_CERTIFICATE = '0x0000000000000000000000000000000000000000000000000000000000000000';

const orderCreationFlag =
  '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const orderPaymentFlag =
  '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'; // Flag to indicate a partition change
const partitionFlag =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'; // Flag to indicate a partition change
const bypassFlag =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const ERC1820_ACCEPT_MAGIC = ethers.utils.id('ERC1820_ACCEPT_MAGIC');

const OFF_CHAIN_PAYMENT = 0;
const ETH_PAYMENT = 1;
const ERC20_PAYMENT = 2;
const ERC1400_PAYMENT = 3;

const ASSET_VALUE_UNKNOWN = 0;
const ASSET_VALUE_KNOWN = 1;

const STATE_PENDING = 1;
const STATE_EXECUTED = 2;
const STATE_FORCED = 3;
const STATE_CANCELLED = 4;

const TYPE_ESCROW = 0;
const TYPE_SWAP = 1;

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

const DEFAULT_SUBSCRIPTION_PERIOD_LENGTH = SECONDS_IN_A_WEEK;
const DEFAULT_VALUATION_PERIOD_LENGTH = SECONDS_IN_A_WEEK;
const DEFAULT_PAYMENT_PERIOD_LENGTH = SECONDS_IN_A_WEEK;

const getOrderCreationData = (
  _assetAddress: any,
  _assetClass: string,
  _orderValue: number,
  _orderAmount: number,
  _orderType: number,
  isFake: boolean = false
) => {
  const flag = isFake ? partitionFlag : orderCreationFlag;
  const hexAssetAddress = addressToBytes32(_assetAddress);

  const hexAssetClass = _assetClass.substring(2);

  const hexOrderValue = numTostringBytes32(_orderValue);
  const hexOrderAmount = numTostringBytes32(_orderAmount);
  const hexOrderType = ethers.utils.hexlify(_orderType).substring(2);
  const orderData = `${hexOrderValue}${hexOrderAmount}${hexOrderType}`;

  return `${flag}${hexAssetAddress}${hexAssetClass}${orderData}`;
};

const getOrderPaymentData = (orderIndex: number, isFake: boolean = false) => {
  const flag = isFake ? partitionFlag : orderPaymentFlag;
  const hexOrderIndex = numTostringBytes32(orderIndex);

  return `${flag}${hexOrderIndex}`;
};

const setAssetRules = async (
  _contract: FundIssuer,
  _issuerSigner: Signer,
  _assetAddress: string,
  _assetClass: string,
  _firstStartTime: number | undefined,
  _subscriptionPeriodLength: number | undefined,
  _valuationPeriodLength: number | undefined,
  _paymentPeriodLength: number | undefined,
  _paymentType: number,
  _paymentAddress: string,
  _paymentPartition: BytesLike,
  _fundAddress: string,
  _subscriptionsOpened: boolean
) => {
  const chainTime = (await ethers.provider.getBlock('latest')).timestamp;
  const firstStartTime = _firstStartTime || chainTime + 20;
  const subscriptionPeriodLength =
    _subscriptionPeriodLength || DEFAULT_SUBSCRIPTION_PERIOD_LENGTH;
  const valuationPeriodLength =
    _valuationPeriodLength || DEFAULT_VALUATION_PERIOD_LENGTH;
  const paymentPeriodLength =
    _paymentPeriodLength || DEFAULT_PAYMENT_PERIOD_LENGTH;

  await _contract
    .connect(_issuerSigner)
    .setAssetRules(
      _assetAddress,
      _assetClass,
      firstStartTime,
      subscriptionPeriodLength,
      valuationPeriodLength,
      paymentPeriodLength,
      _paymentType,
      _paymentAddress,
      _paymentPartition,
      _fundAddress,
      _subscriptionsOpened
    );

  await assertAssetRules(
    _contract,
    _assetAddress,
    _assetClass,
    firstStartTime,
    subscriptionPeriodLength,
    valuationPeriodLength,
    paymentPeriodLength,
    ASSET_VALUE_UNKNOWN,
    0,
    0,
    _paymentType,
    _paymentAddress,
    _paymentPartition,
    _fundAddress,
    _subscriptionsOpened
  );

  // Wait for 10 seconds, in order to be after the first start time (set to "chainTime + 1" by default)
  await advanceTimeAndBlock(30);
};

const subscribe = async (
  _contract: FundIssuer,
  _assetAddress: string,
  _assetClass: string,
  _value: number,
  _amount: number,
  _orderType: number,
  _investorSigner: Signer,
  _setAssetRules: boolean,
  _issuerSigner: Signer,
  _fundAddress: string,
  _newCycle: boolean
) => {
  if (_setAssetRules) {
    await setAssetRules(
      _contract,
      _issuerSigner,
      _assetAddress,
      _assetClass,
      undefined,
      undefined,
      undefined,
      undefined,
      OFF_CHAIN_PAYMENT,
      ZERO_ADDRESS,
      ZERO_BYTES32,
      _fundAddress,
      true
    );
  }

  const initialNumberOfCycles = (await _contract.getNbCycles()).toNumber();
  const initialIndexOfAssetCycle = (
    await _contract.getLastCycleIndex(_assetAddress, _assetClass)
  ).toNumber();

  const initialNumberOfOrders = (await _contract.getNbOrders()).toNumber();
  const initialInvestorOrders = await _contract.getInvestorOrders(
    _investorSigner.getAddress()
  );

  await _contract.connect(_investorSigner).subscribe(
    _assetAddress,
    _assetClass,
    _value,
    _amount,
    _orderType,
    false // executePaymentAtSubscription
  );

  const currentNumberOfCycles = (await _contract.getNbCycles()).toNumber();
  const currentIndexOfAssetCycle = (
    await _contract.getLastCycleIndex(_assetAddress, _assetClass)
  ).toNumber();

  if (_newCycle) {
    assert.equal(currentNumberOfCycles, initialNumberOfCycles + 1);
    assert.equal(currentIndexOfAssetCycle, initialNumberOfCycles + 1);
  } else {
    assert.equal(currentNumberOfCycles, initialNumberOfCycles);
    assert.equal(currentIndexOfAssetCycle, initialIndexOfAssetCycle);
  }

  const currentNumberOfOrders = (await _contract.getNbOrders()).toNumber();
  const currentInvestorOrders = await _contract.getInvestorOrders(
    _investorSigner.getAddress()
  );
  assert.equal(currentNumberOfOrders, initialNumberOfOrders + 1);
  assert.equal(currentInvestorOrders.length, initialInvestorOrders.length + 1);

  const cycleIndex = (
    await _contract.getLastCycleIndex(_assetAddress, _assetClass)
  ).toNumber();

  await assertOrder(
    _contract,
    currentInvestorOrders[currentInvestorOrders.length - 1].toNumber(),
    cycleIndex,
    await _investorSigner.getAddress(),
    _value,
    _amount,
    _orderType,
    ORDER_SUBSCRIBED
  );
};

const launchCycleForAssetClass = async (
  _contract: any,
  _assetAddress: any,
  _assetClass: any,
  _firstStartTime: any,
  _subscriptionPeriodLength: number,
  _valuationPeriodLength: number,
  _paymentPeriodLength: number,
  _paymentType: any,
  _paymentAddress: any,
  _paymentPartition: any,
  _subscriptionsOpened: any
) => {
  const chainTime = (await ethers.provider.getBlock('latest')).timestamp;
  const firstStartTime = _firstStartTime || chainTime;
  const subscriptionPeriodLength =
    _subscriptionPeriodLength || SECONDS_IN_A_WEEK;
  const valuationPeriodLength = _valuationPeriodLength || SECONDS_IN_A_WEEK;
  const paymentPeriodLength = _paymentPeriodLength || SECONDS_IN_A_WEEK;

  const initialNumberOfCycles = (await _contract.getNbCycles()).toNumber();
  const initialNumberOfAssetCycles = (
    await _contract.getLastCycleIndex(_assetAddress, _assetClass)
  ).toNumber();

  await _contract.setAssetRules(
    _assetAddress,
    _assetClass,
    firstStartTime,
    subscriptionPeriodLength,
    valuationPeriodLength,
    paymentPeriodLength,
    _paymentType,
    _paymentAddress,
    _paymentPartition,
    _subscriptionsOpened
  );

  const currentNumberOfCycles = (await _contract.getNbCycles()).toNumber();
  const currentNumberOfAssetCycles = (
    await _contract.getLastCycleIndex(_assetAddress, _assetClass)
  ).toNumber();
  assert.equal(currentNumberOfCycles, initialNumberOfCycles + 1);
  assert.equal(initialNumberOfAssetCycles, currentNumberOfAssetCycles + 1);

  await assertCycle(
    _contract,
    currentNumberOfAssetCycles,
    _assetAddress,
    _assetClass,
    firstStartTime,
    subscriptionPeriodLength,
    valuationPeriodLength,
    paymentPeriodLength,
    _paymentType,
    _paymentAddress,
    _paymentPartition,
    false
  );
};

describe('Fund issuance', function () {
  const signers = getSigners(10);
  const [
    signer,
    tokenController1Signer,
    tokenController2Signer,
    fundSigner,
    oracleSigner,
    tokenHolder1Signer,
    tokenHolder2Signer,
    recipient1Signer,
    recipient2Signer,
    unknownSigner
  ] = signers;
  const [
    owner,
    tokenController1,
    tokenController2,
    fund,
    oracle,
    tokenHolder1,
    tokenHolder2,
    recipient1,
    recipient2,
    unknown
  ] = signers.map((s) => s.address);

  let registry: ERC1820Registry;

  before(async function () {
    await truffleFixture([2]);

    registry = ERC1820Registry__factory.deployed;
  });

  // EXECUTEPAYMENTASINVESTOR

  describe('executePaymentAsInvestor', function () {
    let fic: FundIssuer;
    let asset: ERC1400;
    let assetValue: number;
    beforeEach(async function () {
      asset = await new ERC1400__factory(tokenController1Signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [owner],
        partitions
      );
      fic = await new FundIssuer__factory(signer).deploy();

      assetValue = 1000;

      // await setAssetRules(
      //   fic,
      //   tokenController1,
      //   asset.address,
      //   partition1,
      //   undefined,
      //   undefined,
      //   undefined,
      //   undefined,
      //   _paymentType,
      //   _paymentAddress,
      //   _paymentPartition,
      //   fund,
      //   true
      // );
    });
    describe('when function is called by the investor', function () {
      describe('when payment is made with ether', function () {
        beforeEach(async function () {
          await setAssetRules(
            fic,
            tokenController1Signer,
            asset.address,
            partition1,
            undefined,
            undefined,
            undefined,
            undefined,
            ETH_PAYMENT,
            ZERO_ADDRESS,
            ZERO_BYTES32,
            fund,
            true
          );

          await subscribe(
            fic,
            asset.address,
            partition1,
            0,
            1000,
            TYPE_AMOUNT,
            tokenHolder1Signer,
            INIT_RULES_FALSE,
            tokenController1Signer,
            fund,
            NEW_CYCLE_CREATED_TRUE
          );
        });
        describe('when asset value is of type Unknown', function () {
          describe('when cycle is at least in payment period', function () {
            beforeEach(async function () {
              await assertCycleState(
                fic,
                asset.address,
                partition1,
                CYCLE_SUBSCRIPTION
              );

              // Wait until after the end of the first subscription period
              await advanceTimeAndBlock(DEFAULT_SUBSCRIPTION_PERIOD_LENGTH + 1);
              await assertCycleState(
                fic,
                asset.address,
                partition1,
                CYCLE_VALUATION
              );

              const cycleIndex = (
                await fic.getLastCycleIndex(asset.address, partition1)
              ).toNumber();
              await fic
                .connect(tokenController1Signer)
                .valuate(cycleIndex, assetValue, 0);
              await assertCycleAssetValue(
                fic,
                cycleIndex,
                ASSET_VALUE_UNKNOWN,
                assetValue,
                0
              );

              // Wait until after the end of the first valuation period
              await advanceTimeAndBlock(DEFAULT_VALUATION_PERIOD_LENGTH + 1);
              await assertCycleState(
                fic,
                asset.address,
                partition1,
                CYCLE_PAYMENT
              );
            });
            describe('when order is of type amount', function () {
              describe('when asset value is not nil', function () {
                describe('when payment is not bypassed', function () {
                  describe('when payment value is correct', function () {
                    describe('when order state is Subscribed', function () {
                      it('updates the order state to Paid', async function () {
                        const currentInvestorOrders =
                          await fic.getInvestorOrders(tokenHolder1);
                        const orderIndex =
                          currentInvestorOrders[
                            currentInvestorOrders.length - 1
                          ].toNumber();
                        const amountAndValue = await fic.getOrderAmountAndValue(
                          orderIndex
                        );

                        const amount = amountAndValue[0].toNumber();
                        const value = amountAndValue[1].toNumber();

                        await assertOrder(
                          fic,
                          orderIndex,
                          1,
                          tokenHolder1,
                          0,
                          amount,
                          TYPE_AMOUNT,
                          ORDER_SUBSCRIBED
                        );

                        await fic
                          .connect(tokenHolder1Signer)
                          .executePaymentAsInvestor(orderIndex, {
                            value: value
                          });

                        await assertOrder(
                          fic,
                          orderIndex,
                          1,
                          tokenHolder1,
                          value,
                          amount,
                          TYPE_AMOUNT,
                          ORDER_PAID
                        );
                      });
                    });
                    describe('when order state is UnpaidSettled', function () {
                      describe('when cycle is not finalized', function () {
                        it('reverts', async function () {});
                      });
                      describe('when cycle is finalized', function () {
                        it('reverts', async function () {});
                      });
                    });
                    describe('when order state is neither Subscribed nor UnpaidSettled', function () {
                      it('reverts', async function () {});
                    });
                  });
                  describe('when payment value is not correct', function () {
                    it('reverts', async function () {});
                  });
                });
                describe('when payment is bypassed', function () {
                  it('reverts', async function () {});
                });
              });
              describe('when reverse asset value is not nil', function () {
                it('reverts', async function () {});
              });
            });
            describe('when order is of type value', function () {
              describe('when asset value is not nil', function () {
                it('reverts', async function () {});
              });
              describe('when reverse asset value is not nil', function () {
                it('reverts', async function () {});
              });
            });
          });
          describe('when cycle is not at least in payment period', function () {
            it('reverts', async function () {});
          });
        });
        describe('when asset value is of type Known', function () {
          describe('when cycle is at least in subscription period', function () {
            it('reverts', async function () {});
          });
          describe('when cycle is not at least in subscription period', function () {
            it('reverts', async function () {});
          });
        });
      });
      describe('when payment is made with erc20', function () {
        describe('when payment value is correct', function () {
          it('reverts', async function () {});
        });
        describe('when payment value is not correct', function () {
          it('reverts', async function () {});
        });
      });
      describe('when payment is made with erc1400 through allowance', function () {
        describe('when payment value is correct', function () {
          it('reverts', async function () {});
        });
        describe('when payment value is not correct', function () {
          it('reverts', async function () {});
        });
      });
      describe('when payment is made with erc1400 through hook', function () {
        describe('when payment value is correct', function () {
          describe('when payment succeeds', function () {
            it('reverts', async function () {});
          });
          describe('when payment type is not correct', function () {
            it('reverts', async function () {});
          });
          describe('when payment address is not correct', function () {
            it('reverts', async function () {});
          });
          describe('when payment partition is not correct', function () {
            it('reverts', async function () {});
          });
        });
        describe('when payment value is not correct', function () {
          it('reverts', async function () {});
        });
      });
      describe('when payment is done off-chain', function () {
        it('reverts', async function () {});
      });
    });
    describe('when function is not called by the investor', function () {
      it('reverts', async function () {});
    });
  });

  // REJECTORDER

  describe('rejectOrder', function () {
    let asset: ERC1400;
    let fic: FundIssuer;
    beforeEach(async function () {
      asset = await new ERC1400__factory(tokenController1Signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [owner],
        partitions
      );
      fic = await new FundIssuer__factory(signer).deploy();
      await subscribe(
        fic,
        asset.address,
        partition1,
        0,
        1000,
        TYPE_AMOUNT,
        tokenHolder1Signer,
        INIT_RULES_TRUE,
        tokenController1Signer,
        fund,
        NEW_CYCLE_CREATED_TRUE
      );
    });
    describe('when order exists and can still be rejected', function () {
      describe('when valuation period is not over', function () {
        describe('when message sender is the token controller', function () {
          describe('when the order has not been settled', function () {
            describe('when the order needs to be rejected', function () {
              describe('when order has not been paid yet', function () {
                describe('when we are in the subscription period', function () {
                  it('rejects the order', async function () {
                    const orderIndex = (
                      await fic.getInvestorOrders(tokenHolder1)
                    )[0].toNumber();
                    const cycleIndex = (
                      await fic.getLastCycleIndex(asset.address, partition1)
                    ).toNumber();
                    await assertOrder(
                      fic,
                      orderIndex,
                      cycleIndex,
                      tokenHolder1,
                      0,
                      1000,
                      TYPE_AMOUNT,
                      ORDER_SUBSCRIBED
                    );
                    await fic
                      .connect(tokenController1Signer)
                      .rejectOrder(orderIndex, true);
                    await assertOrder(
                      fic,
                      orderIndex,
                      cycleIndex,
                      tokenHolder1,
                      0,
                      1000,
                      TYPE_AMOUNT,
                      ORDER_REJECTED
                    );
                  });
                });
                describe('when we are in the valuation period', function () {
                  it('rejects the order', async function () {
                    const orderIndex = (
                      await fic.getInvestorOrders(tokenHolder1)
                    )[0].toNumber();
                    const cycleIndex = (
                      await fic.getLastCycleIndex(asset.address, partition1)
                    ).toNumber();
                    await assertOrder(
                      fic,
                      orderIndex,
                      cycleIndex,
                      tokenHolder1,
                      0,
                      1000,
                      TYPE_AMOUNT,
                      ORDER_SUBSCRIBED
                    );

                    await assertCycleState(
                      fic,
                      asset.address,
                      partition1,
                      CYCLE_SUBSCRIPTION
                    );

                    // Wait until after the end of the first subscription period
                    await advanceTimeAndBlock(
                      DEFAULT_SUBSCRIPTION_PERIOD_LENGTH + 1
                    );

                    await assertCycleState(
                      fic,
                      asset.address,
                      partition1,
                      CYCLE_VALUATION
                    );

                    await fic
                      .connect(tokenController1Signer)
                      .rejectOrder(orderIndex, true);
                    await assertOrder(
                      fic,
                      orderIndex,
                      cycleIndex,
                      tokenHolder1,
                      0,
                      1000,
                      TYPE_AMOUNT,
                      ORDER_REJECTED
                    );
                  });
                });
              });
              describe('when order had already been paid', function () {
                // XXX
              });
            });
            describe('when the order rejection needs to be cancelled', function () {
              it('cancels the rejection', async function () {
                const orderIndex = (
                  await fic.getInvestorOrders(tokenHolder1)
                )[0].toNumber();
                const cycleIndex = (
                  await fic.getLastCycleIndex(asset.address, partition1)
                ).toNumber();
                await assertOrder(
                  fic,
                  orderIndex,
                  cycleIndex,
                  tokenHolder1,
                  0,
                  1000,
                  TYPE_AMOUNT,
                  ORDER_SUBSCRIBED
                );
                await fic
                  .connect(tokenController1Signer)
                  .rejectOrder(orderIndex, true);
                await assertOrder(
                  fic,
                  orderIndex,
                  cycleIndex,
                  tokenHolder1,
                  0,
                  1000,
                  TYPE_AMOUNT,
                  ORDER_REJECTED
                );
                await fic
                  .connect(tokenController1Signer)
                  .rejectOrder(orderIndex, false);
                await assertOrder(
                  fic,
                  orderIndex,
                  cycleIndex,
                  tokenHolder1,
                  0,
                  1000,
                  TYPE_AMOUNT,
                  ORDER_SUBSCRIBED
                );
              });
            });
          });
          describe('when the order has been settled', function () {
            describe('when the order has been paid', function () {
              it('reverts', async function () {});
            });
            describe('when the order has not been paid', function () {
              it('reverts', async function () {});
            });
          });
        });
        describe('when message sender is not the token controller', function () {
          it('reverts', async function () {});
        });
      });
      describe('when subscription period is over', function () {
        it('reverts', async function () {});
      });
    });
    describe('when order can not be rejected', function () {
      describe('when order doesnt exist', function () {
        it('reverts', async function () {});
      });
      describe('when order has already been settled', function () {
        describe('when order has been paid', function () {
          it('reverts', async function () {});
        });
        describe('when order has not been paid', function () {
          it('reverts', async function () {});
        });
      });
      describe('when order has been cancelled', function () {
        it('reverts', async function () {});
      });
      describe('when order has already been rejected', function () {
        it('reverts', async function () {});
      });
    });
  });

  // PARAMETERS

  describe('parameters', function () {
    let fic: FundIssuer;
    beforeEach(async function () {
      fic = await new FundIssuer__factory(signer).deploy();
    });
    describe('implementerFund', function () {
      it('returns the contract address', async function () {
        let interfaceFundImplementer = await registry.getInterfaceImplementer(
          fic.address,
          ethers.utils.id(ERC1400_TOKENS_RECIPIENT_INTERFACE)
        );
        assert.equal(interfaceFundImplementer, fic.address);
      });
    });
  });

  // CANIMPLEMENTINTERFACE

  describe('canImplementInterfaceForAddress', function () {
    let fic: FundIssuer;
    beforeEach(async function () {
      fic = await new FundIssuer__factory(signer).deploy();
    });
    describe('when interface hash is correct', function () {
      it('returns ERC1820_ACCEPT_MAGIC', async function () {
        const canImplement = await fic.canImplementInterfaceForAddress(
          ethers.utils.id(ERC1400_TOKENS_RECIPIENT_INTERFACE),
          ZERO_ADDRESS
        );
        assert.equal(ERC1820_ACCEPT_MAGIC, canImplement);
      });
    });
    describe('when interface hash is not correct', function () {
      it('returns empty bytes32', async function () {
        const canImplement = await fic.canImplementInterfaceForAddress(
          ethers.utils.id('FakeInterfaceName'),
          ZERO_ADDRESS
        );
        assert.equal(ZERO_BYTES32, canImplement);
      });
    });
  });

  // CANRECEIVE

  describe('canReceive', function () {
    let fic: FundIssuer;
    let asset: ERC1400;
    let orderCreationFlag: string;
    let orderPaymentFlag: string;
    beforeEach(async function () {
      fic = await new FundIssuer__factory(signer).deploy();
      asset = await new ERC1400__factory(tokenController1Signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [owner],
        partitions
      );
      orderCreationFlag = getOrderCreationData(
        asset.address,
        partition1,
        500,
        0,
        TYPE_VALUE
      );
      orderPaymentFlag = getOrderPaymentData(1);
    });
    describe('when operatorData is not empty', function () {
      describe('when data has the correct length', function () {
        describe('when data has the right format', function () {
          describe('when data is formatted for an order creation', function () {
            it('returns false', async function () {
              const answer = await fic.canReceive(
                '0x00000000',
                partition1,
                unknown,
                unknown,
                unknown,
                1,
                orderCreationFlag,
                MOCK_CERTIFICATE
              );
              assert.isFalse(answer);
            });
          });
          describe('when data is formatted for an order payment', function () {
            it('returns true', async function () {
              const answer = await fic.canReceive(
                '0x00000000',
                partition1,
                unknown,
                unknown,
                unknown,
                1,
                orderPaymentFlag,
                MOCK_CERTIFICATE
              );

              assert.isTrue(answer);
            });
          });
          describe('when data is formatted for a hook bypass', function () {
            it('returns true', async function () {
              const answer = await fic.canReceive(
                '0x00000000',
                partition1,
                unknown,
                unknown,
                unknown,
                1,
                bypassFlag,
                MOCK_CERTIFICATE
              );
              assert.isTrue(answer);
            });
          });
        });
        describe('when data does not have the right format', function () {
          it('returns false', async function () {
            const answer = await fic.canReceive(
              '0x00000000',
              partition1,
              unknown,
              unknown,
              unknown,
              1,
              partitionFlag,
              MOCK_CERTIFICATE
            );
            assert.isFalse(answer);
          });
        });
      });
      describe('when data does not have the correct length', function () {
        it('returns false', async function () {
          const answer = await fic.canReceive(
            '0x00000000',
            partition1,
            unknown,
            unknown,
            unknown,
            1,
            orderPaymentFlag.substring(0, orderPaymentFlag.length - 2),
            MOCK_CERTIFICATE
          );

          assert.isFalse(answer);
        });
      });
    });
    describe('when operatorData is empty', function () {
      it('returns false', async function () {
        const answer = await fic.canReceive(
          '0x00000000',
          partition1,
          unknown,
          unknown,
          unknown,
          1,
          orderPaymentFlag,
          ZERO_BYTE
        );
        assert.isFalse(answer);
      });
    });
  });

  // SETASSETRULES

  describe('setAssetRules', function () {
    let asset: ERC1400;
    let fic: FundIssuer;
    beforeEach(async function () {
      asset = await new ERC1400__factory(tokenController1Signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [owner],
        partitions
      );
      fic = await new FundIssuer__factory(signer).deploy();
    });
    describe('when caller is the token controller', function () {
      describe('when first start time is valid', function () {
        describe('when periods are valid', function () {
          describe('when rules are not already defined', function () {
            it('sets asset rules', async function () {
              await setAssetRules(
                fic,
                tokenController1Signer,
                asset.address,
                partition1,
                undefined,
                undefined,
                undefined,
                undefined,
                OFF_CHAIN_PAYMENT,
                ZERO_ADDRESS,
                ZERO_BYTES32,
                fund,
                true
              );
            });
          });
          describe('when rules are already defined', function () {
            it('updates asset rules', async function () {
              await setAssetRules(
                fic,
                tokenController1Signer,
                asset.address,
                partition1,
                undefined,
                undefined,
                undefined,
                undefined,
                OFF_CHAIN_PAYMENT,
                ZERO_ADDRESS,
                ZERO_BYTES32,
                fund,
                true
              );
              const paymentToken = await new ERC1400__factory(
                tokenController1Signer
              ).deploy('ERC1400Token', 'DAU', 1, [owner], partitions);
              const chainTime = (await ethers.provider.getBlock('latest'))
                .timestamp;
              await setAssetRules(
                fic,
                tokenController1Signer,
                asset.address,
                partition2,
                chainTime + 2 * SECONDS_IN_A_WEEK,
                2 * SECONDS_IN_A_WEEK,
                2 * SECONDS_IN_A_WEEK,
                2 * SECONDS_IN_A_WEEK,
                ERC1400_PAYMENT,
                paymentToken.address,
                partition3,
                tokenHolder2,
                false
              );
            });
          });
        });
        describe('when periods are not valid', function () {
          describe('when subscriptionPeriodLength is nil', function () {
            it('reverts', async function () {
              const chainTime = (await ethers.provider.getBlock('latest'))
                .timestamp;
              await expectRevert.unspecified(
                fic
                  .connect(tokenController1Signer)
                  .setAssetRules(
                    asset.address,
                    partition1,
                    chainTime + 1,
                    0,
                    1,
                    1,
                    OFF_CHAIN_PAYMENT,
                    ZERO_ADDRESS,
                    ZERO_BYTES32,
                    fund,
                    true
                  )
              );
            });
          });
          describe('when valuationPeriodLength is nil', function () {
            it('reverts', async function () {
              const chainTime = (await ethers.provider.getBlock('latest'))
                .timestamp;
              await expectRevert.unspecified(
                fic
                  .connect(tokenController1Signer)
                  .setAssetRules(
                    asset.address,
                    partition1,
                    chainTime + 1,
                    1,
                    0,
                    1,
                    OFF_CHAIN_PAYMENT,
                    ZERO_ADDRESS,
                    ZERO_BYTES32,
                    fund,
                    true
                  )
              );
            });
          });
          describe('when paymentPeriodLength is nil', function () {
            it('reverts', async function () {
              const chainTime = (await ethers.provider.getBlock('latest'))
                .timestamp;
              await expectRevert.unspecified(
                fic
                  .connect(tokenController1Signer)
                  .setAssetRules(
                    asset.address,
                    partition1,
                    chainTime + 1,
                    1,
                    1,
                    0,
                    OFF_CHAIN_PAYMENT,
                    ZERO_ADDRESS,
                    ZERO_BYTES32,
                    fund,
                    true
                  )
              );
            });
          });
        });
      });
      describe('when first start time is not valid', function () {
        it('reverts', async function () {
          const chainTime = (await ethers.provider.getBlock('latest'))
            .timestamp;

          await expectRevert.unspecified(
            setAssetRules(
              fic,
              tokenController1Signer,
              asset.address,
              partition1,
              chainTime - 1,
              undefined,
              undefined,
              undefined,
              OFF_CHAIN_PAYMENT,
              ZERO_ADDRESS,
              ZERO_BYTES32,
              fund,
              true
            )
          );
        });
      });
    });
    describe('when caller is not the token controller', function () {
      it('reverts', async function () {
        const chainTime = (await ethers.provider.getBlock('latest')).timestamp;
        await expectRevert.unspecified(
          setAssetRules(
            fic,
            tokenController2Signer,
            asset.address,
            partition1,
            undefined,
            undefined,
            undefined,
            undefined,
            OFF_CHAIN_PAYMENT,
            ZERO_ADDRESS,
            ZERO_BYTES32,
            fund,
            true
          )
        );
      });
    });
  });

  // SUBSCRIBE

  describe('subscribe', function () {
    let asset: ERC1400;
    let fic: FundIssuer;
    beforeEach(async function () {
      asset = await new ERC1400__factory(tokenController1Signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [owner],
        partitions
      );
      fic = await new FundIssuer__factory(signer).deploy();
    });
    describe('when the current cycle is in subscription period', function () {
      describe('when the current period is correct', function () {
        describe('when order is of type value', function () {
          describe('when value is not nil', function () {
            describe('when asset value is unknown', function () {
              it('creates 2 new orders', async function () {
                await subscribe(
                  fic,
                  asset.address,
                  partition1,
                  1000,
                  0,
                  TYPE_VALUE,
                  tokenHolder1Signer,
                  INIT_RULES_TRUE,
                  tokenController1Signer,
                  fund,
                  NEW_CYCLE_CREATED_TRUE
                );
                await subscribe(
                  fic,
                  asset.address,
                  partition1,
                  1000,
                  0,
                  TYPE_VALUE,
                  tokenHolder2Signer,
                  INIT_RULES_FALSE,
                  tokenController1Signer,
                  fund,
                  NEW_CYCLE_CREATED_FALSE
                );
              });
            });
            describe('when asset value is already known', function () {
              describe('when payment is made at the same time as the subscription', function () {
                // XXX
              });
              describe('when payment is not made at the same time as the subscription', function () {
                // XXX
              });
            });
          });
          describe('when value is nil', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(
                subscribe(
                  fic,
                  asset.address,
                  partition1,
                  0, // value
                  1000, // amount
                  TYPE_VALUE,
                  tokenHolder1Signer,
                  INIT_RULES_TRUE,
                  tokenController1Signer,
                  fund,
                  NEW_CYCLE_CREATED_TRUE
                )
              );
            });
          });
        });
        describe('when order is of type amount', function () {
          describe('when amount is not nil', function () {
            it('creates a new order', async function () {
              await subscribe(
                fic,
                asset.address,
                partition1,
                0,
                1000,
                TYPE_AMOUNT,
                tokenHolder1Signer,
                INIT_RULES_TRUE,
                tokenController1Signer,
                fund,
                NEW_CYCLE_CREATED_TRUE
              );
            });
          });
          describe('when amount is nil', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(
                subscribe(
                  fic,
                  asset.address,
                  partition1,
                  1000, // value
                  0, // amount
                  TYPE_AMOUNT,
                  tokenHolder1Signer,
                  INIT_RULES_TRUE,
                  tokenController1Signer,
                  fund,
                  NEW_CYCLE_CREATED_TRUE
                )
              );
            });
          });
        });
      });
      describe('when the current period is not a subscription period (before first start time)', function () {
        it('reverts', async function () {
          const chainTime = (await ethers.provider.getBlock('latest'))
            .timestamp;

          await setAssetRules(
            fic,
            tokenController1Signer,
            asset.address,
            partition1,
            chainTime + 10000,
            undefined,
            undefined,
            undefined,
            OFF_CHAIN_PAYMENT,
            ZERO_ADDRESS,
            ZERO_BYTES32,
            fund,
            true
          );

          await expectRevert.unspecified(
            subscribe(
              fic,
              asset.address,
              partition1,
              1000,
              0,
              TYPE_VALUE,
              tokenHolder1Signer,
              INIT_RULES_FALSE,
              tokenController1Signer,
              fund,
              NEW_CYCLE_CREATED_TRUE
            )
          );
        });
      });
    });
    describe('when the current cycle is not in subscription period', function () {
      describe('when rules are defined for the asset', function () {
        describe('when subscriptions are open', function () {
          describe('when cycle is the first cycle for this asset', function () {
            it('creates a new order', async function () {
              await subscribe(
                fic,
                asset.address,
                partition1,
                1000,
                0,
                TYPE_VALUE,
                tokenHolder1Signer,
                INIT_RULES_TRUE,
                tokenController1Signer,
                fund,
                NEW_CYCLE_CREATED_TRUE
              );
            });
            it('creates 3 orders', async function () {
              await subscribe(
                fic,
                asset.address,
                partition1,
                1000,
                0,
                TYPE_VALUE,
                tokenHolder1Signer,
                INIT_RULES_TRUE,
                tokenController1Signer,
                fund,
                NEW_CYCLE_CREATED_TRUE
              );
              await subscribe(
                fic,
                asset.address,
                partition1,
                1000,
                0,
                TYPE_VALUE,
                tokenHolder2Signer,
                INIT_RULES_FALSE,
                tokenController1Signer,
                fund,
                NEW_CYCLE_CREATED_FALSE
              );
              const asset2 = await new ERC1400__factory(
                tokenController2Signer
              ).deploy('ERC1400Token', 'DAU', 1, [owner], partitions);
              await subscribe(
                fic,
                asset2.address,
                partition2,
                0,
                5000,
                TYPE_AMOUNT,
                tokenHolder2Signer,
                INIT_RULES_TRUE,
                tokenController2Signer,
                fund,
                NEW_CYCLE_CREATED_TRUE
              );
            });
          });
          describe('when cycle is not the first cycle for this asset', function () {
            it('creates 3 orders', async function () {
              await subscribe(
                fic,
                asset.address,
                partition1,
                1000,
                0,
                TYPE_VALUE,
                tokenHolder1Signer,
                INIT_RULES_TRUE,
                tokenController1Signer,
                fund,
                NEW_CYCLE_CREATED_TRUE
              );

              await assertCycleState(
                fic,
                asset.address,
                partition1,
                CYCLE_SUBSCRIPTION
              );

              // Wait until after the end of the first subsciption period
              await advanceTimeAndBlock(DEFAULT_SUBSCRIPTION_PERIOD_LENGTH + 1);

              await assertCycleState(
                fic,
                asset.address,
                partition1,
                CYCLE_VALUATION
              );

              await subscribe(
                fic,
                asset.address,
                partition1,
                1000,
                0,
                TYPE_VALUE,
                tokenHolder2Signer,
                INIT_RULES_FALSE,
                tokenController1Signer,
                fund,
                NEW_CYCLE_CREATED_TRUE
              );
            });
          });
        });
        describe('when subscriptions are not open', function () {
          it('reverts', async function () {
            await setAssetRules(
              fic,
              tokenController1Signer,
              asset.address,
              partition1,
              undefined,
              undefined,
              undefined,
              undefined,
              OFF_CHAIN_PAYMENT,
              ZERO_ADDRESS,
              ZERO_BYTES32,
              fund,
              false
            );

            await expectRevert.unspecified(
              subscribe(
                fic,
                asset.address,
                partition1,
                1000,
                0,
                TYPE_VALUE,
                tokenHolder1Signer,
                INIT_RULES_FALSE,
                tokenController1Signer,
                fund,
                NEW_CYCLE_CREATED_TRUE
              )
            );
          });
        });
      });
      describe('when rules are not defined for the asset', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            subscribe(
              fic,
              asset.address,
              partition1,
              1000,
              0,
              TYPE_VALUE,
              tokenHolder1Signer,
              INIT_RULES_FALSE,
              tokenController1Signer,
              fund,
              NEW_CYCLE_CREATED_TRUE
            )
          );
        });
      });
    });
  });

  // CANCELORDER

  describe('cancelOrder', function () {
    let asset: ERC1400;
    let fic: FundIssuer;
    beforeEach(async function () {
      asset = await new ERC1400__factory(tokenController1Signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [owner],
        partitions
      );
      fic = await new FundIssuer__factory(signer).deploy();
      await subscribe(
        fic,
        asset.address,
        partition1,
        0,
        1000,
        TYPE_AMOUNT,
        tokenHolder1Signer,
        INIT_RULES_TRUE,
        tokenController1Signer,
        fund,
        NEW_CYCLE_CREATED_TRUE
      );
    });
    describe('when order exists and can still be cancelled', function () {
      describe('when subscription period is not over', function () {
        describe('when message sender is the investor', function () {
          describe('when order has not been paid yet', function () {
            it('cancels the order', async function () {
              const orderIndex = (
                await fic.getInvestorOrders(tokenHolder1)
              )[0].toNumber();
              const cycleIndex = (
                await fic.getLastCycleIndex(asset.address, partition1)
              ).toNumber();
              await assertOrder(
                fic,
                orderIndex,
                cycleIndex,
                tokenHolder1,
                0,
                1000,
                TYPE_AMOUNT,
                ORDER_SUBSCRIBED
              );
              await assertCycleState(
                fic,
                asset.address,
                partition1,
                CYCLE_SUBSCRIPTION
              );
              await fic.connect(tokenHolder1Signer).cancelOrder(orderIndex);
              await assertOrder(
                fic,
                orderIndex,
                cycleIndex,
                tokenHolder1,
                0,
                1000,
                TYPE_AMOUNT,
                ORDER_CANCELLED
              );
            });
          });
          describe('when order had already been paid', function () {
            // XXX
          });
        });
        describe('when message sender is not the investor', function () {
          it('reverts', async function () {
            const orderIndex = (
              await fic.getInvestorOrders(tokenHolder1)
            )[0].toNumber();
            await expectRevert.unspecified(
              fic.connect(tokenHolder2Signer).cancelOrder(orderIndex)
            );
          });
        });
      });
      describe('when subscription period is over', function () {
        it('reverts', async function () {
          await assertCycleState(
            fic,
            asset.address,
            partition1,
            CYCLE_SUBSCRIPTION
          );

          // Wait until after the end of the first subsciption period
          await advanceTimeAndBlock(DEFAULT_SUBSCRIPTION_PERIOD_LENGTH + 1);

          await assertCycleState(
            fic,
            asset.address,
            partition1,
            CYCLE_VALUATION
          );

          const orderIndex = (
            await fic.getInvestorOrders(tokenHolder1)
          )[0].toNumber();
          await expectRevert.unspecified(
            fic.connect(tokenHolder1Signer).cancelOrder(orderIndex)
          );
        });
      });
    });
    describe('when order can not be rejected', function () {
      describe('when order doesnt exist', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            fic.connect(tokenHolder1Signer).cancelOrder(999999)
          );
        });
      });
      describe('when order has already been settled', function () {
        describe('when order has been paid', function () {
          it('reverts', async function () {
            // XXX
          });
        });
        describe('when order has not been paid', function () {
          it('reverts', async function () {
            // XXX
          });
        });
      });
      describe('when order has been cancelled', function () {
        it('reverts', async function () {
          // XXX
        });
      });
      describe('when order has already been rejected', function () {
        it('reverts', async function () {
          // XXX
        });
      });
    });
  });

  // VALUATE

  describe('valuate', function () {
    let asset: ERC1400;
    let fic: FundIssuer;
    beforeEach(async function () {
      asset = await new ERC1400__factory(tokenController1Signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [owner],
        partitions
      );
      fic = await new FundIssuer__factory(signer).deploy();
      await subscribe(
        fic,
        asset.address,
        partition1,
        0,
        1000,
        TYPE_AMOUNT,
        tokenHolder1Signer,
        INIT_RULES_TRUE,
        tokenController1Signer,
        fund,
        NEW_CYCLE_CREATED_TRUE
      );
    });
    describe('when we are in the valuation period', function () {
      beforeEach(async function () {
        await assertCycleState(
          fic,
          asset.address,
          partition1,
          CYCLE_SUBSCRIPTION
        );
        // Wait until after the end of the first subscription period
        await advanceTimeAndBlock(DEFAULT_SUBSCRIPTION_PERIOD_LENGTH + 1);
        await assertCycleState(fic, asset.address, partition1, CYCLE_VALUATION);
      });
      describe('when cycle is of type unknown', function () {
        describe('when the provided values are valid', function () {
          describe('when the sender is a price oracle', function () {
            it('sets the valuation', async function () {
              const cycleIndex = (
                await fic.getLastCycleIndex(asset.address, partition1)
              ).toNumber();

              await assertCycleAssetValue(
                fic,
                cycleIndex,
                ASSET_VALUE_UNKNOWN,
                0,
                0
              );

              await fic
                .connect(tokenController1Signer)
                .valuate(cycleIndex, 1000, 0);

              await assertCycleAssetValue(
                fic,
                cycleIndex,
                ASSET_VALUE_UNKNOWN,
                1000,
                0
              );
            });
            it('sets the reverse valuation', async function () {
              const cycleIndex = (
                await fic.getLastCycleIndex(asset.address, partition1)
              ).toNumber();

              await assertCycleAssetValue(
                fic,
                cycleIndex,
                ASSET_VALUE_UNKNOWN,
                0,
                0
              );

              await fic
                .connect(tokenController1Signer)
                .valuate(cycleIndex, 0, 1000);

              await assertCycleAssetValue(
                fic,
                cycleIndex,
                ASSET_VALUE_UNKNOWN,
                0,
                1000
              );
            });
            it('sets the valuation twice', async function () {
              const cycleIndex = (
                await fic.getLastCycleIndex(asset.address, partition1)
              ).toNumber();

              await assertCycleAssetValue(
                fic,
                cycleIndex,
                ASSET_VALUE_UNKNOWN,
                0,
                0
              );

              await fic
                .connect(tokenController1Signer)
                .valuate(cycleIndex, 1000, 0);

              await assertCycleAssetValue(
                fic,
                cycleIndex,
                ASSET_VALUE_UNKNOWN,
                1000,
                0
              );

              await fic
                .connect(tokenController1Signer)
                .valuate(cycleIndex, 0, 500);

              await assertCycleAssetValue(
                fic,
                cycleIndex,
                ASSET_VALUE_UNKNOWN,
                0,
                500
              );
            });
          });
          describe('when the sender is not a price oracle', function () {
            it('reverts', async function () {
              const cycleIndex = (
                await fic.getLastCycleIndex(asset.address, partition1)
              ).toNumber();

              await assertCycleAssetValue(
                fic,
                cycleIndex,
                ASSET_VALUE_UNKNOWN,
                0,
                0
              );

              await expectRevert.unspecified(
                fic.connect(tokenController2Signer).valuate(cycleIndex, 1000, 0)
              );
            });
          });
        });
        describe('when the provided values are not valid', function () {
          it('reverts', async function () {
            const cycleIndex = (
              await fic.getLastCycleIndex(asset.address, partition1)
            ).toNumber();

            await assertCycleAssetValue(
              fic,
              cycleIndex,
              ASSET_VALUE_UNKNOWN,
              0,
              0
            );

            await expectRevert.unspecified(
              fic
                .connect(tokenController1Signer)
                .valuate(cycleIndex, 1000, 1000)
            );
          });
        });
      });
      describe('when cycle is of type known', function () {
        it('set the valuation', async function () {
          const asset2 = await new ERC1400__factory(
            tokenController1Signer
          ).deploy('ERC1400Token', 'DAU', 1, [owner], partitions);
          const fic2 = await new FundIssuer__factory(signer).deploy();
          await setAssetRules(
            fic2,
            tokenController1Signer,
            asset2.address,
            partition1,
            undefined,
            undefined,
            undefined,
            undefined,
            OFF_CHAIN_PAYMENT,
            ZERO_ADDRESS,
            ZERO_BYTES32,
            fund,
            true
          );
          await fic2
            .connect(tokenController1Signer)
            .setAssetValueRules(
              asset2.address,
              partition1,
              ASSET_VALUE_KNOWN,
              1000,
              0
            );
          await fic2.connect(tokenHolder1Signer).subscribe(
            asset2.address,
            partition1,
            0,
            1000,
            TYPE_AMOUNT,
            false // executePaymentAtSubscription
          );
          await assertCycleState(
            fic2,
            asset2.address,
            partition1,
            CYCLE_SUBSCRIPTION
          );
          // Wait until after the end of the first subscription period
          await advanceTimeAndBlock(DEFAULT_SUBSCRIPTION_PERIOD_LENGTH + 1);
          await assertCycleState(
            fic2,
            asset2.address,
            partition1,
            CYCLE_VALUATION
          );

          const cycleIndex = (
            await fic2.getLastCycleIndex(asset2.address, partition1)
          ).toNumber();

          await assertCycleAssetValue(
            fic2,
            cycleIndex,
            ASSET_VALUE_KNOWN,
            1000,
            0
          );

          await expectRevert.unspecified(
            fic2.connect(tokenController1Signer).valuate(cycleIndex, 0, 1000)
          );
        });
      });
    });
    describe('when we are in the subscription period', function () {
      beforeEach(async function () {
        await assertCycleState(
          fic,
          asset.address,
          partition1,
          CYCLE_SUBSCRIPTION
        );
      });
      it('reverts', async function () {
        const cycleIndex = (
          await fic.getLastCycleIndex(asset.address, partition1)
        ).toNumber();

        await assertCycleAssetValue(fic, cycleIndex, ASSET_VALUE_UNKNOWN, 0, 0);

        await expectRevert.unspecified(
          fic.connect(tokenController1Signer).valuate(cycleIndex, 1000, 0)
        );
      });
    });
    describe('when we are in the payment period', function () {
      beforeEach(async function () {
        await assertCycleState(
          fic,
          asset.address,
          partition1,
          CYCLE_SUBSCRIPTION
        );
        // Wait until after the end of the first valuation period
        await advanceTimeAndBlock(
          DEFAULT_SUBSCRIPTION_PERIOD_LENGTH +
            DEFAULT_VALUATION_PERIOD_LENGTH +
            1
        );
        await assertCycleState(fic, asset.address, partition1, CYCLE_PAYMENT);
      });
      it('reverts', async function () {
        const cycleIndex = (
          await fic.getLastCycleIndex(asset.address, partition1)
        ).toNumber();

        await assertCycleAssetValue(fic, cycleIndex, ASSET_VALUE_UNKNOWN, 0, 0);

        await expectRevert.unspecified(
          fic.connect(tokenController1Signer).valuate(cycleIndex, 1000, 0)
        );
      });
    });
  });
});
