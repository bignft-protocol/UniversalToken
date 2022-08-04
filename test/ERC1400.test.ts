import { ethers, assert, contract } from 'hardhat';
import {
  ERC1400,
  ERC1400__factory,
  ERC1820Registry,
  ERC1820Registry__factory,
  FakeERC1400Mock__factory,
  MinterMock,
  MinterMock__factory
} from '../typechain-types';

// @ts-ignore
import { expectRevert } from '@openzeppelin/test-helpers';
import {
  assertBalance,
  assertBalanceOfByPartition,
  assertBalanceOfSecurityToken,
  assertBalances,
  assertBurnEvent,
  assertTotalSupply,
  assertTransferEvent,
  ZERO_ADDRESS,
  ZERO_BYTE,
  ZERO_BYTES32
} from './utils/assert';
import { BytesLike, Signer } from 'ethers';

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

let totalSupply;
let balance;
let balanceByPartition;

let defaultPartitions;

let totalSupplyPartition1;
let totalSupplyPartition2;

let registry: ERC1820Registry;

const authorizeOperatorForPartitions = async (
  _contract: ERC1400,
  _operator: any,
  _tokenHolder: any,
  _partitions: string | any[]
) => {
  for (let i = 0; i < _partitions.length; i++) {
    await _contract
      .connect(await ethers.getSigner(_tokenHolder))
      .authorizeOperatorByPartition(_partitions[i], _operator);
  }
};

const issueOnMultiplePartitions = async (
  _contract: ERC1400,
  _owner: any,
  _recipient: any,
  _partitions: BytesLike[],
  _amounts: any[]
) => {
  await Promise.all(
    _partitions.map(
      async (_partition, i) =>
        await _contract
          .connect(await ethers.getSigner(_owner))
          .issueByPartition(_partition, _recipient, _amounts[i], ZERO_BYTES32)
    )
  );
};

