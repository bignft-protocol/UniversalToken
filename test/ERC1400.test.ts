import { BigNumber, ethers } from 'ethers';
import assert from 'assert';
import {
  ERC1400,
  ERC1400__factory,
  ERC1820Registry,
  ERC1820Registry__factory,
  FakeERC1400Mock__factory,
  MinterMock,
  MinterMock__factory
} from '../typechain-types';

import {
  assertBalance,
  assertBalanceOfByPartition,
  assertBalanceOfSecurityToken,
  assertBalances,
  assertBurnEvent,
  assertRevert,
  assertTotalSupply,
  assertTransferEvent,
  ZERO_ADDRESS,
  ZERO_BYTE,
  ZERO_BYTES32
} from './utils/assert';
import { BigNumberish, BytesLike, Signer } from 'ethers';
import truffleFixture from './truffle-fixture';
import { getSigners } from './common/wallet';
import { PromiseOrValue } from 'typechain-types/common';

const ERC1820_ACCEPT_MAGIC = 'ERC1820_ACCEPT_MAGIC';

const ERC20_INTERFACE_NAME = 'ERC20Token';
const ERC1400_INTERFACE_NAME = 'ERC1400Token';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const partitionFlag =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'; // Flag to indicate a partition change
const otherFlag =
  '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'; // Other flag
const partition1_short =
  '7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
const partition2_short =
  '6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
const partition3_short =
  '6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex
const changeToPartition1 = partitionFlag.concat(partition1_short);
const changeToPartition2 = partitionFlag.concat(partition2_short);
const changeToPartition3 = partitionFlag.concat(partition3_short);
const doNotChangePartition = otherFlag.concat(partition2_short);
const partition1 = ZERO_BYTE.concat(partition1_short);
const partition2 = ZERO_BYTE.concat(partition2_short);
const partition3 = ZERO_BYTE.concat(partition3_short);

const partitions = [partition1, partition2, partition3];
const reversedPartitions = [partition3, partition1, partition2];

const documentName =
  '0x446f63756d656e74204e616d6500000000000000000000000000000000000000';

const issuanceAmount = 1000;

let defaultPartitions;

let totalSupplyPartition1;
let totalSupplyPartition2;

const issueOnMultiplePartitions = async (
  _contract: ERC1400,
  _signer: Signer,
  _recipient: PromiseOrValue<string>,
  _partitions: BytesLike[],
  _amounts: BigNumberish[]
) => {
  await Promise.all(
    _partitions.map(
      async (_partition, i) =>
        await _contract
          .connect(_signer)
          .issueByPartition(_partition, _recipient, _amounts[i], ZERO_BYTES32)
    )
  );
};

