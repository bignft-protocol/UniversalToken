import {
  ZERO_ADDRESS,
  ZERO_BYTES32
  // @ts-ignore
} from '@openzeppelin/test-helpers/src/constants';

import {
  CERTIFICATE_VALIDATION_NONE,
  CERTIFICATE_VALIDATION_SALT,
  setAllowListActivated,
  setBlockListActivated,
  setGranularityByPartitionActivated,
  setHoldsActivated,
  addTokenController
} from './common/extension';

import { contract, assert, ethers } from 'hardhat';
import { newSecretHashPair, newHoldId } from './utils/crypto';
import {
  BatchReader,
  BatchReader__factory,
  ERC1400HoldableCertificateToken,
  ERC1400HoldableCertificateToken__factory,
  ERC1400TokensValidator,
  ERC1400TokensValidator__factory,
  ERC1820Registry,
  ERC1820Registry__factory,
  ERC721Token,
  ERC721Token__factory
} from '../typechain-types';
import { ZERO_BYTE } from './utils/assert';
import { Signer } from 'ethers';

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

contract(
  'BatchReader',
  ([
    owner,
    controller1,
    controller2,
    controller3,
    deployer,
    tokenHolder1,
    tokenHolder2,
    tokenHolder3,
    unknown
  ]) => {
    let balanceReader: BatchReader;

    let extension: ERC1400TokensValidator;
    let extension2: ERC1400TokensValidator;
    let token1: ERC1400HoldableCertificateToken;
    let token2: ERC1400HoldableCertificateToken;
    let token3: ERC1400HoldableCertificateToken;
    let token4: ERC1400HoldableCertificateToken;
    let token5: ERC721Token;
    let token6: ERC721Token;
    let signer: Signer;
    before(async function () {
      signer = await ethers.getSigner(owner);

      extension = await new ERC1400TokensValidator__factory(
        await ethers.getSigner(deployer)
      ).deploy();
      extension2 = await new ERC1400TokensValidator__factory(
        await ethers.getSigner(deployer)
      ).deploy();

      balanceReader = await new BatchReader__factory(signer).deploy();

      token1 = await new ERC1400HoldableCertificateToken__factory(
        await ethers.getSigner(controller1)
      ).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controller1],
        token1DefaultPartitions,
        extension.address,
        ZERO_ADDRESS, // owner
        ZERO_ADDRESS, // certitficate signer
        CERTIFICATE_VALIDATION_NONE
      );
      token2 = await new ERC1400HoldableCertificateToken__factory(
        await ethers.getSigner(controller1)
      ).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controller1],
        token2DefaultPartitions,
        extension.address,
        ZERO_ADDRESS, // owner
        ZERO_ADDRESS, // certitficate signer
        CERTIFICATE_VALIDATION_NONE
      );
      token3 = await new ERC1400HoldableCertificateToken__factory(
        await ethers.getSigner(controller2)
      ).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [],
        token3DefaultPartitions,
        extension2.address,
        owner, // owner
        ZERO_ADDRESS, // certitficate signer
        CERTIFICATE_VALIDATION_SALT
      );
      token4 = await new ERC1400HoldableCertificateToken__factory(
        await ethers.getSigner(controller3)
      ).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controller1, controller2, controller3],
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
      await addTokenController(extension2, token3, owner, controller1);
      await addTokenController(extension2, token3, owner, controller2);

      // Deactivate allowlist checks
      await setAllowListActivated(extension, token1, controller1, false);
      await setAllowListActivated(extension, token2, controller1, false);

      // Deactivate blocklist checks
      await setBlockListActivated(extension, token2, controller1, false);

      // Deactivate granularity by partition checks
      await setGranularityByPartitionActivated(
        extension,
        token1,
        controller1,
        false
      );

      // Deactivate holds
      await setHoldsActivated(extension2, token3, owner, false);

      // Token1
      await token1
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition1,
          tokenHolder1,
          issuanceAmount11,
          ZERO_BYTE
        );
      await token1
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition1,
          tokenHolder2,
          issuanceAmount12,
          ZERO_BYTE
        );
      await token1
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition1,
          tokenHolder3,
          issuanceAmount13,
          ZERO_BYTE
        );

      await token1
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition2,
          tokenHolder1,
          issuanceAmount21,
          ZERO_BYTE
        );
      await token1
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition2,
          tokenHolder2,
          issuanceAmount22,
          ZERO_BYTE
        );
      await token1
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition2,
          tokenHolder3,
          issuanceAmount23,
          ZERO_BYTE
        );

      await token1
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition3,
          tokenHolder1,
          issuanceAmount31,
          ZERO_BYTE
        );
      await token1
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition3,
          tokenHolder2,
          issuanceAmount32,
          ZERO_BYTE
        );
      await token1
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition3,
          tokenHolder3,
          issuanceAmount33,
          ZERO_BYTE
        );

      // Token2
      await token2
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition2,
          tokenHolder1,
          2 * issuanceAmount21,
          ZERO_BYTE
        );
      await token2
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition2,
          tokenHolder2,
          2 * issuanceAmount22,
          ZERO_BYTE
        );
      await token2
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition2,
          tokenHolder3,
          2 * issuanceAmount23,
          ZERO_BYTE
        );

      await token2
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition3,
          tokenHolder1,
          2 * issuanceAmount31,
          ZERO_BYTE
        );
      await token2
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition3,
          tokenHolder2,
          2 * issuanceAmount32,
          ZERO_BYTE
        );
      await token2
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition3,
          tokenHolder3,
          2 * issuanceAmount33,
          ZERO_BYTE
        );

      await token2
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition4,
          tokenHolder1,
          2 * issuanceAmount41,
          ZERO_BYTE
        );
      await token2
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition4,
          tokenHolder2,
          2 * issuanceAmount42,
          ZERO_BYTE
        );
      await token2
        .connect(await ethers.getSigner(controller1))
        .issueByPartition(
          partition4,
          tokenHolder3,
          2 * issuanceAmount43,
          ZERO_BYTE
        );

      // Token4
      await token4
        .connect(await ethers.getSigner(controller3))
        .issueByPartition(
          partition1,
          tokenHolder1,
          4 * issuanceAmount11,
          ZERO_BYTE
        );

      // Transfer some ETH to modify the balances
      await ethers.getSigner(tokenHolder1).then((signer) =>
        signer.sendTransaction({
          to: tokenHolder2,
          value: ethers.utils.parseEther('5')
        })
      );

      // Create token holds to modify the spendable balances by partition
      await extension.connect(await ethers.getSigner(tokenHolder1)).hold(
        token1.address,
        newHoldId(),
        tokenHolder2,
        unknown, // notary
        partition1,
        holdAmount,
        SECONDS_IN_AN_HOUR,
        newSecretHashPair().hash,
        ZERO_BYTES32 // certificate
      );
      await extension.connect(await ethers.getSigner(tokenHolder3)).hold(
        token2.address,
        newHoldId(),
        tokenHolder2,
        unknown, // notary
        partition2,
        2 * holdAmount,
        SECONDS_IN_AN_HOUR,
        newSecretHashPair().hash,
        ZERO_BYTES32 // certificate
      );

      // Add allowlisted
      await extension
        .connect(await ethers.getSigner(controller1))
        .addAllowlisted(token1.address, tokenHolder1);
      await extension
        .connect(await ethers.getSigner(controller1))
        .addAllowlisted(token1.address, tokenHolder2);
      await extension
        .connect(await ethers.getSigner(controller1))
        .addAllowlisted(token2.address, tokenHolder3);

      // Add blocklisted
      await extension
        .connect(await ethers.getSigner(controller1))
        .addBlocklisted(token1.address, tokenHolder3);
      await extension
        .connect(await ethers.getSigner(controller1))
        .addBlocklisted(token2.address, tokenHolder2);
      await extension
        .connect(await ethers.getSigner(controller1))
        .addBlocklisted(token2.address, tokenHolder3);

      // Mint NFTs
      await token5.mint(tokenHolder1, 1);
      await token5.mint(tokenHolder1, 2);
      await token5.mint(tokenHolder1, 3);
      await token5.mint(tokenHolder1, 4);

      await token5.mint(tokenHolder2, 5);
      await token5.mint(tokenHolder2, 6);
      await token5.mint(tokenHolder2, 7);

      await token5.mint(tokenHolder3, 8);
      await token5.mint(tokenHolder3, 9);
      await token5.mint(tokenHolder3, 10);
      await token5.mint(tokenHolder3, 11);
      await token5.mint(tokenHolder3, 12);
      await token5.mint(tokenHolder3, 13);
      await token5.mint(tokenHolder3, 14);

      await token6.mint(tokenHolder1, 10);
      await token6.mint(tokenHolder1, 20);
      await token6.mint(tokenHolder1, 30);
      await token6.mint(tokenHolder1, 40);

      await token6.mint(tokenHolder2, 50);
      await token6.mint(tokenHolder2, 60);
      await token6.mint(tokenHolder2, 70);

      await token6.mint(tokenHolder3, 80);
      await token6.mint(tokenHolder3, 90);
      await token6.mint(tokenHolder3, 100);
      await token6.mint(tokenHolder3, 110);
      await token6.mint(tokenHolder3, 120);
      await token6.mint(tokenHolder3, 130);
      await token6.mint(tokenHolder3, 140);
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
          .connect(await ethers.getSigner(unknown))
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
        assert.equal(batchTotalSupplies.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(batchTotalSupplies[0].toNumber(), totalSupply1);
        // Token2
        assert.equal(batchTotalSupplies[1].toNumber(), totalSupply2);
        // Token3
        assert.equal(batchTotalSupplies[2].toNumber(), totalSupply3);
        // Token3
        assert.equal(batchTotalSupplies[3].toNumber(), totalSupply4);

        // TOTAL PARTITIONS LENGTH
        //
        assert.equal(totalPartitionsLengths.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(
          totalPartitionsLengths[0].toNumber(),
          token1Partitions.length
        );
        // Token2
        assert.equal(
          totalPartitionsLengths[1].toNumber(),
          token2Partitions.length
        );
        // Token3
        assert.equal(
          totalPartitionsLengths[2].toNumber(),
          token3Partitions.length
        );
        // Token3
        assert.equal(
          totalPartitionsLengths[3].toNumber(),
          token4Partitions.length
        );

        // TOTAL PARTITIONS
        //
        assert.equal(
          batchTotalPartitions.length,
          token1Partitions.length +
            token2Partitions.length +
            token3Partitions.length +
            token4Partitions.length
        );
        //
        // Token1
        assert.equal(batchTotalPartitions[0], token1Partitions[0]);
        assert.equal(batchTotalPartitions[1], token1Partitions[1]);
        assert.equal(batchTotalPartitions[2], token1Partitions[2]);
        // Token2
        assert.equal(batchTotalPartitions[3], token2Partitions[0]);
        assert.equal(batchTotalPartitions[4], token2Partitions[1]);
        assert.equal(batchTotalPartitions[5], token2Partitions[2]);
        // Token3
        // NA
        // Token4
        assert.equal(batchTotalPartitions[6], token4Partitions[0]);

        // PARTITION SUPPLIES
        //
        assert.equal(
          batchPartitionSupplies.length,
          token1Partitions.length +
            token2Partitions.length +
            token3Partitions.length +
            token4Partitions.length
        );
        //
        // Token1
        assert.equal(
          batchPartitionSupplies[0].toNumber(),
          totalSupply1Partition1
        );
        assert.equal(
          batchPartitionSupplies[1].toNumber(),
          totalSupply1Partition2
        );
        assert.equal(
          batchPartitionSupplies[2].toNumber(),
          totalSupply1Partition3
        );
        // Token2
        assert.equal(
          batchPartitionSupplies[3].toNumber(),
          totalSupply2Partition1
        );
        assert.equal(
          batchPartitionSupplies[4].toNumber(),
          totalSupply2Partition2
        );
        assert.equal(
          batchPartitionSupplies[5].toNumber(),
          totalSupply2Partition3
        );
        // Token3
        // NA
        // Token4
        assert.equal(
          batchPartitionSupplies[6].toNumber(),
          totalSupply4Partition1
        );

        // DEFAULT PARTITIONS LENGTH
        //
        assert.equal(defaultPartitionsLengths.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(
          defaultPartitionsLengths[0].toNumber(),
          token1DefaultPartitions.length
        );
        // Token2
        assert.equal(
          defaultPartitionsLengths[1].toNumber(),
          token2DefaultPartitions.length
        );
        // Token3
        assert.equal(
          defaultPartitionsLengths[2].toNumber(),
          token3DefaultPartitions.length
        );
        // Token4
        assert.equal(
          defaultPartitionsLengths[3].toNumber(),
          token4DefaultPartitions.length
        );

        // DEFAULT PARTITIONS
        //
        assert.equal(
          batchDefaultPartitions.length,
          token1DefaultPartitions.length +
            token2DefaultPartitions.length +
            token3DefaultPartitions.length +
            token4DefaultPartitions.length
        );
        //
        // Token1
        assert.equal(batchDefaultPartitions[0], token1DefaultPartitions[0]);
        assert.equal(batchDefaultPartitions[1], token1DefaultPartitions[1]);
        assert.equal(batchDefaultPartitions[2], token1DefaultPartitions[2]);
        // Token2
        assert.equal(batchDefaultPartitions[3], token2DefaultPartitions[0]);
        assert.equal(batchDefaultPartitions[4], token2DefaultPartitions[1]);
        assert.equal(batchDefaultPartitions[5], token2DefaultPartitions[2]);
        assert.equal(batchDefaultPartitions[6], token2DefaultPartitions[3]);
        // Token3
        // NA
        // Token4
        assert.equal(batchDefaultPartitions[7], token4DefaultPartitions[0]);
        assert.equal(batchDefaultPartitions[8], token4DefaultPartitions[1]);
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
          .connect(await ethers.getSigner(unknown))
          .batchTokenRolesInfos(tokenAddresses);

        const batchOwners = batchTokenRolesInfos[0];
        const batchControllersLength = batchTokenRolesInfos[1];
        const batchControllers = batchTokenRolesInfos[2];
        const batchExtensionControllersLength = batchTokenRolesInfos[3];
        const batchExtensionControllers = batchTokenRolesInfos[4];

        // OWNERS
        //
        assert.equal(batchOwners.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(batchOwners[0], controller1);
        // Token2
        assert.equal(batchOwners[1], controller1);
        // Token3
        assert.equal(batchOwners[2], owner);
        // Token4
        assert.equal(batchOwners[3], controller3);

        // CONTROLLERS LENGTH
        //
        assert.equal(batchControllersLength.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(batchControllersLength[0].toNumber(), 1);
        // Token2
        assert.equal(batchControllersLength[1].toNumber(), 1);
        // Token3
        assert.equal(batchControllersLength[2].toNumber(), 0);
        // Token4
        assert.equal(batchControllersLength[3].toNumber(), 3);

        // CONTROLLERS
        //
        assert.equal(batchControllers.length, 1 + 1 + 0 + 3);
        //
        // Token1
        assert.equal(batchControllers[0], controller1);
        // Token2
        assert.equal(batchControllers[1], controller1);
        // Token3
        //
        // Token4
        assert.equal(batchControllers[2], controller1);
        assert.equal(batchControllers[3], controller2);
        assert.equal(batchControllers[4], controller3);

        // EXTENSION CONTROLLERS LENGTH
        //
        assert.equal(
          batchExtensionControllersLength.length,
          tokenAddresses.length
        );
        //
        // Token1
        assert.equal(batchExtensionControllersLength[0].toNumber(), 1);
        // Token2
        assert.equal(batchExtensionControllersLength[1].toNumber(), 1);
        // Token3
        assert.equal(batchExtensionControllersLength[2].toNumber(), 2);
        // Token4
        assert.equal(batchExtensionControllersLength[3].toNumber(), 0);

        // EXTENSION CONTROLLERS
        //
        assert.equal(batchExtensionControllers.length, 1 + 1 + 2 + 0);
        //
        // Token1
        assert.equal(batchExtensionControllers[0], controller1);
        // Token2
        assert.equal(batchExtensionControllers[1], controller1);
        // Token3
        assert.equal(batchExtensionControllers[2], controller1);
        assert.equal(batchExtensionControllers[3], controller2);
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
          .connect(await ethers.getSigner(unknown))
          .batchTokenExtensionSetup(tokenAddresses);

        const batchTokenExtension = batchTokenRolesInfos[0];
        const batchCertificateActivated = batchTokenRolesInfos[1];
        const batchAllowlistActivated = batchTokenRolesInfos[2];
        const batchBlocklistActivated = batchTokenRolesInfos[3];
        const batchGranularityByPartitionActivated = batchTokenRolesInfos[4];
        const batchHoldsActivated = batchTokenRolesInfos[5];

        // TOKEN EXTENSION ADDRESS
        //
        assert.equal(batchTokenExtension.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(batchTokenExtension[0], extension.address);
        // Token2
        assert.equal(batchTokenExtension[1], extension.address);
        // Token3
        assert.equal(batchTokenExtension[2], extension2.address);
        // Token4
        assert.equal(batchTokenExtension[3], ZERO_ADDRESS);

        // CERTIFICATE VALIDATION
        //
        assert.equal(batchCertificateActivated.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(batchCertificateActivated[0], CERTIFICATE_VALIDATION_NONE);
        // Token2
        assert.equal(batchCertificateActivated[1], CERTIFICATE_VALIDATION_NONE);
        // Token3
        assert.equal(batchCertificateActivated[2], CERTIFICATE_VALIDATION_SALT);
        // Token4
        assert.equal(batchCertificateActivated[3], CERTIFICATE_VALIDATION_NONE);

        // ALLOWLIST
        //
        assert.equal(batchAllowlistActivated.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(batchAllowlistActivated[0], false);
        // Token2
        assert.equal(batchAllowlistActivated[1], false);
        // Token3
        assert.equal(batchAllowlistActivated[2], true);
        // Token4
        assert.equal(batchAllowlistActivated[3], false);

        // BLOCKLIST
        //
        assert.equal(batchBlocklistActivated.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(batchBlocklistActivated[0], true);
        // Token2
        assert.equal(batchBlocklistActivated[1], false);
        // Token3
        assert.equal(batchBlocklistActivated[2], true);
        // Token4
        assert.equal(batchBlocklistActivated[3], false);

        // GRANULARITY BY PARTITION
        //
        assert.equal(
          batchGranularityByPartitionActivated.length,
          tokenAddresses.length
        );
        //
        // Token1
        assert.equal(batchGranularityByPartitionActivated[0], false);
        // Token2
        assert.equal(batchGranularityByPartitionActivated[1], true);
        // Token3
        assert.equal(batchGranularityByPartitionActivated[2], true);
        // Token4
        assert.equal(batchGranularityByPartitionActivated[3], false);

        // HOLDS
        //
        assert.equal(batchHoldsActivated.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(batchHoldsActivated[0], true);
        // Token2
        assert.equal(batchHoldsActivated[1], true);
        // Token3
        assert.equal(batchHoldsActivated[2], false);
        // Token4
        assert.equal(batchHoldsActivated[3], false);
      });
    });

    describe('batchBalances', function () {
      it('returns the lists of ETH, ERC20 and ERC1400 balances (spendable or not)', async function () {
        const tokenHolders = [tokenHolder1, tokenHolder2, tokenHolder3];
        const tokenAddresses = [
          token1.address,
          token2.address,
          token3.address,
          token4.address
        ];

        const batchERC1400Balances = await balanceReader
          .connect(await ethers.getSigner(unknown))
          .batchERC1400Balances(tokenAddresses, tokenHolders);

        const batchEthBalances = batchERC1400Balances[0];
        const batchBalancesOf = batchERC1400Balances[1];
        const totalPartitionsLengths = batchERC1400Balances[2];
        const batchTotalPartitions = batchERC1400Balances[3];
        const batchBalancesOfByPartition = batchERC1400Balances[4];
        const batchSpendableBalancesOfByPartition = batchERC1400Balances[5];

        // ETH BALANCES
        //

        assert.equal(batchEthBalances.length, tokenHolders.length);
        assert.equal(
          batchEthBalances[0].toString(),
          (await ethers.provider.getBalance(tokenHolders[0])).toString()
        );
        assert.equal(
          batchEthBalances[1].toString(),
          (await ethers.provider.getBalance(tokenHolders[1])).toString()
        );
        assert.equal(
          batchEthBalances[2].toString(),
          (await ethers.provider.getBalance(tokenHolders[2])).toString()
        );

        // BALANCES
        //
        assert.equal(
          batchBalancesOf.length,
          tokenHolders.length * tokenAddresses.length
        );
        //
        // Tokenholder1
        assert.equal(
          batchBalancesOf[0].toNumber(),
          issuanceAmount11 + issuanceAmount21 + issuanceAmount31
        );
        assert.equal(
          batchBalancesOf[1].toNumber(),
          2 * (issuanceAmount21 + issuanceAmount31 + issuanceAmount41)
        );
        assert.equal(batchBalancesOf[2].toNumber(), 0);
        assert.equal(batchBalancesOf[3].toNumber(), 4 * issuanceAmount11);
        // Tokenholder2
        assert.equal(
          batchBalancesOf[4].toNumber(),
          issuanceAmount12 + issuanceAmount22 + issuanceAmount32
        );
        assert.equal(
          batchBalancesOf[5].toNumber(),
          2 * (issuanceAmount22 + issuanceAmount32 + issuanceAmount42)
        );
        assert.equal(batchBalancesOf[6].toNumber(), 0);
        assert.equal(batchBalancesOf[7].toNumber(), 0);
        // Tokenholder3
        assert.equal(
          batchBalancesOf[8].toNumber(),
          issuanceAmount13 + issuanceAmount23 + issuanceAmount33
        );
        assert.equal(
          batchBalancesOf[9].toNumber(),
          2 * (issuanceAmount23 + issuanceAmount33 + issuanceAmount43)
        );
        assert.equal(batchBalancesOf[10].toNumber(), 0);
        assert.equal(batchBalancesOf[11].toNumber(), 0);

        // TOTAL PARTITION LENGTHS
        //
        assert.equal(totalPartitionsLengths.length, tokenAddresses.length);
        //
        // Token1
        assert.equal(
          totalPartitionsLengths[0].toNumber(),
          token1Partitions.length
        );
        // Token2
        assert.equal(
          totalPartitionsLengths[1].toNumber(),
          token2Partitions.length
        );
        // Token3
        assert.equal(
          totalPartitionsLengths[2].toNumber(),
          token3Partitions.length
        );
        // Token4
        assert.equal(
          totalPartitionsLengths[3].toNumber(),
          token4Partitions.length
        );

        // TOTAL PARTITIONS
        //
        assert.equal(
          batchTotalPartitions.length,
          token1Partitions.length +
            token2Partitions.length +
            token3Partitions.length +
            token4Partitions.length
        );
        //
        // Token1
        assert.equal(batchTotalPartitions[0], token1Partitions[0]);
        assert.equal(batchTotalPartitions[1], token1Partitions[1]);
        assert.equal(batchTotalPartitions[2], token1Partitions[2]);
        // Token2
        assert.equal(batchTotalPartitions[3], token2Partitions[0]);
        assert.equal(batchTotalPartitions[4], token2Partitions[1]);
        assert.equal(batchTotalPartitions[5], token2Partitions[2]);
        // Token3
        // NA
        // Token4
        assert.equal(batchTotalPartitions[6], token4Partitions[0]);

        // PARTITION BALANCES
        //
        assert.equal(
          batchBalancesOfByPartition.length,
          tokenHolders.length *
            (token1Partitions.length +
              token2Partitions.length +
              token3Partitions.length +
              token4Partitions.length)
        );
        //
        // Tokenholder1 - token1
        assert.equal(
          batchBalancesOfByPartition[0].toNumber(),
          issuanceAmount11
        );
        assert.equal(
          batchBalancesOfByPartition[1].toNumber(),
          issuanceAmount21
        );
        assert.equal(
          batchBalancesOfByPartition[2].toNumber(),
          issuanceAmount31
        );
        // Tokenholder1 - token2
        assert.equal(
          batchBalancesOfByPartition[3].toNumber(),
          2 * issuanceAmount21
        );
        assert.equal(
          batchBalancesOfByPartition[4].toNumber(),
          2 * issuanceAmount31
        );
        assert.equal(
          batchBalancesOfByPartition[5].toNumber(),
          2 * issuanceAmount41
        );
        // Tokenholder1 - token3
        // NA
        // Tokenholder1 - token4
        assert.equal(
          batchBalancesOfByPartition[6].toNumber(),
          4 * issuanceAmount11
        );
        //
        // Tokenholder2 - token1
        assert.equal(
          batchBalancesOfByPartition[7].toNumber(),
          issuanceAmount12
        );
        assert.equal(
          batchBalancesOfByPartition[8].toNumber(),
          issuanceAmount22
        );
        assert.equal(
          batchBalancesOfByPartition[9].toNumber(),
          issuanceAmount32
        );
        // Tokenholder2 - token2
        assert.equal(
          batchBalancesOfByPartition[10].toNumber(),
          2 * issuanceAmount22
        );
        assert.equal(
          batchBalancesOfByPartition[11].toNumber(),
          2 * issuanceAmount32
        );
        assert.equal(
          batchBalancesOfByPartition[12].toNumber(),
          2 * issuanceAmount42
        );
        // Tokenholder2 - token3
        // NA
        // Tokenholder2 - token4
        assert.equal(batchBalancesOfByPartition[13].toNumber(), 0);
        //
        // Tokenholder3 - token1
        assert.equal(
          batchBalancesOfByPartition[14].toNumber(),
          issuanceAmount13
        );
        assert.equal(
          batchBalancesOfByPartition[15].toNumber(),
          issuanceAmount23
        );
        assert.equal(
          batchBalancesOfByPartition[16].toNumber(),
          issuanceAmount33
        );
        // Tokenholder3 - token2
        assert.equal(
          batchBalancesOfByPartition[17].toNumber(),
          2 * issuanceAmount23
        );
        assert.equal(
          batchBalancesOfByPartition[18].toNumber(),
          2 * issuanceAmount33
        );
        assert.equal(
          batchBalancesOfByPartition[19].toNumber(),
          2 * issuanceAmount43
        );
        // Tokenholder3 - token3
        // NA
        // Tokenholder3 - token4
        assert.equal(batchBalancesOfByPartition[20].toNumber(), 0);

        // SPENDABLE PARTITION BALANCES
        //
        assert.equal(
          batchSpendableBalancesOfByPartition.length,
          tokenHolders.length *
            (token1Partitions.length +
              token2Partitions.length +
              token3Partitions.length +
              token4Partitions.length)
        );
        //
        // Tokenholder1 - token1
        assert.equal(
          batchSpendableBalancesOfByPartition[0].toNumber(),
          issuanceAmount11 - holdAmount
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[1].toNumber(),
          issuanceAmount21
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[2].toNumber(),
          issuanceAmount31
        );
        // Tokenholder1 - token2
        assert.equal(
          batchSpendableBalancesOfByPartition[3].toNumber(),
          2 * issuanceAmount21
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[4].toNumber(),
          2 * issuanceAmount31
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[5].toNumber(),
          2 * issuanceAmount41
        );
        // Tokenholder1 - token3
        // NA
        // Tokenholder1 - token4
        assert.equal(
          batchSpendableBalancesOfByPartition[6].toNumber(),
          4 * issuanceAmount11
        );
        //
        // Tokenholder2 - token1
        assert.equal(
          batchSpendableBalancesOfByPartition[7].toNumber(),
          issuanceAmount12
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[8].toNumber(),
          issuanceAmount22
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[9].toNumber(),
          issuanceAmount32
        );
        // Tokenholder2 - token2
        assert.equal(
          batchSpendableBalancesOfByPartition[10].toNumber(),
          2 * issuanceAmount22
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[11].toNumber(),
          2 * issuanceAmount32
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[12].toNumber(),
          2 * issuanceAmount42
        );
        // Tokenholder2 - token3
        // NA
        // Tokenholder2 - token4
        assert.equal(batchSpendableBalancesOfByPartition[13].toNumber(), 0);
        //
        // Tokenholder3 - token1
        assert.equal(
          batchSpendableBalancesOfByPartition[14].toNumber(),
          issuanceAmount13
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[15].toNumber(),
          issuanceAmount23
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[16].toNumber(),
          issuanceAmount33
        );
        // Tokenholder3 - token2
        assert.equal(
          batchSpendableBalancesOfByPartition[17].toNumber(),
          2 * issuanceAmount23 - 2 * holdAmount
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[18].toNumber(),
          2 * issuanceAmount33
        );
        assert.equal(
          batchSpendableBalancesOfByPartition[19].toNumber(),
          2 * issuanceAmount43
        );
        // Tokenholder3 - token3
        // NA
        // Tokenholder3 - token4
        assert.equal(batchSpendableBalancesOfByPartition[20].toNumber(), 0);

        //
        //
        //
        //
        //

        const batchERC20Balances = await balanceReader
          .connect(await ethers.getSigner(unknown))
          .batchERC20Balances(tokenAddresses, tokenHolders);
        const batchEthBalances2 = batchERC20Balances[0];
        const batchBalancesOf2 = batchERC20Balances[1];

        // ETH BALANCES
        //
        assert.equal(batchEthBalances.length, tokenHolders.length);
        assert.equal(
          batchEthBalances2[0].toString(),
          (await ethers.provider.getBalance(tokenHolders[0])).toString()
        );
        assert.equal(
          batchEthBalances2[1].toString(),
          (await ethers.provider.getBalance(tokenHolders[1])).toString()
        );
        assert.equal(
          batchEthBalances2[2].toString(),
          (await ethers.provider.getBalance(tokenHolders[2])).toString()
        );

        // BALANCES
        //
        assert.equal(
          batchBalancesOf2.length,
          tokenHolders.length * tokenAddresses.length
        );
        //
        // Tokenholder1
        assert.equal(
          batchBalancesOf2[0].toNumber(),
          issuanceAmount11 + issuanceAmount21 + issuanceAmount31
        );
        assert.equal(
          batchBalancesOf2[1].toNumber(),
          2 * (issuanceAmount21 + issuanceAmount31 + issuanceAmount41)
        );
        assert.equal(batchBalancesOf2[2].toNumber(), 0);
        assert.equal(batchBalancesOf2[3].toNumber(), 4 * issuanceAmount11);
        // Tokenholder2
        assert.equal(
          batchBalancesOf2[4].toNumber(),
          issuanceAmount12 + issuanceAmount22 + issuanceAmount32
        );
        assert.equal(
          batchBalancesOf2[5].toNumber(),
          2 * (issuanceAmount22 + issuanceAmount32 + issuanceAmount42)
        );
        assert.equal(batchBalancesOf2[6].toNumber(), 0);
        assert.equal(batchBalancesOf2[7].toNumber(), 0);
        // Tokenholder3
        assert.equal(
          batchBalancesOf2[8].toNumber(),
          issuanceAmount13 + issuanceAmount23 + issuanceAmount33
        );
        assert.equal(
          batchBalancesOf2[9].toNumber(),
          2 * (issuanceAmount23 + issuanceAmount33 + issuanceAmount43)
        );
        assert.equal(batchBalancesOf2[10].toNumber(), 0);
        assert.equal(batchBalancesOf2[11].toNumber(), 0);
      });
    });

    describe('batchERC721Balances', function () {
      it('returns the list of minted tokens', async function () {
        const tokenHolders = [tokenHolder1, tokenHolder2, tokenHolder3];
        const tokenAddresses = [token5.address, token6.address];

        const batchERC721Balances = await balanceReader
          .connect(await ethers.getSigner(unknown))
          .batchERC721Balances(tokenAddresses, tokenHolders);

        const batchEthBalances = batchERC721Balances[0];
        const batchBalancesOf = batchERC721Balances[1];

        assert.equal(batchBalancesOf.length, tokenAddresses.length);
        assert.equal(batchEthBalances.length, tokenHolders.length);

        const token5Balances = batchBalancesOf[0];
        const token6Balances = batchBalancesOf[1];

        assert.equal(token5Balances.length, tokenHolders.length);
        assert.equal(token6Balances.length, tokenHolders.length);

        const token5Holder1 = token5Balances[0];
        const token5Holder2 = token5Balances[1];
        const token5Holder3 = token5Balances[2];

        const token6Holder1 = token6Balances[0];
        const token6Holder2 = token6Balances[1];
        const token6Holder3 = token6Balances[2];

        assert.equal(token5Holder1.length, 4);
        assert.equal(token5Holder2.length, 3);
        assert.equal(token5Holder3.length, 7);

        assert.equal(token6Holder1.length, 4);
        assert.equal(token6Holder2.length, 3);
        assert.equal(token6Holder3.length, 7);

        assert.equal(token5Holder1[0].toNumber(), 1);
        assert.equal(token5Holder1[1].toNumber(), 2);
        assert.equal(token5Holder1[2].toNumber(), 3);
        assert.equal(token5Holder1[3].toNumber(), 4);

        assert.equal(token5Holder2[0].toNumber(), 5);
        assert.equal(token5Holder2[1].toNumber(), 6);
        assert.equal(token5Holder2[2].toNumber(), 7);

        assert.equal(token5Holder3[0].toNumber(), 8);
        assert.equal(token5Holder3[1].toNumber(), 9);
        assert.equal(token5Holder3[2].toNumber(), 10);
        assert.equal(token5Holder3[3].toNumber(), 11);
        assert.equal(token5Holder3[4].toNumber(), 12);
        assert.equal(token5Holder3[5].toNumber(), 13);
        assert.equal(token5Holder3[6].toNumber(), 14);

        assert.equal(token6Holder1[0].toNumber(), 10);
        assert.equal(token6Holder1[1].toNumber(), 20);
        assert.equal(token6Holder1[2].toNumber(), 30);
        assert.equal(token6Holder1[3].toNumber(), 40);

        assert.equal(token6Holder2[0].toNumber(), 50);
        assert.equal(token6Holder2[1].toNumber(), 60);
        assert.equal(token6Holder2[2].toNumber(), 70);

        assert.equal(token6Holder3[0].toNumber(), 80);
        assert.equal(token6Holder3[1].toNumber(), 90);
        assert.equal(token6Holder3[2].toNumber(), 100);
        assert.equal(token6Holder3[3].toNumber(), 110);
        assert.equal(token6Holder3[4].toNumber(), 120);
        assert.equal(token6Holder3[5].toNumber(), 130);
        assert.equal(token6Holder3[6].toNumber(), 140);
      });
    });

    describe('batchValidations', function () {
      it('returns the lists of allowlisted and blocklisted', async function () {
        const tokenHolders = [tokenHolder1, tokenHolder2, tokenHolder3];
        const tokenAddresses = [
          token1.address,
          token2.address,
          token3.address,
          token4.address
        ];

        const batchValidations = await balanceReader
          .connect(await ethers.getSigner(unknown))
          .batchValidations(tokenAddresses, tokenHolders);

        const batchAllowlisted = batchValidations[0];
        const batchBlocklisted = batchValidations[1];

        // ALLOWLISTED
        //
        assert.equal(
          batchAllowlisted.length,
          tokenAddresses.length * tokenHolders.length
        );
        //
        // Tokenholder1
        assert.equal(batchAllowlisted[0], true);
        assert.equal(batchAllowlisted[1], false);
        assert.equal(batchAllowlisted[2], false);
        assert.equal(batchAllowlisted[3], false);
        // Tokenholder2
        assert.equal(batchAllowlisted[4], true);
        assert.equal(batchAllowlisted[5], false);
        assert.equal(batchAllowlisted[6], false);
        assert.equal(batchAllowlisted[7], false);
        // Tokenholder3
        assert.equal(batchAllowlisted[8], false);
        assert.equal(batchAllowlisted[9], true);
        assert.equal(batchAllowlisted[10], false);
        assert.equal(batchAllowlisted[11], false);

        // BLOCKLISTED
        //
        assert.equal(
          batchBlocklisted.length,
          tokenAddresses.length * tokenHolders.length
        );
        //
        // Tokenholder1
        assert.equal(batchBlocklisted[0], false);
        assert.equal(batchBlocklisted[1], false);
        assert.equal(batchBlocklisted[2], false);
        assert.equal(batchBlocklisted[3], false);
        // Tokenholder2
        assert.equal(batchBlocklisted[4], false);
        assert.equal(batchBlocklisted[5], true);
        assert.equal(batchBlocklisted[6], false);
        assert.equal(batchBlocklisted[7], false);
        // Tokenholder3
        assert.equal(batchBlocklisted[8], true);
        assert.equal(batchBlocklisted[9], true);
        assert.equal(batchBlocklisted[10], false);
        assert.equal(batchBlocklisted[11], false);
      });
    });
  }
);
