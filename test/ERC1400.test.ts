// @ts-nocheck

import { ethers, artifacts, network, assert, contract } from 'hardhat';
import type { ERC1400, ERC1820Registry, MinterMock } from '../typechain-types';

const { expectRevert } = require('@openzeppelin/test-helpers');

const ERC1400 = artifacts.require('ERC1400');

const ERC1820Registry = artifacts.require('ERC1820Registry');

const FakeERC1400 = artifacts.require('FakeERC1400Mock');

const MinterMock = artifacts.require('MinterMock');

const ERC1820_ACCEPT_MAGIC = 'ERC1820_ACCEPT_MAGIC';

const ERC20_INTERFACE_NAME = 'ERC20Token';
const ERC1400_INTERFACE_NAME = 'ERC1400Token';

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTE = '0x';

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
const partition1 = '0x'.concat(partition1_short);
const partition2 = '0x'.concat(partition2_short);
const partition3 = '0x'.concat(partition3_short);

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

const assertTransferEvent = (
  _logs: string | any[],
  _fromPartition: string,
  _operator: any,
  _from: any,
  _to: any,
  _amount: number,
  _data: string | null,
  _operatorData: string | null
) => {
  let i = 0;
  if (_logs.length === 3) {
    assert.equal(_logs[0].event, 'Checked');
    assert.equal(_logs[0].args.sender, _operator);
    i = 1;
  }

  assert.equal(_logs[i].event, 'Transfer');
  assert.equal(_logs[i].args.from, _from);
  assert.equal(_logs[i].args.to, _to);
  assert.equal(_logs[i].args.value, _amount);

  assert.equal(_logs[i + 1].event, 'TransferByPartition');
  assert.equal(_logs[i + 1].args.fromPartition, _fromPartition);
  assert.equal(_logs[i + 1].args.operator, _operator);
  assert.equal(_logs[i + 1].args.from, _from);
  assert.equal(_logs[i + 1].args.to, _to);
  assert.equal(_logs[i + 1].args.value, _amount);
  assert.equal(_logs[i + 1].args.data, _data);
  assert.equal(_logs[i + 1].args.operatorData, _operatorData);
};

const assertBurnEvent = (
  _logs: string | any[],
  _fromPartition: string,
  _operator: any,
  _from: any,
  _amount: number,
  _data: string | null,
  _operatorData: string | null
) => {
  let i = 0;
  if (_logs.length === 4) {
    assert.equal(_logs[0].event, 'Checked');
    assert.equal(_logs[0].args.sender, _operator);
    i = 1;
  }

  assert.equal(_logs[i].event, 'Redeemed');
  assert.equal(_logs[i].args.operator, _operator);
  assert.equal(_logs[i].args.from, _from);
  assert.equal(_logs[i].args.value, _amount);
  assert.equal(_logs[i].args.data, _data);

  assert.equal(_logs[i + 1].event, 'Transfer');
  assert.equal(_logs[i + 1].args.from, _from);
  assert.equal(_logs[i + 1].args.to, ZERO_ADDRESS);
  assert.equal(_logs[i + 1].args.value, _amount);

  assert.equal(_logs[i + 2].event, 'RedeemedByPartition');
  assert.equal(_logs[i + 2].args.partition, _fromPartition);
  assert.equal(_logs[i + 2].args.operator, _operator);
  assert.equal(_logs[i + 2].args.from, _from);
  assert.equal(_logs[i + 2].args.value, _amount);
  assert.equal(_logs[i + 2].args.operatorData, _operatorData);
};

const assertBalances = async (
  _contract: any,
  _tokenHolder: any,
  _partitions: string | any[],
  _amounts: any[]
) => {
  let totalBalance = 0;
  for (let i = 0; i < _partitions.length; i++) {
    totalBalance += _amounts[i];
    await assertBalanceOfByPartition(
      _contract,
      _tokenHolder,
      _partitions[i],
      _amounts[i]
    );
  }
  await assertBalance(_contract, _tokenHolder, totalBalance);
};

const assertBalanceOf = async (
  _contract: any,
  _tokenHolder: any,
  _partition: string,
  _amount: number
) => {
  await assertBalance(_contract, _tokenHolder, _amount);
  await assertBalanceOfByPartition(
    _contract,
    _tokenHolder,
    _partition,
    _amount
  );
};

const assertBalanceOfByPartition = async (
  _contract: { balanceOfByPartition: (arg0: any, arg1: any) => any },
  _tokenHolder: any,
  _partition: string,
  _amount: number
) => {
  balanceByPartition = await _contract.balanceOfByPartition(
    _partition,
    _tokenHolder
  );
  assert.equal(balanceByPartition, _amount);
};

const assertBalance = async (
  _contract: { balanceOf: (arg0: any) => any },
  _tokenHolder: any,
  _amount: number
) => {
  balance = await _contract.balanceOf(_tokenHolder);
  assert.equal(balance, _amount);
};

const assertTotalSupply = async (
  _contract: { totalSupply: () => any },
  _amount: number
) => {
  totalSupply = await _contract.totalSupply();
  assert.equal(totalSupply, _amount);
};

const authorizeOperatorForPartitions = async (
  _contract: {
    authorizeOperatorByPartition: (
      arg0: any,
      arg1: any,
      arg2: { from: any }
    ) => any;
  },
  _operator: any,
  _tokenHolder: any,
  _partitions: string | any[]
) => {
  for (let i = 0; i < _partitions.length; i++) {
    await _contract.authorizeOperatorByPartition(_partitions[i], _operator, {
      from: _tokenHolder
    });
  }
};