describe('ERC1400', function () {
  const [
    signer,
    operatorSigner,
    controllerSigner,
    controllerAlternative1Signer,
    controllerAlternative2Signer,
    tokenHolderSigner,
    recipientSigner,
    unknownSigner
  ] = getSigners(8);

  let registry: ERC1820Registry;

  before(async function () {
    await truffleFixture([2]);

    registry = ERC1820Registry__factory.deployed;
  });

  describe('contract creation', function () {
    it('fails deploying the contract if granularity is lower than 1', async function () {
      await assertRevert(
        new ERC1400__factory(signer).deploy(
          'ERC1400Token',
          'DAU',
          0,
          [controllerSigner.getAddress()],
          partitions
        )
      );
    });
  });

  // CANIMPLEMENTINTERFACE

  describe('canImplementInterfaceForAddress', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    describe('when interface hash is correct', function () {
      it('returns ERC1820_ACCEPT_MAGIC', async function () {
        const canImplement1400 = await token.canImplementInterfaceForAddress(
          ethers.utils.id(ERC1400_INTERFACE_NAME),
          ZERO_ADDRESS
        );
        assert.strictEqual(
          ethers.utils.id(ERC1820_ACCEPT_MAGIC),
          canImplement1400
        );
        const canImplement20 = await token.canImplementInterfaceForAddress(
          ethers.utils.id(ERC20_INTERFACE_NAME),
          ZERO_ADDRESS
        );
        assert.strictEqual(
          ethers.utils.id(ERC1820_ACCEPT_MAGIC),
          canImplement20
        );
      });
    });
    describe('when interface hash is not correct', function () {
      it('returns ERC1820_ACCEPT_MAGIC', async function () {
        const canImplement = await token.canImplementInterfaceForAddress(
          ethers.utils.id('FakeToken'),
          ZERO_ADDRESS
        );
        assert.strictEqual(ZERO_BYTES32, canImplement);
      });
    });
  });

  // MINTER
  describe('minter role', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    describe('addMinter/removeMinter', function () {
      describe('add/renounce a minter', function () {
        describe('when caller is a minter', function () {
          it('adds a minter as owner', async function () {
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              false
            );
            await token.addMinter(unknownSigner.getAddress());
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              true
            );
          });
          it('adds a minter as minter', async function () {
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              false
            );
            await token.addMinter(unknownSigner.getAddress());
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              true
            );

            assert.strictEqual(
              await token.isMinter(tokenHolderSigner.getAddress()),
              false
            );
            await token
              .connect(unknownSigner)
              .addMinter(tokenHolderSigner.getAddress());
            assert.strictEqual(
              await token.isMinter(tokenHolderSigner.getAddress()),
              true
            );
          });
          it('renounces minter', async function () {
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              false
            );
            await token.addMinter(unknownSigner.getAddress());
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              true
            );
            await token.connect(unknownSigner).renounceMinter();
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              false
            );
          });
        });
        describe('when caller is not a minter', function () {
          it('reverts', async function () {
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              false
            );
            await assertRevert(
              token.connect(unknownSigner).addMinter(unknownSigner.getAddress())
            );
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              false
            );
          });
        });
      });
      describe('remove a minter', function () {
        describe('when caller is a minter', function () {
          it('removes a minter as owner', async function () {
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              false
            );
            await token.addMinter(unknownSigner.getAddress());
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              true
            );
            await token.removeMinter(unknownSigner.getAddress());
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              false
            );
          });
        });
        describe('when caller is not a minter', function () {
          it('reverts', async function () {
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              false
            );
            await token.addMinter(unknownSigner.getAddress());
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              true
            );
            await assertRevert(
              token
                .connect(tokenHolderSigner)
                .removeMinter(unknownSigner.getAddress())
            );
            assert.strictEqual(
              await token.isMinter(unknownSigner.getAddress()),
              true
            );
          });
        });
      });
    });
    describe('onlyMinter [mock for coverage]', function () {
      let minterMock: MinterMock;
      beforeEach(async function () {
        minterMock = await new MinterMock__factory(signer).deploy();
      });
      describe('can not call function if not minter', function () {
        it('reverts', async function () {
          assert.strictEqual(
            await minterMock.isMinter(unknownSigner.getAddress()),
            false
          );
          await assertRevert(
            minterMock
              .connect(unknownSigner)
              .addMinter(unknownSigner.getAddress())
          );
          assert.strictEqual(
            await minterMock.isMinter(unknownSigner.getAddress()),
            false
          );
          await minterMock.addMinter(unknownSigner.getAddress());
          assert.strictEqual(
            await minterMock.isMinter(unknownSigner.getAddress()),
            true
          );
        });
      });
    });
  });

  // TRANSFER

  describe('transfer', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      await token.issueByPartition(
        partition1,
        tokenHolderSigner.getAddress(),
        issuanceAmount,
        ZERO_BYTES32
      );
    });

    describe('when the amount is a multiple of the granularity', function () {
      describe('when the recipient is not the zero address', function () {
        describe('when the sender has enough balance', function () {
          const amount = issuanceAmount;

          it('transfers the requested amount', async function () {
            await token
              .connect(tokenHolderSigner)
              .transfer(recipientSigner.getAddress(), amount);
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount - amount
            );
            await assertBalance(token, recipientSigner.getAddress(), amount);
          });

          it('emits a Transfer event', async function () {
            const { events } = await token
              .connect(tokenHolderSigner)
              .transfer(recipientSigner.getAddress(), amount)
              .then((res) => res.wait());

            assert.strictEqual(events!.length, 2);

            const [event0, event1] = events!;

            assert.strictEqual(event0.event, 'Transfer');
            assert.strictEqual(
              event0.args?.from,
              await tokenHolderSigner.getAddress()
            );
            assert.strictEqual(
              event0.args?.to,
              await recipientSigner.getAddress()
            );
            assert.strictEqual(
              BigNumber.from(event0.args?.value).toNumber(),
              amount
            );

            assert.strictEqual(event1.event, 'TransferByPartition');
            assert.strictEqual(event1.args?.fromPartition, partition1);
            assert.strictEqual(
              event1.args?.operator,
              await tokenHolderSigner.getAddress()
            );
            assert.strictEqual(
              event1.args?.from,
              await tokenHolderSigner.getAddress()
            );
            assert.strictEqual(
              event1.args?.to,
              await recipientSigner.getAddress()
            );
            assert.strictEqual(
              BigNumber.from(event1.args?.value).toNumber(),
              amount
            );
            assert.strictEqual(event1.args?.data, ZERO_BYTE);
            assert.strictEqual(event1.args?.operatorData, ZERO_BYTE);
          });
        });
        describe('when the sender does not have enough balance', function () {
          const amount = issuanceAmount + 1;

          it('reverts', async function () {
            await assertRevert(
              token
                .connect(tokenHolderSigner)
                .transfer(recipientSigner.getAddress(), amount)
            );
          });
        });
      });

      describe('when the recipient is the zero address', function () {
        const amount = issuanceAmount;

        it('reverts', async function () {
          await assertRevert(
            token.connect(tokenHolderSigner).transfer(ZERO_ADDRESS, amount)
          );
        });
      });
    });
    describe('when the amount is not a multiple of the granularity', function () {
      it('reverts', async function () {
        token = await new ERC1400__factory(signer).deploy(
          'ERC1400Token',
          'DAU',
          2,
          [],
          partitions
        );
        await token.issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTES32
        );
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .transfer(recipientSigner.getAddress(), 3)
        );
      });
    });
  });

  // TRANSFERFROM

  describe('transferFrom', function () {
    const approvedAmount = 10000;
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      await token.issueByPartition(
        partition1,
        tokenHolderSigner.getAddress(),
        issuanceAmount,
        ZERO_BYTES32
      );
    });
    describe('when token has a withelist', function () {
      describe('when the operator is approved', function () {
        beforeEach(async function () {
          // await token.connect(tokenHolderSigner).authorizeOperator(operatorSigner.getAddress(), );
          await token
            .connect(tokenHolderSigner)
            .approve(operatorSigner.getAddress(), approvedAmount);
        });
        describe('when the amount is a multiple of the granularity', function () {
          describe('when the recipient is not the zero address', function () {
            describe('when the sender has enough balance', function () {
              const amount = 500;

              it('transfers the requested amount', async function () {
                await token
                  .connect(operatorSigner)
                  .transferFrom(
                    tokenHolderSigner.getAddress(),
                    recipientSigner.getAddress(),
                    amount
                  );
                await assertBalance(
                  token,
                  tokenHolderSigner.getAddress(),
                  issuanceAmount - amount
                );
                await assertBalance(
                  token,
                  recipientSigner.getAddress(),
                  amount
                );

                assert.strictEqual(
                  (
                    await token.allowance(
                      tokenHolderSigner.getAddress(),
                      operatorSigner.getAddress()
                    )
                  ).eq(approvedAmount - amount),
                  true
                );
              });

              it('emits a sent + a transfer event', async function () {
                const { events } = await token
                  .connect(operatorSigner)
                  .transferFrom(
                    tokenHolderSigner.getAddress(),
                    recipientSigner.getAddress(),
                    amount
                  )
                  .then((res) => res.wait());

                assert.strictEqual(events!.length, 2);

                assert.strictEqual(events![0].event, 'Transfer');
                assert.strictEqual(
                  events![0].args?.from,
                  await tokenHolderSigner.getAddress()
                );
                assert.strictEqual(
                  events![0].args?.to,
                  await recipientSigner.getAddress()
                );
                assert.strictEqual(
                  BigNumber.from(events![0].args?.value).toNumber(),
                  amount
                );

                assert.strictEqual(events![1].event, 'TransferByPartition');
                assert.strictEqual(events![1].args?.fromPartition, partition1);
                assert.strictEqual(
                  events![1].args?.operator,
                  await operatorSigner.getAddress()
                );
                assert.strictEqual(
                  events![1].args?.from,
                  await tokenHolderSigner.getAddress()
                );
                assert.strictEqual(
                  events![1].args?.to,
                  await recipientSigner.getAddress()
                );
                assert.strictEqual(
                  BigNumber.from(events![1].args?.value).toNumber(),
                  amount
                );
                assert.strictEqual(events![1].args?.data, ZERO_BYTE);
                assert.strictEqual(events![1].args?.operatorData, ZERO_BYTE);
              });
            });
            describe('when the sender does not have enough balance', function () {
              const amount = approvedAmount + 1;

              it('reverts', async function () {
                await assertRevert(
                  token
                    .connect(operatorSigner)
                    .transferFrom(
                      tokenHolderSigner.getAddress(),
                      recipientSigner.getAddress(),
                      amount
                    )
                );
              });
            });
          });

          describe('when the recipient is the zero address', function () {
            const amount = issuanceAmount;

            it('reverts', async function () {
              await assertRevert(
                token
                  .connect(operatorSigner)
                  .transferFrom(
                    tokenHolderSigner.getAddress(),
                    ZERO_ADDRESS,
                    amount
                  )
              );
            });
          });
        });
        describe('when the amount is not a multiple of the granularity', function () {
          it('reverts', async function () {
            token = await new ERC1400__factory(signer).deploy(
              'ERC1400Token',
              'DAU',
              2,
              [],
              partitions
            );
            await token.issueByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTES32
            );
            await assertRevert(
              token
                .connect(operatorSigner)
                .transferFrom(
                  tokenHolderSigner.getAddress(),
                  recipientSigner.getAddress(),
                  3
                )
            );
          });
        });
      });
      describe('when the operator is not approved', function () {
        const amount = 100;
        describe('when the operator is not approved but authorized', function () {
          it('transfers the requested amount', async function () {
            await token
              .connect(tokenHolderSigner)
              .authorizeOperator(operatorSigner.getAddress());
            assert.strictEqual(
              (
                await token.allowance(
                  tokenHolderSigner.getAddress(),
                  operatorSigner.getAddress()
                )
              ).toNumber(),
              0
            );

            await token
              .connect(operatorSigner)
              .transferFrom(
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                amount
              );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount - amount
            );
            await assertBalance(token, recipientSigner.getAddress(), amount);
          });
        });
        describe('when the operator is not approved and not authorized', function () {
          it('reverts', async function () {
            await assertRevert(
              token
                .connect(operatorSigner)
                .transferFrom(
                  tokenHolderSigner.getAddress(),
                  recipientSigner.getAddress(),
                  amount
                )
            );
          });
        });
      });
    });
  });

  // APPROVE

  describe('approve', function () {
    const amount = 100;
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    describe('when sender approves an operator', function () {
      it('approves the operator', async function () {
        assert.strictEqual(
          (
            await token.allowance(
              tokenHolderSigner.getAddress(),
              operatorSigner.getAddress()
            )
          ).eq(0),
          true
        );

        await token
          .connect(tokenHolderSigner)
          .approve(operatorSigner.getAddress(), amount);

        assert.strictEqual(
          (
            await token.allowance(
              tokenHolderSigner.getAddress(),
              operatorSigner.getAddress()
            )
          ).eq(amount),
          true
        );
      });
      it('emits an approval event', async function () {
        const { events } = await token
          .connect(tokenHolderSigner)
          .approve(operatorSigner.getAddress(), amount)
          .then((res) => res.wait());

        assert.strictEqual(events!.length, 1);
        assert.strictEqual(events![0].event, 'Approval');
        assert.strictEqual(
          events![0].args?.owner,
          await tokenHolderSigner.getAddress()
        );
        assert.strictEqual(
          events![0].args?.spender,
          await operatorSigner.getAddress()
        );
        assert.strictEqual(
          BigNumber.from(events![0].args?.value).toNumber(),
          amount
        );
      });
    });
    describe('when the operator to approve is the zero address', function () {
      it('reverts', async function () {
        await assertRevert(
          token.connect(tokenHolderSigner).approve(ZERO_ADDRESS, amount)
        );
      });
    });
  });

  // SET/GET DOCUMENT

  describe('set/getDocument', function () {
    const documentURI =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit,sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'; // SHA-256 of documentURI
    const documentHash =
      '0x1c81c608a616183cc4a38c09ecc944eb77eaff465dd87aae0290177f2b70b6f8'; // SHA-256 of documentURI + ZERO_BYTE
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });

    describe('setDocument', function () {
      describe('when sender is a controller', function () {
        it('attaches the document to the token', async function () {
          await token
            .connect(controllerSigner)
            .setDocument(documentName, documentURI, documentHash);
          const doc = await token.getDocument(documentName);
          assert.strictEqual(documentURI, doc[0]);
          assert.strictEqual(documentHash, doc[1]);
        });
        it('emits a document event', async function () {
          const { events } = await token
            .connect(controllerSigner)
            .setDocument(documentName, documentURI, documentHash)
            .then((res) => res.wait());

          assert.strictEqual(events!.length, 1);
          assert.strictEqual(events![0].event, 'DocumentUpdated');

          assert.strictEqual(events![0].args?.name, documentName);
          assert.strictEqual(events![0].args?.uri, documentURI);
          assert.strictEqual(events![0].args?.documentHash, documentHash);
        });
      });
      describe('when sender is not a controller', function () {
        it('reverts', async function () {
          await assertRevert(
            token
              .connect(unknownSigner)
              .setDocument(documentName, documentURI, documentHash)
          );
        });
      });
    });
    describe('getDocument', function () {
      describe('when docuemnt exists', function () {
        it('returns the document', async function () {
          await token
            .connect(controllerSigner)
            .setDocument(documentName, documentURI, documentHash);
          const doc = await token.getDocument(documentName);
          assert.strictEqual(documentURI, doc[0]);
          assert.strictEqual(documentHash, doc[1]);
        });
      });
      describe('when docuemnt does not exist', function () {
        it('reverts', async function () {
          await assertRevert(token.getDocument(documentName));
        });
      });
    });
  });

  // PARTITIONSOF

  describe('partitionsOf', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    describe('when tokenHolder owes no tokens', function () {
      it('returns empty list', async function () {
        const partitionsOf = await token.partitionsOf(
          tokenHolderSigner.getAddress()
        );
        assert.strictEqual(partitionsOf.length, 0);
      });
    });
    describe('when tokenHolder owes tokens of 1 partition', function () {
      it('returns partition', async function () {
        await token.issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTES32
        );
        const partitionsOf = await token.partitionsOf(
          tokenHolderSigner.getAddress()
        );
        assert.strictEqual(partitionsOf.length, 1);
        assert.strictEqual(partitionsOf[0], partition1);
      });
    });
    describe('when tokenHolder owes tokens of 3 partitions', function () {
      it('returns list of 3 partitions', async function () {
        await issueOnMultiplePartitions(
          token,
          signer,
          tokenHolderSigner.getAddress(),
          partitions,
          [issuanceAmount, issuanceAmount, issuanceAmount]
        );
        const partitionsOf = await token.partitionsOf(
          tokenHolderSigner.getAddress()
        );
        assert.strictEqual(partitionsOf.length, 3);
        assert.strictEqual(partitionsOf[0], partition1);
        assert.strictEqual(partitionsOf[1], partition2);
        assert.strictEqual(partitionsOf[2], partition3);
      });
    });
  });

  // TRANSFERWITHDATA

  describe('transferWithData', function () {
    describe('when defaultPartitions have been defined', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await new ERC1400__factory(signer).deploy(
          'ERC1400Token',
          'DAU',
          1,
          [controllerSigner.getAddress()],
          partitions
        );
        await issueOnMultiplePartitions(
          token,
          signer,
          tokenHolderSigner.getAddress(),
          partitions,
          [issuanceAmount, issuanceAmount, issuanceAmount]
        );
      });
      describe('when the amount is a multiple of the granularity', function () {
        describe('when the recipient is not the zero address', function () {
          describe('when the sender has enough balance for those default partitions', function () {
            describe('when the sender has defined custom default partitions', function () {
              it('transfers the requested amount', async function () {
                await token.setDefaultPartitions(reversedPartitions);
                await assertBalances(
                  token,
                  tokenHolderSigner.getAddress(),
                  partitions,
                  [issuanceAmount, issuanceAmount, issuanceAmount]
                );

                await token
                  .connect(tokenHolderSigner)
                  .transferWithData(
                    recipientSigner.getAddress(),
                    2.5 * issuanceAmount,
                    ZERO_BYTES32
                  );

                await assertBalances(
                  token,
                  tokenHolderSigner.getAddress(),
                  partitions,
                  [0, 0.5 * issuanceAmount, 0]
                );
                await assertBalances(
                  token,
                  recipientSigner.getAddress(),
                  partitions,
                  [issuanceAmount, 0.5 * issuanceAmount, issuanceAmount]
                );
              });
              it('emits a sent event', async function () {
                await token.setDefaultPartitions(reversedPartitions);
                const { events } = await token
                  .connect(tokenHolderSigner)
                  .transferWithData(
                    recipientSigner.getAddress(),
                    2.5 * issuanceAmount,
                    ZERO_BYTES32
                  )
                  .then((res) => res.wait());

                assert.strictEqual(events!.length, 2 * partitions.length);

                assertTransferEvent(
                  [events![0], events![1]],
                  partition3,
                  await tokenHolderSigner.getAddress(),
                  await tokenHolderSigner.getAddress(),
                  await recipientSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTES32,
                  ZERO_BYTE
                );
                assertTransferEvent(
                  [events![2], events![3]],
                  partition1,
                  await tokenHolderSigner.getAddress(),
                  await tokenHolderSigner.getAddress(),
                  await recipientSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTES32,
                  ZERO_BYTE
                );
                assertTransferEvent(
                  [events![4], events![5]],
                  partition2,
                  await tokenHolderSigner.getAddress(),
                  await tokenHolderSigner.getAddress(),
                  await recipientSigner.getAddress(),
                  0.5 * issuanceAmount,
                  ZERO_BYTES32,
                  ZERO_BYTE
                );
              });
            });
            describe('when the sender has not defined custom default partitions', function () {
              it('transfers the requested amount', async function () {
                await assertBalances(
                  token,
                  tokenHolderSigner.getAddress(),
                  partitions,
                  [issuanceAmount, issuanceAmount, issuanceAmount]
                );

                await token
                  .connect(tokenHolderSigner)
                  .transferWithData(
                    recipientSigner.getAddress(),
                    2.5 * issuanceAmount,
                    ZERO_BYTES32
                  );

                await assertBalances(
                  token,
                  tokenHolderSigner.getAddress(),
                  partitions,
                  [0, 0, 0.5 * issuanceAmount]
                );
                await assertBalances(
                  token,
                  recipientSigner.getAddress(),
                  partitions,
                  [issuanceAmount, issuanceAmount, 0.5 * issuanceAmount]
                );
              });
            });
          });
          describe('when the sender does not have enough balance for those default partitions', function () {
            it('reverts', async function () {
              await token.setDefaultPartitions(reversedPartitions);
              await assertRevert(
                token
                  .connect(tokenHolderSigner)
                  .transferWithData(
                    recipientSigner.getAddress(),
                    3.5 * issuanceAmount,
                    ZERO_BYTES32
                  )
              );
            });
          });
        });
        describe('when the recipient is the zero address', function () {
          it('reverts', async function () {
            await token.setDefaultPartitions(reversedPartitions);
            await assertBalances(
              token,
              tokenHolderSigner.getAddress(),
              partitions,
              [issuanceAmount, issuanceAmount, issuanceAmount]
            );

            await assertRevert(
              token
                .connect(tokenHolderSigner)
                .transferWithData(
                  ZERO_ADDRESS,
                  2.5 * issuanceAmount,
                  ZERO_BYTES32
                )
            );
          });
        });
      });
      describe('when the amount is not a multiple of the granularity', function () {
        it('reverts', async function () {
          token = await new ERC1400__factory(signer).deploy(
            'ERC1400Token',
            'DAU',
            2,
            [controllerSigner.getAddress()],
            partitions
          );
          await issueOnMultiplePartitions(
            token,
            signer,
            tokenHolderSigner.getAddress(),
            partitions,
            [issuanceAmount, issuanceAmount, issuanceAmount]
          );
          await token.setDefaultPartitions(reversedPartitions);
          await assertBalances(
            token,
            tokenHolderSigner.getAddress(),
            partitions,
            [issuanceAmount, issuanceAmount, issuanceAmount]
          );

          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transferWithData(recipientSigner.getAddress(), 3, ZERO_BYTES32)
          );
        });
      });
    });
    describe('when defaultPartitions have not been defined', function () {
      it('reverts', async function () {
        const token = await new ERC1400__factory(signer).deploy(
          'ERC1400Token',
          'DAU',
          1,
          [controllerSigner.getAddress()],
          []
        );
        await issueOnMultiplePartitions(
          token,
          signer,
          tokenHolderSigner.getAddress(),
          partitions,
          [issuanceAmount, issuanceAmount, issuanceAmount]
        );
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .transferWithData(
              recipientSigner.getAddress(),
              2.5 * issuanceAmount,
              ZERO_BYTES32
            )
        );
      });
    });
  });

  // TRANSFERFROMWITHDATA

  describe('transferFromWithData', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      await issueOnMultiplePartitions(
        token,
        signer,
        tokenHolderSigner.getAddress(),
        partitions,
        [issuanceAmount, issuanceAmount, issuanceAmount]
      );
    });
    describe('when the operator is approved', function () {
      beforeEach(async function () {
        await token
          .connect(tokenHolderSigner)
          .authorizeOperator(operatorSigner.getAddress());
      });
      describe('when the amount is a multiple of the granularity', function () {
        describe('when the recipient is not the zero address', function () {
          describe('when defaultPartitions have been defined', function () {
            describe('when the sender has enough balance for those default partitions', function () {
              it('transfers the requested amount', async function () {
                await token.setDefaultPartitions(reversedPartitions);
                await assertBalances(
                  token,
                  tokenHolderSigner.getAddress(),
                  partitions,
                  [issuanceAmount, issuanceAmount, issuanceAmount]
                );

                await token
                  .connect(operatorSigner)
                  .transferFromWithData(
                    tokenHolderSigner.getAddress(),
                    recipientSigner.getAddress(),
                    2.5 * issuanceAmount,
                    ZERO_BYTES32
                  );

                await assertBalances(
                  token,
                  tokenHolderSigner.getAddress(),
                  partitions,
                  [0, 0.5 * issuanceAmount, 0]
                );
                await assertBalances(
                  token,
                  recipientSigner.getAddress(),
                  partitions,
                  [issuanceAmount, 0.5 * issuanceAmount, issuanceAmount]
                );
              });
              it('emits a sent event', async function () {
                await token.setDefaultPartitions(reversedPartitions);
                const { events } = await token
                  .connect(operatorSigner)
                  .transferFromWithData(
                    tokenHolderSigner.getAddress(),
                    recipientSigner.getAddress(),
                    2.5 * issuanceAmount,
                    ZERO_BYTES32
                  )
                  .then((res) => res.wait());

                assert.strictEqual(events!.length, 2 * partitions.length);

                assertTransferEvent(
                  [events![0], events![1]],
                  partition3,
                  await operatorSigner.getAddress(),
                  await tokenHolderSigner.getAddress(),
                  await recipientSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTES32,
                  ZERO_BYTE
                );
                assertTransferEvent(
                  [events![2], events![3]],
                  partition1,
                  await operatorSigner.getAddress(),
                  await tokenHolderSigner.getAddress(),
                  await recipientSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTES32,
                  ZERO_BYTE
                );
                assertTransferEvent(
                  [events![4], events![5]],
                  partition2,
                  await operatorSigner.getAddress(),
                  await tokenHolderSigner.getAddress(),
                  await recipientSigner.getAddress(),
                  0.5 * issuanceAmount,
                  ZERO_BYTES32,
                  ZERO_BYTE
                );
              });
            });
            describe('when the sender does not have enough balance for those default partitions', function () {
              it('reverts', async function () {
                await token.setDefaultPartitions(reversedPartitions);
                await assertRevert(
                  token
                    .connect(operatorSigner)
                    .transferFromWithData(
                      tokenHolderSigner.getAddress(),
                      recipientSigner.getAddress(),
                      3.5 * issuanceAmount,
                      ZERO_BYTES32
                    )
                );
              });
              it('reverts (mock contract - for 100% test coverage)', async function () {
                token = await new FakeERC1400Mock__factory(signer).deploy(
                  'ERC1400Token',
                  'DAU',
                  1,
                  [controllerSigner.getAddress()],
                  partitions,
                  ZERO_ADDRESS,
                  ZERO_ADDRESS
                );
                await token.issueByPartition(
                  partition1,
                  tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTES32
                );

                await assertRevert(
                  token
                    .connect(controllerSigner)
                    .transferFromWithData(
                      tokenHolderSigner.getAddress(),
                      recipientSigner.getAddress(),
                      issuanceAmount + 1,
                      ZERO_BYTES32
                    )
                );
              });
            });
          });
          describe('when defaultPartitions have not been defined', function () {
            it('reverts', async function () {
              await token.setDefaultPartitions([]);
              await assertRevert(
                token
                  .connect(operatorSigner)
                  .transferFromWithData(
                    tokenHolderSigner.getAddress(),
                    recipientSigner.getAddress(),
                    2.5 * issuanceAmount,
                    ZERO_BYTES32
                  )
              );
            });
          });
        });
        describe('when the recipient is the zero address', function () {
          it('reverts', async function () {
            await token.setDefaultPartitions(reversedPartitions);
            await assertBalances(
              token,
              tokenHolderSigner.getAddress(),
              partitions,
              [issuanceAmount, issuanceAmount, issuanceAmount]
            );

            await assertRevert(
              token
                .connect(operatorSigner)
                .transferFromWithData(
                  tokenHolderSigner.getAddress(),
                  ZERO_ADDRESS,
                  2.5 * issuanceAmount,
                  ZERO_BYTES32
                )
            );
          });
        });
      });
      describe('when the amount is not a multiple of the granularity', function () {
        it('reverts', async function () {
          token = await new ERC1400__factory(signer).deploy(
            'ERC1400Token',
            'DAU',
            2,
            [controllerSigner.getAddress()],
            partitions
          );
          await issueOnMultiplePartitions(
            token,
            signer,
            tokenHolderSigner.getAddress(),
            partitions,
            [issuanceAmount, issuanceAmount, issuanceAmount]
          );
          await token.setDefaultPartitions(reversedPartitions);
          await assertBalances(
            token,
            tokenHolderSigner.getAddress(),
            partitions,
            [issuanceAmount, issuanceAmount, issuanceAmount]
          );

          await assertRevert(
            token
              .connect(operatorSigner)
              .transferFromWithData(
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                3,
                ZERO_BYTES32
              )
          );
        });
      });
    });
    describe('when the operator is not approved', function () {
      it('reverts', async function () {
        await token.setDefaultPartitions(reversedPartitions);
        await assertRevert(
          token
            .connect(operatorSigner)
            .transferFromWithData(
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              2.5 * issuanceAmount,
              ZERO_BYTES32
            )
        );
      });
    });
  });

  // TRANSFERBYPARTITION

  describe('transferByPartition', function () {
    const transferAmount = 300;
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      await token.issueByPartition(
        partition1,
        tokenHolderSigner.getAddress(),
        issuanceAmount,
        ZERO_BYTES32
      );
    });

    describe('when the sender has enough balance for this partition', function () {
      describe('when the transfer amount is not equal to 0', function () {
        it('transfers the requested amount', async function () {
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipientSigner.getAddress(),
            partition1,
            0
          );

          await token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition1,
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTES32
            );
          await token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition1,
              recipientSigner.getAddress(),
              0,
              ZERO_BYTES32
            );

          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - transferAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipientSigner.getAddress(),
            partition1,
            transferAmount
          );
        });
        it('emits a TransferByPartition event', async function () {
          const { events } = await token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition1,
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTES32
            )
            .then((res) => res.wait());

          assert.strictEqual(events!.length, 2);

          assertTransferEvent(
            events!,
            partition1,
            await tokenHolderSigner.getAddress(),
            await tokenHolderSigner.getAddress(),
            await recipientSigner.getAddress(),
            transferAmount,
            ZERO_BYTES32,
            ZERO_BYTE
          );
        });
      });
      describe('when the transfer amount is equal to 0', function () {
        it('reverts', async function () {
          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transferByPartition(
                partition2,
                recipientSigner.getAddress(),
                0,
                ZERO_BYTES32
              )
          );
        });
      });
    });
    describe('when the sender does not have enough balance for this partition', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition2,
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTES32
            )
        );
      });
    });
  });

  // OPERATORTRANSFERBYPARTITION

  describe('operatorTransferByPartition', function () {
    const transferAmount = 300;
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      await token.issueByPartition(
        partition1,
        tokenHolderSigner.getAddress(),
        issuanceAmount,
        ZERO_BYTES32
      );
    });

    describe('when the sender is approved for this partition', function () {
      describe('when approved amount is sufficient', function () {
        it('transfers the requested amount', async function () {
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipientSigner.getAddress(),
            partition1,
            0
          );
          assert.strictEqual(
            (
              await token.allowanceByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                operatorSigner.getAddress()
              )
            ).eq(0),
            true
          );

          const approvedAmount = 400;
          await token
            .connect(tokenHolderSigner)
            .approveByPartition(
              partition1,
              operatorSigner.getAddress(),
              approvedAmount
            );
          assert.strictEqual(
            (
              await token.allowanceByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                operatorSigner.getAddress()
              )
            ).eq(approvedAmount),
            true
          );
          await token
            .connect(operatorSigner)
            .operatorTransferByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE,
              ZERO_BYTES32
            );

          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - transferAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipientSigner.getAddress(),
            partition1,
            transferAmount
          );
          assert.strictEqual(
            (
              await token.allowanceByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                operatorSigner.getAddress()
              )
            ).eq(approvedAmount - transferAmount),
            true
          );
        });
      });
      describe('when approved amount is not sufficient', function () {
        it('reverts', async function () {
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipientSigner.getAddress(),
            partition1,
            0
          );
          assert.strictEqual(
            (
              await token.allowanceByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                operatorSigner.getAddress()
              )
            ).eq(0),
            true
          );

          const approvedAmount = 200;
          await token
            .connect(tokenHolderSigner)
            .approveByPartition(
              partition1,
              operatorSigner.getAddress(),
              approvedAmount
            );
          assert.strictEqual(
            (
              await token.allowanceByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                operatorSigner.getAddress()
              )
            ).eq(approvedAmount),
            true
          );
          await assertRevert(
            token
              .connect(operatorSigner)
              .operatorTransferByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE,
                ZERO_BYTES32
              )
          );
        });
      });
    });
    describe('when the sender is an operator for this partition', function () {
      describe('when the sender has enough balance for this partition', function () {
        describe('when partition does not change', function () {
          it('transfers the requested amount', async function () {
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount
            );
            await assertBalanceOfSecurityToken(
              token,
              recipientSigner.getAddress(),
              partition1,
              0
            );

            await token
              .connect(tokenHolderSigner)
              .authorizeOperatorByPartition(
                partition1,
                operatorSigner.getAddress()
              );
            await token
              .connect(operatorSigner)
              .operatorTransferByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE,
                ZERO_BYTES32
              );

            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOfSecurityToken(
              token,
              recipientSigner.getAddress(),
              partition1,
              transferAmount
            );
          });
          it('transfers the requested amount with attached data (without changePartition flag)', async function () {
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount
            );
            await assertBalanceOfSecurityToken(
              token,
              recipientSigner.getAddress(),
              partition1,
              0
            );

            await token
              .connect(tokenHolderSigner)
              .authorizeOperatorByPartition(
                partition1,
                operatorSigner.getAddress()
              );
            await token
              .connect(operatorSigner)
              .operatorTransferByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount,
                doNotChangePartition,
                ZERO_BYTES32
              );

            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOfSecurityToken(
              token,
              recipientSigner.getAddress(),
              partition1,
              transferAmount
            );
          });
          it('emits a TransferByPartition event', async function () {
            await token
              .connect(tokenHolderSigner)
              .authorizeOperatorByPartition(
                partition1,
                operatorSigner.getAddress()
              );
            const { events } = await token
              .connect(operatorSigner)
              .operatorTransferByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE,
                ZERO_BYTES32
              )
              .then((res) => res.wait());

            assert.strictEqual(events!.length, 2);

            assertTransferEvent(
              events!,
              partition1,
              await operatorSigner.getAddress(),
              await tokenHolderSigner.getAddress(),
              await recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE,
              ZERO_BYTES32
            );
          });
        });
        describe('when partition changes', function () {
          it('transfers the requested amount', async function () {
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount
            );
            await assertBalanceOfSecurityToken(
              token,
              recipientSigner.getAddress(),
              partition2,
              0
            );

            await token
              .connect(tokenHolderSigner)
              .authorizeOperatorByPartition(
                partition1,
                operatorSigner.getAddress()
              );
            await token
              .connect(operatorSigner)
              .operatorTransferByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount,
                changeToPartition2,
                ZERO_BYTES32
              );

            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOfSecurityToken(
              token,
              recipientSigner.getAddress(),
              partition2,
              transferAmount
            );
          });
          it('converts the requested amount', async function () {
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalanceOfByPartition(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount
            );
            await assertBalanceOfByPartition(
              token,
              tokenHolderSigner.getAddress(),
              partition2,
              0
            );

            await token
              .connect(tokenHolderSigner)
              .authorizeOperatorByPartition(
                partition1,
                operatorSigner.getAddress()
              );
            await token
              .connect(operatorSigner)
              .operatorTransferByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                tokenHolderSigner.getAddress(),
                transferAmount,
                changeToPartition2,
                ZERO_BYTES32
              );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalanceOfByPartition(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOfByPartition(
              token,
              tokenHolderSigner.getAddress(),
              partition2,
              transferAmount
            );
          });
          it('emits a changedPartition event', async function () {
            await token
              .connect(tokenHolderSigner)
              .authorizeOperatorByPartition(
                partition1,
                operatorSigner.getAddress()
              );
            const { events } = await token
              .connect(operatorSigner)
              .operatorTransferByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount,
                changeToPartition2,
                ZERO_BYTES32
              )
              .then((res) => res.wait());

            assert.strictEqual(events!.length, 3);

            assertTransferEvent(
              [events![0], events![1]],
              partition1,
              await operatorSigner.getAddress(),
              await tokenHolderSigner.getAddress(),
              await recipientSigner.getAddress(),
              transferAmount,
              changeToPartition2,
              ZERO_BYTES32
            );

            assert.strictEqual(events![2].event, 'ChangedPartition');
            assert.strictEqual(events![2].args?.fromPartition, partition1);
            assert.strictEqual(events![2].args?.toPartition, partition2);
            assert.strictEqual(
              BigNumber.from(events![2].args?.value).toNumber(),
              transferAmount
            );
          });
        });
      });
      describe('when the sender does not have enough balance for this partition', function () {
        it('reverts', async function () {
          await token
            .connect(tokenHolderSigner)
            .authorizeOperatorByPartition(
              partition1,
              operatorSigner.getAddress()
            );
          await assertRevert(
            token
              .connect(operatorSigner)
              .operatorTransferByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                issuanceAmount + 1,
                ZERO_BYTE,
                ZERO_BYTES32
              )
          );
        });
      });
    });
    describe('when the sender is a global operator', function () {
      it('redeems the requested amount', async function () {
        await assertBalanceOfSecurityToken(
          token,
          tokenHolderSigner.getAddress(),
          partition1,
          issuanceAmount
        );
        await assertBalanceOfSecurityToken(
          token,
          recipientSigner.getAddress(),
          partition1,
          0
        );

        await token
          .connect(tokenHolderSigner)
          .authorizeOperator(operatorSigner.getAddress());
        await token
          .connect(operatorSigner)
          .operatorTransferByPartition(
            partition1,
            tokenHolderSigner.getAddress(),
            recipientSigner.getAddress(),
            transferAmount,
            ZERO_BYTE,
            ZERO_BYTES32
          );

        await assertBalanceOfSecurityToken(
          token,
          tokenHolderSigner.getAddress(),
          partition1,
          issuanceAmount - transferAmount
        );
        await assertBalanceOfSecurityToken(
          token,
          recipientSigner.getAddress(),
          partition1,
          transferAmount
        );
      });
    });
    describe('when the sender is neither an operatorSigner.getAddress(), nor approved', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(operatorSigner)
            .operatorTransferByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE,
              ZERO_BYTES32
            )
        );
      });
    });
  });

  // AUTHORIZEOPERATOR

  describe('authorizeOperator', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    describe('when sender authorizes an operator', function () {
      it('authorizes the operator', async function () {
        assert.strictEqual(
          await token.isOperator(
            operatorSigner.getAddress(),
            tokenHolderSigner.getAddress()
          ),
          false
        );
        await token
          .connect(tokenHolderSigner)
          .authorizeOperator(operatorSigner.getAddress());
        assert.strictEqual(
          await token.isOperator(
            operatorSigner.getAddress(),
            tokenHolderSigner.getAddress()
          ),
          true
        );
      });
      it('emits a authorized event', async function () {
        const { events } = await token
          .connect(tokenHolderSigner)
          .authorizeOperator(operatorSigner.getAddress())
          .then((res) => res.wait());

        assert.strictEqual(events!.length, 1);
        assert.strictEqual(events![0].event, 'AuthorizedOperator');
        assert.strictEqual(
          events![0].args?.operator,
          await operatorSigner.getAddress()
        );
        assert.strictEqual(
          events![0].args?.tokenHolder,
          await tokenHolderSigner.getAddress()
        );
      });
    });
    describe('when sender authorizes himself', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .authorizeOperator(tokenHolderSigner.getAddress())
        );
      });
    });
  });

  // REVOKEOPERATOR

  describe('revokeOperator', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    describe('when sender revokes an operator', function () {
      it('revokes the operator (when operator is not the controllerSigner.getAddress())', async function () {
        assert.strictEqual(
          await token.isOperator(
            operatorSigner.getAddress(),
            tokenHolderSigner.getAddress()
          ),
          false
        );
        await token
          .connect(tokenHolderSigner)
          .authorizeOperator(operatorSigner.getAddress());
        assert.strictEqual(
          await token.isOperator(
            operatorSigner.getAddress(),
            tokenHolderSigner.getAddress()
          ),
          true
        );

        await token
          .connect(tokenHolderSigner)
          .revokeOperator(operatorSigner.getAddress());

        assert.strictEqual(
          await token.isOperator(
            operatorSigner.getAddress(),
            tokenHolderSigner.getAddress()
          ),
          false
        );
      });
      it('emits a revoked event', async function () {
        const { events } = await token
          .connect(tokenHolderSigner)
          .revokeOperator(controllerSigner.getAddress())
          .then((res) => res.wait());

        assert.strictEqual(events!.length, 1);
        assert.strictEqual(events![0].event, 'RevokedOperator');
        assert.strictEqual(
          events![0].args?.operator,
          await controllerSigner.getAddress()
        );
        assert.strictEqual(
          events![0].args?.tokenHolder,
          await tokenHolderSigner.getAddress()
        );
      });
    });
    describe('when sender revokes himself', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .revokeOperator(tokenHolderSigner.getAddress())
        );
      });
    });
  });

  // AUTHORIZE OPERATOR BY PARTITION

  describe('authorizeOperatorByPartition', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    it('authorizes the operator', async function () {
      assert.strictEqual(
        await token.isOperatorForPartition(
          partition1,
          operatorSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        false
      );
      await token
        .connect(tokenHolderSigner)
        .authorizeOperatorByPartition(partition1, operatorSigner.getAddress());
      assert.strictEqual(
        await token.isOperatorForPartition(
          partition1,
          operatorSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        true
      );
    });
    it('emits an authorized event', async function () {
      const { events } = await token
        .connect(tokenHolderSigner)
        .authorizeOperatorByPartition(partition1, operatorSigner.getAddress())
        .then((res) => res.wait());

      assert.strictEqual(events!.length, 1);
      assert.strictEqual(events![0].event, 'AuthorizedOperatorByPartition');
      assert.strictEqual(events![0].args?.partition, partition1);
      assert.strictEqual(
        events![0].args?.operator,
        await operatorSigner.getAddress()
      );
      assert.strictEqual(
        events![0].args?.tokenHolder,
        await tokenHolderSigner.getAddress()
      );
    });
  });

  // REVOKEOPERATORBYPARTITION

  describe('revokeOperatorByPartition', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    describe('when operator is not controller', function () {
      it('revokes the operator', async function () {
        await token
          .connect(tokenHolderSigner)
          .authorizeOperatorByPartition(
            partition1,
            operatorSigner.getAddress()
          );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            operatorSigner.getAddress(),
            tokenHolderSigner.getAddress()
          ),
          true
        );
        await token
          .connect(tokenHolderSigner)
          .revokeOperatorByPartition(partition1, operatorSigner.getAddress());
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            operatorSigner.getAddress(),
            tokenHolderSigner.getAddress()
          ),
          false
        );
      });
      it('emits a revoked event', async function () {
        await token
          .connect(tokenHolderSigner)
          .authorizeOperatorByPartition(
            partition1,
            operatorSigner.getAddress()
          );
        const { events } = await token
          .connect(tokenHolderSigner)
          .revokeOperatorByPartition(partition1, operatorSigner.getAddress())
          .then((res) => res.wait());

        assert.strictEqual(events!.length, 1);
        assert.strictEqual(events![0].event, 'RevokedOperatorByPartition');
        assert.strictEqual(events![0].args?.partition, partition1);
        assert.strictEqual(
          events![0].args?.operator,
          await operatorSigner.getAddress()
        );
        assert.strictEqual(
          events![0].args?.tokenHolder,
          await tokenHolderSigner.getAddress()
        );
      });
    });
  });

  // ISOPERATOR

  describe('isOperator', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    it('when operator is tokenHolder', async function () {
      assert.strictEqual(
        await token.isOperator(
          tokenHolderSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        true
      );
    });
    it('when operator is authorized by tokenHolder', async function () {
      await token
        .connect(tokenHolderSigner)
        .authorizeOperator(operatorSigner.getAddress());
      assert.strictEqual(
        await token.isOperator(
          operatorSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        true
      );
    });
    it('when is a revoked operator', async function () {
      await token
        .connect(tokenHolderSigner)
        .authorizeOperator(operatorSigner.getAddress());
      await token
        .connect(tokenHolderSigner)
        .revokeOperator(operatorSigner.getAddress());
      assert.strictEqual(
        await token.isOperator(
          operatorSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        false
      );
    });
    it('when is a controller and token is controllable', async function () {
      assert.strictEqual(
        await token.isOperator(
          controllerSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        true
      );
    });
    it('when is a controller and token is not controllable', async function () {
      await token.connect(signer).renounceControl();
      assert.strictEqual(
        await token.isOperator(
          controllerSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        false
      );
    });
  });

  // ISOPERATORFORPARTITION

  describe('isOperatorForPartition', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    it('when operator is tokenHolder', async function () {
      assert.strictEqual(
        await token.isOperatorForPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        true
      );
    });
    it('when operator is authorized by tokenHolder', async function () {
      await token
        .connect(tokenHolderSigner)
        .authorizeOperatorByPartition(partition1, operatorSigner.getAddress());
      assert.strictEqual(
        await token.isOperatorForPartition(
          partition1,
          operatorSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        true
      );
    });
    it('when is a revoked operator', async function () {
      await token
        .connect(tokenHolderSigner)
        .authorizeOperatorByPartition(partition1, operatorSigner.getAddress());
      await token
        .connect(tokenHolderSigner)
        .revokeOperatorByPartition(partition1, operatorSigner.getAddress());
      assert.strictEqual(
        await token.isOperatorForPartition(
          partition1,
          operatorSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        false
      );
    });
    it('when is a controller and token is controllable', async function () {
      assert.strictEqual(
        await token.isOperatorForPartition(
          partition1,
          controllerSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        true
      );
    });
    it('when is a controller and token is not controllable', async function () {
      await token.connect(signer).renounceControl();
      assert.strictEqual(
        await token.isOperatorForPartition(
          partition1,
          controllerSigner.getAddress(),
          tokenHolderSigner.getAddress()
        ),
        false
      );
    });
  });

  // ISSUE

  describe('issue', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });

    describe('when sender is the issuer', function () {
      describe('when token is issuable', function () {
        describe('when default partitions have been defined', function () {
          describe('when the amount is a multiple of the granularity', function () {
            describe('when the recipient is not the zero address', function () {
              it('issues the requested amount', async function () {
                await token.issue(
                  tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTES32
                );

                await assertTotalSupply(token, issuanceAmount);
                await assertBalanceOfSecurityToken(
                  token,
                  tokenHolderSigner.getAddress(),
                  partition1,
                  issuanceAmount
                );
              });
              it('issues twice the requested amount', async function () {
                await token.issue(
                  tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTES32
                );
                await token.issue(
                  tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTES32
                );

                await assertTotalSupply(token, 2 * issuanceAmount);
                await assertBalanceOfSecurityToken(
                  token,
                  tokenHolderSigner.getAddress(),
                  partition1,
                  2 * issuanceAmount
                );
              });
              it('emits a issuedByPartition event', async function () {
                const { events } = await token
                  .issue(
                    tokenHolderSigner.getAddress(),
                    issuanceAmount,
                    ZERO_BYTES32
                  )
                  .then((res) => res.wait());

                assert.strictEqual(events!.length, 3);

                // assert.strictEqual(events![0].event, 'Checked');
                // assert.strictEqual(events![0].args.sender, signer.getAddress());

                assert.strictEqual(events![0].event, 'Issued');
                assert.strictEqual(
                  events![0].args?.operator,
                  await signer.getAddress()
                );
                assert.strictEqual(
                  events![0].args?.to,
                  await tokenHolderSigner.getAddress()
                );
                assert.strictEqual(
                  BigNumber.from(events![0].args?.value).toNumber(),
                  issuanceAmount
                );
                assert.strictEqual(events![0].args?.data, ZERO_BYTES32);
                assert.strictEqual(events![0].args?.operatorData, undefined);

                assert.strictEqual(events![1].event, 'Transfer');
                assert.strictEqual(events![1].args?.from, ZERO_ADDRESS);
                assert.strictEqual(
                  events![1].args?.to,
                  await tokenHolderSigner.getAddress()
                );
                assert.strictEqual(
                  BigNumber.from(events![1].args?.value).toNumber(),
                  issuanceAmount
                );

                assert.strictEqual(events![2].event, 'IssuedByPartition');
                assert.strictEqual(events![2].args?.partition, partition1);
                assert.strictEqual(
                  events![2].args?.operator,
                  await signer.getAddress()
                );
                assert.strictEqual(
                  events![2].args?.to,
                  await tokenHolderSigner.getAddress()
                );
                assert.strictEqual(
                  BigNumber.from(events![2].args?.value).toNumber(),
                  issuanceAmount
                );
                assert.strictEqual(events![2].args?.data, ZERO_BYTES32);
                assert.strictEqual(events![2].args?.operatorData, ZERO_BYTE);
              });
            });
            describe('when the recipient is not the zero address', function () {
              it('issues the requested amount', async function () {
                await assertRevert(
                  token.issue(ZERO_ADDRESS, issuanceAmount, ZERO_BYTES32)
                );
              });
            });
          });
          describe('when the amount is not a multiple of the granularity', function () {
            it('issues the requested amount', async function () {
              token = await new ERC1400__factory(signer).deploy(
                'ERC1400Token',
                'DAU',
                2,
                [controllerSigner.getAddress()],
                partitions
              );
              await assertRevert(
                token.issue(tokenHolderSigner.getAddress(), 1, ZERO_BYTES32)
              );
            });
          });
        });
        describe('when default partitions have not been defined', function () {
          it('reverts', async function () {
            token = await new ERC1400__factory(signer).deploy(
              'ERC1400Token',
              'DAU',
              1,
              [controllerSigner.getAddress()],
              []
            );
            await assertRevert(
              token.issue(
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                ZERO_BYTES32
              )
            );
          });
        });
      });
      describe('when token is not issuable', function () {
        it('reverts', async function () {
          assert.strictEqual(await token.isIssuable(), true);
          await token.connect(signer).renounceIssuance();
          assert.strictEqual(await token.isIssuable(), false);
          await assertRevert(
            token.issue(
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTES32
            )
          );
        });
      });
    });
    describe('when sender is not the issuer', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(unknownSigner)
            .issue(tokenHolderSigner.getAddress(), issuanceAmount, ZERO_BYTES32)
        );
      });
    });
  });

  // ISSUEBYPARTITION

  describe('issueByPartition', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });

    describe('when sender is the issuer', function () {
      describe('when token is issuable', function () {
        it('issues the requested amount', async function () {
          await token.issueByPartition(
            partition1,
            tokenHolderSigner.getAddress(),
            issuanceAmount,
            ZERO_BYTES32
          );

          await assertTotalSupply(token, issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
        });
        it('issues twice the requested amount', async function () {
          await token.issueByPartition(
            partition1,
            tokenHolderSigner.getAddress(),
            issuanceAmount,
            ZERO_BYTES32
          );
          await token.issueByPartition(
            partition1,
            tokenHolderSigner.getAddress(),
            issuanceAmount,
            ZERO_BYTES32
          );

          await assertTotalSupply(token, 2 * issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            2 * issuanceAmount
          );
        });
        it('emits a issuedByPartition event', async function () {
          const { events } = await token
            .issueByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTES32
            )
            .then((res) => res.wait());

          assert.strictEqual(events!.length, 3);

          //   assert.strictEqual(events![0].event, 'Checked');
          //   assert.strictEqual(events![0].args.sender, signer.getAddress());

          assert.strictEqual(events![0].event, 'Issued');
          assert.strictEqual(
            events![0].args?.operator,
            await signer.getAddress()
          );
          assert.strictEqual(
            events![0].args?.to,
            await tokenHolderSigner.getAddress()
          );
          assert.strictEqual(
            BigNumber.from(events![0].args?.value).toNumber(),
            issuanceAmount
          );
          assert.strictEqual(events![0].args?.data, ZERO_BYTES32);
          assert.strictEqual(events![0].args?.operatorData, undefined);

          assert.strictEqual(events![1].event, 'Transfer');
          assert.strictEqual(events![1].args?.from, ZERO_ADDRESS);
          assert.strictEqual(
            events![1].args?.to,
            await tokenHolderSigner.getAddress()
          );
          assert.strictEqual(
            BigNumber.from(events![1].args?.value).toNumber(),
            issuanceAmount
          );

          assert.strictEqual(events![2].event, 'IssuedByPartition');
          assert.strictEqual(events![2].args?.partition, partition1);
          assert.strictEqual(
            events![2].args?.operator,
            await signer.getAddress()
          );
          assert.strictEqual(
            events![2].args?.to,
            await tokenHolderSigner.getAddress()
          );
          assert.strictEqual(
            BigNumber.from(events![2].args?.value).toNumber(),
            issuanceAmount
          );
          assert.strictEqual(events![2].args?.data, ZERO_BYTES32);
          assert.strictEqual(events![2].args?.operatorData, ZERO_BYTE);
        });
      });
      describe('when token is not issuable', function () {
        it('reverts', async function () {
          assert.strictEqual(await token.isIssuable(), true);
          await token.connect(signer).renounceIssuance();
          assert.strictEqual(await token.isIssuable(), false);
          await assertRevert(
            token.issueByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTES32
            )
          );
        });
      });
    });
    describe('when sender is not the issuer', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(unknownSigner)
            .issueByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTES32
            )
        );
      });
    });
  });

  // REDEEM

  describe('redeem', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      await issueOnMultiplePartitions(
        token,
        signer,
        tokenHolderSigner.getAddress(),
        partitions,
        [issuanceAmount, issuanceAmount, issuanceAmount]
      );
    });
    describe('when defaultPartitions have been defined', function () {
      describe('when the amount is a multiple of the granularity', function () {
        describe('when the sender has enough balance for those default partitions', function () {
          it('redeeems the requested amount', async function () {
            await token.setDefaultPartitions(reversedPartitions);
            await assertBalances(
              token,
              tokenHolderSigner.getAddress(),
              partitions,
              [issuanceAmount, issuanceAmount, issuanceAmount]
            );

            await token
              .connect(tokenHolderSigner)
              .redeem(2.5 * issuanceAmount, ZERO_BYTES32);

            await assertBalances(
              token,
              tokenHolderSigner.getAddress(),
              partitions,
              [0, 0.5 * issuanceAmount, 0]
            );
          });
          it('emits a redeemedByPartition events', async function () {
            await token.setDefaultPartitions(reversedPartitions);
            const { events } = await token
              .connect(tokenHolderSigner)
              .redeem(2.5 * issuanceAmount, ZERO_BYTES32)
              .then((res) => res.wait());

            assert.strictEqual(events!.length, 3 * partitions.length);

            assertBurnEvent(
              [events![0], events![1], events![2]],
              partition3,
              await tokenHolderSigner.getAddress(),
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTES32,
              ZERO_BYTE
            );
            assertBurnEvent(
              [events![3], events![4], events![5]],
              partition1,
              await tokenHolderSigner.getAddress(),
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTES32,
              ZERO_BYTE
            );
            assertBurnEvent(
              [events![6], events![7], events![8]],
              partition2,
              await tokenHolderSigner.getAddress(),
              await tokenHolderSigner.getAddress(),
              0.5 * issuanceAmount,
              ZERO_BYTES32,
              ZERO_BYTE
            );
          });
        });
        describe('when the sender does not have enough balance for those default partitions', function () {
          it('reverts', async function () {
            await token.setDefaultPartitions(reversedPartitions);
            await assertRevert(
              token
                .connect(tokenHolderSigner)
                .redeem(3.5 * issuanceAmount, ZERO_BYTES32)
            );
          });
        });
      });
      describe('when the amount is not a multiple of the granularity', function () {
        it('reverts', async function () {
          token = await new ERC1400__factory(signer).deploy(
            'ERC1400Token',
            'DAU',
            2,
            [controllerSigner.getAddress()],
            partitions
          );
          await issueOnMultiplePartitions(
            token,
            signer,
            tokenHolderSigner.getAddress(),
            partitions,
            [issuanceAmount, issuanceAmount, issuanceAmount]
          );
          await token.setDefaultPartitions(reversedPartitions);
          await assertBalances(
            token,
            tokenHolderSigner.getAddress(),
            partitions,
            [issuanceAmount, issuanceAmount, issuanceAmount]
          );

          await assertRevert(
            token.connect(tokenHolderSigner).redeem(3, ZERO_BYTES32)
          );
        });
      });
    });
    describe('when defaultPartitions have not been defined', function () {
      it('reverts', async function () {
        await token.setDefaultPartitions([]);
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .redeem(2.5 * issuanceAmount, ZERO_BYTES32)
        );
      });
    });
  });

  // REDEEMFROM

  describe('redeemFrom', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      await issueOnMultiplePartitions(
        token,
        signer,
        tokenHolderSigner.getAddress(),
        partitions,
        [issuanceAmount, issuanceAmount, issuanceAmount]
      );
    });
    describe('when the operator is approved', function () {
      beforeEach(async function () {
        await token
          .connect(tokenHolderSigner)
          .authorizeOperator(operatorSigner.getAddress());
      });
      describe('when defaultPartitions have been defined', function () {
        describe('when the sender has enough balance for those default partitions', function () {
          describe('when the amount is a multiple of the granularity', function () {
            describe('when the redeemer is not the zero address', function () {
              it('redeems the requested amount', async function () {
                await token.setDefaultPartitions(reversedPartitions);
                await assertBalances(
                  token,
                  tokenHolderSigner.getAddress(),
                  partitions,
                  [issuanceAmount, issuanceAmount, issuanceAmount]
                );

                await token
                  .connect(operatorSigner)
                  .redeemFrom(
                    tokenHolderSigner.getAddress(),
                    2.5 * issuanceAmount,
                    ZERO_BYTES32
                  );

                await assertBalances(
                  token,
                  tokenHolderSigner.getAddress(),
                  partitions,
                  [0, 0.5 * issuanceAmount, 0]
                );
              });
              it('emits redeemedByPartition events', async function () {
                await token.setDefaultPartitions(reversedPartitions);
                const { events } = await token
                  .connect(operatorSigner)
                  .redeemFrom(
                    tokenHolderSigner.getAddress(),
                    2.5 * issuanceAmount,
                    ZERO_BYTES32
                  )
                  .then((res) => res.wait());

                assert.strictEqual(events!.length, 3 * partitions.length);

                assertBurnEvent(
                  [events![0], events![1], events![2]],
                  partition3,
                  await operatorSigner.getAddress(),
                  await tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTES32,
                  ZERO_BYTE
                );
                assertBurnEvent(
                  [events![3], events![4], events![5]],
                  partition1,
                  await operatorSigner.getAddress(),
                  await tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTES32,
                  ZERO_BYTE
                );
                assertBurnEvent(
                  [events![6], events![7], events![8]],
                  partition2,
                  await operatorSigner.getAddress(),
                  await tokenHolderSigner.getAddress(),
                  0.5 * issuanceAmount,
                  ZERO_BYTES32,
                  ZERO_BYTE
                );
              });
            });
            describe('when the redeemer is the zero address', function () {
              it('reverts', async function () {
                await token.setDefaultPartitions(reversedPartitions);
                await assertBalances(
                  token,
                  tokenHolderSigner.getAddress(),
                  partitions,
                  [issuanceAmount, issuanceAmount, issuanceAmount]
                );

                await assertRevert(
                  token
                    .connect(controllerSigner)
                    .redeemFrom(
                      ZERO_ADDRESS,
                      2.5 * issuanceAmount,
                      ZERO_BYTES32
                    )
                );
              });
              it('reverts (mock contract - for 100% test coverage)', async function () {
                token = await new FakeERC1400Mock__factory(signer).deploy(
                  'ERC1400Token',
                  'DAU',
                  1,
                  [controllerSigner.getAddress()],
                  partitions,
                  ZERO_ADDRESS,
                  ZERO_ADDRESS
                );
                await issueOnMultiplePartitions(
                  token,
                  signer,
                  tokenHolderSigner.getAddress(),
                  partitions,
                  [issuanceAmount, issuanceAmount, issuanceAmount]
                );
                await token.setDefaultPartitions(reversedPartitions);

                await assertRevert(
                  token
                    .connect(controllerSigner)
                    .redeemFrom(
                      ZERO_ADDRESS,
                      2.5 * issuanceAmount,
                      ZERO_BYTES32
                    )
                );
              });
            });
          });
          describe('when the amount is not a multiple of the granularity', function () {
            it('reverts', async function () {
              token = await new ERC1400__factory(signer).deploy(
                'ERC1400Token',
                'DAU',
                2,
                [controllerSigner.getAddress()],
                partitions
              );
              await issueOnMultiplePartitions(
                token,
                signer,
                tokenHolderSigner.getAddress(),
                partitions,
                [issuanceAmount, issuanceAmount, issuanceAmount]
              );
              await token.setDefaultPartitions(reversedPartitions);
              await assertBalances(
                token,
                tokenHolderSigner.getAddress(),
                partitions,
                [issuanceAmount, issuanceAmount, issuanceAmount]
              );

              await assertRevert(
                token
                  .connect(operatorSigner)
                  .redeemFrom(tokenHolderSigner.getAddress(), 3, ZERO_BYTES32)
              );
            });
          });
        });
        describe('when the sender does not have enough balance for those default partitions', function () {
          it('reverts', async function () {
            await token.setDefaultPartitions(reversedPartitions);
            await assertRevert(
              token
                .connect(operatorSigner)
                .redeemFrom(
                  tokenHolderSigner.getAddress(),
                  3.5 * issuanceAmount,
                  ZERO_BYTES32
                )
            );
          });
          it('reverts (mock contract - for 100% test coverage)', async function () {
            token = await new FakeERC1400Mock__factory(signer).deploy(
              'ERC1400Token',
              'DAU',
              1,
              [controllerSigner.getAddress()],
              partitions,
              ZERO_ADDRESS,
              ZERO_ADDRESS
            );

            await issueOnMultiplePartitions(
              token,
              signer,
              tokenHolderSigner.getAddress(),
              partitions,
              [issuanceAmount, issuanceAmount, issuanceAmount]
            );

            await token.setDefaultPartitions(reversedPartitions);

            await assertRevert(
              token
                .connect(controllerSigner)
                .redeemFrom(
                  tokenHolderSigner.getAddress(),
                  3.5 * issuanceAmount,
                  ZERO_BYTES32
                )
            );
          });
        });
      });
      describe('when defaultPartitions have not been defined', function () {
        it('reverts', async function () {
          await token.setDefaultPartitions([]);
          await assertRevert(
            token
              .connect(operatorSigner)
              .redeemFrom(
                tokenHolderSigner.getAddress(),
                2.5 * issuanceAmount,
                ZERO_BYTES32
              )
          );
        });
      });
    });
    describe('when the operator is not approved', function () {
      it('reverts', async function () {
        await token.setDefaultPartitions(reversedPartitions);
        await assertRevert(
          token
            .connect(operatorSigner)
            .redeemFrom(
              tokenHolderSigner.getAddress(),
              2.5 * issuanceAmount,
              ZERO_BYTES32
            )
        );
      });
    });
  });

  // REDEEMBYPARTITION

  describe('redeemByPartition', function () {
    const redeemAmount = 300;
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      await token.issueByPartition(
        partition1,
        tokenHolderSigner.getAddress(),
        issuanceAmount,
        ZERO_BYTES32
      );
    });

    describe('when the redeemer has enough balance for this partition', function () {
      it('redeems the requested amount', async function () {
        await token
          .connect(tokenHolderSigner)
          .redeemByPartition(partition1, redeemAmount, ZERO_BYTES32);

        await assertTotalSupply(token, issuanceAmount - redeemAmount);
        await assertBalanceOfSecurityToken(
          token,
          tokenHolderSigner.getAddress(),
          partition1,
          issuanceAmount - redeemAmount
        );
      });
      it('emits a redeemedByPartition event', async function () {
        const { events } = await token
          .connect(tokenHolderSigner)
          .redeemByPartition(partition1, redeemAmount, ZERO_BYTES32)
          .then((res) => res.wait());

        assert.strictEqual(events!.length, 3);

        assertBurnEvent(
          events!,
          partition1,
          await tokenHolderSigner.getAddress(),
          await tokenHolderSigner.getAddress(),
          redeemAmount,
          ZERO_BYTES32,
          ZERO_BYTE
        );
      });
    });
    describe('when the redeemer does not have enough balance for this partition', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .redeemByPartition(partition2, redeemAmount, ZERO_BYTES32)
        );
      });
    });
    describe('special case (_removeTokenFromPartition shall revert)', function () {
      it('reverts', async function () {
        await token.issueByPartition(
          partition2,
          signer.getAddress(),
          issuanceAmount,
          ZERO_BYTES32
        );
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .redeemByPartition(partition2, 0, ZERO_BYTES32)
        );
      });
    });
  });

  // OPERATOREDEEMBYPARTITION

  describe('operatorRedeemByPartition', function () {
    const redeemAmount = 300;
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      await token.issueByPartition(
        partition1,
        tokenHolderSigner.getAddress(),
        issuanceAmount,
        ZERO_BYTES32
      );
    });

    describe('when the sender is an operator for this partition', function () {
      describe('when the redeemer has enough balance for this partition', function () {
        it('redeems the requested amount', async function () {
          await token
            .connect(tokenHolderSigner)
            .authorizeOperatorByPartition(
              partition1,
              operatorSigner.getAddress()
            );
          await token
            .connect(operatorSigner)
            .operatorRedeemByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              redeemAmount,
              ZERO_BYTES32
            );

          await assertTotalSupply(token, issuanceAmount - redeemAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - redeemAmount
          );
        });
        it('emits a redeemedByPartition event', async function () {
          await token
            .connect(tokenHolderSigner)
            .authorizeOperatorByPartition(
              partition1,
              operatorSigner.getAddress()
            );
          const { events } = await token
            .connect(operatorSigner)
            .operatorRedeemByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              redeemAmount,
              ZERO_BYTES32
            )
            .then((res) => res.wait());

          assert.strictEqual(events!.length, 3);

          assertBurnEvent(
            events!,
            partition1,
            await operatorSigner.getAddress(),
            await tokenHolderSigner.getAddress(),
            redeemAmount,
            ZERO_BYTE,
            ZERO_BYTES32
          );
        });
      });
      describe('when the redeemer does not have enough balance for this partition', function () {
        it('reverts', async function () {
          it('redeems the requested amount', async function () {
            await token
              .connect(tokenHolderSigner)
              .authorizeOperatorByPartition(
                partition1,
                operatorSigner.getAddress()
              );

            await assertRevert(
              token
                .connect(operatorSigner)
                .operatorRedeemByPartition(
                  partition1,
                  tokenHolderSigner.getAddress(),
                  issuanceAmount + 1,
                  ZERO_BYTES32
                )
            );
          });
        });
      });
    });
    describe('when the sender is a global operator', function () {
      it('redeems the requested amount', async function () {
        await token
          .connect(tokenHolderSigner)
          .authorizeOperator(operatorSigner.getAddress());
        await token
          .connect(operatorSigner)
          .operatorRedeemByPartition(
            partition1,
            tokenHolderSigner.getAddress(),
            redeemAmount,
            ZERO_BYTES32
          );

        await assertTotalSupply(token, issuanceAmount - redeemAmount);
        await assertBalanceOfSecurityToken(
          token,
          tokenHolderSigner.getAddress(),
          partition1,
          issuanceAmount - redeemAmount
        );
      });
    });
    describe('when the sender is not an operator', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(operatorSigner)
            .operatorRedeemByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              redeemAmount,
              ZERO_BYTES32
            )
        );
      });
    });
  });

  // BASIC FUNCTIONNALITIES

  describe('parameters', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });

    describe('name', function () {
      it('returns the name of the token', async function () {
        const name = await token.name();

        assert.strictEqual(name, 'ERC1400Token');
      });
    });

    describe('symbol', function () {
      it('returns the symbol of the token', async function () {
        const symbol = await token.symbol();

        assert.strictEqual(symbol, 'DAU');
      });
    });

    describe('decimals', function () {
      it('returns the decimals the token', async function () {
        const decimals = await token.decimals();

        assert.strictEqual(decimals, 18);
      });
    });

    describe('granularity', function () {
      it('returns the granularity of tokens', async function () {
        const granularity = await token.granularity();

        assert.strictEqual(granularity.toNumber(), 1);
      });
    });

    describe('totalPartitions', function () {
      it('returns the list of partitions', async function () {
        let totalPartitions = await token.totalPartitions();
        assert.strictEqual(totalPartitions.length, 0);

        await token.issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTES32
        );
        totalPartitions = await token.totalPartitions();
        assert.strictEqual(totalPartitions.length, 1);
        assert.strictEqual(totalPartitions[0], partition1);

        await token.issueByPartition(
          partition2,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTES32
        );
        totalPartitions = await token.totalPartitions();
        assert.strictEqual(totalPartitions.length, 2);
        assert.strictEqual(totalPartitions[0], partition1);
        assert.strictEqual(totalPartitions[1], partition2);

        await token.issueByPartition(
          partition3,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTES32
        );
        totalPartitions = await token.totalPartitions();
        assert.strictEqual(totalPartitions.length, 3);
        assert.strictEqual(totalPartitions[0], partition1);
        assert.strictEqual(totalPartitions[1], partition2);
        assert.strictEqual(totalPartitions[2], partition3);
      });
    });

    describe('totalSupplyByPartition', function () {
      it('returns the totalSupply of a given partition', async function () {
        totalSupplyPartition1 = await token.totalSupplyByPartition(partition1);
        totalSupplyPartition2 = await token.totalSupplyByPartition(partition2);
        assert.strictEqual(totalSupplyPartition1.eq(0), true);
        assert.strictEqual(totalSupplyPartition2.eq(0), true);

        await token.issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTES32
        );
        totalSupplyPartition1 = await token.totalSupplyByPartition(partition1);
        totalSupplyPartition2 = await token.totalSupplyByPartition(partition2);
        assert.strictEqual(totalSupplyPartition1.eq(issuanceAmount), true);
        assert.strictEqual(totalSupplyPartition2.eq(0), true);

        await token.issueByPartition(
          partition2,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTES32
        );
        totalSupplyPartition1 = await token.totalSupplyByPartition(partition1);
        totalSupplyPartition2 = await token.totalSupplyByPartition(partition2);
        assert.strictEqual(totalSupplyPartition1.eq(issuanceAmount), true);
        assert.strictEqual(totalSupplyPartition2.eq(issuanceAmount), true);

        await token.issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTES32
        );
        totalSupplyPartition1 = await token.totalSupplyByPartition(partition1);
        totalSupplyPartition2 = await token.totalSupplyByPartition(partition2);
        assert.strictEqual(totalSupplyPartition1.eq(2 * issuanceAmount), true);
        assert.strictEqual(totalSupplyPartition2.eq(issuanceAmount), true);
      });
    });

    describe('total supply', function () {
      it('returns the total amount of tokens', async function () {
        await token.issue(
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTES32
        );
        const totalSupply = await token.totalSupply();

        assert.strictEqual(totalSupply.eq(issuanceAmount), true);
      });
    });

    describe('balanceOf', function () {
      describe('when the requested account has no tokens', function () {
        it('returns zero', async function () {
          const balance = await token.balanceOf(unknownSigner.getAddress());

          assert.strictEqual(balance.eq(0), true);
        });
      });

      describe('when the requested account has some tokens', function () {
        it('returns the total amount of tokens', async function () {
          await token.issue(
            tokenHolderSigner.getAddress(),
            issuanceAmount,
            ZERO_BYTES32
          );
          const balance = await token.balanceOf(tokenHolderSigner.getAddress());

          assert.strictEqual(balance.eq(issuanceAmount), true);
        });
      });
    });

    describe('controllers', function () {
      it('returns the list of controllers', async function () {
        const controllers = await token.controllers();

        assert.strictEqual(controllers.length, 1);
        assert.strictEqual(controllers[0], await controllerSigner.getAddress());
      });
    });

    describe('implementer1400', function () {
      it('returns the contract address', async function () {
        let interface1400Implementer = await registry.getInterfaceImplementer(
          token.address,
          ethers.utils.id(ERC1400_INTERFACE_NAME)
        );
        assert.strictEqual(interface1400Implementer, token.address);
      });
    });

    describe('implementer20', function () {
      it('returns the zero address', async function () {
        let interface20Implementer = await registry.getInterfaceImplementer(
          token.address,
          ethers.utils.id(ERC20_INTERFACE_NAME)
        );
        assert.strictEqual(interface20Implementer, token.address);
      });
    });
  });

  // SET CONTROLLERS

  describe('setControllers', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    describe('when the caller is the contract owner', function () {
      it('sets the operators as controllers', async function () {
        const controllers1 = await token.controllers();
        assert.strictEqual(controllers1.length, 1);
        assert.strictEqual(
          controllers1[0],
          await controllerSigner.getAddress()
        );
        assert.strictEqual(
          await token.isOperator(
            controllerSigner.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await token.isOperator(
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        assert.strictEqual(
          await token.isOperator(
            controllerAlternative2Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        await token.setControllers([
          controllerAlternative1Signer.getAddress(),
          controllerAlternative2Signer.getAddress()
        ]);
        const controllers2 = await token.controllers();
        assert.strictEqual(controllers2.length, 2);
        assert.strictEqual(
          controllers2[0],
          await controllerAlternative1Signer.getAddress()
        );
        assert.strictEqual(
          controllers2[1],
          await controllerAlternative2Signer.getAddress()
        );
        assert.strictEqual(
          await token.isOperator(
            controllerSigner.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        assert.strictEqual(
          await token.isOperator(
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await token.isOperator(
            controllerAlternative2Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        await token.connect(signer).renounceControl();
        assert.strictEqual(
          await token.isOperator(
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        assert.strictEqual(
          await token.isOperator(
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        assert.strictEqual(
          await token.isOperator(
            controllerAlternative2Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
      });
    });
    describe('when the caller is not the contract owner', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(unknownSigner)
            .setControllers([
              controllerAlternative1Signer.getAddress(),
              controllerAlternative2Signer.getAddress()
            ])
        );
      });
    });
  });

  // SET PARTITION CONTROLLERS

  describe('setPartitionControllers', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    describe('when the caller is the contract owner', function () {
      it('sets the operators as controllers for the specified partition', async function () {
        assert.strictEqual(await token.isControllable(), true);

        const controllers1 = await token.controllersByPartition(partition1);
        assert.strictEqual(controllers1.length, 0);
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerSigner.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative2Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        await token.setPartitionControllers(partition1, [
          controllerAlternative1Signer.getAddress(),
          controllerAlternative2Signer.getAddress()
        ]);
        const controllers2 = await token.controllersByPartition(partition1);
        assert.strictEqual(controllers2.length, 2);
        assert.strictEqual(
          controllers2[0],
          await controllerAlternative1Signer.getAddress()
        );
        assert.strictEqual(
          controllers2[1],
          await controllerAlternative2Signer.getAddress()
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerSigner.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative2Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        await token.connect(signer).renounceControl();
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative2Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
      });
      it('removes the operators as controllers for the specified partition', async function () {
        assert.strictEqual(await token.isControllable(), true);

        const controllers1 = await token.controllersByPartition(partition1);
        assert.strictEqual(controllers1.length, 0);
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerSigner.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative2Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        await token.setPartitionControllers(partition1, [
          controllerAlternative1Signer.getAddress(),
          controllerAlternative2Signer.getAddress()
        ]);
        const controllers2 = await token.controllersByPartition(partition1);
        assert.strictEqual(controllers2.length, 2);
        assert.strictEqual(
          controllers2[0],
          await controllerAlternative1Signer.getAddress()
        );
        assert.strictEqual(
          controllers2[1],
          await controllerAlternative2Signer.getAddress()
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerSigner.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative2Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        await token.setPartitionControllers(partition1, [
          controllerAlternative2Signer.getAddress()
        ]);
        const controllers3 = await token.controllersByPartition(partition1);
        assert.strictEqual(controllers3.length, 1);
        assert.strictEqual(
          controllers3[0],
          await controllerAlternative2Signer.getAddress()
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerSigner.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative1Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          false
        );
        assert.strictEqual(
          await token.isOperatorForPartition(
            partition1,
            controllerAlternative2Signer.getAddress(),
            unknownSigner.getAddress()
          ),
          true
        );
      });
    });
    describe('when the caller is not the contract owner', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(unknownSigner)
            .setPartitionControllers(partition1, [
              controllerAlternative1Signer.getAddress(),
              controllerAlternative2Signer.getAddress()
            ])
        );
      });
    });
  });

  // SET/GET TOKEN DEFAULT PARTITIONS
  describe('defaultPartitions', function () {
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      defaultPartitions = await token.getDefaultPartitions();
      assert.strictEqual(defaultPartitions.length, 3);
      assert.strictEqual(defaultPartitions[0], partition1);
      assert.strictEqual(defaultPartitions[1], partition2);
      assert.strictEqual(defaultPartitions[2], partition3);
    });
    describe('when the sender is the contract owner', function () {
      it('sets the list of token default partitions', async function () {
        await token.setDefaultPartitions(reversedPartitions);
        defaultPartitions = await token.getDefaultPartitions();
        assert.strictEqual(defaultPartitions.length, 3);
        assert.strictEqual(defaultPartitions[0], partition3);
        assert.strictEqual(defaultPartitions[1], partition1);
        assert.strictEqual(defaultPartitions[2], partition2);
      });
    });
    describe('when the sender is not the contract owner', function () {
      it('reverts', async function () {
        await assertRevert(
          token.connect(unknownSigner).setDefaultPartitions(reversedPartitions)
        );
      });
    });
  });

  // APPROVE BY PARTITION

  describe('approveByPartition', function () {
    const amount = 100;
    let token: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
    });
    describe('when sender approves an operator for a given partition', function () {
      it('approves the operator', async function () {
        assert.strictEqual(
          (
            await token.allowanceByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              operatorSigner.getAddress()
            )
          ).toNumber(),
          0
        );

        await token
          .connect(tokenHolderSigner)
          .approveByPartition(partition1, operatorSigner.getAddress(), amount);

        assert.strictEqual(
          (
            await token.allowanceByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              operatorSigner.getAddress()
            )
          ).eq(amount),
          true
        );
      });
      it('emits an approval event', async function () {
        const { events } = await token
          .connect(tokenHolderSigner)
          .approveByPartition(partition1, operatorSigner.getAddress(), amount)
          .then((res) => res.wait());

        assert.strictEqual(events!.length, 1);
        assert.strictEqual(events![0].event, 'ApprovalByPartition');
        assert.strictEqual(events![0].args?.partition, partition1);
        assert.strictEqual(
          events![0].args?.owner,
          await tokenHolderSigner.getAddress()
        );
        assert.strictEqual(
          events![0].args?.spender,
          await operatorSigner.getAddress()
        );
        assert.strictEqual(
          BigNumber.from(events![0].args?.value).toNumber(),
          amount
        );
      });
    });
    describe('when the operator to approve is the zero address', function () {
      it('reverts', async function () {
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .approveByPartition(partition1, ZERO_ADDRESS, amount)
        );
      });
    });
  });

  // MIGRATE
  describe('migrate', function () {
    const transferAmount = 300;
    let token: ERC1400;
    let migratedToken: ERC1400;
    beforeEach(async function () {
      token = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU20',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      migratedToken = await new ERC1400__factory(signer).deploy(
        'ERC1400Token',
        'DAU20',
        1,
        [controllerSigner.getAddress()],
        partitions
      );
      await token.issueByPartition(
        partition1,
        tokenHolderSigner.getAddress(),
        issuanceAmount,
        ZERO_BYTES32
      );
    });
    describe('when the sender is the contract owner', function () {
      describe('when the contract is not migrated', function () {
        it('can transfer tokens', async function () {
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipientSigner.getAddress(),
            partition1,
            0
          );

          await token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition1,
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTES32
            );

          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - transferAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipientSigner.getAddress(),
            partition1,
            transferAmount
          );
        });
      });
      describe('when the contract is migrated definitely', function () {
        it('can not transfer tokens', async function () {
          let interface1400Implementer = await registry.getInterfaceImplementer(
            token.address,
            ethers.utils.id(ERC1400_INTERFACE_NAME)
          );
          assert.strictEqual(interface1400Implementer, token.address);
          let interface20Implementer = await registry.getInterfaceImplementer(
            token.address,
            ethers.utils.id(ERC20_INTERFACE_NAME)
          );
          assert.strictEqual(interface20Implementer, token.address);

          await token.migrate(migratedToken.address, true);

          interface1400Implementer = await registry.getInterfaceImplementer(
            token.address,
            ethers.utils.id(ERC1400_INTERFACE_NAME)
          );
          assert.strictEqual(interface1400Implementer, migratedToken.address);
          interface20Implementer = await registry.getInterfaceImplementer(
            token.address,
            ethers.utils.id(ERC20_INTERFACE_NAME)
          );
          assert.strictEqual(interface20Implementer, migratedToken.address);

          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipientSigner.getAddress(),
            partition1,
            0
          );

          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transferByPartition(
                partition1,
                recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTES32
              )
          );
        });
      });
      describe('when the contract is migrated, but not definitely', function () {
        it('can transfer tokens', async function () {
          let interface1400Implementer = await registry.getInterfaceImplementer(
            token.address,
            ethers.utils.id(ERC1400_INTERFACE_NAME)
          );
          assert.strictEqual(interface1400Implementer, token.address);
          let interface20Implementer = await registry.getInterfaceImplementer(
            token.address,
            ethers.utils.id(ERC20_INTERFACE_NAME)
          );
          assert.strictEqual(interface20Implementer, token.address);

          await token.migrate(migratedToken.address, false);

          interface1400Implementer = await registry.getInterfaceImplementer(
            token.address,
            ethers.utils.id(ERC1400_INTERFACE_NAME)
          );
          assert.strictEqual(interface1400Implementer, migratedToken.address);
          interface20Implementer = await registry.getInterfaceImplementer(
            token.address,
            ethers.utils.id(ERC20_INTERFACE_NAME)
          );
          assert.strictEqual(interface20Implementer, migratedToken.address);

          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipientSigner.getAddress(),
            partition1,
            0
          );

          await token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition1,
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTES32
            );

          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - transferAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipientSigner.getAddress(),
            partition1,
            transferAmount
          );
        });
      });
    });
    describe('when the sender is not the contract owner', function () {
      it('reverts', async function () {
        await assertRevert(
          token.connect(unknownSigner).migrate(migratedToken.address, true)
        );
      });
    });
  });
});
