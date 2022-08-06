import assert from 'assert';
import {
  BatchBalanceReader,
  BatchBalanceReader__factory,
  ERC1400,
  ERC1400__factory
} from '../typechain-types';
import { ZERO_BYTE } from './utils/assert';
import truffleFixture from './truffle-fixture';
import { getSigners } from './common/wallet';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const VALID_CERTIFICATE =
  '0x1000000000000000000000000000000000000000000000000000000000000000';

const partition1_short =
  '7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
const partition2_short =
  '6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
const partition3_short =
  '6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex
const partition4_short =
  '636f6c6c61746572616c00000000000000000000000000000000000000000000'; // collateral in hex
const partition1 = ZERO_BYTE.concat(partition1_short);
const partition2 = ZERO_BYTE.concat(partition2_short);
const partition3 = ZERO_BYTE.concat(partition3_short);
const partition4 = ZERO_BYTE.concat(partition4_short);

const partitions = [partition1, partition2, partition3, partition4];

const issuanceAmount11 = 11;
const issuanceAmount12 = 12;
const issuanceAmount13 = 13;

const issuanceAmount21 = 21;
const issuanceAmount22 = 22;
const issuanceAmount23 = 23;

const issuanceAmount31 = 31;
const issuanceAmount32 = 32;
const issuanceAmount33 = 33;

const issuanceAmount41 = 41;
const issuanceAmount42 = 42;
const issuanceAmount43 = 43;