const issueOnMultiplePartitions = async (
  _contract: {
    issueByPartition: (
      arg0: any,
      arg1: any,
      arg2: any,
      arg3: string,
      arg4: { from: any }
    ) => any;
  },
  _owner: any,
  _recipient: any,
  _partitions: string | any[],
  _amounts: any[]
) => {
  for (let i = 0; i < _partitions.length; i++) {
    await _contract.issueByPartition(
      _partitions[i],
      _recipient,
      _amounts[i],
      ZERO_BYTES32,
      { from: _owner }
    );
  }
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
    before(async function () {
      registry = await ERC1820Registry.deployed();
    });

    describe('contract creation', function () {
      it('fails deploying the contract if granularity is lower than 1', async function () {
        await expectRevert.unspecified(
          ERC1400.new('ERC1400Token', 'DAU', 0, [controller], partitions)
        );
      });
    });

    // CANIMPLEMENTINTERFACE

    describe('canImplementInterfaceForAddress', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
        token = await ERC1400.new(
          'ERC1400Token',
          'DAU',
          1,
          [controller],
          partitions,
          { from: owner }
        );
      });
      describe('addMinter/removeMinter', function () {
        describe('add/renounce a minter', function () {
          describe('when caller is a minter', function () {
            it('adds a minter as owner', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await token.addMinter(unknown, {
                from: owner
              });
              assert.equal(await token.isMinter(unknown), true);
            });
            it('adds a minter as minter', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await token.addMinter(unknown, {
                from: owner
              });
              assert.equal(await token.isMinter(unknown), true);

              assert.equal(await token.isMinter(tokenHolder), false);
              await token.addMinter(tokenHolder, {
                from: unknown
              });
              assert.equal(await token.isMinter(tokenHolder), true);
            });
            it('renounces minter', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await token.addMinter(unknown, {
                from: owner
              });
              assert.equal(await token.isMinter(unknown), true);
              await token.renounceMinter({
                from: unknown
              });
              assert.equal(await token.isMinter(unknown), false);
            });
          });
          describe('when caller is not a minter', function () {
            it('reverts', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await expectRevert.unspecified(
                token.addMinter(unknown, { from: unknown })
              );
              assert.equal(await token.isMinter(unknown), false);
            });
          });
        });
        describe('remove a minter', function () {
          describe('when caller is a minter', function () {
            it('removes a minter as owner', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await token.addMinter(unknown, {
                from: owner
              });
              assert.equal(await token.isMinter(unknown), true);
              await token.removeMinter(unknown, {
                from: owner
              });
              assert.equal(await token.isMinter(unknown), false);
            });
          });
          describe('when caller is not a minter', function () {
            it('reverts', async function () {
              assert.equal(await token.isMinter(unknown), false);
              await token.addMinter(unknown, {
                from: owner
              });
              assert.equal(await token.isMinter(unknown), true);
              await expectRevert.unspecified(
                token.removeMinter(unknown, {
                  from: tokenHolder
                })
              );
              assert.equal(await token.isMinter(unknown), true);
            });
          });
        });
      });
      describe('onlyMinter [mock for coverage]', function () {
        let minterMock: MinterMock;
        beforeEach(async function () {
          minterMock = await MinterMock.new({ from: owner });
        });
        describe('can not call function if not minter', function () {
          it('reverts', async function () {
            assert.equal(await minterMock.isMinter(unknown), false);
            await expectRevert.unspecified(
              minterMock.addMinter(unknown, { from: unknown })
            );
            assert.equal(await minterMock.isMinter(unknown), false);
            await minterMock.addMinter(unknown, { from: owner });
            assert.equal(await minterMock.isMinter(unknown), true);
          });
        });
      });
    });

    // TRANSFER

    describe('transfer', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
          ZERO_BYTES32,
          { from: owner }
        );
      });

      describe('when the amount is a multiple of the granularity', function () {
        describe('when the recipient is not the zero address', function () {
          describe('when the sender has enough balance', function () {
            const amount = issuanceAmount;

            it('transfers the requested amount', async function () {
              await token.transfer(recipient, amount, {
                from: tokenHolder
              });
              await assertBalance(token, tokenHolder, issuanceAmount - amount);
              await assertBalance(token, recipient, amount);
            });

            it('emits a Transfer event', async function () {
              const { logs } = await token.transfer(recipient, amount, {
                from: tokenHolder
              });

              assert.equal(logs.length, 2);

              assert.equal(logs[0].event, 'Transfer');
              assert.equal(logs[0].args.from, tokenHolder);
              assert.equal(logs[0].args.to, recipient);
              assert.equal(logs[0].args.value, amount);

              assert.equal(logs[1].event, 'TransferByPartition');
              assert.equal(logs[1].args.fromPartition, partition1);
              assert.equal(logs[1].args.operator, tokenHolder);
              assert.equal(logs[1].args.from, tokenHolder);
              assert.equal(logs[1].args.to, recipient);
              assert.equal(logs[1].args.value, amount);
              assert.equal(logs[1].args.data, null);
              assert.equal(logs[1].args.operatorData, null);
            });
          });
          describe('when the sender does not have enough balance', function () {
            const amount = issuanceAmount + 1;

            it('reverts', async function () {
              await expectRevert.unspecified(
                token.transfer(recipient, amount, { from: tokenHolder })
              );
            });
          });
        });

        describe('when the recipient is the zero address', function () {
          const amount = issuanceAmount;

          it('reverts', async function () {
            await expectRevert.unspecified(
              token.transfer(ZERO_ADDRESS, amount, { from: tokenHolder })
            );
          });
        });
      });
      describe('when the amount is not a multiple of the granularity', function () {
        it('reverts', async function () {
          token = await ERC1400.new('ERC1400Token', 'DAU', 2, [], partitions);
          await token.issueByPartition(
            partition1,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32,
            { from: owner }
          );
          await expectRevert.unspecified(
            token.transfer(recipient, 3, { from: tokenHolder })
          );
        });
      });
    });

    // TRANSFERFROM

    describe('transferFrom', function () {
      const approvedAmount = 10000;
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
          ZERO_BYTES32,
          { from: owner }
        );
      });
      describe('when token has a withelist', function () {
        describe('when the operator is approved', function () {
          beforeEach(async function () {
            // await token.authorizeOperator(operator, { from: tokenHolder});
            await token.approve(operator, approvedAmount, {
              from: tokenHolder
            });
          });
          describe('when the amount is a multiple of the granularity', function () {
            describe('when the recipient is not the zero address', function () {
              describe('when the sender has enough balance', function () {
                const amount = 500;

                it('transfers the requested amount', async function () {
                  await token.transferFrom(tokenHolder, recipient, amount, {
                    from: operator
                  });
                  await assertBalance(
                    token,
                    tokenHolder,
                    issuanceAmount - amount
                  );
                  await assertBalance(token, recipient, amount);

                  assert.equal(
                    await token.allowance(tokenHolder, operator),
                    approvedAmount - amount
                  );
                });

                it('emits a sent + a transfer event', async function () {
                  const { logs } = await token.transferFrom(
                    tokenHolder,
                    recipient,
                    amount,
                    { from: operator }
                  );

                  assert.equal(logs.length, 2);

                  assert.equal(logs[0].event, 'Transfer');
                  assert.equal(logs[0].args.from, tokenHolder);
                  assert.equal(logs[0].args.to, recipient);
                  assert.equal(logs[0].args.value, amount);

                  assert.equal(logs[1].event, 'TransferByPartition');
                  assert.equal(logs[1].args.fromPartition, partition1);
                  assert.equal(logs[1].args.operator, operator);
                  assert.equal(logs[1].args.from, tokenHolder);
                  assert.equal(logs[1].args.to, recipient);
                  assert.equal(logs[1].args.value, amount);
                  assert.equal(logs[1].args.data, null);
                  assert.equal(logs[1].args.operatorData, null);
                });
              });
              describe('when the sender does not have enough balance', function () {
                const amount = approvedAmount + 1;

                it('reverts', async function () {
                  await expectRevert.unspecified(
                    token.transferFrom(tokenHolder, recipient, amount, {
                      from: operator
                    })
                  );
                });
              });
            });

            describe('when the recipient is the zero address', function () {
              const amount = issuanceAmount;

              it('reverts', async function () {
                await expectRevert.unspecified(
                  token.transferFrom(tokenHolder, ZERO_ADDRESS, amount, {
                    from: operator
                  })
                );
              });
            });
          });
          describe('when the amount is not a multiple of the granularity', function () {
            it('reverts', async function () {
              token = await ERC1400.new(
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
                ZERO_BYTES32,
                { from: owner }
              );
              await expectRevert.unspecified(
                token.transferFrom(tokenHolder, recipient, 3, {
                  from: operator
                })
              );
            });
          });
        });
        describe('when the operator is not approved', function () {
          const amount = 100;
          describe('when the operator is not approved but authorized', function () {
            it('transfers the requested amount', async function () {
              await token.authorizeOperator(operator, {
                from: tokenHolder
              });
              assert.equal(await token.allowance(tokenHolder, operator), 0);

              await token.transferFrom(tokenHolder, recipient, amount, {
                from: operator
              });

              await assertBalance(token, tokenHolder, issuanceAmount - amount);
              await assertBalance(token, recipient, amount);
            });
          });
          describe('when the operator is not approved and not authorized', function () {
            it('reverts', async function () {
              await expectRevert.unspecified(
                token.transferFrom(tokenHolder, recipient, amount, {
                  from: operator
                })
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
        token = await ERC1400.new(
          'ERC1400Token',
          'DAU',
          1,
          [controller],
          partitions
        );
      });
      describe('when sender approves an operator', function () {
        it('approves the operator', async function () {
          assert.equal(await token.allowance(tokenHolder, operator), 0);

          await token.approve(operator, amount, { from: tokenHolder });

          assert.equal(await token.allowance(tokenHolder, operator), amount);
        });
        it('emits an approval event', async function () {
          const { logs } = await token.approve(operator, amount, {
            from: tokenHolder
          });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'Approval');
          assert.equal(logs[0].args.owner, tokenHolder);
          assert.equal(logs[0].args.spender, operator);
          assert.equal(logs[0].args.value, amount);
        });
      });
      describe('when the operator to approve is the zero address', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token.approve(ZERO_ADDRESS, amount, { from: tokenHolder })
          );
        });
      });
    });

    // SET/GET DOCUMENT

    describe('set/getDocument', function () {
      const documentURI =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit,sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'; // SHA-256 of documentURI
      const documentHash =
        '0x1c81c608a616183cc4a38c09ecc944eb77eaff465dd87aae0290177f2b70b6f8'; // SHA-256 of documentURI + '0x'
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
            await token.setDocument(documentName, documentURI, documentHash, {
              from: controller
            });
            const doc = await token.getDocument(documentName);
            assert.equal(documentURI, doc[0]);
            assert.equal(documentHash, doc[1]);
          });
          it('emits a document event', async function () {
            const { logs } = await token.setDocument(
              documentName,
              documentURI,
              documentHash,
              { from: controller }
            );

            assert.equal(logs.length, 1);
            assert.equal(logs[0].event, 'DocumentUpdated');

            assert.equal(logs[0].args.name, documentName);
            assert.equal(logs[0].args.uri, documentURI);
            assert.equal(logs[0].args.documentHash, documentHash);
          });
        });
        describe('when sender is not a controller', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(
              token.setDocument(documentName, documentURI, documentHash, {
                from: unknown
              })
            );
          });
        });
      });
      describe('getDocument', function () {
        describe('when docuemnt exists', function () {
          it('returns the document', async function () {
            await token.setDocument(documentName, documentURI, documentHash, {
              from: controller
            });
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
        token = await ERC1400.new(
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
            ZERO_BYTES32,
            { from: owner }
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
          token = await ERC1400.new(
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
                  await token.setDefaultPartitions(reversedPartitions, {
                    from: owner
                  });
                  await assertBalances(token, tokenHolder, partitions, [
                    issuanceAmount,
                    issuanceAmount,
                    issuanceAmount
                  ]);

                  await token.transferWithData(
                    recipient,
                    2.5 * issuanceAmount,
                    ZERO_BYTES32,
                    { from: tokenHolder }
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
                  await token.setDefaultPartitions(reversedPartitions, {
                    from: owner
                  });
                  const { logs } = await token.transferWithData(
                    recipient,
                    2.5 * issuanceAmount,
                    ZERO_BYTES32,
                    { from: tokenHolder }
                  );

                  assert.equal(logs.length, 2 * partitions.length);

                  assertTransferEvent(
                    [logs[0], logs[1]],
                    partition3,
                    tokenHolder,
                    tokenHolder,
                    recipient,
                    issuanceAmount,
                    ZERO_BYTES32,
                    null
                  );
                  assertTransferEvent(
                    [logs[2], logs[3]],
                    partition1,
                    tokenHolder,
                    tokenHolder,
                    recipient,
                    issuanceAmount,
                    ZERO_BYTES32,
                    null
                  );
                  assertTransferEvent(
                    [logs[4], logs[5]],
                    partition2,
                    tokenHolder,
                    tokenHolder,
                    recipient,
                    0.5 * issuanceAmount,
                    ZERO_BYTES32,
                    null
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

                  await token.transferWithData(
                    recipient,
                    2.5 * issuanceAmount,
                    ZERO_BYTES32,
                    { from: tokenHolder }
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
                await token.setDefaultPartitions(reversedPartitions, {
                  from: owner
                });
                await expectRevert.unspecified(
                  token.transferWithData(
                    recipient,
                    3.5 * issuanceAmount,
                    ZERO_BYTES32,
                    { from: tokenHolder }
                  )
                );
              });
            });
          });
          describe('when the recipient is the zero address', function () {
            it('reverts', async function () {
              await token.setDefaultPartitions(reversedPartitions, {
                from: owner
              });
              await assertBalances(token, tokenHolder, partitions, [
                issuanceAmount,
                issuanceAmount,
                issuanceAmount
              ]);

              await expectRevert.unspecified(
                token.transferWithData(
                  ZERO_ADDRESS,
                  2.5 * issuanceAmount,
                  ZERO_BYTES32,
                  { from: tokenHolder }
                )
              );
            });
          });
        });
        describe('when the amount is not a multiple of the granularity', function () {
          it('reverts', async function () {
            token = await ERC1400.new(
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
            await token.setDefaultPartitions(reversedPartitions, {
              from: owner
            });
            await assertBalances(token, tokenHolder, partitions, [
              issuanceAmount,
              issuanceAmount,
              issuanceAmount
            ]);

            await expectRevert.unspecified(
              token.transferWithData(recipient, 3, ZERO_BYTES32, {
                from: tokenHolder
              })
            );
          });
        });
      });
      describe('when defaultPartitions have not been defined', function () {
        it('reverts', async function () {
          const token = await ERC1400.new(
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
            token.transferWithData(
              recipient,
              2.5 * issuanceAmount,
              ZERO_BYTES32,
              { from: tokenHolder }
            )
          );
        });
      });
    });

    // TRANSFERFROMWITHDATA

    describe('transferFromWithData', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
          await token.authorizeOperator(operator, { from: tokenHolder });
        });
        describe('when the amount is a multiple of the granularity', function () {
          describe('when the recipient is not the zero address', function () {
            describe('when defaultPartitions have been defined', function () {
              describe('when the sender has enough balance for those default partitions', function () {
                it('transfers the requested amount', async function () {
                  await token.setDefaultPartitions(reversedPartitions, {
                    from: owner
                  });
                  await assertBalances(token, tokenHolder, partitions, [
                    issuanceAmount,
                    issuanceAmount,
                    issuanceAmount
                  ]);

                  await token.transferFromWithData(
                    tokenHolder,
                    recipient,
                    2.5 * issuanceAmount,
                    ZERO_BYTES32,
                    { from: operator }
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
                  await token.setDefaultPartitions(reversedPartitions, {
                    from: owner
                  });
                  const { logs } = await token.transferFromWithData(
                    tokenHolder,
                    recipient,
                    2.5 * issuanceAmount,
                    ZERO_BYTES32,
                    { from: operator }
                  );

                  assert.equal(logs.length, 2 * partitions.length);

                  assertTransferEvent(
                    [logs[0], logs[1]],
                    partition3,
                    operator,
                    tokenHolder,
                    recipient,
                    issuanceAmount,
                    ZERO_BYTES32,
                    null
                  );
                  assertTransferEvent(
                    [logs[2], logs[3]],
                    partition1,
                    operator,
                    tokenHolder,
                    recipient,
                    issuanceAmount,
                    ZERO_BYTES32,
                    null
                  );
                  assertTransferEvent(
                    [logs[4], logs[5]],
                    partition2,
                    operator,
                    tokenHolder,
                    recipient,
                    0.5 * issuanceAmount,
                    ZERO_BYTES32,
                    null
                  );
                });
              });
              describe('when the sender does not have enough balance for those default partitions', function () {
                it('reverts', async function () {
                  await token.setDefaultPartitions(reversedPartitions, {
                    from: owner
                  });
                  await expectRevert.unspecified(
                    token.transferFromWithData(
                      tokenHolder,
                      recipient,
                      3.5 * issuanceAmount,
                      ZERO_BYTES32,
                      { from: operator }
                    )
                  );
                });
                it('reverts (mock contract - for 100% test coverage)', async function () {
                  token = await FakeERC1400.new(
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
                    ZERO_BYTES32,
                    { from: owner }
                  );

                  await expectRevert.unspecified(
                    token.transferFromWithData(
                      tokenHolder,
                      recipient,
                      issuanceAmount + 1,
                      ZERO_BYTES32,
                      { from: controller }
                    )
                  );
                });
              });
            });
            describe('when defaultPartitions have not been defined', function () {
              it('reverts', async function () {
                await token.setDefaultPartitions([], { from: owner });
                await expectRevert.unspecified(
                  token.transferFromWithData(
                    tokenHolder,
                    recipient,
                    2.5 * issuanceAmount,
                    ZERO_BYTES32,
                    { from: operator }
                  )
                );
              });
            });
          });
          describe('when the recipient is the zero address', function () {
            it('reverts', async function () {
              await token.setDefaultPartitions(reversedPartitions, {
                from: owner
              });
              await assertBalances(token, tokenHolder, partitions, [
                issuanceAmount,
                issuanceAmount,
                issuanceAmount
              ]);

              await expectRevert.unspecified(
                token.transferFromWithData(
                  tokenHolder,
                  ZERO_ADDRESS,
                  2.5 * issuanceAmount,
                  ZERO_BYTES32,
                  { from: operator }
                )
              );
            });
          });
        });
        describe('when the amount is not a multiple of the granularity', function () {
          it('reverts', async function () {
            token = await ERC1400.new(
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
            await token.setDefaultPartitions(reversedPartitions, {
              from: owner
            });
            await assertBalances(token, tokenHolder, partitions, [
              issuanceAmount,
              issuanceAmount,
              issuanceAmount
            ]);

            await expectRevert.unspecified(
              token.transferFromWithData(
                tokenHolder,
                recipient,
                3,
                ZERO_BYTES32,
                { from: operator }
              )
            );
          });
        });
      });
      describe('when the operator is not approved', function () {
        it('reverts', async function () {
          await token.setDefaultPartitions(reversedPartitions, {
            from: owner
          });
          await expectRevert.unspecified(
            token.transferFromWithData(
              tokenHolder,
              recipient,
              2.5 * issuanceAmount,
              ZERO_BYTES32,
              { from: operator }
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
        token = await ERC1400.new(
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
          ZERO_BYTES32,
          { from: owner }
        );
      });

      describe('when the sender has enough balance for this partition', function () {
        describe('when the transfer amount is not equal to 0', function () {
          it('transfers the requested amount', async function () {
            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOf(token, recipient, partition1, 0);

            await token.transferByPartition(
              partition1,
              recipient,
              transferAmount,
              ZERO_BYTES32,
              { from: tokenHolder }
            );
            await token.transferByPartition(
              partition1,
              recipient,
              0,
              ZERO_BYTES32,
              { from: tokenHolder }
            );

            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOf(token, recipient, partition1, transferAmount);
          });
          it('emits a TransferByPartition event', async function () {
            const { logs } = await token.transferByPartition(
              partition1,
              recipient,
              transferAmount,
              ZERO_BYTES32,
              { from: tokenHolder }
            );

            assert.equal(logs.length, 2);

            assertTransferEvent(
              logs,
              partition1,
              tokenHolder,
              tokenHolder,
              recipient,
              transferAmount,
              ZERO_BYTES32,
              null
            );
          });
        });
        describe('when the transfer amount is equal to 0', function () {
          it('reverts', async function () {
            await expectRevert.unspecified(
              token.transferByPartition(
                partition2,
                recipient,
                0,
                ZERO_BYTES32,
                { from: tokenHolder }
              )
            );
          });
        });
      });
      describe('when the sender does not have enough balance for this partition', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token.transferByPartition(
              partition2,
              recipient,
              transferAmount,
              ZERO_BYTES32,
              { from: tokenHolder }
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
        token = await ERC1400.new(
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
          ZERO_BYTES32,
          { from: owner }
        );
      });

      describe('when the sender is approved for this partition', function () {
        describe('when approved amount is sufficient', function () {
          it('transfers the requested amount', async function () {
            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOf(token, recipient, partition1, 0);
            assert.equal(
              await token.allowanceByPartition(
                partition1,
                tokenHolder,
                operator
              ),
              0
            );

            const approvedAmount = 400;
            await token.approveByPartition(
              partition1,
              operator,
              approvedAmount,
              { from: tokenHolder }
            );
            assert.equal(
              await token.allowanceByPartition(
                partition1,
                tokenHolder,
                operator
              ),
              approvedAmount
            );
            await token.operatorTransferByPartition(
              partition1,
              tokenHolder,
              recipient,
              transferAmount,
              ZERO_BYTE,
              ZERO_BYTES32,
              { from: operator }
            );

            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOf(token, recipient, partition1, transferAmount);
            assert.equal(
              await token.allowanceByPartition(
                partition1,
                tokenHolder,
                operator
              ),
              approvedAmount - transferAmount
            );
          });
        });
        describe('when approved amount is not sufficient', function () {
          it('reverts', async function () {
            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOf(token, recipient, partition1, 0);
            assert.equal(
              await token.allowanceByPartition(
                partition1,
                tokenHolder,
                operator
              ),
              0
            );

            const approvedAmount = 200;
            await token.approveByPartition(
              partition1,
              operator,
              approvedAmount,
              { from: tokenHolder }
            );
            assert.equal(
              await token.allowanceByPartition(
                partition1,
                tokenHolder,
                operator
              ),
              approvedAmount
            );
            await expectRevert.unspecified(
              token.operatorTransferByPartition(
                partition1,
                tokenHolder,
                recipient,
                transferAmount,
                ZERO_BYTE,
                ZERO_BYTES32,
                { from: operator }
              )
            );
          });
        });
      });
      describe('when the sender is an operator for this partition', function () {
        describe('when the sender has enough balance for this partition', function () {
          describe('when partition does not change', function () {
            it('transfers the requested amount', async function () {
              await assertBalanceOf(
                token,
                tokenHolder,
                partition1,
                issuanceAmount
              );
              await assertBalanceOf(token, recipient, partition1, 0);

              await token.authorizeOperatorByPartition(partition1, operator, {
                from: tokenHolder
              });
              await token.operatorTransferByPartition(
                partition1,
                tokenHolder,
                recipient,
                transferAmount,
                ZERO_BYTE,
                ZERO_BYTES32,
                { from: operator }
              );

              await assertBalanceOf(
                token,
                tokenHolder,
                partition1,
                issuanceAmount - transferAmount
              );
              await assertBalanceOf(
                token,
                recipient,
                partition1,
                transferAmount
              );
            });
            it('transfers the requested amount with attached data (without changePartition flag)', async function () {
              await assertBalanceOf(
                token,
                tokenHolder,
                partition1,
                issuanceAmount
              );
              await assertBalanceOf(token, recipient, partition1, 0);

              await token.authorizeOperatorByPartition(partition1, operator, {
                from: tokenHolder
              });
              await token.operatorTransferByPartition(
                partition1,
                tokenHolder,
                recipient,
                transferAmount,
                doNotChangePartition,
                ZERO_BYTES32,
                { from: operator }
              );

              await assertBalanceOf(
                token,
                tokenHolder,
                partition1,
                issuanceAmount - transferAmount
              );
              await assertBalanceOf(
                token,
                recipient,
                partition1,
                transferAmount
              );
            });
            it('emits a TransferByPartition event', async function () {
              await token.authorizeOperatorByPartition(partition1, operator, {
                from: tokenHolder
              });
              const { logs } = await token.operatorTransferByPartition(
                partition1,
                tokenHolder,
                recipient,
                transferAmount,
                ZERO_BYTE,
                ZERO_BYTES32,
                { from: operator }
              );

              assert.equal(logs.length, 2);

              assertTransferEvent(
                logs,
                partition1,
                operator,
                tokenHolder,
                recipient,
                transferAmount,
                null,
                ZERO_BYTES32
              );
            });
          });
          describe('when partition changes', function () {
            it('transfers the requested amount', async function () {
              await assertBalanceOf(
                token,
                tokenHolder,
                partition1,
                issuanceAmount
              );
              await assertBalanceOf(token, recipient, partition2, 0);

              await token.authorizeOperatorByPartition(partition1, operator, {
                from: tokenHolder
              });
              await token.operatorTransferByPartition(
                partition1,
                tokenHolder,
                recipient,
                transferAmount,
                changeToPartition2,
                ZERO_BYTES32,
                { from: operator }
              );

              await assertBalanceOf(
                token,
                tokenHolder,
                partition1,
                issuanceAmount - transferAmount
              );
              await assertBalanceOf(
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

              await token.authorizeOperatorByPartition(partition1, operator, {
                from: tokenHolder
              });
              await token.operatorTransferByPartition(
                partition1,
                tokenHolder,
                tokenHolder,
                transferAmount,
                changeToPartition2,
                ZERO_BYTES32,
                { from: operator }
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
              await token.authorizeOperatorByPartition(partition1, operator, {
                from: tokenHolder
              });
              const { logs } = await token.operatorTransferByPartition(
                partition1,
                tokenHolder,
                recipient,
                transferAmount,
                changeToPartition2,
                ZERO_BYTES32,
                { from: operator }
              );

              assert.equal(logs.length, 3);

              assertTransferEvent(
                [logs[0], logs[1]],
                partition1,
                operator,
                tokenHolder,
                recipient,
                transferAmount,
                changeToPartition2,
                ZERO_BYTES32
              );

              assert.equal(logs[2].event, 'ChangedPartition');
              assert.equal(logs[2].args.fromPartition, partition1);
              assert.equal(logs[2].args.toPartition, partition2);
              assert.equal(logs[2].args.value, transferAmount);
            });
          });
        });
        describe('when the sender does not have enough balance for this partition', function () {
          it('reverts', async function () {
            await token.authorizeOperatorByPartition(partition1, operator, {
              from: tokenHolder
            });
            await expectRevert.unspecified(
              token.operatorTransferByPartition(
                partition1,
                tokenHolder,
                recipient,
                issuanceAmount + 1,
                ZERO_BYTE,
                ZERO_BYTES32,
                { from: operator }
              )
            );
          });
        });
      });
      describe('when the sender is a global operator', function () {
        it('redeems the requested amount', async function () {
          await assertBalanceOf(token, tokenHolder, partition1, issuanceAmount);
          await assertBalanceOf(token, recipient, partition1, 0);

          await token.authorizeOperator(operator, { from: tokenHolder });
          await token.operatorTransferByPartition(
            partition1,
            tokenHolder,
            recipient,
            transferAmount,
            ZERO_BYTE,
            ZERO_BYTES32,
            { from: operator }
          );

          await assertBalanceOf(
            token,
            tokenHolder,
            partition1,
            issuanceAmount - transferAmount
          );
          await assertBalanceOf(token, recipient, partition1, transferAmount);
        });
      });
      describe('when the sender is neither an operator, nor approved', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token.operatorTransferByPartition(
              partition1,
              tokenHolder,
              recipient,
              transferAmount,
              ZERO_BYTE,
              ZERO_BYTES32,
              { from: operator }
            )
          );
        });
      });
    });

    // AUTHORIZEOPERATOR

    describe('authorizeOperator', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
          await token.authorizeOperator(operator, { from: tokenHolder });
          assert.isTrue(await token.isOperator(operator, tokenHolder));
        });
        it('emits a authorized event', async function () {
          const { logs } = await token.authorizeOperator(operator, {
            from: tokenHolder
          });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'AuthorizedOperator');
          assert.equal(logs[0].args.operator, operator);
          assert.equal(logs[0].args.tokenHolder, tokenHolder);
        });
      });
      describe('when sender authorizes himself', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token.authorizeOperator(tokenHolder, { from: tokenHolder })
          );
        });
      });
    });

    // REVOKEOPERATOR

    describe('revokeOperator', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
          await token.authorizeOperator(operator, { from: tokenHolder });
          assert.isTrue(await token.isOperator(operator, tokenHolder));

          await token.revokeOperator(operator, { from: tokenHolder });

          assert.isTrue(!(await token.isOperator(operator, tokenHolder)));
        });
        it('emits a revoked event', async function () {
          const { logs } = await token.revokeOperator(controller, {
            from: tokenHolder
          });

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'RevokedOperator');
          assert.equal(logs[0].args.operator, controller);
          assert.equal(logs[0].args.tokenHolder, tokenHolder);
        });
      });
      describe('when sender revokes himself', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token.revokeOperator(tokenHolder, { from: tokenHolder })
          );
        });
      });
    });

    // AUTHORIZE OPERATOR BY PARTITION

    describe('authorizeOperatorByPartition', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
        await token.authorizeOperatorByPartition(partition1, operator, {
          from: tokenHolder
        });
        assert.isTrue(
          await token.isOperatorForPartition(partition1, operator, tokenHolder)
        );
      });
      it('emits an authorized event', async function () {
        const { logs } = await token.authorizeOperatorByPartition(
          partition1,
          operator,
          { from: tokenHolder }
        );

        assert.equal(logs.length, 1);
        assert.equal(logs[0].event, 'AuthorizedOperatorByPartition');
        assert.equal(logs[0].args.partition, partition1);
        assert.equal(logs[0].args.operator, operator);
        assert.equal(logs[0].args.tokenHolder, tokenHolder);
      });
    });

    // REVOKEOPERATORBYPARTITION

    describe('revokeOperatorByPartition', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
          'ERC1400Token',
          'DAU',
          1,
          [controller],
          partitions
        );
      });
      describe('when operator is not controller', function () {
        it('revokes the operator', async function () {
          await token.authorizeOperatorByPartition(partition1, operator, {
            from: tokenHolder
          });
          assert.isTrue(
            await token.isOperatorForPartition(
              partition1,
              operator,
              tokenHolder
            )
          );
          await token.revokeOperatorByPartition(partition1, operator, {
            from: tokenHolder
          });
          assert.isTrue(
            !(await token.isOperatorForPartition(
              partition1,
              operator,
              tokenHolder
            ))
          );
        });
        it('emits a revoked event', async function () {
          await token.authorizeOperatorByPartition(partition1, operator, {
            from: tokenHolder
          });
          const { logs } = await token.revokeOperatorByPartition(
            partition1,
            operator,
            { from: tokenHolder }
          );

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'RevokedOperatorByPartition');
          assert.equal(logs[0].args.partition, partition1);
          assert.equal(logs[0].args.operator, operator);
          assert.equal(logs[0].args.tokenHolder, tokenHolder);
        });
      });
    });

    // ISOPERATOR

    describe('isOperator', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
        await token.authorizeOperator(operator, { from: tokenHolder });
        assert.isTrue(await token.isOperator(operator, tokenHolder));
      });
      it('when is a revoked operator', async function () {
        await token.authorizeOperator(operator, { from: tokenHolder });
        await token.revokeOperator(operator, { from: tokenHolder });
        assert.isTrue(!(await token.isOperator(operator, tokenHolder)));
      });
      it('when is a controller and token is controllable', async function () {
        assert.isTrue(await token.isOperator(controller, tokenHolder));
      });
      it('when is a controller and token is not controllable', async function () {
        await token.renounceControl({ from: owner });
        assert.isTrue(!(await token.isOperator(controller, tokenHolder)));
      });
    });

    // ISOPERATORFORPARTITION

    describe('isOperatorForPartition', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
        await token.authorizeOperatorByPartition(partition1, operator, {
          from: tokenHolder
        });
        assert.isTrue(
          await token.isOperatorForPartition(partition1, operator, tokenHolder)
        );
      });
      it('when is a revoked operator', async function () {
        await token.authorizeOperatorByPartition(partition1, operator, {
          from: tokenHolder
        });
        await token.revokeOperatorByPartition(partition1, operator, {
          from: tokenHolder
        });
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
        await token.renounceControl({ from: owner });
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
        token = await ERC1400.new(
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
                  await token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32, {
                    from: owner
                  });

                  await assertTotalSupply(token, issuanceAmount);
                  await assertBalanceOf(
                    token,
                    tokenHolder,
                    partition1,
                    issuanceAmount
                  );
                });
                it('issues twice the requested amount', async function () {
                  await token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32, {
                    from: owner
                  });
                  await token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32, {
                    from: owner
                  });

                  await assertTotalSupply(token, 2 * issuanceAmount);
                  await assertBalanceOf(
                    token,
                    tokenHolder,
                    partition1,
                    2 * issuanceAmount
                  );
                });
                it('emits a issuedByPartition event', async function () {
                  const { logs } = await token.issue(
                    tokenHolder,
                    issuanceAmount,
                    ZERO_BYTES32,
                    { from: owner }
                  );

                  assert.equal(logs.length, 3);

                  // assert.equal(logs[0].event, 'Checked');
                  // assert.equal(logs[0].args.sender, owner);

                  assert.equal(logs[0].event, 'Issued');
                  assert.equal(logs[0].args.operator, owner);
                  assert.equal(logs[0].args.to, tokenHolder);
                  assert.equal(logs[0].args.value, issuanceAmount);
                  assert.equal(logs[0].args.data, ZERO_BYTES32);
                  assert.equal(logs[0].args.operatorData, null);

                  assert.equal(logs[1].event, 'Transfer');
                  assert.equal(logs[1].args.from, ZERO_ADDRESS);
                  assert.equal(logs[1].args.to, tokenHolder);
                  assert.equal(logs[1].args.value, issuanceAmount);

                  assert.equal(logs[2].event, 'IssuedByPartition');
                  assert.equal(logs[2].args.partition, partition1);
                  assert.equal(logs[2].args.operator, owner);
                  assert.equal(logs[2].args.to, tokenHolder);
                  assert.equal(logs[2].args.value, issuanceAmount);
                  assert.equal(logs[2].args.data, ZERO_BYTES32);
                  assert.equal(logs[2].args.operatorData, null);
                });
              });
              describe('when the recipient is not the zero address', function () {
                it('issues the requested amount', async function () {
                  await expectRevert.unspecified(
                    token.issue(ZERO_ADDRESS, issuanceAmount, ZERO_BYTES32, {
                      from: owner
                    })
                  );
                });
              });
            });
            describe('when the amount is not a multiple of the granularity', function () {
              it('issues the requested amount', async function () {
                token = await ERC1400.new(
                  'ERC1400Token',
                  'DAU',
                  2,
                  [controller],
                  partitions
                );
                await expectRevert.unspecified(
                  token.issue(tokenHolder, 1, ZERO_BYTES32, {
                    from: owner
                  })
                );
              });
            });
          });
          describe('when default partitions have not been defined', function () {
            it('reverts', async function () {
              token = await ERC1400.new(
                'ERC1400Token',
                'DAU',
                1,
                [controller],
                []
              );
              await expectRevert.unspecified(
                token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32, {
                  from: owner
                })
              );
            });
          });
        });
        describe('when token is not issuable', function () {
          it('reverts', async function () {
            assert.isTrue(await token.isIssuable());
            await token.renounceIssuance({ from: owner });
            assert.isTrue(!(await token.isIssuable()));
            await expectRevert.unspecified(
              token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32, {
                from: owner
              })
            );
          });
        });
      });
      describe('when sender is not the issuer', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32, {
              from: unknown
            })
          );
        });
      });
    });

    // ISSUEBYPARTITION

    describe('issueByPartition', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
              ZERO_BYTES32,
              { from: owner }
            );

            await assertTotalSupply(token, issuanceAmount);
            await assertBalanceOf(
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
              ZERO_BYTES32,
              { from: owner }
            );
            await token.issueByPartition(
              partition1,
              tokenHolder,
              issuanceAmount,
              ZERO_BYTES32,
              { from: owner }
            );

            await assertTotalSupply(token, 2 * issuanceAmount);
            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              2 * issuanceAmount
            );
          });
          it('emits a issuedByPartition event', async function () {
            const { logs } = await token.issueByPartition(
              partition1,
              tokenHolder,
              issuanceAmount,
              ZERO_BYTES32,
              { from: owner }
            );

            assert.equal(logs.length, 3);

            //   assert.equal(logs[0].event, 'Checked');
            //   assert.equal(logs[0].args.sender, owner);

            assert.equal(logs[0].event, 'Issued');
            assert.equal(logs[0].args.operator, owner);
            assert.equal(logs[0].args.to, tokenHolder);
            assert.equal(logs[0].args.value, issuanceAmount);
            assert.equal(logs[0].args.data, ZERO_BYTES32);
            assert.equal(logs[0].args.operatorData, null);

            assert.equal(logs[1].event, 'Transfer');
            assert.equal(logs[1].args.from, ZERO_ADDRESS);
            assert.equal(logs[1].args.to, tokenHolder);
            assert.equal(logs[1].args.value, issuanceAmount);

            assert.equal(logs[2].event, 'IssuedByPartition');
            assert.equal(logs[2].args.partition, partition1);
            assert.equal(logs[2].args.operator, owner);
            assert.equal(logs[2].args.to, tokenHolder);
            assert.equal(logs[2].args.value, issuanceAmount);
            assert.equal(logs[2].args.data, ZERO_BYTES32);
            assert.equal(logs[2].args.operatorData, null);
          });
        });
        describe('when token is not issuable', function () {
          it('reverts', async function () {
            assert.isTrue(await token.isIssuable());
            await token.renounceIssuance({ from: owner });
            assert.isTrue(!(await token.isIssuable()));
            await expectRevert.unspecified(
              token.issueByPartition(
                partition1,
                tokenHolder,
                issuanceAmount,
                ZERO_BYTES32,
                { from: owner }
              )
            );
          });
        });
      });
      describe('when sender is not the issuer', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token.issueByPartition(
              partition1,
              tokenHolder,
              issuanceAmount,
              ZERO_BYTES32,
              { from: unknown }
            )
          );
        });
      });
    });

    // REDEEM

    describe('redeem', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
              await token.setDefaultPartitions(reversedPartitions, {
                from: owner
              });
              await assertBalances(token, tokenHolder, partitions, [
                issuanceAmount,
                issuanceAmount,
                issuanceAmount
              ]);

              await token.redeem(2.5 * issuanceAmount, ZERO_BYTES32, {
                from: tokenHolder
              });

              await assertBalances(token, tokenHolder, partitions, [
                0,
                0.5 * issuanceAmount,
                0
              ]);
            });
            it('emits a redeemedByPartition events', async function () {
              await token.setDefaultPartitions(reversedPartitions, {
                from: owner
              });
              const { logs } = await token.redeem(
                2.5 * issuanceAmount,
                ZERO_BYTES32,
                { from: tokenHolder }
              );

              assert.equal(logs.length, 3 * partitions.length);

              assertBurnEvent(
                [logs[0], logs[1], logs[2]],
                partition3,
                tokenHolder,
                tokenHolder,
                issuanceAmount,
                ZERO_BYTES32,
                null
              );
              assertBurnEvent(
                [logs[3], logs[4], logs[5]],
                partition1,
                tokenHolder,
                tokenHolder,
                issuanceAmount,
                ZERO_BYTES32,
                null
              );
              assertBurnEvent(
                [logs[6], logs[7], logs[8]],
                partition2,
                tokenHolder,
                tokenHolder,
                0.5 * issuanceAmount,
                ZERO_BYTES32,
                null
              );
            });
          });
          describe('when the sender does not have enough balance for those default partitions', function () {
            it('reverts', async function () {
              await token.setDefaultPartitions(reversedPartitions, {
                from: owner
              });
              await expectRevert.unspecified(
                token.redeem(3.5 * issuanceAmount, ZERO_BYTES32, {
                  from: tokenHolder
                })
              );
            });
          });
        });
        describe('when the amount is not a multiple of the granularity', function () {
          it('reverts', async function () {
            token = await ERC1400.new(
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
            await token.setDefaultPartitions(reversedPartitions, {
              from: owner
            });
            await assertBalances(token, tokenHolder, partitions, [
              issuanceAmount,
              issuanceAmount,
              issuanceAmount
            ]);

            await expectRevert.unspecified(
              token.redeem(3, ZERO_BYTES32, { from: tokenHolder })
            );
          });
        });
      });
      describe('when defaultPartitions have not been defined', function () {
        it('reverts', async function () {
          await token.setDefaultPartitions([], { from: owner });
          await expectRevert.unspecified(
            token.redeem(2.5 * issuanceAmount, ZERO_BYTES32, {
              from: tokenHolder
            })
          );
        });
      });
    });

    // REDEEMFROM

    describe('redeemFrom', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
          await token.authorizeOperator(operator, { from: tokenHolder });
        });
        describe('when defaultPartitions have been defined', function () {
          describe('when the sender has enough balance for those default partitions', function () {
            describe('when the amount is a multiple of the granularity', function () {
              describe('when the redeemer is not the zero address', function () {
                it('redeems the requested amount', async function () {
                  await token.setDefaultPartitions(reversedPartitions, {
                    from: owner
                  });
                  await assertBalances(token, tokenHolder, partitions, [
                    issuanceAmount,
                    issuanceAmount,
                    issuanceAmount
                  ]);

                  await token.redeemFrom(
                    tokenHolder,
                    2.5 * issuanceAmount,
                    ZERO_BYTES32,
                    { from: operator }
                  );

                  await assertBalances(token, tokenHolder, partitions, [
                    0,
                    0.5 * issuanceAmount,
                    0
                  ]);
                });
                it('emits redeemedByPartition events', async function () {
                  await token.setDefaultPartitions(reversedPartitions, {
                    from: owner
                  });
                  const { logs } = await token.redeemFrom(
                    tokenHolder,
                    2.5 * issuanceAmount,
                    ZERO_BYTES32,
                    { from: operator }
                  );

                  assert.equal(logs.length, 3 * partitions.length);

                  assertBurnEvent(
                    [logs[0], logs[1], logs[2]],
                    partition3,
                    operator,
                    tokenHolder,
                    issuanceAmount,
                    ZERO_BYTES32,
                    null
                  );
                  assertBurnEvent(
                    [logs[3], logs[4], logs[5]],
                    partition1,
                    operator,
                    tokenHolder,
                    issuanceAmount,
                    ZERO_BYTES32,
                    null
                  );
                  assertBurnEvent(
                    [logs[6], logs[7], logs[8]],
                    partition2,
                    operator,
                    tokenHolder,
                    0.5 * issuanceAmount,
                    ZERO_BYTES32,
                    null
                  );
                });
              });
              describe('when the redeemer is the zero address', function () {
                it('reverts', async function () {
                  await token.setDefaultPartitions(reversedPartitions, {
                    from: owner
                  });
                  await assertBalances(token, tokenHolder, partitions, [
                    issuanceAmount,
                    issuanceAmount,
                    issuanceAmount
                  ]);

                  await expectRevert.unspecified(
                    token.redeemFrom(
                      ZERO_ADDRESS,
                      2.5 * issuanceAmount,
                      ZERO_BYTES32,
                      { from: controller }
                    )
                  );
                });
                it('reverts (mock contract - for 100% test coverage)', async function () {
                  token = await FakeERC1400.new(
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
                  await token.setDefaultPartitions(reversedPartitions, {
                    from: owner
                  });

                  await expectRevert.unspecified(
                    token.redeemFrom(
                      ZERO_ADDRESS,
                      2.5 * issuanceAmount,
                      ZERO_BYTES32,
                      { from: controller }
                    )
                  );
                });
              });
            });
            describe('when the amount is not a multiple of the granularity', function () {
              it('reverts', async function () {
                token = await ERC1400.new(
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
                await token.setDefaultPartitions(reversedPartitions, {
                  from: owner
                });
                await assertBalances(token, tokenHolder, partitions, [
                  issuanceAmount,
                  issuanceAmount,
                  issuanceAmount
                ]);

                await expectRevert.unspecified(
                  token.redeemFrom(tokenHolder, 3, ZERO_BYTES32, {
                    from: operator
                  })
                );
              });
            });
          });
          describe('when the sender does not have enough balance for those default partitions', function () {
            it('reverts', async function () {
              await token.setDefaultPartitions(reversedPartitions, {
                from: owner
              });
              await expectRevert.unspecified(
                token.redeemFrom(
                  tokenHolder,
                  3.5 * issuanceAmount,
                  ZERO_BYTES32,
                  { from: operator }
                )
              );
            });
            it('reverts (mock contract - for 100% test coverage)', async function () {
              token = await FakeERC1400.new(
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

              await token.setDefaultPartitions(reversedPartitions, {
                from: owner
              });

              await expectRevert.unspecified(
                token.redeemFrom(
                  tokenHolder,
                  3.5 * issuanceAmount,
                  ZERO_BYTES32,
                  { from: controller }
                )
              );
            });
          });
        });
        describe('when defaultPartitions have not been defined', function () {
          it('reverts', async function () {
            await token.setDefaultPartitions([], { from: owner });
            await expectRevert.unspecified(
              token.redeemFrom(
                tokenHolder,
                2.5 * issuanceAmount,
                ZERO_BYTES32,
                { from: operator }
              )
            );
          });
        });
      });
      describe('when the operator is not approved', function () {
        it('reverts', async function () {
          await token.setDefaultPartitions(reversedPartitions, {
            from: owner
          });
          await expectRevert.unspecified(
            token.redeemFrom(tokenHolder, 2.5 * issuanceAmount, ZERO_BYTES32, {
              from: operator
            })
          );
        });
      });
    });

    // REDEEMBYPARTITION

    describe('redeemByPartition', function () {
      const redeemAmount = 300;
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
          ZERO_BYTES32,
          { from: owner }
        );
      });

      describe('when the redeemer has enough balance for this partition', function () {
        it('redeems the requested amount', async function () {
          await token.redeemByPartition(
            partition1,
            redeemAmount,
            ZERO_BYTES32,
            { from: tokenHolder }
          );

          await assertTotalSupply(token, issuanceAmount - redeemAmount);
          await assertBalanceOf(
            token,
            tokenHolder,
            partition1,
            issuanceAmount - redeemAmount
          );
        });
        it('emits a redeemedByPartition event', async function () {
          const { logs } = await token.redeemByPartition(
            partition1,
            redeemAmount,
            ZERO_BYTES32,
            { from: tokenHolder }
          );

          assert.equal(logs.length, 3);

          assertBurnEvent(
            logs,
            partition1,
            tokenHolder,
            tokenHolder,
            redeemAmount,
            ZERO_BYTES32,
            null
          );
        });
      });
      describe('when the redeemer does not have enough balance for this partition', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token.redeemByPartition(partition2, redeemAmount, ZERO_BYTES32, {
              from: tokenHolder
            })
          );
        });
      });
      describe('special case (_removeTokenFromPartition shall revert)', function () {
        it('reverts', async function () {
          await token.issueByPartition(
            partition2,
            owner,
            issuanceAmount,
            ZERO_BYTES32,
            { from: owner }
          );
          await expectRevert.unspecified(
            token.redeemByPartition(partition2, 0, ZERO_BYTES32, {
              from: tokenHolder
            })
          );
        });
      });
    });

    // OPERATOREDEEMBYPARTITION

    describe('operatorRedeemByPartition', function () {
      const redeemAmount = 300;
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
          ZERO_BYTES32,
          { from: owner }
        );
      });

      describe('when the sender is an operator for this partition', function () {
        describe('when the redeemer has enough balance for this partition', function () {
          it('redeems the requested amount', async function () {
            await token.authorizeOperatorByPartition(partition1, operator, {
              from: tokenHolder
            });
            await token.operatorRedeemByPartition(
              partition1,
              tokenHolder,
              redeemAmount,
              ZERO_BYTES32,
              { from: operator }
            );

            await assertTotalSupply(token, issuanceAmount - redeemAmount);
            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount - redeemAmount
            );
          });
          it('emits a redeemedByPartition event', async function () {
            await token.authorizeOperatorByPartition(partition1, operator, {
              from: tokenHolder
            });
            const { logs } = await token.operatorRedeemByPartition(
              partition1,
              tokenHolder,
              redeemAmount,
              ZERO_BYTES32,
              { from: operator }
            );

            assert.equal(logs.length, 3);

            assertBurnEvent(
              logs,
              partition1,
              operator,
              tokenHolder,
              redeemAmount,
              null,
              ZERO_BYTES32
            );
          });
        });
        describe('when the redeemer does not have enough balance for this partition', function () {
          it('reverts', async function () {
            it('redeems the requested amount', async function () {
              await token.authorizeOperatorByPartition(partition1, operator, {
                from: tokenHolder
              });

              await expectRevert.unspecified(
                token.operatorRedeemByPartition(
                  partition1,
                  tokenHolder,
                  issuanceAmount + 1,
                  ZERO_BYTES32,
                  { from: operator }
                )
              );
            });
          });
        });
      });
      describe('when the sender is a global operator', function () {
        it('redeems the requested amount', async function () {
          await token.authorizeOperator(operator, { from: tokenHolder });
          await token.operatorRedeemByPartition(
            partition1,
            tokenHolder,
            redeemAmount,
            ZERO_BYTES32,
            { from: operator }
          );

          await assertTotalSupply(token, issuanceAmount - redeemAmount);
          await assertBalanceOf(
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
            token.operatorRedeemByPartition(
              partition1,
              tokenHolder,
              redeemAmount,
              ZERO_BYTES32,
              { from: operator }
            )
          );
        });
      });
    });

    // BASIC FUNCTIONNALITIES

    describe('parameters', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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

          assert.equal(granularity, 1);
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
            ZERO_BYTES32,
            { from: owner }
          );
          totalPartitions = await token.totalPartitions();
          assert.equal(totalPartitions.length, 1);
          assert.equal(totalPartitions[0], partition1);

          await token.issueByPartition(
            partition2,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32,
            { from: owner }
          );
          totalPartitions = await token.totalPartitions();
          assert.equal(totalPartitions.length, 2);
          assert.equal(totalPartitions[0], partition1);
          assert.equal(totalPartitions[1], partition2);

          await token.issueByPartition(
            partition3,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32,
            { from: owner }
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
          assert.equal(totalSupplyPartition1, 0);
          assert.equal(totalSupplyPartition2, 0);

          await token.issueByPartition(
            partition1,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32,
            { from: owner }
          );
          totalSupplyPartition1 = await token.totalSupplyByPartition(
            partition1
          );
          totalSupplyPartition2 = await token.totalSupplyByPartition(
            partition2
          );
          assert.equal(totalSupplyPartition1, issuanceAmount);
          assert.equal(totalSupplyPartition2, 0);

          await token.issueByPartition(
            partition2,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32,
            { from: owner }
          );
          totalSupplyPartition1 = await token.totalSupplyByPartition(
            partition1
          );
          totalSupplyPartition2 = await token.totalSupplyByPartition(
            partition2
          );
          assert.equal(totalSupplyPartition1, issuanceAmount);
          assert.equal(totalSupplyPartition2, issuanceAmount);

          await token.issueByPartition(
            partition1,
            tokenHolder,
            issuanceAmount,
            ZERO_BYTES32,
            { from: owner }
          );
          totalSupplyPartition1 = await token.totalSupplyByPartition(
            partition1
          );
          totalSupplyPartition2 = await token.totalSupplyByPartition(
            partition2
          );
          assert.equal(totalSupplyPartition1, 2 * issuanceAmount);
          assert.equal(totalSupplyPartition2, issuanceAmount);
        });
      });

      describe('total supply', function () {
        it('returns the total amount of tokens', async function () {
          await token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32, {
            from: owner
          });
          const totalSupply = await token.totalSupply();

          assert.equal(totalSupply, issuanceAmount);
        });
      });

      describe('balanceOf', function () {
        describe('when the requested account has no tokens', function () {
          it('returns zero', async function () {
            const balance = await token.balanceOf(unknown);

            assert.equal(balance, 0);
          });
        });

        describe('when the requested account has some tokens', function () {
          it('returns the total amount of tokens', async function () {
            await token.issue(tokenHolder, issuanceAmount, ZERO_BYTES32, {
              from: owner
            });
            const balance = await token.balanceOf(tokenHolder);

            assert.equal(balance, issuanceAmount);
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
        token = await ERC1400.new(
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
          await token.setControllers(
            [controller_alternative1, controller_alternative2],
            { from: owner }
          );
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
          await token.renounceControl({ from: owner });
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
            token.setControllers(
              [controller_alternative1, controller_alternative2],
              { from: unknown }
            )
          );
        });
      });
    });

    // SET PARTITION CONTROLLERS

    describe('setPartitionControllers', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
          await token.setPartitionControllers(
            partition1,
            [controller_alternative1, controller_alternative2],
            { from: owner }
          );
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
          await token.renounceControl({ from: owner });
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
          await token.setPartitionControllers(
            partition1,
            [controller_alternative1, controller_alternative2],
            { from: owner }
          );
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
          await token.setPartitionControllers(
            partition1,
            [controller_alternative2],
            { from: owner }
          );
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
            token.setPartitionControllers(
              partition1,
              [controller_alternative1, controller_alternative2],
              { from: unknown }
            )
          );
        });
      });
    });

    // SET/GET TOKEN DEFAULT PARTITIONS
    describe('defaultPartitions', function () {
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
          await token.setDefaultPartitions(reversedPartitions, {
            from: owner
          });
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
            token.setDefaultPartitions(reversedPartitions, {
              from: unknown
            })
          );
        });
      });
    });

    // APPROVE BY PARTITION

    describe('approveByPartition', function () {
      const amount = 100;
      let token: ERC1400;
      beforeEach(async function () {
        token = await ERC1400.new(
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
            await token.allowanceByPartition(partition1, tokenHolder, operator),
            0
          );

          await token.approveByPartition(partition1, operator, amount, {
            from: tokenHolder
          });

          assert.equal(
            await token.allowanceByPartition(partition1, tokenHolder, operator),
            amount
          );
        });
        it('emits an approval event', async function () {
          const { logs } = await token.approveByPartition(
            partition1,
            operator,
            amount,
            { from: tokenHolder }
          );

          assert.equal(logs.length, 1);
          assert.equal(logs[0].event, 'ApprovalByPartition');
          assert.equal(logs[0].args.partition, partition1);
          assert.equal(logs[0].args.owner, tokenHolder);
          assert.equal(logs[0].args.spender, operator);
          assert.equal(logs[0].args.value, amount);
        });
      });
      describe('when the operator to approve is the zero address', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token.approveByPartition(partition1, ZERO_ADDRESS, amount, {
              from: tokenHolder
            })
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
        token = await ERC1400.new(
          'ERC1400Token',
          'DAU20',
          1,
          [controller],
          partitions
        );
        migratedToken = await ERC1400.new(
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
          ZERO_BYTES32,
          { from: owner }
        );
      });
      describe('when the sender is the contract owner', function () {
        describe('when the contract is not migrated', function () {
          it('can transfer tokens', async function () {
            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOf(token, recipient, partition1, 0);

            await token.transferByPartition(
              partition1,
              recipient,
              transferAmount,
              ZERO_BYTES32,
              { from: tokenHolder }
            );

            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOf(token, recipient, partition1, transferAmount);
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

            await token.migrate(migratedToken.address, true, {
              from: owner
            });

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

            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOf(token, recipient, partition1, 0);

            await expectRevert.unspecified(
              token.transferByPartition(
                partition1,
                recipient,
                transferAmount,
                ZERO_BYTES32,
                { from: tokenHolder }
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

            await token.migrate(migratedToken.address, false, {
              from: owner
            });

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

            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount
            );
            await assertBalanceOf(token, recipient, partition1, 0);

            await token.transferByPartition(
              partition1,
              recipient,
              transferAmount,
              ZERO_BYTES32,
              { from: tokenHolder }
            );

            await assertBalanceOf(
              token,
              tokenHolder,
              partition1,
              issuanceAmount - transferAmount
            );
            await assertBalanceOf(token, recipient, partition1, transferAmount);
          });
        });
      });
      describe('when the sender is not the contract owner', function () {
        it('reverts', async function () {
          await expectRevert.unspecified(
            token.migrate(migratedToken.address, true, {
              from: unknown
            })
          );
        });
      });
    });
  }
);
