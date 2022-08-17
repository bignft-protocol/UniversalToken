import {
  CERTIFICATE_VALIDATION_NONE,
  CERTIFICATE_VALIDATION_SALT,
  setAllowListActivated,
  setBlockListActivated,
  setGranularityByPartitionActivated,
  setHoldsActivated,
  addTokenController
} from './common/extension';

import { ethers } from 'ethers';
import assert from 'assert';
import { newSecretHashPair, newHoldId } from './utils/crypto';
import {
  BatchReader,
  BatchReader__factory,
  ERC1400HoldableCertificateToken,
  ERC1400HoldableCertificateToken__factory,
  ERC1400TokensValidator,
  ERC1400TokensValidator__factory,
  ERC721Token,
  ERC721Token__factory
} from '../typechain-types';
import { ZERO_ADDRESS, ZERO_BYTE, ZERO_BYTES32 } from './utils/assert';
import truffleFixture from './truffle-fixture';
import { provider, getSigners } from 'hardhat';
import { partition1, partition2, partition3, partition4 } from './utils/bytes';

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

const token1DefaultPartitions = [partition1, partition2, partition3];
const token2DefaultPartitions = [
  partition1,
  partition2,
  partition3,
  partition4
];
const token3DefaultPartitions: string | any[] = [];
const token4DefaultPartitions = [partition3, partition4];

const token1Partitions = [partition1, partition2, partition3];
const token2Partitions = [partition2, partition3, partition4];
const token3Partitions = [];
const token4Partitions = [partition1];

const SECONDS_IN_AN_HOUR = 3600;

const holdAmount = 6;