describe('BatchBalanceReader', function () {
  const [
    signer,
    controllerSigner,
    tokenHolder1Signer,
    tokenHolder2Signer,
    tokenHolder3Signer,
    unknownSigner
  ] = getSigners(6);

  let token1: ERC1400;
  let token2: ERC1400;
  let balanceReader: BatchBalanceReader;

  before(async function () {
    // require fixture first
    await truffleFixture([2]);
  });

  beforeEach(async function () {
    token1 = await new ERC1400__factory(controllerSigner).deploy(
      'ERC1400Token',
      'DAU',
      1,
      [controllerSigner.getAddress()],
      partitions
    );
    token2 = await new ERC1400__factory(controllerSigner).deploy(
      'ERC1400Token',
      'DAU',
      1,
      [controllerSigner.getAddress()],
      partitions
    );
    balanceReader = await new BatchBalanceReader__factory(signer).deploy();

    // Token1
    await token1.issueByPartition(
      partition1,
      tokenHolder1Signer.getAddress(),
      issuanceAmount11,
      VALID_CERTIFICATE
    );
    await token1.issueByPartition(
      partition1,
      tokenHolder2Signer.getAddress(),
      issuanceAmount12,
      VALID_CERTIFICATE
    );
    await token1.issueByPartition(
      partition1,
      tokenHolder3Signer.getAddress(),
      issuanceAmount13,
      VALID_CERTIFICATE
    );

    await token1.issueByPartition(
      partition2,
      tokenHolder1Signer.getAddress(),
      issuanceAmount21,
      VALID_CERTIFICATE
    );
    await token1.issueByPartition(
      partition2,
      tokenHolder2Signer.getAddress(),
      issuanceAmount22,
      VALID_CERTIFICATE
    );
    await token1.issueByPartition(
      partition2,
      tokenHolder3Signer.getAddress(),
      issuanceAmount23,
      VALID_CERTIFICATE
    );

    await token1.issueByPartition(
      partition3,
      tokenHolder1Signer.getAddress(),
      issuanceAmount31,
      VALID_CERTIFICATE
    );
    await token1.issueByPartition(
      partition3,
      tokenHolder2Signer.getAddress(),
      issuanceAmount32,
      VALID_CERTIFICATE
    );
    await token1.issueByPartition(
      partition3,
      tokenHolder3Signer.getAddress(),
      issuanceAmount33,
      VALID_CERTIFICATE
    );

    await token1.issueByPartition(
      partition4,
      tokenHolder1Signer.getAddress(),
      issuanceAmount41,
      VALID_CERTIFICATE
    );
    await token1.issueByPartition(
      partition4,
      tokenHolder2Signer.getAddress(),
      issuanceAmount42,
      VALID_CERTIFICATE
    );
    await token1.issueByPartition(
      partition4,
      tokenHolder3Signer.getAddress(),
      issuanceAmount43,
      VALID_CERTIFICATE
    );

    // Token2
    await token2.issueByPartition(
      partition1,
      tokenHolder1Signer.getAddress(),
      2 * issuanceAmount11,
      VALID_CERTIFICATE
    );
    await token2.issueByPartition(
      partition1,
      tokenHolder2Signer.getAddress(),
      2 * issuanceAmount12,
      VALID_CERTIFICATE
    );
    await token2.issueByPartition(
      partition1,
      tokenHolder3Signer.getAddress(),
      2 * issuanceAmount13,
      VALID_CERTIFICATE
    );

    await token2.issueByPartition(
      partition2,
      tokenHolder1Signer.getAddress(),
      2 * issuanceAmount21,
      VALID_CERTIFICATE
    );
    await token2.issueByPartition(
      partition2,
      tokenHolder2Signer.getAddress(),
      2 * issuanceAmount22,
      VALID_CERTIFICATE
    );
    await token2.issueByPartition(
      partition2,
      tokenHolder3Signer.getAddress(),
      2 * issuanceAmount23,
      VALID_CERTIFICATE
    );

    await token2.issueByPartition(
      partition3,
      tokenHolder1Signer.getAddress(),
      2 * issuanceAmount31,
      VALID_CERTIFICATE
    );
    await token2.issueByPartition(
      partition3,
      tokenHolder2Signer.getAddress(),
      2 * issuanceAmount32,
      VALID_CERTIFICATE
    );
    await token2.issueByPartition(
      partition3,
      tokenHolder3Signer.getAddress(),
      2 * issuanceAmount33,
      VALID_CERTIFICATE
    );

    await token2.issueByPartition(
      partition4,
      tokenHolder1Signer.getAddress(),
      2 * issuanceAmount41,
      VALID_CERTIFICATE
    );
    await token2.issueByPartition(
      partition4,
      tokenHolder2Signer.getAddress(),
      2 * issuanceAmount42,
      VALID_CERTIFICATE
    );
    await token2.issueByPartition(
      partition4,
      tokenHolder3Signer.getAddress(),
      2 * issuanceAmount43,
      VALID_CERTIFICATE
    );
  });

  describe('balancesOfByPartition', function () {
    it('returns the partition balances list', async function () {
      const tokenHolders = [
        tokenHolder1Signer.getAddress(),
        tokenHolder2Signer.getAddress(),
        tokenHolder3Signer.getAddress()
      ];
      const tokenAddresses = [token1.address, token2.address];

      const balancesOfByPartition = await balanceReader
        .connect(unknownSigner)
        .balancesOfByPartition(tokenHolders, tokenAddresses, partitions);

      assert.equal(balancesOfByPartition.length, 24);

      // Tokenholder1
      assert.equal(balancesOfByPartition[0].toNumber(), issuanceAmount11);
      assert.equal(balancesOfByPartition[1].toNumber(), issuanceAmount21);
      assert.equal(balancesOfByPartition[2].toNumber(), issuanceAmount31);
      assert.equal(balancesOfByPartition[3].toNumber(), issuanceAmount41);

      assert.equal(balancesOfByPartition[4].toNumber(), 2 * issuanceAmount11);
      assert.equal(balancesOfByPartition[5].toNumber(), 2 * issuanceAmount21);
      assert.equal(balancesOfByPartition[6].toNumber(), 2 * issuanceAmount31);
      assert.equal(balancesOfByPartition[7].toNumber(), 2 * issuanceAmount41);

      // Tokenholder2
      assert.equal(balancesOfByPartition[8].toNumber(), issuanceAmount12);
      assert.equal(balancesOfByPartition[9].toNumber(), issuanceAmount22);
      assert.equal(balancesOfByPartition[10].toNumber(), issuanceAmount32);
      assert.equal(balancesOfByPartition[11].toNumber(), issuanceAmount42);

      assert.equal(balancesOfByPartition[12].toNumber(), 2 * issuanceAmount12);
      assert.equal(balancesOfByPartition[13].toNumber(), 2 * issuanceAmount22);
      assert.equal(balancesOfByPartition[14].toNumber(), 2 * issuanceAmount32);
      assert.equal(balancesOfByPartition[15].toNumber(), 2 * issuanceAmount42);

      // Tokenholder3
      assert.equal(balancesOfByPartition[16].toNumber(), issuanceAmount13);
      assert.equal(balancesOfByPartition[17].toNumber(), issuanceAmount23);
      assert.equal(balancesOfByPartition[18].toNumber(), issuanceAmount33);
      assert.equal(balancesOfByPartition[19].toNumber(), issuanceAmount43);

      assert.equal(balancesOfByPartition[20].toNumber(), 2 * issuanceAmount13);
      assert.equal(balancesOfByPartition[21].toNumber(), 2 * issuanceAmount23);
      assert.equal(balancesOfByPartition[22].toNumber(), 2 * issuanceAmount33);
      assert.equal(balancesOfByPartition[23].toNumber(), 2 * issuanceAmount43);
    });
  });

  describe('balancesOf', function () {
    it('returns the balances list', async function () {
      const tokenHolders = [
        tokenHolder1Signer.getAddress(),
        tokenHolder2Signer.getAddress(),
        tokenHolder3Signer.getAddress()
      ];
      const tokenAddresses = [token1.address, token2.address];

      const balancesOf = await balanceReader
        .connect(unknownSigner)
        .balancesOf(tokenHolders, tokenAddresses);

      assert.equal(balancesOf.length, 6);

      // Tokenholder1
      assert.equal(
        balancesOf[0].toNumber(),
        issuanceAmount11 +
          issuanceAmount21 +
          issuanceAmount31 +
          issuanceAmount41
      );
      assert.equal(
        balancesOf[1].toNumber(),
        2 *
          (issuanceAmount11 +
            issuanceAmount21 +
            issuanceAmount31 +
            issuanceAmount41)
      );

      // Tokenholder2
      assert.equal(
        balancesOf[2].toNumber(),
        issuanceAmount12 +
          issuanceAmount22 +
          issuanceAmount32 +
          issuanceAmount42
      );
      assert.equal(
        balancesOf[3].toNumber(),
        2 *
          (issuanceAmount12 +
            issuanceAmount22 +
            issuanceAmount32 +
            issuanceAmount42)
      );

      // Tokenholder3
      assert.equal(
        balancesOf[4].toNumber(),
        issuanceAmount13 +
          issuanceAmount23 +
          issuanceAmount33 +
          issuanceAmount43
      );
      assert.equal(
        balancesOf[5].toNumber(),
        2 *
          (issuanceAmount13 +
            issuanceAmount23 +
            issuanceAmount33 +
            issuanceAmount43)
      );
    });
  });

  describe('totalSuppliesByPartition', function () {
    it('returns the partition total supplies list', async function () {
      const tokenAddresses = [token1.address, token2.address];

      const totalSuppliesByPartition = await balanceReader
        .connect(unknownSigner)
        .totalSuppliesByPartition(partitions, tokenAddresses);

      assert.equal(totalSuppliesByPartition.length, 8);

      const expectedTotalSupplyPartition1 =
        issuanceAmount11 + issuanceAmount12 + issuanceAmount13;

      const expectedTotalSupplyPartition2 =
        issuanceAmount21 + issuanceAmount22 + issuanceAmount23;

      const expectedTotalSupplyPartition3 =
        issuanceAmount31 + issuanceAmount32 + issuanceAmount33;

      const expectedTotalSupplyPartition4 =
        issuanceAmount41 + issuanceAmount42 + issuanceAmount43;

      // Token1
      assert.equal(
        totalSuppliesByPartition[0].toNumber(),
        expectedTotalSupplyPartition1
      );
      assert.equal(
        totalSuppliesByPartition[1].toNumber(),
        expectedTotalSupplyPartition2
      );
      assert.equal(
        totalSuppliesByPartition[2].toNumber(),
        expectedTotalSupplyPartition3
      );
      assert.equal(
        totalSuppliesByPartition[3].toNumber(),
        expectedTotalSupplyPartition4
      );

      // Token2
      assert.equal(
        totalSuppliesByPartition[4].toNumber(),
        2 * expectedTotalSupplyPartition1
      );
      assert.equal(
        totalSuppliesByPartition[5].toNumber(),
        2 * expectedTotalSupplyPartition2
      );
      assert.equal(
        totalSuppliesByPartition[6].toNumber(),
        2 * expectedTotalSupplyPartition3
      );
      assert.equal(
        totalSuppliesByPartition[7].toNumber(),
        2 * expectedTotalSupplyPartition4
      );
    });
  });

  describe('totalSupplies', function () {
    it('returns the total supplies list', async function () {
      const tokenAddresses = [token1.address, token2.address];

      const totalSupplies = await balanceReader
        .connect(unknownSigner)
        .totalSupplies(tokenAddresses);

      assert.equal(totalSupplies.length, 2);

      const expectedTotalSupply =
        issuanceAmount11 +
        issuanceAmount12 +
        issuanceAmount13 +
        issuanceAmount21 +
        issuanceAmount22 +
        issuanceAmount23 +
        issuanceAmount31 +
        issuanceAmount32 +
        issuanceAmount33 +
        issuanceAmount41 +
        issuanceAmount42 +
        issuanceAmount43;

      // Token1
      assert.equal(totalSupplies[0].toNumber(), expectedTotalSupply);

      // Token2
      assert.equal(totalSupplies[1].toNumber(), 2 * expectedTotalSupply);
    });
  });
});