contract(
  'ERC1400',
  function ([
    owner,
    operator,
    controller,
    controller_alternative1,
    controller_alternative2,
    tokenHolder,
    recipient,
    unknown
  ]) {
    let signer: Signer;
    before(async function () {
      signer = await ethers.getSigner(owner);
      registry = ERC1820Registry__factory.deployed;
    });

    describe('contract creation', function () {
      it('fails deploying the contract if granularity is lower than 1', async function () {
        await expectRevert.unspecified(
          new ERC1400__factory(signer).deploy(
            'ERC1400Token',
            'DAU',
            0,
            [controller],
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
          [controller],
          partitions
        );
      });
      describe('when interface hash is correct', function () {
        it('returns ERC1820_ACCEPT_MAGIC', async function () {
          const canImplement1400 = await token.canImplementInterfaceForAddress(
            ethers.utils.id(ERC1400_INTERFACE_NAME),
            ZERO_ADDRESS
          );
          assert.equal(ethers.utils.id(ERC1820_ACCEPT_MAGIC), canImplement1400);
          const canImplement20 = await token.canImplementInterfaceForAddress(
            ethers.utils.id(ERC20_INTERFACE_NAME),
            ZERO_ADDRESS
          );
          assert.equal(ethers.utils.id(ERC1820_ACCEPT_MAGIC), canImplement20);
        });
      });
      describe('when interface hash is not correct', function () {
        it('returns ERC1820_ACCEPT_MAGIC', async function () {
          const canImplement = await token.canImplementInterfaceForAddress(
            ethers.utils.id('FakeToken'),
            ZERO_ADDRESS
          );
          assert.equal(ZERO_BYTES32, canImplement);
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
          [controller],
          partitions
        );
      });
      describe('addMinter/removeMinter', function () {
        describe('add/renounce a minter', function () {
          describe('when caller is a minter', function () {
            it('adds a minter as owner', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await token.addMinter(unknown);
              assert.equal(await token.isMinter(unknown), true);
            });
            it('adds a minter as minter', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await token.addMinter(unknown);
              assert.equal(await token.isMinter(unknown), true);

              assert.equal(await token.isMinter(tokenHolder), false);
              await token
                .connect(await ethers.getSigner(unknown))
                .addMinter(tokenHolder);
              assert.equal(await token.isMinter(tokenHolder), true);
            });
            it('renounces minter', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await token.addMinter(unknown);
              assert.equal(await token.isMinter(unknown), true);
              await token
                .connect(await ethers.getSigner(unknown))
                .renounceMinter();
              assert.equal(await token.isMinter(unknown), false);
            });
          });
          describe('when caller is not a minter', function () {
            it('reverts', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(unknown))
                  .addMinter(unknown)
              );
              assert.equal(await token.isMinter(unknown), false);
            });
          });
        });
        describe('remove a minter', function () {
          describe('when caller is a minter', function () {
            it('removes a minter as owner', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await token.addMinter(unknown);
              assert.equal(await token.isMinter(unknown), true);
              await token.removeMinter(unknown);
              assert.equal(await token.isMinter(unknown), false);
            });
          });
          describe('when caller is not a minter', function () {
            it('reverts', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await token.addMinter(unknown);
              assert.equal(await token.isMinter(unknown), true);
              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(tokenHolder))
                  .removeMinter(unknown)
              );
              assert.equal(await token.isMinter(unknown), true);
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
            assert.equal(await minterMock.isMinter(unknown), false);
            await expectRevert.unspecified(
              minterMock
                .connect(await ethers.getSigner(unknown))
                .addMinter(unknown)
            );
            assert.equal(await minterMock.isMinter(unknown), false);
            await minterMock.addMinter(unknown);
            assert.equal(await minterMock.isMinter(unknown), true);
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
          [controller],
          partitions
        );
        await token.issueByPartition(
          partition1,
          tokenHolder,
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
                .connect(await ethers.getSigner(tokenHolder))
                .transfer(recipient, amount);
              await assertBalance(token, tokenHolder, issuanceAmount - amount);
              await assertBalance(token, recipient, amount);
            });

            it('emits a Transfer event', async function () {
              const { events } = await token
                .connect(await ethers.getSigner(tokenHolder))
                .transfer(recipient, amount)
                .then((res) => res.wait());

              assert.equal(events!.length, 2);

              const [event0, event1] = events!;

              assert.equal(event0.event, 'Transfer');
              assert.equal(event0.args?.from, tokenHolder);
              assert.equal(event0.args?.to, recipient);
              assert.equal(event0.args?.value, amount);

              assert.equal(event1.event, 'TransferByPartition');
              assert.equal(event1.args?.fromPartition, partition1);
              assert.equal(event1.args?.operator, tokenHolder);
              assert.equal(event1.args?.from, tokenHolder);
              assert.equal(event1.args?.to, recipient);
              assert.equal(event1.args?.value, amount);
              assert.equal(event1.args?.data, ZERO_BYTE);
              assert.equal(event1.args?.operatorData, ZERO_BYTE);
            });
          });
          describe('when the sender does not have enough balance', function () {
            const amount = issuanceAmount + 1;

            it('reverts', async function () {
              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(tokenHolder))
                  .transfer(recipient, amount)
              );
            });
          });
        });

        describe('when the recipient is the zero address', function () {
          const amount = issuanceAmount;

          it('reverts', async function () {
            await expectRevert.unspecified(
              token
                .connect(await ethers.getSigner(tokenHolder))
                .transfer(ZERO_ADDRESS, amount)
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
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32
          );
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(tokenHolder))
              .transfer(recipient, 3)
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
          [controller],
          partitions
        );
        await token.issueByPartition(
          partition1,
          tokenHolder,
          issuanceAmount,
          ZERO_BYTES32
        );
      });
      describe('when token has a withelist', function () {
        describe('when the operator is approved', function () {
          beforeEach(async function () {
            // await token.connect(await ethers.getSigner(tokenHolder)).authorizeOperator(operator, );
            await token
              .connect(await ethers.getSigner(tokenHolder))
              .approve(operator, approvedAmount);
          });
          describe('when the amount is a multiple of the granularity', function () {
            describe('when the recipient is not the zero address', function () {
              describe('when the sender has enough balance', function () {
                const amount = 500;

                it('transfers the requested amount', async function () {
                  await token
                    .connect(await ethers.getSigner(operator))
                    .transferFrom(tokenHolder, recipient, amount);
                  await assertBalance(
                    token,
                    tokenHolder,
                    issuanceAmount - amount
                  );
                  await assertBalance(token, recipient, amount);

                  assert.equal(
                    (await token.allowance(tokenHolder, operator)).eq(
                      approvedAmount - amount
                    ),
                    true
                  );
                });

                it('emits a sent + a transfer event', async function () {
                  const { events } = await token
                    .connect(await ethers.getSigner(operator))
                    .transferFrom(tokenHolder, recipient, amount)
                    .then((res) => res.wait());

                  assert.equal(events!.length, 2);

                  assert.equal(events![0].event, 'Transfer');
                  assert.equal(events![0].args?.from, tokenHolder);
                  assert.equal(events![0].args?.to, recipient);
                  assert.equal(events![0].args?.value, amount);

                  assert.equal(events![1].event, 'TransferByPartition');
                  assert.equal(events![1].args?.fromPartition, partition1);
                  assert.equal(events![1].args?.operator, operator);
                  assert.equal(events![1].args?.from, tokenHolder);
                  assert.equal(events![1].args?.to, recipient);
                  assert.equal(events![1].args?.value, amount);
                  assert.equal(events![1].args?.data, ZERO_BYTE);
                  assert.equal(events![1].args?.operatorData, ZERO_BYTE);
                });
              });
              describe('when the sender does not have enough balance', function () {
                const amount = approvedAmount + 1;

                it('reverts', async function () {
                  await expectRevert.unspecified(
                    token
                      .connect(await ethers.getSigner(operator))
                      .transferFrom(tokenHolder, recipient, amount)
                  );
                });
              });
            });

            describe('when the recipient is the zero address', function () {
              const amount = issuanceAmount;

              it('reverts', async function () {
                await expectRevert.unspecified(
                  token
                    .connect(await ethers.getSigner(operator))
                    .transferFrom(tokenHolder, ZERO_ADDRESS, amount)
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
                tokenHolder,
                issuanceAmount,
                ZERO_BYTES32
              );
              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(operator))
                  .transferFrom(tokenHolder, recipient, 3)
              );
            });
          });
        });
        describe('when the operator is not approved', function () {
          const amount = 100;
          describe('when the operator is not approved but authorized', function () {
            it('transfers the requested amount', async function () {
              await token
                .connect(await ethers.getSigner(tokenHolder))
                .authorizeOperator(operator);
              assert.equal(
                (await token.allowance(tokenHolder, operator)).toNumber(),
                0
              );

              await token
                .connect(await ethers.getSigner(operator))
                .transferFrom(tokenHolder, recipient, amount);

              await assertBalance(token, tokenHolder, issuanceAmount - amount);
              await assertBalance(token, recipient, amount);
            });
          });
          describe('when the operator is not approved and not authorized', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(operator))
                  .transferFrom(tokenHolder, recipient, amount)
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
          [controller],
          partitions
        );
      });
      describe('when sender approves an operator', function () {
        it('approves the operator', async function () {
          assert.equal(
            (await token.allowance(tokenHolder, operator)).eq(0),
            true
          );

          await token
            .connect(await ethers.getSigner(tokenHolder))
            .approve(operator, amount);

          assert.equal(
            (await token.allowance(tokenHolder, operator)).eq(amount),
            true
          );
        });
        it('emits an approval event', async function () {
          const { events } = await token
            .connect(await ethers.getSigner(tokenHolder))
            .approve(operator, amount)
            .then((res) => res.wait());

          assert.equal(events!.length, 1);
          assert.equal(events![0].event, 'Approval');
          assert.equal(events![0].args?.owner, tokenHolder);
          assert.equal(events![0].args?.spender, operator);
          assert.equal(events![0].args?.value, amount);
        });
      });
      describe('when the operator to approve is the zero address', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(tokenHolder))
              .approve(ZERO_ADDRESS, amount)
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
          [controller],
          partitions
        );
      });

      describe('setDocument', function () {
        describe('when sender is a controller', function () {
          it('attaches the document to the token', async function () {
            await token
              .connect(await ethers.getSigner(controller))
              .setDocument(documentName, documentURI, documentHash);
            const doc = await token.getDocument(documentName);
            assert.equal(documentURI, doc[0]);
            assert.equal(documentHash, doc[1]);
          });
          it('emits a document event', async function () {
            const { events } = await token
              .connect(await ethers.getSigner(controller))
              .setDocument(documentName, documentURI, documentHash)
              .then((res) => res.wait());

            assert.equal(events!.length, 1);
            assert.equal(events![0].event, 'DocumentUpdated');

            assert.equal(events![0].args?.name, documentName);
            assert.equal(events![0].args?.uri, documentURI);
            assert.equal(events![0].args?.documentHash, documentHash);
          });
        });
        describe('when sender is not a controller', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(
              token
                .connect(await ethers.getSigner(unknown))
                .setDocument(documentName, documentURI, documentHash)
            );
          });
        });
      });
      describe('getDocument', function () {
        describe('when docuemnt exists', function () {
          it('returns the document', async function () {
            await token
              .connect(await ethers.getSigner(controller))
              .setDocument(documentName, documentURI, documentHash);
            const doc = await token.getDocument(documentName);
            assert.equal(documentURI, doc[0]);
            assert.equal(documentHash, doc[1]);
          });
        });
        describe('when docuemnt does not exist', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(token.getDocument(documentName));
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
          [controller],
          partitions
        );
      });
      describe('when tokenHolder owes no tokens', function () {
        it('returns empty list', async function () {
          const partitionsOf = await token.partitionsOf(tokenHolder);
          assert.equal(partitionsOf.length, 0);
        });
      });
      describe('when tokenHolder owes tokens of 1 partition', function () {
        it('returns partition', async function () {
          await token.issueByPartition(
            partition1,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32
          );
          const partitionsOf = await token.partitionsOf(tokenHolder);
          assert.equal(partitionsOf.length, 1);
          assert.equal(partitionsOf[0], partition1);
        });
      });
      describe('when tokenHolder owes tokens of 3 partitions', function () {
        it('returns list of 3 partitions', async function () {
          await issueOnMultiplePartitions(
            token,
            owner,
            tokenHolder,
            partitions,
            [issuanceAmount, issuanceAmount, issuanceAmount]
          );
          const partitionsOf = await token.partitionsOf(tokenHolder);
          assert.equal(partitionsOf.length, 3);
          assert.equal(partitionsOf[0], partition1);
          assert.equal(partitionsOf[1], partition2);
          assert.equal(partitionsOf[2], partition3);
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
            [controller],
            partitions
          );
          await issueOnMultiplePartitions(
            token,
            owner,
            tokenHolder,
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
                  await assertBalances(token, tokenHolder, partitions, [
                    issuanceAmount,
                    issuanceAmount,
                    issuanceAmount
                  ]);

                  await token
                    .connect(await ethers.getSigner(tokenHolder))
                    .transferWithData(
                      recipient,
                      2.5 * issuanceAmount,
                      ZERO_BYTES32
                    );

                  await assertBalances(token, tokenHolder, partitions, [
                    0,
                    0.5 * issuanceAmount,
                    0
                  ]);
                  await assertBalances(token, recipient, partitions, [
                    issuanceAmount,
                    0.5 * issuanceAmount,
                    issuanceAmount
                  ]);
                });
                it('emits a sent event', async function () {
                  await token.setDefaultPartitions(reversedPartitions);
                  const { events } = await token
                    .connect(await ethers.getSigner(tokenHolder))
                    .transferWithData(
                      recipient,
                      2.5 * issuanceAmount,
                      ZERO_BYTES32
                    )
                    .then((res) => res.wait());

                  assert.equal(events!.length, 2 * partitions.length);

                  assertTransferEvent(
                    [events![0], events![1]],
                    partition3,
                    tokenHolder,
                    tokenHolder,
                    recipient,
                    issuanceAmount,
                    ZERO_BYTES32,
                    ZERO_BYTE
                  );
                  assertTransferEvent(
                    [events![2], events![3]],
                    partition1,
                    tokenHolder,
                    tokenHolder,
                    recipient,
                    issuanceAmount,
                    ZERO_BYTES32,
                    ZERO_BYTE
                  );
                  assertTransferEvent(
                    [events![4], events![5]],
                    partition2,
                    tokenHolder,
                    tokenHolder,
                    recipient,
                    0.5 * issuanceAmount,
                    ZERO_BYTES32,
                    ZERO_BYTE
                  );
                });
              });
              describe('when the sender has not defined custom default partitions', function () {
                it('transfers the requested amount', async function () {
                  await assertBalances(token, tokenHolder, partitions, [
                    issuanceAmount,
                    issuanceAmount,
                    issuanceAmount
                  ]);

                  await token
                    .connect(await ethers.getSigner(tokenHolder))
                    .transferWithData(
                      recipient,
                      2.5 * issuanceAmount,
                      ZERO_BYTES32
                    );

                  await assertBalances(token, tokenHolder, partitions, [
                    0,
                    0,
                    0.5 * issuanceAmount
                  ]);
                  await assertBalances(token, recipient, partitions, [
                    issuanceAmount,
                    issuanceAmount,
                    0.5 * issuanceAmount
                  ]);
                });
              });
            });
            describe('when the sender does not have enough balance for those default partitions', function () {
              it('reverts', async function () {
                await token.setDefaultPartitions(reversedPartitions);
                await expectRevert.unspecified(
                  token
                    .connect(await ethers.getSigner(tokenHolder))
                    .transferWithData(
                      recipient,
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
              await assertBalances(token, tokenHolder, partitions, [
                issuanceAmount,
                issuanceAmount,
                issuanceAmount
              ]);

              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(tokenHolder))
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
              [controller],
              partitions
            );
            await issueOnMultiplePartitions(
              token,
              owner,
              tokenHolder,
              partitions,
              [issuanceAmount, issuanceAmount, issuanceAmount]
            );
            await token.setDefaultPartitions(reversedPartitions);
            await assertBalances(token, tokenHolder, partitions, [
              issuanceAmount,
              issuanceAmount,
              issuanceAmount
            ]);

            await expectRevert.unspecified(
              token
                .connect(await ethers.getSigner(tokenHolder))
                .transferWithData(recipient, 3, ZERO_BYTES32)
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
            [controller],
            []
          );
          await issueOnMultiplePartitions(
            token,
            owner,
            tokenHolder,
            partitions,
            [issuanceAmount, issuanceAmount, issuanceAmount]
          );
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(tokenHolder))
              .transferWithData(recipient, 2.5 * issuanceAmount, ZERO_BYTES32)
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
          [controller],
          partitions
        );
        await issueOnMultiplePartitions(token, owner, tokenHolder, partitions, [
          issuanceAmount,
          issuanceAmount,
          issuanceAmount
        ]);
      });
      describe('when the operator is approved', function () {
        beforeEach(async function () {
          await token
            .connect(await ethers.getSigner(tokenHolder))
            .authorizeOperator(operator);
        });
        describe('when the amount is a multiple of the granularity', function () {
          describe('when the recipient is not the zero address', function () {
            describe('when defaultPartitions have been defined', function () {
              describe('when the sender has enough balance for those default partitions', function () {
                it('transfers the requested amount', async function () {
                  await token.setDefaultPartitions(reversedPartitions);
                  await assertBalances(token, tokenHolder, partitions, [
                    issuanceAmount,
                    issuanceAmount,
                    issuanceAmount
                  ]);

                  await token
                    .connect(await ethers.getSigner(operator))
                    .transferFromWithData(
                      tokenHolder,
                      recipient,
                      2.5 * issuanceAmount,
                      ZERO_BYTES32
                    );

                  await assertBalances(token, tokenHolder, partitions, [
                    0,
                    0.5 * issuanceAmount,
                    0
                  ]);
                  await assertBalances(token, recipient, partitions, [
                    issuanceAmount,
                    0.5 * issuanceAmount,
                    issuanceAmount
                  ]);
                });
                it('emits a sent event', async function () {
                  await token.setDefaultPartitions(reversedPartitions);
                  const { events } = await token
                    .connect(await ethers.getSigner(operator))
                    .transferFromWithData(
                      tokenHolder,
                      recipient,
                      2.5 * issuanceAmount,
                      ZERO_BYTES32
                    )
                    .then((res) => res.wait());

                  assert.equal(events!.length, 2 * partitions.length);

                  assertTransferEvent(
                    [events![0], events![1]],
                    partition3,
                    operator,
                    tokenHolder,
                    recipient,
                    issuanceAmount,
                    ZERO_BYTES32,
                    ZERO_BYTE
                  );
                  assertTransferEvent(
                    [events![2], events![3]],
                    partition1,
                    operator,
                    tokenHolder,
                    recipient,
                    issuanceAmount,
                    ZERO_BYTES32,
                    ZERO_BYTE
                  );
                  assertTransferEvent(
                    [events![4], events![5]],
                    partition2,
                    operator,
                    tokenHolder,
                    recipient,
                    0.5 * issuanceAmount,
                    ZERO_BYTES32,
                    ZERO_BYTE
                  );
                });
              });
              describe('when the sender does not have enough balance for those default partitions', function () {
                it('reverts', async function () {
                  await token.setDefaultPartitions(reversedPartitions);
                  await expectRevert.unspecified(
                    token
                      .connect(await ethers.getSigner(operator))
                      .transferFromWithData(
                        tokenHolder,
                        recipient,
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
                    [controller],
                    partitions,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS
                  );
                  await token.issueByPartition(
                    partition1,
                    tokenHolder,
                    issuanceAmount,
                    ZERO_BYTES32
                  );

                  await expectRevert.unspecified(
                    token
                      .connect(await ethers.getSigner(controller))
                      .transferFromWithData(
                        tokenHolder,
                        recipient,
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
                await expectRevert.unspecified(
                  token
                    .connect(await ethers.getSigner(operator))
                    .transferFromWithData(
                      tokenHolder,
                      recipient,
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
              await assertBalances(token, tokenHolder, partitions, [
                issuanceAmount,
                issuanceAmount,
                issuanceAmount
              ]);

              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(operator))
                  .transferFromWithData(
                    tokenHolder,
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
              [controller],
              partitions
            );
            await issueOnMultiplePartitions(
              token,
              owner,
              tokenHolder,
              partitions,
              [issuanceAmount, issuanceAmount, issuanceAmount]
            );
            await token.setDefaultPartitions(reversedPartitions);
            await assertBalances(token, tokenHolder, partitions, [
              issuanceAmount,
              issuanceAmount,
              issuanceAmount
            ]);

            await expectRevert.unspecified(
              token
                .connect(await ethers.getSigner(operator))
                .transferFromWithData(tokenHolder, recipient, 3, ZERO_BYTES32)
            );
          });
        });
      });
      describe('when the operator is not approved', function () {
        it('reverts', async function () {
          await token.setDefaultPartitions(reversedPartitions);
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(operator))
              .transferFromWithData(
                tokenHolder,
                recipient,
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
          [controller],
          partitions
        );
        await token.issueByPartition(
          partition1,
          tokenHolder,
          issuanceAmount,
          ZERO_BYTES32
        );
      });

      describe('when the sender has enough balance for this partition', function () {
        describe('when the transfer amount is not equal to 0', function () {
          it('transfers the requested amount', async function () {
            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOfSecurityToken(token, recipient, partition1, 0);

            await token
              .connect(await ethers.getSigner(tokenHolder))
              .transferByPartition(
                partition1,
                recipient,
                transferAmount,
                ZERO_BYTES32
              );
            await token
              .connect(await ethers.getSigner(tokenHolder))
              .transferByPartition(partition1, recipient, 0, ZERO_BYTES32);

            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOfSecurityToken(
              token,
              recipient,
              partition1,
              transferAmount
            );
          });
          it('emits a TransferByPartition event', async function () {
            const { events } = await token
              .connect(await ethers.getSigner(tokenHolder))
              .transferByPartition(
                partition1,
                recipient,
                transferAmount,
                ZERO_BYTES32
              )
              .then((res) => res.wait());

            assert.equal(events!.length, 2);

            assertTransferEvent(
              events!,
              partition1,
              tokenHolder,
              tokenHolder,
              recipient,
              transferAmount,
              ZERO_BYTES32,
              ZERO_BYTE
            );
          });
        });
        describe('when the transfer amount is equal to 0', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(
              token
                .connect(await ethers.getSigner(tokenHolder))
                .transferByPartition(partition2, recipient, 0, ZERO_BYTES32)
            );
          });
        });
      });
      describe('when the sender does not have enough balance for this partition', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(tokenHolder))
              .transferByPartition(
                partition2,
                recipient,
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
          [controller],
          partitions
        );
        await token.issueByPartition(
          partition1,
          tokenHolder,
          issuanceAmount,
          ZERO_BYTES32
        );
      });

      describe('when the sender is approved for this partition', function () {
        describe('when approved amount is sufficient', function () {
          it('transfers the requested amount', async function () {
            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOfSecurityToken(token, recipient, partition1, 0);
            assert.equal(
              (
                await token.allowanceByPartition(
                  partition1,
                  tokenHolder,
                  operator
                )
              ).eq(0),
              true
            );

            const approvedAmount = 400;
            await token
              .connect(await ethers.getSigner(tokenHolder))
              .approveByPartition(partition1, operator, approvedAmount);
            assert.equal(
              (
                await token.allowanceByPartition(
                  partition1,
                  tokenHolder,
                  operator
                )
              ).eq(approvedAmount),
              true
            );
            await token
              .connect(await ethers.getSigner(operator))
              .operatorTransferByPartition(
                partition1,
                tokenHolder,
                recipient,
                transferAmount,
                ZERO_BYTE,
                ZERO_BYTES32
              );

            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOfSecurityToken(
              token,
              recipient,
              partition1,
              transferAmount
            );
            assert.equal(
              (
                await token.allowanceByPartition(
                  partition1,
                  tokenHolder,
                  operator
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
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOfSecurityToken(token, recipient, partition1, 0);
            assert.equal(
              (
                await token.allowanceByPartition(
                  partition1,
                  tokenHolder,
                  operator
                )
              ).eq(0),
              true
            );

            const approvedAmount = 200;
            await token
              .connect(await ethers.getSigner(tokenHolder))
              .approveByPartition(partition1, operator, approvedAmount);
            assert.equal(
              (
                await token.allowanceByPartition(
                  partition1,
                  tokenHolder,
                  operator
                )
              ).eq(approvedAmount),
              true
            );
            await expectRevert.unspecified(
              token
                .connect(await ethers.getSigner(operator))
                .operatorTransferByPartition(
                  partition1,
                  tokenHolder,
                  recipient,
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
                tokenHolder,
                partition1,
                issuanceAmount
              );
              await assertBalanceOfSecurityToken(
                token,
                recipient,
                partition1,
                0
              );

              await token
                .connect(await ethers.getSigner(tokenHolder))
                .authorizeOperatorByPartition(partition1, operator);
              await token
                .connect(await ethers.getSigner(operator))
                .operatorTransferByPartition(
                  partition1,
                  tokenHolder,
                  recipient,
                  transferAmount,
                  ZERO_BYTE,
                  ZERO_BYTES32
                );

              await assertBalanceOfSecurityToken(
                token,
                tokenHolder,
                partition1,
                issuanceAmount - transferAmount
              );
              await assertBalanceOfSecurityToken(
                token,
                recipient,
                partition1,
                transferAmount
              );
            });
            it('transfers the requested amount with attached data (without changePartition flag)', async function () {
              await assertBalanceOfSecurityToken(
                token,
                tokenHolder,
                partition1,
                issuanceAmount
              );
              await assertBalanceOfSecurityToken(
                token,
                recipient,
                partition1,
                0
              );

              await token
                .connect(await ethers.getSigner(tokenHolder))
                .authorizeOperatorByPartition(partition1, operator);
              await token
                .connect(await ethers.getSigner(operator))
                .operatorTransferByPartition(
                  partition1,
                  tokenHolder,
                  recipient,
                  transferAmount,
                  doNotChangePartition,
                  ZERO_BYTES32
                );

              await assertBalanceOfSecurityToken(
                token,
                tokenHolder,
                partition1,
                issuanceAmount - transferAmount
              );
              await assertBalanceOfSecurityToken(
                token,
                recipient,
                partition1,
                transferAmount
              );
            });
            it('emits a TransferByPartition event', async function () {
              await token
                .connect(await ethers.getSigner(tokenHolder))
                .authorizeOperatorByPartition(partition1, operator);
              const { events } = await token
                .connect(await ethers.getSigner(operator))
                .operatorTransferByPartition(
                  partition1,
                  tokenHolder,
                  recipient,
                  transferAmount,
                  ZERO_BYTE,
                  ZERO_BYTES32
                )
                .then((res) => res.wait());

              assert.equal(events!.length, 2);

              assertTransferEvent(
                events!,
                partition1,
                operator,
                tokenHolder,
                recipient,
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
                tokenHolder,
                partition1,
                issuanceAmount
              );
              await assertBalanceOfSecurityToken(
                token,
                recipient,
                partition2,
                0
              );

              await token
                .connect(await ethers.getSigner(tokenHolder))
                .authorizeOperatorByPartition(partition1, operator);
              await token
                .connect(await ethers.getSigner(operator))
                .operatorTransferByPartition(
                  partition1,
                  tokenHolder,
                  recipient,
                  transferAmount,
                  changeToPartition2,
                  ZERO_BYTES32
                );

              await assertBalanceOfSecurityToken(
                token,
                tokenHolder,
                partition1,
                issuanceAmount - transferAmount
              );
              await assertBalanceOfSecurityToken(
                token,
                recipient,
                partition2,
                transferAmount
              );
            });
            it('converts the requested amount', async function () {
              await assertBalance(token, tokenHolder, issuanceAmount);
              await assertBalanceOfByPartition(
                token,
                tokenHolder,
                partition1,
                issuanceAmount
              );
              await assertBalanceOfByPartition(
                token,
                tokenHolder,
                partition2,
                0
              );

              await token
                .connect(await ethers.getSigner(tokenHolder))
                .authorizeOperatorByPartition(partition1, operator);
              await token
                .connect(await ethers.getSigner(operator))
                .operatorTransferByPartition(
                  partition1,
                  tokenHolder,
                  tokenHolder,
                  transferAmount,
                  changeToPartition2,
                  ZERO_BYTES32
                );

              await assertBalance(token, tokenHolder, issuanceAmount);
              await assertBalanceOfByPartition(
                token,
                tokenHolder,
                partition1,
                issuanceAmount - transferAmount
              );
              await assertBalanceOfByPartition(
                token,
                tokenHolder,
                partition2,
                transferAmount
              );
            });
            it('emits a changedPartition event', async function () {
              await token
                .connect(await ethers.getSigner(tokenHolder))
                .authorizeOperatorByPartition(partition1, operator);
              const { events } = await token
                .connect(await ethers.getSigner(operator))
                .operatorTransferByPartition(
                  partition1,
                  tokenHolder,
                  recipient,
                  transferAmount,
                  changeToPartition2,
                  ZERO_BYTES32
                )
                .then((res) => res.wait());

              assert.equal(events!.length, 3);

              assertTransferEvent(
                [events![0], events![1]],
                partition1,
                operator,
                tokenHolder,
                recipient,
                transferAmount,
                changeToPartition2,
                ZERO_BYTES32
              );

              assert.equal(events![2].event, 'ChangedPartition');
              assert.equal(events![2].args?.fromPartition, partition1);
              assert.equal(events![2].args?.toPartition, partition2);
              assert.equal(events![2].args?.value, transferAmount);
            });
          });
        });
        describe('when the sender does not have enough balance for this partition', function () {
          it('reverts', async function () {
            await token
              .connect(await ethers.getSigner(tokenHolder))
              .authorizeOperatorByPartition(partition1, operator);
            await expectRevert.unspecified(
              token
                .connect(await ethers.getSigner(operator))
                .operatorTransferByPartition(
                  partition1,
                  tokenHolder,
                  recipient,
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
            tokenHolder,
            partition1,
            issuanceAmount
          );
          await assertBalanceOfSecurityToken(token, recipient, partition1, 0);

          await token
            .connect(await ethers.getSigner(tokenHolder))
            .authorizeOperator(operator);
          await token
            .connect(await ethers.getSigner(operator))
            .operatorTransferByPartition(
              partition1,
              tokenHolder,
              recipient,
              transferAmount,
              ZERO_BYTE,
              ZERO_BYTES32
            );

          await assertBalanceOfSecurityToken(
            token,
            tokenHolder,
            partition1,
            issuanceAmount - transferAmount
          );
          await assertBalanceOfSecurityToken(
            token,
            recipient,
            partition1,
            transferAmount
          );
        });
      });
      describe('when the sender is neither an operator, nor approved', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(operator))
              .operatorTransferByPartition(
                partition1,
                tokenHolder,
                recipient,
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
          [controller],
          partitions
        );
      });
      describe('when sender authorizes an operator', function () {
        it('authorizes the operator', async function () {
          assert.isTrue(!(await token.isOperator(operator, tokenHolder)));
          await token
            .connect(await ethers.getSigner(tokenHolder))
            .authorizeOperator(operator);
          assert.isTrue(await token.isOperator(operator, tokenHolder));
        });
        it('emits a authorized event', async function () {
          const { events } = await token
            .connect(await ethers.getSigner(tokenHolder))
            .authorizeOperator(operator)
            .then((res) => res.wait());

          assert.equal(events!.length, 1);
          assert.equal(events![0].event, 'AuthorizedOperator');
          assert.equal(events![0].args?.operator, operator);
          assert.equal(events![0].args?.tokenHolder, tokenHolder);
        });
      });
      describe('when sender authorizes himself', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(tokenHolder))
              .authorizeOperator(tokenHolder)
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
          [controller],
          partitions
        );
      });
      describe('when sender revokes an operator', function () {
        it('revokes the operator (when operator is not the controller)', async function () {
          assert.isTrue(!(await token.isOperator(operator, tokenHolder)));
          await token
            .connect(await ethers.getSigner(tokenHolder))
            .authorizeOperator(operator);
          assert.isTrue(await token.isOperator(operator, tokenHolder));

          await token
            .connect(await ethers.getSigner(tokenHolder))
            .revokeOperator(operator);

          assert.isTrue(!(await token.isOperator(operator, tokenHolder)));
        });
        it('emits a revoked event', async function () {
          const { events } = await token
            .connect(await ethers.getSigner(tokenHolder))
            .revokeOperator(controller)
            .then((res) => res.wait());

          assert.equal(events!.length, 1);
          assert.equal(events![0].event, 'RevokedOperator');
          assert.equal(events![0].args?.operator, controller);
          assert.equal(events![0].args?.tokenHolder, tokenHolder);
        });
      });
      describe('when sender revokes himself', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(tokenHolder))
              .revokeOperator(tokenHolder)
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
          [controller],
          partitions
        );
      });
      it('authorizes the operator', async function () {
        assert.isTrue(
          !(await token.isOperatorForPartition(
            partition1,
            operator,
            tokenHolder
          ))
        );
        await token
          .connect(await ethers.getSigner(tokenHolder))
          .authorizeOperatorByPartition(partition1, operator);
        assert.isTrue(
          await token.isOperatorForPartition(partition1, operator, tokenHolder)
        );
      });
      it('emits an authorized event', async function () {
        const { events } = await token
          .connect(await ethers.getSigner(tokenHolder))
          .authorizeOperatorByPartition(partition1, operator)
          .then((res) => res.wait());

        assert.equal(events!.length, 1);
        assert.equal(events![0].event, 'AuthorizedOperatorByPartition');
        assert.equal(events![0].args?.partition, partition1);
        assert.equal(events![0].args?.operator, operator);
        assert.equal(events![0].args?.tokenHolder, tokenHolder);
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
          [controller],
          partitions
        );
      });
      describe('when operator is not controller', function () {
        it('revokes the operator', async function () {
          await token
            .connect(await ethers.getSigner(tokenHolder))
            .authorizeOperatorByPartition(partition1, operator);
          assert.isTrue(
            await token.isOperatorForPartition(
              partition1,
              operator,
              tokenHolder
            )
          );
          await token
            .connect(await ethers.getSigner(tokenHolder))
            .revokeOperatorByPartition(partition1, operator);
          assert.isTrue(
            !(await token.isOperatorForPartition(
              partition1,
              operator,
              tokenHolder
            ))
          );
        });
        it('emits a revoked event', async function () {
          await token
            .connect(await ethers.getSigner(tokenHolder))
            .authorizeOperatorByPartition(partition1, operator);
          const { events } = await token
            .connect(await ethers.getSigner(tokenHolder))
            .revokeOperatorByPartition(partition1, operator)
            .then((res) => res.wait());

          assert.equal(events!.length, 1);
          assert.equal(events![0].event, 'RevokedOperatorByPartition');
          assert.equal(events![0].args?.partition, partition1);
          assert.equal(events![0].args?.operator, operator);
          assert.equal(events![0].args?.tokenHolder, tokenHolder);
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
          [controller],
          partitions
        );
      });
      it('when operator is tokenHolder', async function () {
        assert.isTrue(await token.isOperator(tokenHolder, tokenHolder));
      });
      it('when operator is authorized by tokenHolder', async function () {
        await token
          .connect(await ethers.getSigner(tokenHolder))
          .authorizeOperator(operator);
        assert.isTrue(await token.isOperator(operator, tokenHolder));
      });
      it('when is a revoked operator', async function () {
        await token
          .connect(await ethers.getSigner(tokenHolder))
          .authorizeOperator(operator);
        await token
          .connect(await ethers.getSigner(tokenHolder))
          .revokeOperator(operator);
        assert.isTrue(!(await token.isOperator(operator, tokenHolder)));
      });
      it('when is a controller and token is controllable', async function () {
        assert.isTrue(await token.isOperator(controller, tokenHolder));
      });
      it('when is a controller and token is not controllable', async function () {
        await token.connect(signer).renounceControl();
        assert.isTrue(!(await token.isOperator(controller, tokenHolder)));
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
          [controller],
          partitions
        );
      });
      it('when operator is tokenHolder', async function () {
        assert.isTrue(
          await token.isOperatorForPartition(
            partition1,
            tokenHolder,
            tokenHolder
          )
        );
      });
      it('when operator is authorized by tokenHolder', async function () {
        await token
          .connect(await ethers.getSigner(tokenHolder))
          .authorizeOperatorByPartition(partition1, operator);
        assert.isTrue(
          await token.isOperatorForPartition(partition1, operator, tokenHolder)
        );
      });
      it('when is a revoked operator', async function () {
        await token
          .connect(await ethers.getSigner(tokenHolder))
          .authorizeOperatorByPartition(partition1, operator);
        await token
          .connect(await ethers.getSigner(tokenHolder))
          .revokeOperatorByPartition(partition1, operator);
        assert.isTrue(
          !(await token.isOperatorForPartition(
            partition1,
            operator,
            tokenHolder
          ))
        );
      });
      it('when is a controller and token is controllable', async function () {
        assert.isTrue(
          await token.isOperatorForPartition(
            partition1,
            controller,
            tokenHolder
          )
        );
      });
      it('when is a controller and token is not controllable', async function () {
        await token.connect(signer).renounceControl();
        assert.isTrue(
          !(await token.isOperatorForPartition(
            partition1,
            controller,
            tokenHolder
          ))
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
          [controller],
          partitions
        );
      });

      describe('when sender is the issuer', function () {
        describe('when token is issuable', function () {
          describe('when default partitions have been defined', function () {
            describe('when the amount is a multiple of the granularity', function () {
              describe('when the recipient is not the zero address', function () {
                it('issues the requested amount', async function () {
                  await token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32);

                  await assertTotalSupply(token, issuanceAmount);
                  await assertBalanceOfSecurityToken(
                    token,
                    tokenHolder,
                    partition1,
                    issuanceAmount
                  );
                });
                it('issues twice the requested amount', async function () {
                  await token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32);
                  await token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32);

                  await assertTotalSupply(token, 2 * issuanceAmount);
                  await assertBalanceOfSecurityToken(
                    token,
                    tokenHolder,
                    partition1,
                    2 * issuanceAmount
                  );
                });
                it('emits a issuedByPartition event', async function () {
                  const { events } = await token
                    .issue(tokenHolder, issuanceAmount, ZERO_BYTES32)
                    .then((res) => res.wait());

                  assert.equal(events!.length, 3);

                  // assert.equal(events![0].event, 'Checked');
                  // assert.equal(events![0].args.sender, owner);

                  assert.equal(events![0].event, 'Issued');
                  assert.equal(events![0].args?.operator, owner);
                  assert.equal(events![0].args?.to, tokenHolder);
                  assert.equal(events![0].args?.value, issuanceAmount);
                  assert.equal(events![0].args?.data, ZERO_BYTES32);
                  assert.equal(events![0].args?.operatorData, undefined);

                  assert.equal(events![1].event, 'Transfer');
                  assert.equal(events![1].args?.from, ZERO_ADDRESS);
                  assert.equal(events![1].args?.to, tokenHolder);
                  assert.equal(events![1].args?.value, issuanceAmount);

                  assert.equal(events![2].event, 'IssuedByPartition');
                  assert.equal(events![2].args?.partition, partition1);
                  assert.equal(events![2].args?.operator, owner);
                  assert.equal(events![2].args?.to, tokenHolder);
                  assert.equal(events![2].args?.value, issuanceAmount);
                  assert.equal(events![2].args?.data, ZERO_BYTES32);
                  assert.equal(events![2].args?.operatorData, ZERO_BYTE);
                });
              });
              describe('when the recipient is not the zero address', function () {
                it('issues the requested amount', async function () {
                  await expectRevert.unspecified(
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
                  [controller],
                  partitions
                );
                await expectRevert.unspecified(
                  token.issue(tokenHolder, 1, ZERO_BYTES32)
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
                [controller],
                []
              );
              await expectRevert.unspecified(
                token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32)
              );
            });
          });
        });
        describe('when token is not issuable', function () {
          it('reverts', async function () {
            assert.isTrue(await token.isIssuable());
            await token.connect(signer).renounceIssuance();
            assert.isTrue(!(await token.isIssuable()));
            await expectRevert.unspecified(
              token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32)
            );
          });
        });
      });
      describe('when sender is not the issuer', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(unknown))
              .issue(tokenHolder, issuanceAmount, ZERO_BYTES32)
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
          [controller],
          partitions
        );
      });

      describe('when sender is the issuer', function () {
        describe('when token is issuable', function () {
          it('issues the requested amount', async function () {
            await token.issueByPartition(
              partition1,
              tokenHolder,
              issuanceAmount,
              ZERO_BYTES32
            );

            await assertTotalSupply(token, issuanceAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
          });
          it('issues twice the requested amount', async function () {
            await token.issueByPartition(
              partition1,
              tokenHolder,
              issuanceAmount,
              ZERO_BYTES32
            );
            await token.issueByPartition(
              partition1,
              tokenHolder,
              issuanceAmount,
              ZERO_BYTES32
            );

            await assertTotalSupply(token, 2 * issuanceAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              2 * issuanceAmount
            );
          });
          it('emits a issuedByPartition event', async function () {
            const { events } = await token
              .issueByPartition(
                partition1,
                tokenHolder,
                issuanceAmount,
                ZERO_BYTES32
              )
              .then((res) => res.wait());

            assert.equal(events!.length, 3);

            //   assert.equal(events![0].event, 'Checked');
            //   assert.equal(events![0].args.sender, owner);

            assert.equal(events![0].event, 'Issued');
            assert.equal(events![0].args?.operator, owner);
            assert.equal(events![0].args?.to, tokenHolder);
            assert.equal(events![0].args?.value, issuanceAmount);
            assert.equal(events![0].args?.data, ZERO_BYTES32);
            assert.equal(events![0].args?.operatorData, undefined);

            assert.equal(events![1].event, 'Transfer');
            assert.equal(events![1].args?.from, ZERO_ADDRESS);
            assert.equal(events![1].args?.to, tokenHolder);
            assert.equal(events![1].args?.value, issuanceAmount);

            assert.equal(events![2].event, 'IssuedByPartition');
            assert.equal(events![2].args?.partition, partition1);
            assert.equal(events![2].args?.operator, owner);
            assert.equal(events![2].args?.to, tokenHolder);
            assert.equal(events![2].args?.value, issuanceAmount);
            assert.equal(events![2].args?.data, ZERO_BYTES32);
            assert.equal(events![2].args?.operatorData, ZERO_BYTE);
          });
        });
        describe('when token is not issuable', function () {
          it('reverts', async function () {
            assert.isTrue(await token.isIssuable());
            await token.connect(signer).renounceIssuance();
            assert.isTrue(!(await token.isIssuable()));
            await expectRevert.unspecified(
              token.issueByPartition(
                partition1,
                tokenHolder,
                issuanceAmount,
                ZERO_BYTES32
              )
            );
          });
        });
      });
      describe('when sender is not the issuer', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(unknown))
              .issueByPartition(
                partition1,
                tokenHolder,
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
          [controller],
          partitions
        );
        await issueOnMultiplePartitions(token, owner, tokenHolder, partitions, [
          issuanceAmount,
          issuanceAmount,
          issuanceAmount
        ]);
      });
      describe('when defaultPartitions have been defined', function () {
        describe('when the amount is a multiple of the granularity', function () {
          describe('when the sender has enough balance for those default partitions', function () {
            it('redeeems the requested amount', async function () {
              await token.setDefaultPartitions(reversedPartitions);
              await assertBalances(token, tokenHolder, partitions, [
                issuanceAmount,
                issuanceAmount,
                issuanceAmount
              ]);

              await token
                .connect(await ethers.getSigner(tokenHolder))
                .redeem(2.5 * issuanceAmount, ZERO_BYTES32);

              await assertBalances(token, tokenHolder, partitions, [
                0,
                0.5 * issuanceAmount,
                0
              ]);
            });
            it('emits a redeemedByPartition events', async function () {
              await token.setDefaultPartitions(reversedPartitions);
              const { events } = await token
                .connect(await ethers.getSigner(tokenHolder))
                .redeem(2.5 * issuanceAmount, ZERO_BYTES32)
                .then((res) => res.wait());

              assert.equal(events!.length, 3 * partitions.length);

              assertBurnEvent(
                [events![0], events![1], events![2]],
                partition3,
                tokenHolder,
                tokenHolder,
                issuanceAmount,
                ZERO_BYTES32,
                ZERO_BYTE
              );
              assertBurnEvent(
                [events![3], events![4], events![5]],
                partition1,
                tokenHolder,
                tokenHolder,
                issuanceAmount,
                ZERO_BYTES32,
                ZERO_BYTE
              );
              assertBurnEvent(
                [events![6], events![7], events![8]],
                partition2,
                tokenHolder,
                tokenHolder,
                0.5 * issuanceAmount,
                ZERO_BYTES32,
                ZERO_BYTE
              );
            });
          });
          describe('when the sender does not have enough balance for those default partitions', function () {
            it('reverts', async function () {
              await token.setDefaultPartitions(reversedPartitions);
              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(tokenHolder))
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
              [controller],
              partitions
            );
            await issueOnMultiplePartitions(
              token,
              owner,
              tokenHolder,
              partitions,
              [issuanceAmount, issuanceAmount, issuanceAmount]
            );
            await token.setDefaultPartitions(reversedPartitions);
            await assertBalances(token, tokenHolder, partitions, [
              issuanceAmount,
              issuanceAmount,
              issuanceAmount
            ]);

            await expectRevert.unspecified(
              token
                .connect(await ethers.getSigner(tokenHolder))
                .redeem(3, ZERO_BYTES32)
            );
          });
        });
      });
      describe('when defaultPartitions have not been defined', function () {
        it('reverts', async function () {
          await token.setDefaultPartitions([]);
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(tokenHolder))
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
          [controller],
          partitions
        );
        await issueOnMultiplePartitions(token, owner, tokenHolder, partitions, [
          issuanceAmount,
          issuanceAmount,
          issuanceAmount
        ]);
      });
      describe('when the operator is approved', function () {
        beforeEach(async function () {
          await token
            .connect(await ethers.getSigner(tokenHolder))
            .authorizeOperator(operator);
        });
        describe('when defaultPartitions have been defined', function () {
          describe('when the sender has enough balance for those default partitions', function () {
            describe('when the amount is a multiple of the granularity', function () {
              describe('when the redeemer is not the zero address', function () {
                it('redeems the requested amount', async function () {
                  await token.setDefaultPartitions(reversedPartitions);
                  await assertBalances(token, tokenHolder, partitions, [
                    issuanceAmount,
                    issuanceAmount,
                    issuanceAmount
                  ]);

                  await token
                    .connect(await ethers.getSigner(operator))
                    .redeemFrom(
                      tokenHolder,
                      2.5 * issuanceAmount,
                      ZERO_BYTES32
                    );

                  await assertBalances(token, tokenHolder, partitions, [
                    0,
                    0.5 * issuanceAmount,
                    0
                  ]);
                });
                it('emits redeemedByPartition events', async function () {
                  await token.setDefaultPartitions(reversedPartitions);
                  const { events } = await token
                    .connect(await ethers.getSigner(operator))
                    .redeemFrom(tokenHolder, 2.5 * issuanceAmount, ZERO_BYTES32)
                    .then((res) => res.wait());

                  assert.equal(events!.length, 3 * partitions.length);

                  assertBurnEvent(
                    [events![0], events![1], events![2]],
                    partition3,
                    operator,
                    tokenHolder,
                    issuanceAmount,
                    ZERO_BYTES32,
                    ZERO_BYTE
                  );
                  assertBurnEvent(
                    [events![3], events![4], events![5]],
                    partition1,
                    operator,
                    tokenHolder,
                    issuanceAmount,
                    ZERO_BYTES32,
                    ZERO_BYTE
                  );
                  assertBurnEvent(
                    [events![6], events![7], events![8]],
                    partition2,
                    operator,
                    tokenHolder,
                    0.5 * issuanceAmount,
                    ZERO_BYTES32,
                    ZERO_BYTE
                  );
                });
              });
              describe('when the redeemer is the zero address', function () {
                it('reverts', async function () {
                  await token.setDefaultPartitions(reversedPartitions);
                  await assertBalances(token, tokenHolder, partitions, [
                    issuanceAmount,
                    issuanceAmount,
                    issuanceAmount
                  ]);

                  await expectRevert.unspecified(
                    token
                      .connect(await ethers.getSigner(controller))
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
                    [controller],
                    partitions,
                    ZERO_ADDRESS,
                    ZERO_ADDRESS
                  );
                  await issueOnMultiplePartitions(
                    token,
                    owner,
                    tokenHolder,
                    partitions,
                    [issuanceAmount, issuanceAmount, issuanceAmount]
                  );
                  await token.setDefaultPartitions(reversedPartitions);

                  await expectRevert.unspecified(
                    token
                      .connect(await ethers.getSigner(controller))
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
                  [controller],
                  partitions
                );
                await issueOnMultiplePartitions(
                  token,
                  owner,
                  tokenHolder,
                  partitions,
                  [issuanceAmount, issuanceAmount, issuanceAmount]
                );
                await token.setDefaultPartitions(reversedPartitions);
                await assertBalances(token, tokenHolder, partitions, [
                  issuanceAmount,
                  issuanceAmount,
                  issuanceAmount
                ]);

                await expectRevert.unspecified(
                  token
                    .connect(await ethers.getSigner(operator))
                    .redeemFrom(tokenHolder, 3, ZERO_BYTES32)
                );
              });
            });
          });
          describe('when the sender does not have enough balance for those default partitions', function () {
            it('reverts', async function () {
              await token.setDefaultPartitions(reversedPartitions);
              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(operator))
                  .redeemFrom(tokenHolder, 3.5 * issuanceAmount, ZERO_BYTES32)
              );
            });
            it('reverts (mock contract - for 100% test coverage)', async function () {
              token = await new FakeERC1400Mock__factory(signer).deploy(
                'ERC1400Token',
                'DAU',
                1,
                [controller],
                partitions,
                ZERO_ADDRESS,
                ZERO_ADDRESS
              );

              await issueOnMultiplePartitions(
                token,
                owner,
                tokenHolder,
                partitions,
                [issuanceAmount, issuanceAmount, issuanceAmount]
              );

              await token.setDefaultPartitions(reversedPartitions);

              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(controller))
                  .redeemFrom(tokenHolder, 3.5 * issuanceAmount, ZERO_BYTES32)
              );
            });
          });
        });
        describe('when defaultPartitions have not been defined', function () {
          it('reverts', async function () {
            await token.setDefaultPartitions([]);
            await expectRevert.unspecified(
              token
                .connect(await ethers.getSigner(operator))
                .redeemFrom(tokenHolder, 2.5 * issuanceAmount, ZERO_BYTES32)
            );
          });
        });
      });
      describe('when the operator is not approved', function () {
        it('reverts', async function () {
          await token.setDefaultPartitions(reversedPartitions);
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(operator))
              .redeemFrom(tokenHolder, 2.5 * issuanceAmount, ZERO_BYTES32)
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
          [controller],
          partitions
        );
        await token.issueByPartition(
          partition1,
          tokenHolder,
          issuanceAmount,
          ZERO_BYTES32
        );
      });

      describe('when the redeemer has enough balance for this partition', function () {
        it('redeems the requested amount', async function () {
          await token
            .connect(await ethers.getSigner(tokenHolder))
            .redeemByPartition(partition1, redeemAmount, ZERO_BYTES32);

          await assertTotalSupply(token, issuanceAmount - redeemAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolder,
            partition1,
            issuanceAmount - redeemAmount
          );
        });
        it('emits a redeemedByPartition event', async function () {
          const { events } = await token
            .connect(await ethers.getSigner(tokenHolder))
            .redeemByPartition(partition1, redeemAmount, ZERO_BYTES32)
            .then((res) => res.wait());

          assert.equal(events!.length, 3);

          assertBurnEvent(
            events!,
            partition1,
            tokenHolder,
            tokenHolder,
            redeemAmount,
            ZERO_BYTES32,
            ZERO_BYTE
          );
        });
      });
      describe('when the redeemer does not have enough balance for this partition', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(tokenHolder))
              .redeemByPartition(partition2, redeemAmount, ZERO_BYTES32)
          );
        });
      });
      describe('special case (_removeTokenFromPartition shall revert)', function () {
        it('reverts', async function () {
          await token.issueByPartition(
            partition2,
            owner,
            issuanceAmount,
            ZERO_BYTES32
          );
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(tokenHolder))
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
          [controller],
          partitions
        );
        await token.issueByPartition(
          partition1,
          tokenHolder,
          issuanceAmount,
          ZERO_BYTES32
        );
      });

      describe('when the sender is an operator for this partition', function () {
        describe('when the redeemer has enough balance for this partition', function () {
          it('redeems the requested amount', async function () {
            await token
              .connect(await ethers.getSigner(tokenHolder))
              .authorizeOperatorByPartition(partition1, operator);
            await token
              .connect(await ethers.getSigner(operator))
              .operatorRedeemByPartition(
                partition1,
                tokenHolder,
                redeemAmount,
                ZERO_BYTES32
              );

            await assertTotalSupply(token, issuanceAmount - redeemAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount - redeemAmount
            );
          });
          it('emits a redeemedByPartition event', async function () {
            await token
              .connect(await ethers.getSigner(tokenHolder))
              .authorizeOperatorByPartition(partition1, operator);
            const { events } = await token
              .connect(await ethers.getSigner(operator))
              .operatorRedeemByPartition(
                partition1,
                tokenHolder,
                redeemAmount,
                ZERO_BYTES32
              )
              .then((res) => res.wait());

            assert.equal(events!.length, 3);

            assertBurnEvent(
              events!,
              partition1,
              operator,
              tokenHolder,
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
                .connect(await ethers.getSigner(tokenHolder))
                .authorizeOperatorByPartition(partition1, operator);

              await expectRevert.unspecified(
                token
                  .connect(await ethers.getSigner(operator))
                  .operatorRedeemByPartition(
                    partition1,
                    tokenHolder,
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
            .connect(await ethers.getSigner(tokenHolder))
            .authorizeOperator(operator);
          await token
            .connect(await ethers.getSigner(operator))
            .operatorRedeemByPartition(
              partition1,
              tokenHolder,
              redeemAmount,
              ZERO_BYTES32
            );

          await assertTotalSupply(token, issuanceAmount - redeemAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolder,
            partition1,
            issuanceAmount - redeemAmount
          );
        });
      });
      describe('when the sender is not an operator', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(operator))
              .operatorRedeemByPartition(
                partition1,
                tokenHolder,
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
          [controller],
          partitions
        );
      });

      describe('name', function () {
        it('returns the name of the token', async function () {
          const name = await token.name();

          assert.equal(name, 'ERC1400Token');
        });
      });

      describe('symbol', function () {
        it('returns the symbol of the token', async function () {
          const symbol = await token.symbol();

          assert.equal(symbol, 'DAU');
        });
      });

      describe('decimals', function () {
        it('returns the decimals the token', async function () {
          const decimals = await token.decimals();

          assert.equal(decimals, 18);
        });
      });

      describe('granularity', function () {
        it('returns the granularity of tokens', async function () {
          const granularity = await token.granularity();

          assert.equal(granularity.toNumber(), 1);
        });
      });

      describe('totalPartitions', function () {
        it('returns the list of partitions', async function () {
          let totalPartitions = await token.totalPartitions();
          assert.equal(totalPartitions.length, 0);

          await token.issueByPartition(
            partition1,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32
          );
          totalPartitions = await token.totalPartitions();
          assert.equal(totalPartitions.length, 1);
          assert.equal(totalPartitions[0], partition1);

          await token.issueByPartition(
            partition2,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32
          );
          totalPartitions = await token.totalPartitions();
          assert.equal(totalPartitions.length, 2);
          assert.equal(totalPartitions[0], partition1);
          assert.equal(totalPartitions[1], partition2);

          await token.issueByPartition(
            partition3,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32
          );
          totalPartitions = await token.totalPartitions();
          assert.equal(totalPartitions.length, 3);
          assert.equal(totalPartitions[0], partition1);
          assert.equal(totalPartitions[1], partition2);
          assert.equal(totalPartitions[2], partition3);
        });
      });

      describe('totalSupplyByPartition', function () {
        it('returns the totalSupply of a given partition', async function () {
          totalSupplyPartition1 = await token.totalSupplyByPartition(
            partition1
          );
          totalSupplyPartition2 = await token.totalSupplyByPartition(
            partition2
          );
          assert.equal(totalSupplyPartition1.eq(0), true);
          assert.equal(totalSupplyPartition2.eq(0), true);

          await token.issueByPartition(
            partition1,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32
          );
          totalSupplyPartition1 = await token.totalSupplyByPartition(
            partition1
          );
          totalSupplyPartition2 = await token.totalSupplyByPartition(
            partition2
          );
          assert.equal(totalSupplyPartition1.eq(issuanceAmount), true);
          assert.equal(totalSupplyPartition2.eq(0), true);

          await token.issueByPartition(
            partition2,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32
          );
          totalSupplyPartition1 = await token.totalSupplyByPartition(
            partition1
          );
          totalSupplyPartition2 = await token.totalSupplyByPartition(
            partition2
          );
          assert.equal(totalSupplyPartition1.eq(issuanceAmount), true);
          assert.equal(totalSupplyPartition2.eq(issuanceAmount), true);

          await token.issueByPartition(
            partition1,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32
          );
          totalSupplyPartition1 = await token.totalSupplyByPartition(
            partition1
          );
          totalSupplyPartition2 = await token.totalSupplyByPartition(
            partition2
          );
          assert.equal(totalSupplyPartition1.eq(2 * issuanceAmount), true);
          assert.equal(totalSupplyPartition2.eq(issuanceAmount), true);
        });
      });

      describe('total supply', function () {
        it('returns the total amount of tokens', async function () {
          await token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32);
          const totalSupply = await token.totalSupply();

          assert.equal(totalSupply.eq(issuanceAmount), true);
        });
      });

      describe('balanceOf', function () {
        describe('when the requested account has no tokens', function () {
          it('returns zero', async function () {
            const balance = await token.balanceOf(unknown);

            assert.equal(balance.eq(0), true);
          });
        });

        describe('when the requested account has some tokens', function () {
          it('returns the total amount of tokens', async function () {
            await token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32);
            const balance = await token.balanceOf(tokenHolder);

            assert.equal(balance.eq(issuanceAmount), true);
          });
        });
      });

      describe('controllers', function () {
        it('returns the list of controllers', async function () {
          const controllers = await token.controllers();

          assert.equal(controllers.length, 1);
          assert.equal(controllers[0], controller);
        });
      });

      describe('implementer1400', function () {
        it('returns the contract address', async function () {
          let interface1400Implementer = await registry.getInterfaceImplementer(
            token.address,
            ethers.utils.id(ERC1400_INTERFACE_NAME)
          );
          assert.equal(interface1400Implementer, token.address);
        });
      });

      describe('implementer20', function () {
        it('returns the zero address', async function () {
          let interface20Implementer = await registry.getInterfaceImplementer(
            token.address,
            ethers.utils.id(ERC20_INTERFACE_NAME)
          );
          assert.equal(interface20Implementer, token.address);
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
          [controller],
          partitions
        );
      });
      describe('when the caller is the contract owner', function () {
        it('sets the operators as controllers', async function () {
          const controllers1 = await token.controllers();
          assert.equal(controllers1.length, 1);
          assert.equal(controllers1[0], controller);
          assert.isTrue(await token.isOperator(controller, unknown));
          assert.isTrue(
            !(await token.isOperator(controller_alternative1, unknown))
          );
          assert.isTrue(
            !(await token.isOperator(controller_alternative2, unknown))
          );
          await token.setControllers([
            controller_alternative1,
            controller_alternative2
          ]);
          const controllers2 = await token.controllers();
          assert.equal(controllers2.length, 2);
          assert.equal(controllers2[0], controller_alternative1);
          assert.equal(controllers2[1], controller_alternative2);
          assert.isTrue(!(await token.isOperator(controller, unknown)));
          assert.isTrue(
            await token.isOperator(controller_alternative1, unknown)
          );
          assert.isTrue(
            await token.isOperator(controller_alternative2, unknown)
          );
          await token.connect(signer).renounceControl();
          assert.isTrue(
            !(await token.isOperator(controller_alternative1, unknown))
          );
          assert.isTrue(
            !(await token.isOperator(controller_alternative1, unknown))
          );
          assert.isTrue(
            !(await token.isOperator(controller_alternative2, unknown))
          );
        });
      });
      describe('when the caller is not the contract owner', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(unknown))
              .setControllers([
                controller_alternative1,
                controller_alternative2
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
          [controller],
          partitions
        );
      });
      describe('when the caller is the contract owner', function () {
        it('sets the operators as controllers for the specified partition', async function () {
          assert.isTrue(await token.isControllable());

          const controllers1 = await token.controllersByPartition(partition1);
          assert.equal(controllers1.length, 0);
          assert.isTrue(
            await token.isOperatorForPartition(partition1, controller, unknown)
          );
          assert.isTrue(
            !(await token.isOperatorForPartition(
              partition1,
              controller_alternative1,
              unknown
            ))
          );
          assert.isTrue(
            !(await token.isOperatorForPartition(
              partition1,
              controller_alternative2,
              unknown
            ))
          );
          await token.setPartitionControllers(partition1, [
            controller_alternative1,
            controller_alternative2
          ]);
          const controllers2 = await token.controllersByPartition(partition1);
          assert.equal(controllers2.length, 2);
          assert.equal(controllers2[0], controller_alternative1);
          assert.equal(controllers2[1], controller_alternative2);
          assert.isTrue(
            await token.isOperatorForPartition(partition1, controller, unknown)
          );
          assert.isTrue(
            await token.isOperatorForPartition(
              partition1,
              controller_alternative1,
              unknown
            )
          );
          assert.isTrue(
            await token.isOperatorForPartition(
              partition1,
              controller_alternative2,
              unknown
            )
          );
          await token.connect(signer).renounceControl();
          assert.isTrue(
            !(await token.isOperatorForPartition(
              partition1,
              controller_alternative1,
              unknown
            ))
          );
          assert.isTrue(
            !(await token.isOperatorForPartition(
              partition1,
              controller_alternative1,
              unknown
            ))
          );
          assert.isTrue(
            !(await token.isOperatorForPartition(
              partition1,
              controller_alternative2,
              unknown
            ))
          );
        });
        it('removes the operators as controllers for the specified partition', async function () {
          assert.isTrue(await token.isControllable());

          const controllers1 = await token.controllersByPartition(partition1);
          assert.equal(controllers1.length, 0);
          assert.isTrue(
            await token.isOperatorForPartition(partition1, controller, unknown)
          );
          assert.isTrue(
            !(await token.isOperatorForPartition(
              partition1,
              controller_alternative1,
              unknown
            ))
          );
          assert.isTrue(
            !(await token.isOperatorForPartition(
              partition1,
              controller_alternative2,
              unknown
            ))
          );
          await token.setPartitionControllers(partition1, [
            controller_alternative1,
            controller_alternative2
          ]);
          const controllers2 = await token.controllersByPartition(partition1);
          assert.equal(controllers2.length, 2);
          assert.equal(controllers2[0], controller_alternative1);
          assert.equal(controllers2[1], controller_alternative2);
          assert.isTrue(
            await token.isOperatorForPartition(partition1, controller, unknown)
          );
          assert.isTrue(
            await token.isOperatorForPartition(
              partition1,
              controller_alternative1,
              unknown
            )
          );
          assert.isTrue(
            await token.isOperatorForPartition(
              partition1,
              controller_alternative2,
              unknown
            )
          );
          await token.setPartitionControllers(partition1, [
            controller_alternative2
          ]);
          const controllers3 = await token.controllersByPartition(partition1);
          assert.equal(controllers3.length, 1);
          assert.equal(controllers3[0], controller_alternative2);
          assert.isTrue(
            await token.isOperatorForPartition(partition1, controller, unknown)
          );
          assert.isTrue(
            !(await token.isOperatorForPartition(
              partition1,
              controller_alternative1,
              unknown
            ))
          );
          assert.isTrue(
            await token.isOperatorForPartition(
              partition1,
              controller_alternative2,
              unknown
            )
          );
        });
      });
      describe('when the caller is not the contract owner', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(unknown))
              .setPartitionControllers(partition1, [
                controller_alternative1,
                controller_alternative2
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
          [controller],
          partitions
        );
        defaultPartitions = await token.getDefaultPartitions();
        assert.equal(defaultPartitions.length, 3);
        assert.equal(defaultPartitions[0], partition1);
        assert.equal(defaultPartitions[1], partition2);
        assert.equal(defaultPartitions[2], partition3);
      });
      describe('when the sender is the contract owner', function () {
        it('sets the list of token default partitions', async function () {
          await token.setDefaultPartitions(reversedPartitions);
          defaultPartitions = await token.getDefaultPartitions();
          assert.equal(defaultPartitions.length, 3);
          assert.equal(defaultPartitions[0], partition3);
          assert.equal(defaultPartitions[1], partition1);
          assert.equal(defaultPartitions[2], partition2);
        });
      });
      describe('when the sender is not the contract owner', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(unknown))
              .setDefaultPartitions(reversedPartitions)
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
          [controller],
          partitions
        );
      });
      describe('when sender approves an operator for a given partition', function () {
        it('approves the operator', async function () {
          assert.equal(
            (
              await token.allowanceByPartition(
                partition1,
                tokenHolder,
                operator
              )
            ).toNumber(),
            0
          );

          await token
            .connect(await ethers.getSigner(tokenHolder))
            .approveByPartition(partition1, operator, amount);

          assert.equal(
            (
              await token.allowanceByPartition(
                partition1,
                tokenHolder,
                operator
              )
            ).eq(amount),
            true
          );
        });
        it('emits an approval event', async function () {
          const { events } = await token
            .connect(await ethers.getSigner(tokenHolder))
            .approveByPartition(partition1, operator, amount)
            .then((res) => res.wait());

          assert.equal(events!.length, 1);
          assert.equal(events![0].event, 'ApprovalByPartition');
          assert.equal(events![0].args?.partition, partition1);
          assert.equal(events![0].args?.owner, tokenHolder);
          assert.equal(events![0].args?.spender, operator);
          assert.equal(events![0].args?.value, amount);
        });
      });
      describe('when the operator to approve is the zero address', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(tokenHolder))
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
          [controller],
          partitions
        );
        migratedToken = await new ERC1400__factory(signer).deploy(
          'ERC1400Token',
          'DAU20',
          1,
          [controller],
          partitions
        );
        await token.issueByPartition(
          partition1,
          tokenHolder,
          issuanceAmount,
          ZERO_BYTES32
        );
      });
      describe('when the sender is the contract owner', function () {
        describe('when the contract is not migrated', function () {
          it('can transfer tokens', async function () {
            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOfSecurityToken(token, recipient, partition1, 0);

            await token
              .connect(await ethers.getSigner(tokenHolder))
              .transferByPartition(
                partition1,
                recipient,
                transferAmount,
                ZERO_BYTES32
              );

            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOfSecurityToken(
              token,
              recipient,
              partition1,
              transferAmount
            );
          });
        });
        describe('when the contract is migrated definitely', function () {
          it('can not transfer tokens', async function () {
            let interface1400Implementer =
              await registry.getInterfaceImplementer(
                token.address,
                ethers.utils.id(ERC1400_INTERFACE_NAME)
              );
            assert.equal(interface1400Implementer, token.address);
            let interface20Implementer = await registry.getInterfaceImplementer(
              token.address,
              ethers.utils.id(ERC20_INTERFACE_NAME)
            );
            assert.equal(interface20Implementer, token.address);

            await token.migrate(migratedToken.address, true);

            interface1400Implementer = await registry.getInterfaceImplementer(
              token.address,
              ethers.utils.id(ERC1400_INTERFACE_NAME)
            );
            assert.equal(interface1400Implementer, migratedToken.address);
            interface20Implementer = await registry.getInterfaceImplementer(
              token.address,
              ethers.utils.id(ERC20_INTERFACE_NAME)
            );
            assert.equal(interface20Implementer, migratedToken.address);

            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOfSecurityToken(token, recipient, partition1, 0);

            await expectRevert.unspecified(
              token
                .connect(await ethers.getSigner(tokenHolder))
                .transferByPartition(
                  partition1,
                  recipient,
                  transferAmount,
                  ZERO_BYTES32
                )
            );
          });
        });
        describe('when the contract is migrated, but not definitely', function () {
          it('can transfer tokens', async function () {
            let interface1400Implementer =
              await registry.getInterfaceImplementer(
                token.address,
                ethers.utils.id(ERC1400_INTERFACE_NAME)
              );
            assert.equal(interface1400Implementer, token.address);
            let interface20Implementer = await registry.getInterfaceImplementer(
              token.address,
              ethers.utils.id(ERC20_INTERFACE_NAME)
            );
            assert.equal(interface20Implementer, token.address);

            await token.migrate(migratedToken.address, false);

            interface1400Implementer = await registry.getInterfaceImplementer(
              token.address,
              ethers.utils.id(ERC1400_INTERFACE_NAME)
            );
            assert.equal(interface1400Implementer, migratedToken.address);
            interface20Implementer = await registry.getInterfaceImplementer(
              token.address,
              ethers.utils.id(ERC20_INTERFACE_NAME)
            );
            assert.equal(interface20Implementer, migratedToken.address);

            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOfSecurityToken(token, recipient, partition1, 0);

            await token
              .connect(await ethers.getSigner(tokenHolder))
              .transferByPartition(
                partition1,
                recipient,
                transferAmount,
                ZERO_BYTES32
              );

            await assertBalanceOfSecurityToken(
              token,
              tokenHolder,
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOfSecurityToken(
              token,
              recipient,
              partition1,
              transferAmount
            );
          });
        });
      });
      describe('when the sender is not the contract owner', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token
              .connect(await ethers.getSigner(unknown))
              .migrate(migratedToken.address, true)
          );
        });
      });
    });
  }
);