describe('BatchReader', function () {
  const [
    signer,
    controller1Signer,
    controller2Signer,
    controller3Signer,
    deployerSigner,
    tokenHolder1Signer,
    tokenHolder2Signer,
    tokenHolder3Signer,
    unknownSigner
  ] = getSigners(9);

  let balanceReader: BatchReader;

  let extension: ERC1400TokensValidator;
  let extension2: ERC1400TokensValidator;
  let token1: ERC1400HoldableCertificateToken;
  let token2: ERC1400HoldableCertificateToken;
  let token3: ERC1400HoldableCertificateToken;
  let token4: ERC1400HoldableCertificateToken;
  let token5: ERC721Token;
  let token6: ERC721Token;

  before(async function () {
    // require fixture first
    await truffleFixture([2]);

    extension = await new ERC1400TokensValidator__factory(
      deployerSigner
    ).deploy();
    extension2 = await new ERC1400TokensValidator__factory(
      deployerSigner
    ).deploy();

    balanceReader = await new BatchReader__factory(signer).deploy();

    token1 = await new ERC1400HoldableCertificateToken__factory(
      controller1Signer
    ).deploy(
      'ERC1400Token',
      'DAU',
      1,
      [controller1Signer.getAddress()],
      token1DefaultPartitions,
      extension.address,
      ZERO_ADDRESS, // owner
      ZERO_ADDRESS, // certitficate signer
      CERTIFICATE_VALIDATION_NONE
    );
    token2 = await new ERC1400HoldableCertificateToken__factory(
      controller1Signer
    ).deploy(
      'ERC1400Token',
      'DAU',
      1,
      [controller1Signer.getAddress()],
      token2DefaultPartitions,
      extension.address,
      ZERO_ADDRESS, // owner
      ZERO_ADDRESS, // certitficate signer
      CERTIFICATE_VALIDATION_NONE
    );
    token3 = await new ERC1400HoldableCertificateToken__factory(
      controller2Signer
    ).deploy(
      'ERC1400Token',
      'DAU',
      1,
      [],
      token3DefaultPartitions,
      extension2.address,
      signer.getAddress(), // owner
      ZERO_ADDRESS, // certitficate signer
      CERTIFICATE_VALIDATION_SALT
    );
    token4 = await new ERC1400HoldableCertificateToken__factory(
      controller3Signer
    ).deploy(
      'ERC1400Token',
      'DAU',
      1,
      [
        controller1Signer.getAddress(),
        controller2Signer.getAddress(),
        controller3Signer.getAddress()
      ],
      token4DefaultPartitions,
      ZERO_ADDRESS, // extension
      ZERO_ADDRESS, // owner
      ZERO_ADDRESS, // certitficate signer
      CERTIFICATE_VALIDATION_NONE
    );

    token5 = await new ERC721Token__factory(signer).deploy(
      'ERC721Token',
      'DAU',
      '',
      ''
    );

    token6 = await new ERC721Token__factory(signer).deploy(
      'ERC721Token',
      'DAU',
      '',
      ''
    );

    // Add token extension controllers
    await addTokenController(
      extension2,
      token3,
      signer,
      await controller1Signer.getAddress()
    );
    await addTokenController(
      extension2,
      token3,
      signer,
      await controller2Signer.getAddress()
    );

    // Deactivate allowlist checks
    await setAllowListActivated(extension, token1, controller1Signer, false);
    await setAllowListActivated(extension, token2, controller1Signer, false);

    // Deactivate blocklist checks
    await setBlockListActivated(extension, token2, controller1Signer, false);

    // Deactivate granularity by partition checks
    await setGranularityByPartitionActivated(
      extension,
      token1,
      controller1Signer,
      false
    );

    // Deactivate holds
    await setHoldsActivated(extension2, token3, signer, false);

    // Token1
    await token1
      .connect(controller1Signer)
      .issueByPartition(
        partition1,
        tokenHolder1Signer.getAddress(),
        issuanceAmount11,
        ZERO_BYTE
      );
    await token1
      .connect(controller1Signer)
      .issueByPartition(
        partition1,
        tokenHolder2Signer.getAddress(),
        issuanceAmount12,
        ZERO_BYTE
      );
    await token1
      .connect(controller1Signer)
      .issueByPartition(
        partition1,
        tokenHolder3Signer.getAddress(),
        issuanceAmount13,
        ZERO_BYTE
      );

    await token1
      .connect(controller1Signer)
      .issueByPartition(
        partition2,
        tokenHolder1Signer.getAddress(),
        issuanceAmount21,
        ZERO_BYTE
      );
    await token1
      .connect(controller1Signer)
      .issueByPartition(
        partition2,
        tokenHolder2Signer.getAddress(),
        issuanceAmount22,
        ZERO_BYTE
      );
    await token1
      .connect(controller1Signer)
      .issueByPartition(
        partition2,
        tokenHolder3Signer.getAddress(),
        issuanceAmount23,
        ZERO_BYTE
      );

    await token1
      .connect(controller1Signer)
      .issueByPartition(
        partition3,
        tokenHolder1Signer.getAddress(),
        issuanceAmount31,
        ZERO_BYTE
      );
    await token1
      .connect(controller1Signer)
      .issueByPartition(
        partition3,
        tokenHolder2Signer.getAddress(),
        issuanceAmount32,
        ZERO_BYTE
      );
    await token1
      .connect(controller1Signer)
      .issueByPartition(
        partition3,
        tokenHolder3Signer.getAddress(),
        issuanceAmount33,
        ZERO_BYTE
      );

    // Token2
    await token2
      .connect(controller1Signer)
      .issueByPartition(
        partition2,
        tokenHolder1Signer.getAddress(),
        2 * issuanceAmount21,
        ZERO_BYTE
      );
    await token2
      .connect(controller1Signer)
      .issueByPartition(
        partition2,
        tokenHolder2Signer.getAddress(),
        2 * issuanceAmount22,
        ZERO_BYTE
      );
    await token2
      .connect(controller1Signer)
      .issueByPartition(
        partition2,
        tokenHolder3Signer.getAddress(),
        2 * issuanceAmount23,
        ZERO_BYTE
      );

    await token2
      .connect(controller1Signer)
      .issueByPartition(
        partition3,
        tokenHolder1Signer.getAddress(),
        2 * issuanceAmount31,
        ZERO_BYTE
      );
    await token2
      .connect(controller1Signer)
      .issueByPartition(
        partition3,
        tokenHolder2Signer.getAddress(),
        2 * issuanceAmount32,
        ZERO_BYTE
      );
    await token2
      .connect(controller1Signer)
      .issueByPartition(
        partition3,
        tokenHolder3Signer.getAddress(),
        2 * issuanceAmount33,
        ZERO_BYTE
      );

    await token2
      .connect(controller1Signer)
      .issueByPartition(
        partition4,
        tokenHolder1Signer.getAddress(),
        2 * issuanceAmount41,
        ZERO_BYTE
      );
    await token2
      .connect(controller1Signer)
      .issueByPartition(
        partition4,
        tokenHolder2Signer.getAddress(),
        2 * issuanceAmount42,
        ZERO_BYTE
      );
    await token2
      .connect(controller1Signer)
      .issueByPartition(
        partition4,
        tokenHolder3Signer.getAddress(),
        2 * issuanceAmount43,
        ZERO_BYTE
      );

    // Token4
    await token4
      .connect(controller3Signer)
      .issueByPartition(
        partition1,
        tokenHolder1Signer.getAddress(),
        4 * issuanceAmount11,
        ZERO_BYTE
      );

    // Transfer some ETH to modify the balances
    tokenHolder1Signer.sendTransaction({
      to: tokenHolder2Signer.getAddress(),
      value: ethers.utils.parseEther('5')
    });

    // Create token holds to modify the spendable balances by partition
    await extension.connect(tokenHolder1Signer).hold(
      token1.address,
      newHoldId(),
      tokenHolder2Signer.getAddress(),
      unknownSigner.getAddress(), // notary
      partition1,
      holdAmount,
      SECONDS_IN_AN_HOUR,
      newSecretHashPair().hash,
      ZERO_BYTES32 // certificate
    );
    await extension.connect(tokenHolder3Signer).hold(
      token2.address,
      newHoldId(),
      tokenHolder2Signer.getAddress(),
      unknownSigner.getAddress(), // notary
      partition2,
      2 * holdAmount,
      SECONDS_IN_AN_HOUR,
      newSecretHashPair().hash,
      ZERO_BYTES32 // certificate
    );

    // Add allowlisted
    await extension
      .connect(controller1Signer)
      .addAllowlisted(token1.address, tokenHolder1Signer.getAddress());
    await extension
      .connect(controller1Signer)
      .addAllowlisted(token1.address, tokenHolder2Signer.getAddress());
    await extension
      .connect(controller1Signer)
      .addAllowlisted(token2.address, tokenHolder3Signer.getAddress());

    // Add blocklisted
    await extension
      .connect(controller1Signer)
      .addBlocklisted(token1.address, tokenHolder3Signer.getAddress());
    await extension
      .connect(controller1Signer)
      .addBlocklisted(token2.address, tokenHolder2Signer.getAddress());
    await extension
      .connect(controller1Signer)
      .addBlocklisted(token2.address, tokenHolder3Signer.getAddress());

    // Mint NFTs
    await token5.mint(tokenHolder1Signer.getAddress(), 1);
    await token5.mint(tokenHolder1Signer.getAddress(), 2);
    await token5.mint(tokenHolder1Signer.getAddress(), 3);
    await token5.mint(tokenHolder1Signer.getAddress(), 4);

    await token5.mint(tokenHolder2Signer.getAddress(), 5);
    await token5.mint(tokenHolder2Signer.getAddress(), 6);
    await token5.mint(tokenHolder2Signer.getAddress(), 7);

    await token5.mint(tokenHolder3Signer.getAddress(), 8);
    await token5.mint(tokenHolder3Signer.getAddress(), 9);
    await token5.mint(tokenHolder3Signer.getAddress(), 10);
    await token5.mint(tokenHolder3Signer.getAddress(), 11);
    await token5.mint(tokenHolder3Signer.getAddress(), 12);
    await token5.mint(tokenHolder3Signer.getAddress(), 13);
    await token5.mint(tokenHolder3Signer.getAddress(), 14);

    await token6.mint(tokenHolder1Signer.getAddress(), 10);
    await token6.mint(tokenHolder1Signer.getAddress(), 20);
    await token6.mint(tokenHolder1Signer.getAddress(), 30);
    await token6.mint(tokenHolder1Signer.getAddress(), 40);

    await token6.mint(tokenHolder2Signer.getAddress(), 50);
    await token6.mint(tokenHolder2Signer.getAddress(), 60);
    await token6.mint(tokenHolder2Signer.getAddress(), 70);

    await token6.mint(tokenHolder3Signer.getAddress(), 80);
    await token6.mint(tokenHolder3Signer.getAddress(), 90);
    await token6.mint(tokenHolder3Signer.getAddress(), 100);
    await token6.mint(tokenHolder3Signer.getAddress(), 110);
    await token6.mint(tokenHolder3Signer.getAddress(), 120);
    await token6.mint(tokenHolder3Signer.getAddress(), 130);
    await token6.mint(tokenHolder3Signer.getAddress(), 140);
  });

  describe('batchTokenSuppliesInfos', function () {
    it('returns the list of token supplies', async function () {
      const tokenAddresses = [
        token1.address,
        token2.address,
        token3.address,
        token4.address
      ];

      const batchTokenSupplies = await balanceReader
        .connect(unknownSigner)
        .batchTokenSuppliesInfos(tokenAddresses);

      const totalSupply1Partition1 =
        issuanceAmount11 + issuanceAmount12 + issuanceAmount13;
      const totalSupply1Partition2 =
        issuanceAmount21 + issuanceAmount22 + issuanceAmount23;
      const totalSupply1Partition3 =
        issuanceAmount31 + issuanceAmount32 + issuanceAmount33;
      const totalSupply1 =
        totalSupply1Partition1 +
        totalSupply1Partition2 +
        totalSupply1Partition3;

      const totalSupply2Partition1 =
        2 * (issuanceAmount21 + issuanceAmount22 + issuanceAmount23);
      const totalSupply2Partition2 =
        2 * (issuanceAmount31 + issuanceAmount32 + issuanceAmount33);
      const totalSupply2Partition3 =
        2 * (issuanceAmount41 + issuanceAmount42 + issuanceAmount43);
      const totalSupply2 =
        totalSupply2Partition1 +
        totalSupply2Partition2 +
        totalSupply2Partition3;

      const totalSupply3 = 0;

      const totalSupply4Partition1 = 4 * issuanceAmount11;
      const totalSupply4 = totalSupply4Partition1;

      const batchTotalSupplies = batchTokenSupplies[0];
      const totalPartitionsLengths = batchTokenSupplies[1];
      const batchTotalPartitions = batchTokenSupplies[2];
      const batchPartitionSupplies = batchTokenSupplies[3];
      const defaultPartitionsLengths = batchTokenSupplies[4];
      const batchDefaultPartitions = batchTokenSupplies[5];

      // TOTAL SUPPLIES
      //
      assert.strictEqual(batchTotalSupplies.length, tokenAddresses.length);
      //
      // Token1
      assert.strictEqual(batchTotalSupplies[0].toNumber(), totalSupply1);
      // Token2
      assert.strictEqual(batchTotalSupplies[1].toNumber(), totalSupply2);
      // Token3
      assert.strictEqual(batchTotalSupplies[2].toNumber(), totalSupply3);
      // Token3
      assert.strictEqual(batchTotalSupplies[3].toNumber(), totalSupply4);

      // TOTAL PARTITIONS LENGTH
      //
      assert.strictEqual(totalPartitionsLengths.length, tokenAddresses.length);
      //
      // Token1
      assert.strictEqual(
        totalPartitionsLengths[0].toNumber(),
        token1Partitions.length
      );
      // Token2
      assert.strictEqual(
        totalPartitionsLengths[1].toNumber(),
        token2Partitions.length
      );
      // Token3
      assert.strictEqual(
        totalPartitionsLengths[2].toNumber(),
        token3Partitions.length
      );
      // Token3
      assert.strictEqual(
        totalPartitionsLengths[3].toNumber(),
        token4Partitions.length
      );

      // TOTAL PARTITIONS
      //
      assert.strictEqual(
        batchTotalPartitions.length,
        token1Partitions.length +
          token2Partitions.length +
          token3Partitions.length +
          token4Partitions.length
      );
      //
      // Token1
      assert.strictEqual(batchTotalPartitions[0], token1Partitions[0]);
      assert.strictEqual(batchTotalPartitions[1], token1Partitions[1]);
      assert.strictEqual(batchTotalPartitions[2], token1Partitions[2]);
      // Token2
      assert.strictEqual(batchTotalPartitions[3], token2Partitions[0]);
      assert.strictEqual(batchTotalPartitions[4], token2Partitions[1]);
      assert.strictEqual(batchTotalPartitions[5], token2Partitions[2]);
      // Token3
      // NA
      // Token4
      assert.strictEqual(batchTotalPartitions[6], token4Partitions[0]);

      // PARTITION SUPPLIES
      //
      assert.strictEqual(
        batchPartitionSupplies.length,
        token1Partitions.length +
          token2Partitions.length +
          token3Partitions.length +
          token4Partitions.length
      );
      //
      // Token1
      assert.strictEqual(
        batchPartitionSupplies[0].toNumber(),
        totalSupply1Partition1
      );
      assert.strictEqual(
        batchPartitionSupplies[1].toNumber(),
        totalSupply1Partition2
      );
      assert.strictEqual(
        batchPartitionSupplies[2].toNumber(),
        totalSupply1Partition3
      );
      // Token2
      assert.strictEqual(
        batchPartitionSupplies[3].toNumber(),
        totalSupply2Partition1
      );
      assert.strictEqual(
        batchPartitionSupplies[4].toNumber(),
        totalSupply2Partition2
      );
      assert.strictEqual(
        batchPartitionSupplies[5].toNumber(),
        totalSupply2Partition3
      );
      // Token3
      // NA
      // Token4
      assert.strictEqual(
        batchPartitionSupplies[6].toNumber(),
        totalSupply4Partition1
      );

      // DEFAULT PARTITIONS LENGTH
      //
      assert.strictEqual(
        defaultPartitionsLengths.length,
        tokenAddresses.length
      );
      //
      // Token1
      assert.strictEqual(
        defaultPartitionsLengths[0].toNumber(),
        token1DefaultPartitions.length
      );
      // Token2
      assert.strictEqual(
        defaultPartitionsLengths[1].toNumber(),
        token2DefaultPartitions.length
      );
      // Token3
      assert.strictEqual(
        defaultPartitionsLengths[2].toNumber(),
        token3DefaultPartitions.length
      );
      // Token4
      assert.strictEqual(
        defaultPartitionsLengths[3].toNumber(),
        token4DefaultPartitions.length
      );

      // DEFAULT PARTITIONS
      //
      assert.strictEqual(
        batchDefaultPartitions.length,
        token1DefaultPartitions.length +
          token2DefaultPartitions.length +
          token3DefaultPartitions.length +
          token4DefaultPartitions.length
      );
      //
      // Token1
      assert.strictEqual(batchDefaultPartitions[0], token1DefaultPartitions[0]);
      assert.strictEqual(batchDefaultPartitions[1], token1DefaultPartitions[1]);
      assert.strictEqual(batchDefaultPartitions[2], token1DefaultPartitions[2]);
      // Token2
      assert.strictEqual(batchDefaultPartitions[3], token2DefaultPartitions[0]);
      assert.strictEqual(batchDefaultPartitions[4], token2DefaultPartitions[1]);
      assert.strictEqual(batchDefaultPartitions[5], token2DefaultPartitions[2]);
      assert.strictEqual(batchDefaultPartitions[6], token2DefaultPartitions[3]);
      // Token3
      // NA
      // Token4
      assert.strictEqual(batchDefaultPartitions[7], token4DefaultPartitions[0]);
      assert.strictEqual(batchDefaultPartitions[8], token4DefaultPartitions[1]);
    });
  });

  describe('batchTokenRolesInfos', function () {
    it('returns the list of token roles', async function () {
      const tokenAddresses = [
        token1.address,
        token2.address,
        token3.address,
        token4.address
      ];

      const batchTokenRolesInfos = await balanceReader
        .connect(unknownSigner)
        .batchTokenRolesInfos(tokenAddresses);

      const batchOwners = batchTokenRolesInfos[0];
      const batchControllersLength = batchTokenRolesInfos[1];
      const batchControllers = batchTokenRolesInfos[2];
      const batchExtensionControllersLength = batchTokenRolesInfos[3];
      const batchExtensionControllers = batchTokenRolesInfos[4];

      // OWNERS
      //
      assert.strictEqual(batchOwners.length, tokenAddresses.length);
      //
      // Token1
      assert.strictEqual(batchOwners[0], await controller1Signer.getAddress());
      // Token2
      assert.strictEqual(batchOwners[1], await controller1Signer.getAddress());
      // Token3
      assert.strictEqual(batchOwners[2], await signer.getAddress());
      // Token4
      assert.strictEqual(batchOwners[3], await controller3Signer.getAddress());

      // CONTROLLERS LENGTH
      //
      assert.strictEqual(batchControllersLength.length, tokenAddresses.length);
      //
      // Token1
      assert.strictEqual(batchControllersLength[0].toNumber(), 1);
      // Token2
      assert.strictEqual(batchControllersLength[1].toNumber(), 1);
      // Token3
      assert.strictEqual(batchControllersLength[2].toNumber(), 0);
      // Token4
      assert.strictEqual(batchControllersLength[3].toNumber(), 3);

      // CONTROLLERS
      //
      assert.strictEqual(batchControllers.length, 1 + 1 + 0 + 3);
      //
      // Token1
      assert.strictEqual(
        batchControllers[0],
        await controller1Signer.getAddress()
      );
      // Token2
      assert.strictEqual(
        batchControllers[1],
        await controller1Signer.getAddress()
      );
      // Token3
      //
      // Token4
      assert.strictEqual(
        batchControllers[2],
        await controller1Signer.getAddress()
      );
      assert.strictEqual(
        batchControllers[3],
        await controller2Signer.getAddress()
      );
      assert.strictEqual(
        batchControllers[4],
        await controller3Signer.getAddress()
      );

      // EXTENSION CONTROLLERS LENGTH
      //
      assert.strictEqual(
        batchExtensionControllersLength.length,
        tokenAddresses.length
      );
      //
      // Token1
      assert.strictEqual(batchExtensionControllersLength[0].toNumber(), 1);
      // Token2
      assert.strictEqual(batchExtensionControllersLength[1].toNumber(), 1);
      // Token3
      assert.strictEqual(batchExtensionControllersLength[2].toNumber(), 2);
      // Token4
      assert.strictEqual(batchExtensionControllersLength[3].toNumber(), 0);

      // EXTENSION CONTROLLERS
      //
      assert.strictEqual(batchExtensionControllers.length, 1 + 1 + 2 + 0);
      //
      // Token1
      assert.strictEqual(
        batchExtensionControllers[0],
        await controller1Signer.getAddress()
      );
      // Token2
      assert.strictEqual(
        batchExtensionControllers[1],
        await controller1Signer.getAddress()
      );
      // Token3
      assert.strictEqual(
        batchExtensionControllers[2],
        await controller1Signer.getAddress()
      );
      assert.strictEqual(
        batchExtensionControllers[3],
        await controller2Signer.getAddress()
      );
      // Token4
      //
    });
  });

  describe('batchTokenExtensionSetup', function () {
    it('returns the list of token extensions setup', async function () {
      const tokenAddresses = [
        token1.address,
        token2.address,
        token3.address,
        token4.address
      ];

      const batchTokenRolesInfos = await balanceReader
        .connect(unknownSigner)
        .batchTokenExtensionSetup(tokenAddresses);

      const batchTokenExtension = batchTokenRolesInfos[0];
      const batchCertificateActivated = batchTokenRolesInfos[1];
      const batchAllowlistActivated = batchTokenRolesInfos[2];
      const batchBlocklistActivated = batchTokenRolesInfos[3];
      const batchGranularityByPartitionActivated = batchTokenRolesInfos[4];
      const batchHoldsActivated = batchTokenRolesInfos[5];

      // TOKEN EXTENSION ADDRESS
      //
      assert.strictEqual(batchTokenExtension.length, tokenAddresses.length);
      //
      // Token1
      assert.strictEqual(batchTokenExtension[0], extension.address);
      // Token2
      assert.strictEqual(batchTokenExtension[1], extension.address);
      // Token3
      assert.strictEqual(batchTokenExtension[2], extension2.address);
      // Token4
      assert.strictEqual(batchTokenExtension[3], ZERO_ADDRESS);

      // CERTIFICATE VALIDATION
      //
      assert.strictEqual(
        batchCertificateActivated.length,
        tokenAddresses.length
      );
      //
      // Token1
      assert.strictEqual(
        batchCertificateActivated[0],
        CERTIFICATE_VALIDATION_NONE
      );
      // Token2
      assert.strictEqual(
        batchCertificateActivated[1],
        CERTIFICATE_VALIDATION_NONE
      );
      // Token3
      assert.strictEqual(
        batchCertificateActivated[2],
        CERTIFICATE_VALIDATION_SALT
      );
      // Token4
      assert.strictEqual(
        batchCertificateActivated[3],
        CERTIFICATE_VALIDATION_NONE
      );

      // ALLOWLIST
      //
      assert.strictEqual(batchAllowlistActivated.length, tokenAddresses.length);
      //
      // Token1
      assert.strictEqual(batchAllowlistActivated[0], false);
      // Token2
      assert.strictEqual(batchAllowlistActivated[1], false);
      // Token3
      assert.strictEqual(batchAllowlistActivated[2], true);
      // Token4
      assert.strictEqual(batchAllowlistActivated[3], false);

      // BLOCKLIST
      //
      assert.strictEqual(batchBlocklistActivated.length, tokenAddresses.length);
      //
      // Token1
      assert.strictEqual(batchBlocklistActivated[0], true);
      // Token2
      assert.strictEqual(batchBlocklistActivated[1], false);
      // Token3
      assert.strictEqual(batchBlocklistActivated[2], true);
      // Token4
      assert.strictEqual(batchBlocklistActivated[3], false);

      // GRANULARITY BY PARTITION
      //
      assert.strictEqual(
        batchGranularityByPartitionActivated.length,
        tokenAddresses.length
      );
      //
      // Token1
      assert.strictEqual(batchGranularityByPartitionActivated[0], false);
      // Token2
      assert.strictEqual(batchGranularityByPartitionActivated[1], true);
      // Token3
      assert.strictEqual(batchGranularityByPartitionActivated[2], true);
      // Token4
      assert.strictEqual(batchGranularityByPartitionActivated[3], false);

      // HOLDS
      //
      assert.strictEqual(batchHoldsActivated.length, tokenAddresses.length);
      //
      // Token1
      assert.strictEqual(batchHoldsActivated[0], true);
      // Token2
      assert.strictEqual(batchHoldsActivated[1], true);
      // Token3
      assert.strictEqual(batchHoldsActivated[2], false);
      // Token4
      assert.strictEqual(batchHoldsActivated[3], false);
    });
  });

  describe('batchBalances', function () {
    it('returns the lists of ETH, ERC20 and ERC1400 balances (spendable or not)', async function () {
      const tokenHolders = [
        tokenHolder1Signer.getAddress(),
        tokenHolder2Signer.getAddress(),
        tokenHolder3Signer.getAddress()
      ];
      const tokenAddresses = [
        token1.address,
        token2.address,
        token3.address,
        token4.address
      ];

      const batchERC1400Balances = await balanceReader
        .connect(unknownSigner)
        .batchERC1400Balances(tokenAddresses, tokenHolders);

      const batchEthBalances = batchERC1400Balances[0];
      const batchBalancesOf = batchERC1400Balances[1];
      const totalPartitionsLengths = batchERC1400Balances[2];
      const batchTotalPartitions = batchERC1400Balances[3];
      const batchBalancesOfByPartition = batchERC1400Balances[4];
      const batchSpendableBalancesOfByPartition = batchERC1400Balances[5];

      // ETH BALANCES
      //

      assert.strictEqual(batchEthBalances.length, tokenHolders.length);
      assert.strictEqual(
        batchEthBalances[0].toString(),
        (await provider.getBalance(tokenHolders[0])).toString()
      );
      assert.strictEqual(
        batchEthBalances[1].toString(),
        (await provider.getBalance(tokenHolders[1])).toString()
      );
      assert.strictEqual(
        batchEthBalances[2].toString(),
        (await provider.getBalance(tokenHolders[2])).toString()
      );

      // BALANCES
      //
      assert.strictEqual(
        batchBalancesOf.length,
        tokenHolders.length * tokenAddresses.length
      );
      //
      // Tokenholder1
      assert.strictEqual(
        batchBalancesOf[0].toNumber(),
        issuanceAmount11 + issuanceAmount21 + issuanceAmount31
      );
      assert.strictEqual(
        batchBalancesOf[1].toNumber(),
        2 * (issuanceAmount21 + issuanceAmount31 + issuanceAmount41)
      );
      assert.strictEqual(batchBalancesOf[2].toNumber(), 0);
      assert.strictEqual(batchBalancesOf[3].toNumber(), 4 * issuanceAmount11);
      // Tokenholder2
      assert.strictEqual(
        batchBalancesOf[4].toNumber(),
        issuanceAmount12 + issuanceAmount22 + issuanceAmount32
      );
      assert.strictEqual(
        batchBalancesOf[5].toNumber(),
        2 * (issuanceAmount22 + issuanceAmount32 + issuanceAmount42)
      );
      assert.strictEqual(batchBalancesOf[6].toNumber(), 0);
      assert.strictEqual(batchBalancesOf[7].toNumber(), 0);
      // Tokenholder3
      assert.strictEqual(
        batchBalancesOf[8].toNumber(),
        issuanceAmount13 + issuanceAmount23 + issuanceAmount33
      );
      assert.strictEqual(
        batchBalancesOf[9].toNumber(),
        2 * (issuanceAmount23 + issuanceAmount33 + issuanceAmount43)
      );
      assert.strictEqual(batchBalancesOf[10].toNumber(), 0);
      assert.strictEqual(batchBalancesOf[11].toNumber(), 0);

      // TOTAL PARTITION LENGTHS
      //
      assert.strictEqual(totalPartitionsLengths.length, tokenAddresses.length);
      //
      // Token1
      assert.strictEqual(
        totalPartitionsLengths[0].toNumber(),
        token1Partitions.length
      );
      // Token2
      assert.strictEqual(
        totalPartitionsLengths[1].toNumber(),
        token2Partitions.length
      );
      // Token3
      assert.strictEqual(
        totalPartitionsLengths[2].toNumber(),
        token3Partitions.length
      );
      // Token4
      assert.strictEqual(
        totalPartitionsLengths[3].toNumber(),
        token4Partitions.length
      );

      // TOTAL PARTITIONS
      //
      assert.strictEqual(
        batchTotalPartitions.length,
        token1Partitions.length +
          token2Partitions.length +
          token3Partitions.length +
          token4Partitions.length
      );
      //
      // Token1
      assert.strictEqual(batchTotalPartitions[0], token1Partitions[0]);
      assert.strictEqual(batchTotalPartitions[1], token1Partitions[1]);
      assert.strictEqual(batchTotalPartitions[2], token1Partitions[2]);
      // Token2
      assert.strictEqual(batchTotalPartitions[3], token2Partitions[0]);
      assert.strictEqual(batchTotalPartitions[4], token2Partitions[1]);
      assert.strictEqual(batchTotalPartitions[5], token2Partitions[2]);
      // Token3
      // NA
      // Token4
      assert.strictEqual(batchTotalPartitions[6], token4Partitions[0]);

      // PARTITION BALANCES
      //
      assert.strictEqual(
        batchBalancesOfByPartition.length,
        tokenHolders.length *
          (token1Partitions.length +
            token2Partitions.length +
            token3Partitions.length +
            token4Partitions.length)
      );
      //
      // Tokenholder1 - token1
      assert.strictEqual(
        batchBalancesOfByPartition[0].toNumber(),
        issuanceAmount11
      );
      assert.strictEqual(
        batchBalancesOfByPartition[1].toNumber(),
        issuanceAmount21
      );
      assert.strictEqual(
        batchBalancesOfByPartition[2].toNumber(),
        issuanceAmount31
      );
      // Tokenholder1 - token2
      assert.strictEqual(
        batchBalancesOfByPartition[3].toNumber(),
        2 * issuanceAmount21
      );
      assert.strictEqual(
        batchBalancesOfByPartition[4].toNumber(),
        2 * issuanceAmount31
      );
      assert.strictEqual(
        batchBalancesOfByPartition[5].toNumber(),
        2 * issuanceAmount41
      );
      // Tokenholder1 - token3
      // NA
      // Tokenholder1 - token4
      assert.strictEqual(
        batchBalancesOfByPartition[6].toNumber(),
        4 * issuanceAmount11
      );
      //
      // Tokenholder2 - token1
      assert.strictEqual(
        batchBalancesOfByPartition[7].toNumber(),
        issuanceAmount12
      );
      assert.strictEqual(
        batchBalancesOfByPartition[8].toNumber(),
        issuanceAmount22
      );
      assert.strictEqual(
        batchBalancesOfByPartition[9].toNumber(),
        issuanceAmount32
      );
      // Tokenholder2 - token2
      assert.strictEqual(
        batchBalancesOfByPartition[10].toNumber(),
        2 * issuanceAmount22
      );
      assert.strictEqual(
        batchBalancesOfByPartition[11].toNumber(),
        2 * issuanceAmount32
      );
      assert.strictEqual(
        batchBalancesOfByPartition[12].toNumber(),
        2 * issuanceAmount42
      );
      // Tokenholder2 - token3
      // NA
      // Tokenholder2 - token4
      assert.strictEqual(batchBalancesOfByPartition[13].toNumber(), 0);
      //
      // Tokenholder3 - token1
      assert.strictEqual(
        batchBalancesOfByPartition[14].toNumber(),
        issuanceAmount13
      );
      assert.strictEqual(
        batchBalancesOfByPartition[15].toNumber(),
        issuanceAmount23
      );
      assert.strictEqual(
        batchBalancesOfByPartition[16].toNumber(),
        issuanceAmount33
      );
      // Tokenholder3 - token2
      assert.strictEqual(
        batchBalancesOfByPartition[17].toNumber(),
        2 * issuanceAmount23
      );
      assert.strictEqual(
        batchBalancesOfByPartition[18].toNumber(),
        2 * issuanceAmount33
      );
      assert.strictEqual(
        batchBalancesOfByPartition[19].toNumber(),
        2 * issuanceAmount43
      );
      // Tokenholder3 - token3
      // NA
      // Tokenholder3 - token4
      assert.strictEqual(batchBalancesOfByPartition[20].toNumber(), 0);

      // SPENDABLE PARTITION BALANCES
      //
      assert.strictEqual(
        batchSpendableBalancesOfByPartition.length,
        tokenHolders.length *
          (token1Partitions.length +
            token2Partitions.length +
            token3Partitions.length +
            token4Partitions.length)
      );
      //
      // Tokenholder1 - token1
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[0].toNumber(),
        issuanceAmount11 - holdAmount
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[1].toNumber(),
        issuanceAmount21
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[2].toNumber(),
        issuanceAmount31
      );
      // Tokenholder1 - token2
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[3].toNumber(),
        2 * issuanceAmount21
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[4].toNumber(),
        2 * issuanceAmount31
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[5].toNumber(),
        2 * issuanceAmount41
      );
      // Tokenholder1 - token3
      // NA
      // Tokenholder1 - token4
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[6].toNumber(),
        4 * issuanceAmount11
      );
      //
      // Tokenholder2 - token1
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[7].toNumber(),
        issuanceAmount12
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[8].toNumber(),
        issuanceAmount22
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[9].toNumber(),
        issuanceAmount32
      );
      // Tokenholder2 - token2
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[10].toNumber(),
        2 * issuanceAmount22
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[11].toNumber(),
        2 * issuanceAmount32
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[12].toNumber(),
        2 * issuanceAmount42
      );
      // Tokenholder2 - token3
      // NA
      // Tokenholder2 - token4
      assert.strictEqual(batchSpendableBalancesOfByPartition[13].toNumber(), 0);
      //
      // Tokenholder3 - token1
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[14].toNumber(),
        issuanceAmount13
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[15].toNumber(),
        issuanceAmount23
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[16].toNumber(),
        issuanceAmount33
      );
      // Tokenholder3 - token2
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[17].toNumber(),
        2 * issuanceAmount23 - 2 * holdAmount
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[18].toNumber(),
        2 * issuanceAmount33
      );
      assert.strictEqual(
        batchSpendableBalancesOfByPartition[19].toNumber(),
        2 * issuanceAmount43
      );
      // Tokenholder3 - token3
      // NA
      // Tokenholder3 - token4
      assert.strictEqual(batchSpendableBalancesOfByPartition[20].toNumber(), 0);

      //
      //
      //
      //
      //

      const batchERC20Balances = await balanceReader
        .connect(unknownSigner)
        .batchERC20Balances(tokenAddresses, tokenHolders);
      const batchEthBalances2 = batchERC20Balances[0];
      const batchBalancesOf2 = batchERC20Balances[1];

      // ETH BALANCES
      //
      assert.strictEqual(batchEthBalances.length, tokenHolders.length);
      assert.strictEqual(
        batchEthBalances2[0].toString(),
        (await provider.getBalance(tokenHolders[0])).toString()
      );
      assert.strictEqual(
        batchEthBalances2[1].toString(),
        (await provider.getBalance(tokenHolders[1])).toString()
      );
      assert.strictEqual(
        batchEthBalances2[2].toString(),
        (await provider.getBalance(tokenHolders[2])).toString()
      );

      // BALANCES
      //
      assert.strictEqual(
        batchBalancesOf2.length,
        tokenHolders.length * tokenAddresses.length
      );
      //
      // Tokenholder1
      assert.strictEqual(
        batchBalancesOf2[0].toNumber(),
        issuanceAmount11 + issuanceAmount21 + issuanceAmount31
      );
      assert.strictEqual(
        batchBalancesOf2[1].toNumber(),
        2 * (issuanceAmount21 + issuanceAmount31 + issuanceAmount41)
      );
      assert.strictEqual(batchBalancesOf2[2].toNumber(), 0);
      assert.strictEqual(batchBalancesOf2[3].toNumber(), 4 * issuanceAmount11);
      // Tokenholder2
      assert.strictEqual(
        batchBalancesOf2[4].toNumber(),
        issuanceAmount12 + issuanceAmount22 + issuanceAmount32
      );
      assert.strictEqual(
        batchBalancesOf2[5].toNumber(),
        2 * (issuanceAmount22 + issuanceAmount32 + issuanceAmount42)
      );
      assert.strictEqual(batchBalancesOf2[6].toNumber(), 0);
      assert.strictEqual(batchBalancesOf2[7].toNumber(), 0);
      // Tokenholder3
      assert.strictEqual(
        batchBalancesOf2[8].toNumber(),
        issuanceAmount13 + issuanceAmount23 + issuanceAmount33
      );
      assert.strictEqual(
        batchBalancesOf2[9].toNumber(),
        2 * (issuanceAmount23 + issuanceAmount33 + issuanceAmount43)
      );
      assert.strictEqual(batchBalancesOf2[10].toNumber(), 0);
      assert.strictEqual(batchBalancesOf2[11].toNumber(), 0);
    });
  });

  describe('batchERC721Balances', function () {
    it('returns the list of minted tokens', async function () {
      const tokenHolders = [
        tokenHolder1Signer.getAddress(),
        tokenHolder2Signer.getAddress(),
        tokenHolder3Signer.getAddress()
      ];
      const tokenAddresses = [token5.address, token6.address];

      const batchERC721Balances = await balanceReader
        .connect(unknownSigner)
        .batchERC721Balances(tokenAddresses, tokenHolders);

      const batchEthBalances = batchERC721Balances[0];
      const batchBalancesOf = batchERC721Balances[1];

      assert.strictEqual(batchBalancesOf.length, tokenAddresses.length);
      assert.strictEqual(batchEthBalances.length, tokenHolders.length);

      const token5Balances = batchBalancesOf[0];
      const token6Balances = batchBalancesOf[1];

      assert.strictEqual(token5Balances.length, tokenHolders.length);
      assert.strictEqual(token6Balances.length, tokenHolders.length);

      const token5Holder1 = token5Balances[0];
      const token5Holder2 = token5Balances[1];
      const token5Holder3 = token5Balances[2];

      const token6Holder1 = token6Balances[0];
      const token6Holder2 = token6Balances[1];
      const token6Holder3 = token6Balances[2];

      assert.strictEqual(token5Holder1.length, 4);
      assert.strictEqual(token5Holder2.length, 3);
      assert.strictEqual(token5Holder3.length, 7);

      assert.strictEqual(token6Holder1.length, 4);
      assert.strictEqual(token6Holder2.length, 3);
      assert.strictEqual(token6Holder3.length, 7);

      assert.strictEqual(token5Holder1[0].toNumber(), 1);
      assert.strictEqual(token5Holder1[1].toNumber(), 2);
      assert.strictEqual(token5Holder1[2].toNumber(), 3);
      assert.strictEqual(token5Holder1[3].toNumber(), 4);

      assert.strictEqual(token5Holder2[0].toNumber(), 5);
      assert.strictEqual(token5Holder2[1].toNumber(), 6);
      assert.strictEqual(token5Holder2[2].toNumber(), 7);

      assert.strictEqual(token5Holder3[0].toNumber(), 8);
      assert.strictEqual(token5Holder3[1].toNumber(), 9);
      assert.strictEqual(token5Holder3[2].toNumber(), 10);
      assert.strictEqual(token5Holder3[3].toNumber(), 11);
      assert.strictEqual(token5Holder3[4].toNumber(), 12);
      assert.strictEqual(token5Holder3[5].toNumber(), 13);
      assert.strictEqual(token5Holder3[6].toNumber(), 14);

      assert.strictEqual(token6Holder1[0].toNumber(), 10);
      assert.strictEqual(token6Holder1[1].toNumber(), 20);
      assert.strictEqual(token6Holder1[2].toNumber(), 30);
      assert.strictEqual(token6Holder1[3].toNumber(), 40);

      assert.strictEqual(token6Holder2[0].toNumber(), 50);
      assert.strictEqual(token6Holder2[1].toNumber(), 60);
      assert.strictEqual(token6Holder2[2].toNumber(), 70);

      assert.strictEqual(token6Holder3[0].toNumber(), 80);
      assert.strictEqual(token6Holder3[1].toNumber(), 90);
      assert.strictEqual(token6Holder3[2].toNumber(), 100);
      assert.strictEqual(token6Holder3[3].toNumber(), 110);
      assert.strictEqual(token6Holder3[4].toNumber(), 120);
      assert.strictEqual(token6Holder3[5].toNumber(), 130);
      assert.strictEqual(token6Holder3[6].toNumber(), 140);
    });
  });

  describe('batchValidations', function () {
    it('returns the lists of allowlisted and blocklisted', async function () {
      const tokenHolders = [
        tokenHolder1Signer.getAddress(),
        tokenHolder2Signer.getAddress(),
        tokenHolder3Signer.getAddress()
      ];
      const tokenAddresses = [
        token1.address,
        token2.address,
        token3.address,
        token4.address
      ];

      const batchValidations = await balanceReader
        .connect(unknownSigner)
        .batchValidations(tokenAddresses, tokenHolders);

      const batchAllowlisted = batchValidations[0];
      const batchBlocklisted = batchValidations[1];

      // ALLOWLISTED
      //
      assert.strictEqual(
        batchAllowlisted.length,
        tokenAddresses.length * tokenHolders.length
      );
      //
      // Tokenholder1
      assert.strictEqual(batchAllowlisted[0], true);
      assert.strictEqual(batchAllowlisted[1], false);
      assert.strictEqual(batchAllowlisted[2], false);
      assert.strictEqual(batchAllowlisted[3], false);
      // Tokenholder2
      assert.strictEqual(batchAllowlisted[4], true);
      assert.strictEqual(batchAllowlisted[5], false);
      assert.strictEqual(batchAllowlisted[6], false);
      assert.strictEqual(batchAllowlisted[7], false);
      // Tokenholder3
      assert.strictEqual(batchAllowlisted[8], false);
      assert.strictEqual(batchAllowlisted[9], true);
      assert.strictEqual(batchAllowlisted[10], false);
      assert.strictEqual(batchAllowlisted[11], false);

      // BLOCKLISTED
      //
      assert.strictEqual(
        batchBlocklisted.length,
        tokenAddresses.length * tokenHolders.length
      );
      //
      // Tokenholder1
      assert.strictEqual(batchBlocklisted[0], false);
      assert.strictEqual(batchBlocklisted[1], false);
      assert.strictEqual(batchBlocklisted[2], false);
      assert.strictEqual(batchBlocklisted[3], false);
      // Tokenholder2
      assert.strictEqual(batchBlocklisted[4], false);
      assert.strictEqual(batchBlocklisted[5], true);
      assert.strictEqual(batchBlocklisted[6], false);
      assert.strictEqual(batchBlocklisted[7], false);
      // Tokenholder3
      assert.strictEqual(batchBlocklisted[8], true);
      assert.strictEqual(batchBlocklisted[9], true);
      assert.strictEqual(batchBlocklisted[10], false);
      assert.strictEqual(batchBlocklisted[11], false);
    });
  });
});
