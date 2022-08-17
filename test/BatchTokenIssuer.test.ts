import { ethers } from 'ethers';
import { assertBalanceOfByPartition, assertRevert } from './utils/assert';
import {
  BatchTokenIssuer,
  BatchTokenIssuer__factory,
  ERC1400HoldableCertificateToken,
  ERC1400HoldableCertificateToken__factory,
  ERC1400TokensValidator,
  ERC1400TokensValidator__factory
} from '../typechain-types';
import truffleFixture from './truffle-fixture';
import { getSigners } from 'hardhat';
import { partition1, partitions } from './utils/bytes';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const CERTIFICATE_VALIDATION_NONE = 0;
const CERTIFICATE_VALIDATION_NONCE = 1;
const CERTIFICATE_VALIDATION_SALT = 2;
const CERTIFICATE_VALIDATION_DEFAULT = CERTIFICATE_VALIDATION_SALT;

const MAX_NUMBER_OF_ISSUANCES_IN_A_BATCH = 40;

describe('BatchTokenIssuer', function () {
  const [signer, controllerSigner, unknownSigner] = getSigners(3);

  let extension: ERC1400TokensValidator;
  let token: ERC1400HoldableCertificateToken;
  let batchIssuer: BatchTokenIssuer;
  let issuancePartitions: string[];
  let tokenHolders: string[];
  let values: number[];

  before(async function () {
    await truffleFixture([2]);

    extension = await new ERC1400TokensValidator__factory(
      unknownSigner
    ).deploy();
  });

  beforeEach(async function () {
    token = await new ERC1400HoldableCertificateToken__factory(
      controllerSigner
    ).deploy(
      'ERC1400Token',
      'DAU',
      1,
      [controllerSigner.getAddress()],
      [partition1],
      extension.address,
      signer.getAddress(),
      CERTIFICATE_SIGNER,
      CERTIFICATE_VALIDATION_DEFAULT
    );
    batchIssuer = await new BatchTokenIssuer__factory(signer).deploy();

    await extension
      .connect(controllerSigner)
      .addCertificateSigner(token.address, batchIssuer.address);

    await token.connect(controllerSigner).addMinter(batchIssuer.address);

    issuancePartitions = [];
    tokenHolders = [];
    values = [];

    for (let index = 0; index < MAX_NUMBER_OF_ISSUANCES_IN_A_BATCH; index++) {
      const wallet = ethers.Wallet.createRandom();
      issuancePartitions.push(
        partitions[Math.floor(Math.random() * partitions.length)]
      );
      tokenHolders.push(wallet.address);
      values.push(index);
    }
  });

  // BATCH ISSUEBYPARTITION

  describe('batchIssueByPartition', function () {
    describe('when input is correct', function () {
      describe('when the operator is a minter', function () {
        it('issues tokens for multiple different holders', async function () {
          await batchIssuer
            .connect(controllerSigner)
            .batchIssueByPartition(
              token.address,
              issuancePartitions,
              tokenHolders,
              values
            );

          for (let i = 0; i < issuancePartitions.length; i++) {
            await assertBalanceOfByPartition(
              token,
              tokenHolders[i],
              issuancePartitions[i],
              values[i]
            );
          }
        });
      });
      describe('when the operator is not a minter', function () {
        it('reverts', async function () {
          await assertRevert(
            batchIssuer
              .connect(unknownSigner)
              .batchIssueByPartition(
                token.address,
                issuancePartitions,
                tokenHolders,
                values
              )
          );
        });
      });
    });
    describe('when tokenHoler list is not correct', function () {
      it('reverts', async function () {
        tokenHolders.push(await unknownSigner.getAddress());
        await assertRevert(
          batchIssuer
            .connect(controllerSigner)
            .batchIssueByPartition(
              token.address,
              issuancePartitions,
              tokenHolders,
              values
            )
        );
      });
    });
    describe('when values list is not correct', function () {
      it('reverts', async function () {
        values.push(10);
        await assertRevert(
          batchIssuer
            .connect(controllerSigner)
            .batchIssueByPartition(
              token.address,
              issuancePartitions,
              tokenHolders,
              values
            )
        );
      });
    });
  });
});
