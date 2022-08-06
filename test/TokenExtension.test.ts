import { ethers } from 'ethers';
import assert from 'assert';
import { advanceTimeAndBlock } from './utils/time';
import { newSecretHashPair, newHoldId } from './utils/crypto';
import {
  CERTIFICATE_VALIDATION_NONE,
  CERTIFICATE_VALIDATION_NONCE,
  CERTIFICATE_VALIDATION_SALT,
  CERTIFICATE_VALIDATION_DEFAULT,
  setCertificateActivated,
  setAllowListActivated,
  setBlockListActivated,
  setGranularityByPartitionActivated,
  setHoldsActivated,
  addTokenController
} from './common/extension';
import {
  assertTokenHasExtension,
  assertCertificateActivated,
  assertIsTokenController,
  assertHoldsActivated,
  assertGranularityByPartitionActivated,
  assertBlockListActivated,
  assertAllowListActivated,
  assertBalanceOfByPartition,
  ZERO_BYTE,
  ZERO_ADDRESS,
  assertBalanceOfSecurityToken,
  assertTotalSupply,
  assertBalance,
  assertEscResponse,
  assertRevert
} from './utils/assert';
import {
  AllowlistMock,
  AllowlistMock__factory,
  BlocklistMock,
  BlocklistMock__factory,
  CertificateSignerMock,
  CertificateSignerMock__factory,
  ClockMock,
  ClockMock__factory,
  ERC1400HoldableCertificateToken,
  ERC1400HoldableCertificateToken__factory,
  ERC1400TokensChecker,
  ERC1400TokensChecker__factory,
  ERC1400TokensRecipientMock,
  ERC1400TokensRecipientMock__factory,
  ERC1400TokensSenderMock,
  ERC1400TokensSenderMock__factory,
  ERC1400TokensValidator,
  ERC1400TokensValidatorMock__factory,
  ERC1400TokensValidator__factory,
  ERC1820Registry,
  ERC1820Registry__factory,
  FakeERC1400Mock__factory,
  PauserMock,
  PauserMock__factory
} from '../typechain-types';
import { BigNumber, Signer } from 'ethers';
import { numberToHexa } from './utils/bytes';
import truffleFixture from './truffle-fixture';
import { getSigners } from 'hardhat';
import { PromiseOrValue } from 'typechain-types/common';

const ERC1400_TOKENS_VALIDATOR = 'ERC1400TokensValidator';
const ERC1400_TOKENS_CHECKER = 'ERC1400TokensChecker';

const ERC1400_TOKENS_SENDER = 'ERC1400TokensSender';
const ERC1400_TOKENS_RECIPIENT = 'ERC1400TokensRecipient';

const EMPTY_BYTE32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

const CERTIFICATE_SIGNER_PRIVATE_KEY =
  '0x1699611cc662aad2db30d5cf44bd531a8b16710e43624fc0e801c6592f72f9ab';
const CERTIFICATE_SIGNER = '0x2A3cE238F1903B1cA935D734e6160aBA029ff80a';

const SALT_CERTIFICATE_WITH_V_EQUAL_TO_27 =
  '0xc146ced8f3786c604be1e79736551da9b9fbf013baa1db094ce9940a4ef5af4d000000000000000000000000000000000000000000000000000000012a56ef7a8a94cd85101a9285611e7bea0a6349497ffb9d25be95dee9e43af78437514a6c11d3525bb439dab160e3b7b1bf6fd3b35423d61533658759ceef0b5b019c29691b';
const SALT_CERTIFICATE_WITH_V_EQUAL_TO_28 =
  '0xc146ced8f3786c604be1e79736551da9b9fbf013baa1db094ce9940a4ef5af4d000000000000000000000000000000000000000000000000000000012a56ef7a8a94cd85101a9285611e7bea0a6349497ffb9d25be95dee9e43af78437514a6c11d3525bb439dab160e3b7b1bf6fd3b35423d61533658759ceef0b5b019c29691c';
const SALT_CERTIFICATE_WITH_V_EQUAL_TO_29 =
  '0xc146ced8f3786c604be1e79736551da9b9fbf013baa1db094ce9940a4ef5af4d000000000000000000000000000000000000000000000000000000012a56ef7a8a94cd85101a9285611e7bea0a6349497ffb9d25be95dee9e43af78437514a6c11d3525bb439dab160e3b7b1bf6fd3b35423d61533658759ceef0b5b019c29691d';

const NONCE_CERTIFICATE_WITH_V_EQUAL_TO_27 =
  '0x00000000000000000000000000000000000000000000000000000000c4427ed1057da68ae02a18da9be28448860b16d3903ff8476a2f86effbde677695466aa720f3a5c4f0e450403a66854ea20b7356fcff1cf100d291907ef6f9a6ac25f3a31b';
const NONCE_CERTIFICATE_WITH_V_EQUAL_TO_28 =
  '0x00000000000000000000000000000000000000000000000000000000c4427ed1057da68ae02a18da9be28448860b16d3903ff8476a2f86effbde677695466aa720f3a5c4f0e450403a66854ea20b7356fcff1cf100d291907ef6f9a6ac25f3a31c';
const NONCE_CERTIFICATE_WITH_V_EQUAL_TO_29 =
  '0x00000000000000000000000000000000000000000000000000000000c4427ed1057da68ae02a18da9be28448860b16d3903ff8476a2f86effbde677695466aa720f3a5c4f0e450403a66854ea20b7356fcff1cf100d291907ef6f9a6ac25f3a31d';

const CERTIFICATE_VALIDITY_PERIOD = 1; // Certificate will be valid for 1 hour

const INVALID_CERTIFICATE_SENDER =
  '0x1100000000000000000000000000000000000000000000000000000000000000';
const INVALID_CERTIFICATE_RECIPIENT =
  '0x2200000000000000000000000000000000000000000000000000000000000000';

const partition1_short =
  '5265736572766564000000000000000000000000000000000000000000000000'; // Reserved in hex
const partition2_short =
  '4973737565640000000000000000000000000000000000000000000000000000'; // Issued in hex
const partition3_short =
  '4c6f636b65640000000000000000000000000000000000000000000000000000'; // Locked in hex

const partition1 = ZERO_BYTE.concat(partition1_short);
const partition2 = ZERO_BYTE.concat(partition2_short);
const partition3 = ZERO_BYTE.concat(partition3_short);

const partitions = [partition1, partition2, partition3];

const partitionFlag =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'; // Flag to indicate a partition change
const changeToPartition1 = partitionFlag.concat(partition1_short);
const changeToPartition2 = partitionFlag.concat(partition2_short);
const changeToPartition3 = partitionFlag.concat(partition3_short);

const ESC_00 = '0x00'; // Transfer verifier not setup
const ESC_50 = '0x50'; // 0x50	transfer failure
const ESC_51 = '0x51'; // 0x51	transfer success
const ESC_52 = '0x52'; // 0x52	insufficient balance
// const ESC_53 = '0x53'; // 0x53	insufficient allowance
const ESC_54 = '0x54'; // 0x54	transfers halted (contract paused)
// const ESC_55 = '0x55'; // 0x55	funds locked (lockup period)
const ESC_56 = '0x56'; // 0x56	invalid sender
const ESC_57 = '0x57'; // 0x57	invalid receiver
const ESC_58 = '0x58'; // 0x58	invalid operator (transfer agent)

const HOLD_STATUS_NON_EXISTENT = 0;
const HOLD_STATUS_ORDERED = 1;
const HOLD_STATUS_EXECUTED = 2;
const HOLD_STATUS_EXECUTED_AND_KEPT_OPEN = 3;
const HOLD_STATUS_RELEASED_BY_NOTARY = 4;
const HOLD_STATUS_RELEASED_BY_PAYEE = 5;
const HOLD_STATUS_RELEASED_ON_EXPIRATION = 6;

const issuanceAmount = 1000;
const holdAmount = 600;
const smallHoldAmount = 400;

const SECONDS_IN_AN_HOUR = 3600;
const SECONDS_IN_A_DAY = 24 * SECONDS_IN_AN_HOUR;

const craftCertificate = async (
  _txPayload: string,
  _token: ERC1400HoldableCertificateToken,
  _extension: ERC1400TokensValidator,
  _clock: ClockMock, // clock
  _txSender: PromiseOrValue<string>
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  const domainSeperator = await _token.generateDomainSeparator();
  const certificateValidation = tokenSetup[0];
  if (certificateValidation === CERTIFICATE_VALIDATION_NONCE) {
    return craftNonceBasedCertificate(
      _txPayload,
      _token,
      _extension,
      _clock,
      _txSender,
      domainSeperator
    );
  }
  if (certificateValidation === CERTIFICATE_VALIDATION_SALT) {
    return craftSaltBasedCertificate(
      _txPayload,
      _token,
      _extension,
      _clock,
      _txSender,
      domainSeperator
    );
  }

  return ZERO_BYTE;
};

const craftNonceBasedCertificate = async (
  _txPayload: string,
  _token: ERC1400HoldableCertificateToken,
  _extension: ERC1400TokensValidator,
  _clock: ClockMock,
  _txSender: PromiseOrValue<string>,
  _domain: string
) => {
  // Retrieve current nonce from smart contract
  const nonce = await _extension.usedCertificateNonce(
    _token.address,
    _txSender
  );

  const time = await _clock.getTime();
  const expirationTime = new Date(
    1000 * (time.toNumber() + CERTIFICATE_VALIDITY_PERIOD * SECONDS_IN_AN_HOUR)
  );
  const expirationTimeAsNumber = Math.floor(expirationTime.getTime() / 1000);

  let rawTxPayload;
  if (_txPayload.length >= 64) {
    rawTxPayload = _txPayload.substring(0, _txPayload.length - 64);
  } else {
    throw new Error(
      `txPayload shall be at least 32 bytes long (${
        _txPayload.length / 2
      } instead)`
    );
  }

  const packedAndHashedParameters = ethers.utils.solidityKeccak256(
    ['address', 'address', 'bytes', 'uint256', 'uint256'],
    [
      typeof _txSender === 'string' ? _txSender : await _txSender,
      _token.address.toString(),
      rawTxPayload,
      expirationTimeAsNumber.toString(),
      nonce.toString()
    ]
  );

  const packedAndHashedData = ethers.utils.solidityKeccak256(
    ['bytes32', 'bytes32'],
    [_domain, packedAndHashedParameters]
  );

  const signingKey = new ethers.utils.SigningKey(
    CERTIFICATE_SIGNER_PRIVATE_KEY
  );

  const signature = signingKey.signDigest(packedAndHashedData);
  const certificate = ethers.utils.hexlify(
    ethers.utils.concat([
      numberToHexa(expirationTimeAsNumber, 32),
      signature.r,
      signature.s,
      ethers.utils.hexlify(signature.recoveryParam)
    ])
  );

  return certificate;
};

const craftSaltBasedCertificate = async (
  _txPayload: string,
  _token: ERC1400HoldableCertificateToken,
  _extension: ERC1400TokensValidator,
  _clock: ClockMock,
  _txSender: PromiseOrValue<string>,
  _domain: string
) => {
  // Generate a random salt, which has never been used before
  const salt = ethers.utils.id(new Date().getTime().toString());

  // Check if salt has already been used, even though that very un likely to happen (statistically impossible)
  const saltHasAlreadyBeenUsed = await _extension.usedCertificateSalt(
    _token.address,
    salt
  );

  if (saltHasAlreadyBeenUsed) {
    throw new Error(
      'can never happen: salt has already been used (statistically impossible)'
    );
  }

  const time = (await _clock.getTime()).toNumber();
  const expirationTime = new Date(
    1000 * (time + CERTIFICATE_VALIDITY_PERIOD * 3600)
  );
  const expirationTimeAsNumber = Math.floor(expirationTime.getTime() / 1000);

  let rawTxPayload;
  if (_txPayload.length >= 64) {
    rawTxPayload = _txPayload.substring(0, _txPayload.length - 64);
  } else {
    throw new Error(
      `txPayload shall be at least 32 bytes long (${
        _txPayload.length / 2
      } instead)`
    );
  }

  const packedAndHashedParameters = ethers.utils.solidityKeccak256(
    ['address', 'address', 'bytes', 'uint256', 'bytes32'],
    [
      typeof _txSender === 'string' ? _txSender : await _txSender,
      _token.address.toString(),
      rawTxPayload,
      expirationTimeAsNumber.toString(),
      salt.toString()
    ]
  );

  const packedAndHashedData = ethers.utils.solidityKeccak256(
    ['bytes32', 'bytes32'],
    [_domain, packedAndHashedParameters]
  );

  const signature = new ethers.utils.SigningKey(
    CERTIFICATE_SIGNER_PRIVATE_KEY
  ).signDigest(packedAndHashedData);
  const certificate = ethers.utils.hexlify(
    ethers.utils.concat([
      salt,
      numberToHexa(expirationTimeAsNumber, 32),
      signature.r,
      signature.s,
      ethers.utils.hexlify(signature.recoveryParam)
    ])
  );

  return certificate;
};

describe('ERC1400HoldableCertificate with token extension', function () {
  const [
    deployerSigner,
    signer,
    operatorSigner,
    controllerSigner,
    tokenHolderSigner,
    recipientSigner,
    notarySigner,
    unknownSigner,
    tokenController1Signer,
    tokenController2Signer
  ] = getSigners(10);

  let extension: ERC1400TokensValidator;
  let clock: ClockMock;
  let registry: ERC1820Registry;
  let token: ERC1400HoldableCertificateToken;

  before(async function () {
    await truffleFixture([2]);

    registry = ERC1820Registry__factory.deployed;
    clock = await new ClockMock__factory(signer).deploy();
    extension = await new ERC1400TokensValidator__factory(
      deployerSigner
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
      partitions,
      extension.address,
      signer.getAddress(),
      CERTIFICATE_SIGNER,
      CERTIFICATE_VALIDATION_DEFAULT
    );
  });

  // MOCK
  describe('setTokenExtension', function () {
    it('mock to test modifiers of roles functions', async function () {
      await new FakeERC1400Mock__factory(controllerSigner).deploy(
        'ERC1400Token',
        'DAU',
        1,
        [controllerSigner.getAddress()],
        partitions,
        extension.address,
        signer.getAddress()
      );
    });
  });

  // SET TOKEN EXTENSION
  describe('setTokenExtension', function () {
    describe('when the caller is the contract owner', function () {
      describe('when the the validator contract is not already a minter', function () {
        describe('when there is was no previous validator contract', function () {
          it('sets the token extension', async function () {
            token = await new ERC1400HoldableCertificateToken__factory(
              controllerSigner
            ).deploy(
              'ERC1400Token',
              'DAU',
              1,
              [controllerSigner.getAddress()],
              partitions,
              ZERO_ADDRESS,
              signer.getAddress(),
              ZERO_ADDRESS,
              CERTIFICATE_VALIDATION_DEFAULT
            );

            let [_currentOwner, extensionImplementer] = await Promise.all([
              token.owner(),
              registry.getInterfaceImplementer(
                token.address,
                ethers.utils.id(ERC1400_TOKENS_VALIDATOR)
              )
            ]);

            assert.strictEqual(_currentOwner, await signer.getAddress());
            assert.strictEqual(extensionImplementer, ZERO_ADDRESS);

            let [isOperator, isMinter] = await Promise.all([
              token.isOperator(extension.address, unknownSigner.getAddress()),
              token.isMinter(extension.address)
            ]);

            assert.strictEqual(isOperator, false);
            assert.strictEqual(isMinter, false);

            await token
              .connect(signer)
              .setTokenExtension(
                extension.address,
                ERC1400_TOKENS_VALIDATOR,
                true,
                true,
                true
              );

            [extensionImplementer, isOperator, isMinter] = await Promise.all([
              registry.getInterfaceImplementer(
                token.address,
                ethers.utils.id(ERC1400_TOKENS_VALIDATOR)
              ),
              token.isOperator(extension.address, unknownSigner.getAddress()),
              token.isMinter(extension.address)
            ]);

            assert.strictEqual(extensionImplementer, extension.address);
            assert.strictEqual(isOperator, true);
            assert.strictEqual(isMinter, true);
          });
        });
        describe('when there is was a previous validator contract', function () {
          describe('when the previous validator contract was a minter', function () {
            it('sets the token extension (with controller and minter rights)', async function () {
              assert.strictEqual(
                await token.owner(),
                await signer.getAddress()
              );

              await assertTokenHasExtension(registry, extension, token);
              assert.strictEqual(
                await token.isOperator(
                  extension.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(await token.isMinter(extension.address), true);

              const validatorContract2 =
                await new ERC1400TokensValidator__factory(
                  controllerSigner
                ).deploy();

              await token
                .connect(signer)
                .setTokenExtension(
                  validatorContract2.address,
                  ERC1400_TOKENS_VALIDATOR,
                  true,
                  true,
                  true
                );

              await assertTokenHasExtension(
                registry,
                validatorContract2,
                token
              );
              assert.strictEqual(
                await token.isOperator(
                  validatorContract2.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(
                await token.isMinter(validatorContract2.address),
                true
              );

              assert.strictEqual(
                await token.isOperator(
                  extension.address,
                  unknownSigner.getAddress()
                ),
                false
              );
              assert.strictEqual(
                await token.isMinter(extension.address),
                false
              );
            });
            it('sets the token extension (without controller rights)', async function () {
              assert.strictEqual(
                await token.owner(),
                await signer.getAddress()
              );

              await assertTokenHasExtension(registry, extension, token);
              assert.strictEqual(
                await token.isOperator(
                  extension.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(await token.isMinter(extension.address), true);

              const validatorContract2 =
                await new ERC1400TokensValidator__factory(
                  controllerSigner
                ).deploy();

              await token
                .connect(signer)
                .setTokenExtension(
                  validatorContract2.address,
                  ERC1400_TOKENS_VALIDATOR,
                  true,
                  true,
                  false
                );

              await assertTokenHasExtension(
                registry,
                validatorContract2,
                token
              );
              assert.strictEqual(
                await token.isOperator(
                  validatorContract2.address,
                  unknownSigner.getAddress()
                ),
                false
              );
              assert.strictEqual(
                await token.isMinter(validatorContract2.address),
                true
              );

              assert.strictEqual(
                await token.isOperator(
                  extension.address,
                  unknownSigner.getAddress()
                ),
                false
              );
              assert.strictEqual(
                await token.isMinter(extension.address),
                false
              );
            });
            it('sets the token extension (without minter rights)', async function () {
              assert.strictEqual(
                await token.owner(),
                await signer.getAddress()
              );

              await assertTokenHasExtension(registry, extension, token);
              assert.strictEqual(
                await token.isOperator(
                  extension.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(await token.isMinter(extension.address), true);

              const validatorContract2 =
                await new ERC1400TokensValidator__factory(
                  controllerSigner
                ).deploy();

              await token
                .connect(signer)
                .setTokenExtension(
                  validatorContract2.address,
                  ERC1400_TOKENS_VALIDATOR,
                  true,
                  false,
                  true
                );

              await assertTokenHasExtension(
                registry,
                validatorContract2,
                token
              );
              assert.strictEqual(
                await token.isOperator(
                  validatorContract2.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(
                await token.isMinter(validatorContract2.address),
                false
              );

              assert.strictEqual(
                await token.isOperator(
                  extension.address,
                  unknownSigner.getAddress()
                ),
                false
              );
              assert.strictEqual(
                await token.isMinter(extension.address),
                false
              );
            });
            it('sets the token extension (while leaving minter and controller rights to the old extension)', async function () {
              assert.strictEqual(
                await token.owner(),
                await signer.getAddress()
              );

              await assertTokenHasExtension(registry, extension, token);
              assert.strictEqual(
                await token.isOperator(
                  extension.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(await token.isMinter(extension.address), true);

              const validatorContract2 =
                await new ERC1400TokensValidator__factory(
                  controllerSigner
                ).deploy();

              await token
                .connect(signer)
                .setTokenExtension(
                  validatorContract2.address,
                  ERC1400_TOKENS_VALIDATOR,
                  false,
                  true,
                  true
                );

              await assertTokenHasExtension(
                registry,
                validatorContract2,
                token
              );
              assert.strictEqual(
                await token.isOperator(
                  validatorContract2.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(
                await token.isMinter(validatorContract2.address),
                true
              );

              assert.strictEqual(
                await token.isOperator(
                  extension.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(await token.isMinter(extension.address), true);
            });
          });
          describe('when the previous validator contract was not a minter', function () {
            it('sets the token extension', async function () {
              const validatorContract2 =
                await new ERC1400TokensValidatorMock__factory(
                  deployerSigner
                ).deploy();

              await token
                .connect(signer)
                .setTokenExtension(
                  validatorContract2.address,
                  ERC1400_TOKENS_VALIDATOR,
                  true,
                  true,
                  true
                );

              await assertTokenHasExtension(
                registry,
                validatorContract2,
                token
              );
              assert.strictEqual(
                await token.isOperator(
                  validatorContract2.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(
                await token.isMinter(validatorContract2.address),
                true
              );

              await validatorContract2
                .connect(signer)
                .renounceMinter(token.address);

              assert.strictEqual(
                await token.isOperator(
                  validatorContract2.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(
                await token.isMinter(validatorContract2.address),
                false
              );

              await token
                .connect(signer)
                .setTokenExtension(
                  extension.address,
                  ERC1400_TOKENS_VALIDATOR,
                  true,
                  true,
                  true
                );

              assert.strictEqual(
                await token.isOperator(
                  validatorContract2.address,
                  unknownSigner.getAddress()
                ),
                false
              );
              assert.strictEqual(
                await token.isMinter(validatorContract2.address),
                false
              );

              await assertTokenHasExtension(registry, extension, token);
              assert.strictEqual(
                await token.isOperator(
                  extension.address,
                  unknownSigner.getAddress()
                ),
                true
              );
              assert.strictEqual(await token.isMinter(extension.address), true);
            });
          });
        });
      });
      describe('when the the validator contract is already a minter', function () {
        it('sets the token extension', async function () {
          const validatorContract2 =
            await new ERC1400TokensValidatorMock__factory(
              deployerSigner
            ).deploy();

          await assertTokenHasExtension(registry, extension, token);

          await token
            .connect(controllerSigner)
            .addMinter(validatorContract2.address);

          assert.strictEqual(
            await token.isOperator(
              validatorContract2.address,
              unknownSigner.getAddress()
            ),
            false
          );
          assert.strictEqual(
            await token.isMinter(validatorContract2.address),
            true
          );

          await token
            .connect(signer)
            .setTokenExtension(
              validatorContract2.address,
              ERC1400_TOKENS_VALIDATOR,
              true,
              true,
              true
            );

          await assertTokenHasExtension(registry, validatorContract2, token);
          assert.strictEqual(
            await token.isOperator(
              validatorContract2.address,
              unknownSigner.getAddress()
            ),
            true
          );
          assert.strictEqual(
            await token.isMinter(validatorContract2.address),
            true
          );
        });
      });
    });
    describe('when the caller is not the contract owner', function () {
      it('reverts', async function () {
        const validatorContract2 = await new ERC1400TokensValidator__factory(
          controllerSigner
        ).deploy();
        await assertRevert(
          token
            .connect(controllerSigner)
            .setTokenExtension(
              validatorContract2.address,
              ERC1400_TOKENS_VALIDATOR,
              true,
              true,
              true
            )
        );
      });
    });
  });

  // CERTIFICATE SIGNER
  describe('certificate signer role', function () {
    describe('addCertificateSigner/removeCertificateSigner', function () {
      beforeEach(async function () {
        await assertTokenHasExtension(registry, extension, token);
      });
      describe('add/renounce a certificate signer', function () {
        describe('when caller is a certificate signer', function () {
          it('adds a certificate signer as owner', async function () {
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addCertificateSigner(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
          it('adds a certificate signer as token controller', async function () {
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addCertificateSigner(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
          it('adds a certificate signer as certificate signer', async function () {
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addCertificateSigner(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );

            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                tokenHolderSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(unknownSigner)
              .addCertificateSigner(
                token.address,
                tokenHolderSigner.getAddress()
              );
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                tokenHolderSigner.getAddress()
              ),
              true
            );
          });
          it('renounces certificate signer', async function () {
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addCertificateSigner(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await extension
              .connect(unknownSigner)
              .renounceCertificateSigner(token.address);
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
        describe('when caller is not a certificate signer', function () {
          it('reverts', async function () {
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await assertRevert(
              extension
                .connect(unknownSigner)
                .addCertificateSigner(token.address, unknownSigner.getAddress())
            );
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
      });
      describe('remove a certificate signer', function () {
        describe('when caller is a certificate signer', function () {
          it('removes a certificate signer as owner', async function () {
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addCertificateSigner(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await extension
              .connect(signer)
              .removeCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              );
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
        describe('when caller is not a certificate signer', function () {
          it('reverts', async function () {
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addCertificateSigner(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await assertRevert(
              extension
                .connect(tokenHolderSigner)
                .removeCertificateSigner(
                  token.address,
                  unknownSigner.getAddress()
                )
            );
            assert.strictEqual(
              await extension.isCertificateSigner(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
        });
      });
    });
    describe('case where certificate is not defined at creation [for coverage]', function () {
      describe('can not call function if not certificate signer', function () {
        it('creates the token', async function () {
          await new ERC1400HoldableCertificateToken__factory(
            controllerSigner
          ).deploy(
            'ERC1400Token',
            'DAU',
            1,
            [controllerSigner.getAddress()],
            partitions,
            extension.address,
            signer.getAddress(),
            ZERO_ADDRESS, // <-- certificate signer is not defined
            CERTIFICATE_VALIDATION_DEFAULT
          );
        });
      });
    });
    describe('onlyCertificateSigner [mock for coverage]', function () {
      let certificateSignerMock: CertificateSignerMock;
      beforeEach(async function () {
        certificateSignerMock = await new CertificateSignerMock__factory(
          signer
        ).deploy(token.address);
      });
      describe('can not call function if not certificate signer', function () {
        it('reverts', async function () {
          assert.strictEqual(
            await certificateSignerMock.isCertificateSigner(
              token.address,
              unknownSigner.getAddress()
            ),
            false
          );
          await assertRevert(
            certificateSignerMock
              .connect(unknownSigner)
              .addCertificateSigner(token.address, unknownSigner.getAddress())
          );
          assert.strictEqual(
            await certificateSignerMock.isCertificateSigner(
              token.address,
              unknownSigner.getAddress()
            ),
            false
          );
          await certificateSignerMock
            .connect(signer)
            .addCertificateSigner(token.address, unknownSigner.getAddress());
          assert.strictEqual(
            await certificateSignerMock.isCertificateSigner(
              token.address,
              unknownSigner.getAddress()
            ),
            true
          );
        });
      });
    });
  });

  // ALLOWLIST ADMIN
  describe('allowlist admin role', function () {
    describe('addAllowlisted/removeAllowlistAdmin', function () {
      beforeEach(async function () {
        await assertTokenHasExtension(registry, extension, token);

        await extension
          .connect(controllerSigner)
          .addAllowlisted(token.address, tokenHolderSigner.getAddress());
        await extension
          .connect(controllerSigner)
          .addAllowlisted(token.address, recipientSigner.getAddress());
        assert.strictEqual(
          await extension.isAllowlisted(
            token.address,
            tokenHolderSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await extension.isAllowlisted(
            token.address,
            recipientSigner.getAddress()
          ),
          true
        );
      });
      describe('add/renounce a allowlist admin', function () {
        describe('when caller is a allowlist admin', function () {
          it('adds a allowlist admin as owner', async function () {
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addAllowlistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
          it('adds a allowlist admin as token controller', async function () {
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addAllowlistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
          it('adds a allowlist admin as allowlist admin', async function () {
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addAllowlistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );

            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                tokenHolderSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(unknownSigner)
              .addAllowlistAdmin(token.address, tokenHolderSigner.getAddress());
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                tokenHolderSigner.getAddress()
              ),
              true
            );
          });
          it('renounces allowlist admin', async function () {
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addAllowlistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await extension
              .connect(unknownSigner)
              .renounceAllowlistAdmin(token.address);
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
        describe('when caller is not a allowlist admin', function () {
          it('reverts', async function () {
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await assertRevert(
              extension
                .connect(unknownSigner)
                .addAllowlistAdmin(token.address, unknownSigner.getAddress())
            );
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
      });
      describe('remove a allowlist admin', function () {
        describe('when caller is a allowlist admin', function () {
          it('removes a allowlist admin as owner', async function () {
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addAllowlistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await extension
              .connect(signer)
              .removeAllowlistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
        describe('when caller is not a allowlist admin', function () {
          it('reverts', async function () {
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addAllowlistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await assertRevert(
              extension
                .connect(tokenHolderSigner)
                .removeAllowlistAdmin(token.address, unknownSigner.getAddress())
            );
            assert.strictEqual(
              await extension.isAllowlistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
        });
      });
    });
    describe('onlyNotAllowlisted [mock for coverage]', function () {
      let allowlistMock: AllowlistMock;
      beforeEach(async function () {
        allowlistMock = await new AllowlistMock__factory(signer).deploy(
          token.address
        );
      });
      describe('can not call function if allowlisted', function () {
        it('reverts', async function () {
          assert.strictEqual(
            await allowlistMock.isAllowlisted(
              token.address,
              unknownSigner.getAddress()
            ),
            false
          );
          await allowlistMock
            .connect(unknownSigner)
            .mockFunction(token.address, true);
          await allowlistMock
            .connect(signer)
            .addAllowlisted(token.address, unknownSigner.getAddress());
          assert.strictEqual(
            await allowlistMock.isAllowlisted(
              token.address,
              unknownSigner.getAddress()
            ),
            true
          );

          await assertRevert(
            allowlistMock
              .connect(unknownSigner)
              .mockFunction(token.address, true)
          );
        });
      });
    });
    describe('onlyAllowlistAdmin [mock for coverage]', function () {
      let allowlistMock: AllowlistMock;
      beforeEach(async function () {
        allowlistMock = await new AllowlistMock__factory(signer).deploy(
          token.address
        );
      });
      describe('can not call function if not allowlist admin', function () {
        it('reverts', async function () {
          assert.strictEqual(
            await allowlistMock.isAllowlistAdmin(
              token.address,
              unknownSigner.getAddress()
            ),
            false
          );
          await assertRevert(
            allowlistMock
              .connect(unknownSigner)
              .addAllowlistAdmin(token.address, unknownSigner.getAddress())
          );
          assert.strictEqual(
            await allowlistMock.isAllowlistAdmin(
              token.address,
              unknownSigner.getAddress()
            ),
            false
          );
          await allowlistMock
            .connect(signer)
            .addAllowlistAdmin(token.address, unknownSigner.getAddress());
          assert.strictEqual(
            await allowlistMock.isAllowlistAdmin(
              token.address,
              unknownSigner.getAddress()
            ),
            true
          );
        });
      });
    });
  });

  // BLOCKLIST ADMIN
  describe('blocklist admin role', function () {
    describe('addBlocklisted/removeBlocklistAdmin', function () {
      beforeEach(async function () {
        await assertTokenHasExtension(registry, extension, token);

        await extension
          .connect(controllerSigner)
          .addBlocklisted(token.address, tokenHolderSigner.getAddress());
        await extension
          .connect(controllerSigner)
          .addBlocklisted(token.address, recipientSigner.getAddress());
        assert.strictEqual(
          await extension.isBlocklisted(
            token.address,
            tokenHolderSigner.getAddress()
          ),
          true
        );
        assert.strictEqual(
          await extension.isBlocklisted(
            token.address,
            recipientSigner.getAddress()
          ),
          true
        );
      });
      describe('add/renounce a blocklist admin', function () {
        describe('when caller is a blocklist admin', function () {
          it('adds a blocklist admin as owner', async function () {
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addBlocklistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
          it('adds a blocklist admin as token controller', async function () {
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addBlocklistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
          it('adds a blocklist admin as blocklist admin', async function () {
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addBlocklistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );

            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                tokenHolderSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(unknownSigner)
              .addBlocklistAdmin(token.address, tokenHolderSigner.getAddress());
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                tokenHolderSigner.getAddress()
              ),
              true
            );
          });
          it('renounces blocklist admin', async function () {
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addBlocklistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await extension
              .connect(unknownSigner)
              .renounceBlocklistAdmin(token.address);
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
        describe('when caller is not a blocklist admin', function () {
          it('reverts', async function () {
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await assertRevert(
              extension
                .connect(unknownSigner)
                .addBlocklistAdmin(token.address, unknownSigner.getAddress())
            );
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
      });
      describe('remove a blocklist admin', function () {
        describe('when caller is a blocklist admin', function () {
          it('removes a blocklist admin as owner', async function () {
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addBlocklistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await extension
              .connect(signer)
              .removeBlocklistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
        describe('when caller is not a blocklist admin', function () {
          it('reverts', async function () {
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addBlocklistAdmin(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await assertRevert(
              extension
                .connect(tokenHolderSigner)
                .removeBlocklistAdmin(token.address, unknownSigner.getAddress())
            );
            assert.strictEqual(
              await extension.isBlocklistAdmin(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
        });
      });
    });
    describe('onlyNotBlocklisted [mock for coverage]', function () {
      let blocklistMock: BlocklistMock;
      beforeEach(async function () {
        blocklistMock = await new BlocklistMock__factory(signer).deploy(
          token.address
        );
      });
      describe('can not call function if blocklisted', function () {
        it('reverts', async function () {
          assert.strictEqual(
            await blocklistMock.isBlocklisted(
              token.address,
              unknownSigner.getAddress()
            ),
            false
          );
          await blocklistMock
            .connect(unknownSigner)
            .mockFunction(token.address, true);
          await blocklistMock
            .connect(signer)
            .addBlocklisted(token.address, unknownSigner.getAddress());
          assert.strictEqual(
            await blocklistMock.isBlocklisted(
              token.address,
              unknownSigner.getAddress()
            ),
            true
          );

          await assertRevert(
            blocklistMock
              .connect(unknownSigner)
              .mockFunction(token.address, true)
          );
        });
      });
    });
    describe('onlyBlocklistAdmin [mock for coverage]', function () {
      let blocklistMock: BlocklistMock;
      beforeEach(async function () {
        blocklistMock = await new BlocklistMock__factory(signer).deploy(
          token.address
        );
      });
      describe('can not call function if not blocklist admin', function () {
        it('reverts', async function () {
          assert.strictEqual(
            await blocklistMock.isBlocklistAdmin(
              token.address,
              unknownSigner.getAddress()
            ),
            false
          );
          await assertRevert(
            blocklistMock
              .connect(unknownSigner)
              .addBlocklistAdmin(token.address, unknownSigner.getAddress())
          );
          assert.strictEqual(
            await blocklistMock.isBlocklistAdmin(
              token.address,
              unknownSigner.getAddress()
            ),
            false
          );
          await blocklistMock
            .connect(signer)
            .addBlocklistAdmin(token.address, unknownSigner.getAddress());
          assert.strictEqual(
            await blocklistMock.isBlocklistAdmin(
              token.address,
              unknownSigner.getAddress()
            ),
            true
          );
        });
      });
    });
  });

  // PAUSER
  describe('pauser role', function () {
    describe('addPauser/removePauser', function () {
      beforeEach(async function () {
        await assertTokenHasExtension(registry, extension, token);
      });
      describe('add/renounce a pauser', function () {
        describe('when caller is a pauser', function () {
          it('adds a pauser as token owner', async function () {
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addPauser(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
          it('adds a pauser as token controller', async function () {
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addPauser(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
          it('adds a pauser as pauser', async function () {
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addPauser(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );

            assert.strictEqual(
              await extension.isPauser(
                token.address,
                tokenHolderSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(unknownSigner)
              .addPauser(token.address, tokenHolderSigner.getAddress());
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                tokenHolderSigner.getAddress()
              ),
              true
            );
          });
          it('renounces pauser', async function () {
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(controllerSigner)
              .addPauser(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await extension
              .connect(unknownSigner)
              .renouncePauser(token.address);
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
        describe('when caller is not a pauser', function () {
          it('reverts', async function () {
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await assertRevert(
              extension
                .connect(unknownSigner)
                .addPauser(token.address, unknownSigner.getAddress())
            );
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
      });
      describe('remove a pauser', function () {
        describe('when caller is a pauser', function () {
          it('adds a pauser as token owner', async function () {
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addPauser(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await extension
              .connect(signer)
              .removePauser(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
          });
        });
        describe('when caller is not a pauser', function () {
          it('reverts', async function () {
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              false
            );
            await extension
              .connect(signer)
              .addPauser(token.address, unknownSigner.getAddress());
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
            await assertRevert(
              extension
                .connect(tokenHolderSigner)
                .removePauser(token.address, unknownSigner.getAddress())
            );
            assert.strictEqual(
              await extension.isPauser(
                token.address,
                unknownSigner.getAddress()
              ),
              true
            );
          });
        });
      });
    });
    describe('onlyPauser [mock for coverage]', function () {
      let pauserMock: PauserMock;
      beforeEach(async function () {
        pauserMock = await new PauserMock__factory(signer).deploy(
          token.address
        );
      });
      describe('can not call function if pauser', function () {
        it('reverts', async function () {
          assert.strictEqual(
            await pauserMock.isPauser(
              token.address,
              unknownSigner.getAddress()
            ),
            false
          );
          await assertRevert(
            pauserMock.connect(unknownSigner).mockFunction(token.address, true)
          );
          await pauserMock
            .connect(signer)
            .addPauser(token.address, unknownSigner.getAddress());
          assert.strictEqual(
            await pauserMock.isPauser(
              token.address,
              unknownSigner.getAddress()
            ),
            true
          );

          await pauserMock
            .connect(unknownSigner)
            .mockFunction(token.address, true);
        });
      });
    });
  });

  // CERTIFICATE ACTIVATED
  describe('setCertificateActivated', function () {
    beforeEach(async function () {
      await assertTokenHasExtension(registry, extension, token);
    });
    describe('when the caller is the contract owner', function () {
      it('activates the certificate', async function () {
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_SALT
        );

        await setCertificateActivated(
          extension,
          token,
          controllerSigner,
          CERTIFICATE_VALIDATION_NONCE
        );

        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_NONCE
        );

        await setCertificateActivated(
          extension,
          token,
          controllerSigner,
          CERTIFICATE_VALIDATION_NONE
        );

        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_NONE
        );
      });
    });
    describe('when the caller is not the contract owner', function () {
      it('reverts', async function () {
        await assertRevert(
          setAllowListActivated(
            extension,
            token,
            unknownSigner,
            CERTIFICATE_VALIDATION_NONCE
          )
        );
      });
    });
  });

  // ALLOWLIST ACTIVATED
  describe('setAllowlistActivated', function () {
    beforeEach(async function () {
      await assertTokenHasExtension(registry, extension, token);
    });
    describe('when the caller is the contract owner', function () {
      it('activates the allowlist', async function () {
        await assertAllowListActivated(extension, token, true);

        await setAllowListActivated(extension, token, controllerSigner, false);

        await assertAllowListActivated(extension, token, false);
      });
    });
    describe('when the caller is not the contract owner', function () {
      it('reverts', async function () {
        await assertRevert(
          setAllowListActivated(extension, token, unknownSigner, false)
        );
      });
    });
  });

  // BLOCKLIST ACTIVATED
  describe('setBlocklistActivated', function () {
    beforeEach(async function () {
      await assertTokenHasExtension(registry, extension, token);
    });
    describe('when the caller is the contract owner', function () {
      it('activates the blocklist', async function () {
        await assertBlockListActivated(extension, token, true);

        await setBlockListActivated(extension, token, controllerSigner, false);

        await assertBlockListActivated(extension, token, false);
      });
    });
    describe('when the caller is not the contract owner', function () {
      it('reverts', async function () {
        await assertRevert(
          setBlockListActivated(extension, token, unknownSigner, false)
        );
      });
    });
  });

  // PARTITION GRANULARITY ACTIVATED
  describe('setPartitionGranularityActivated', function () {
    beforeEach(async function () {
      await assertTokenHasExtension(registry, extension, token);
    });
    describe('when the caller is the contract owner', function () {
      it('activates the partition granularity', async function () {
        await assertGranularityByPartitionActivated(extension, token, true);

        await setGranularityByPartitionActivated(
          extension,
          token,
          controllerSigner,
          false
        );

        await assertGranularityByPartitionActivated(extension, token, false);
      });
    });
    describe('when the caller is not the contract owner', function () {
      it('reverts', async function () {
        await assertRevert(
          setGranularityByPartitionActivated(
            extension,
            token,
            unknownSigner,
            false
          )
        );
      });
    });
  });

  // CANTRANSFER
  describe('canTransferByPartition/canOperatorTransferByPartition', function () {
    const localGranularity = 10;
    const transferAmount = 10 * localGranularity;
    let token2: ERC1400HoldableCertificateToken;
    let senderContract: ERC1400TokensSenderMock;
    let recipientContract: ERC1400TokensRecipientMock;
    before(async function () {
      senderContract = await new ERC1400TokensSenderMock__factory(
        tokenHolderSigner
      ).deploy();
      await registry
        .connect(tokenHolderSigner)
        .setInterfaceImplementer(
          tokenHolderSigner.getAddress(),
          ethers.utils.id(ERC1400_TOKENS_SENDER),
          senderContract.address
        );

      recipientContract = await new ERC1400TokensRecipientMock__factory(
        recipientSigner
      ).deploy();
      await registry
        .connect(recipientSigner)
        .setInterfaceImplementer(
          recipientSigner.getAddress(),
          ethers.utils.id(ERC1400_TOKENS_RECIPIENT),
          recipientContract.address
        );
    });
    after(async function () {
      await registry
        .connect(tokenHolderSigner)
        .setInterfaceImplementer(
          tokenHolderSigner.getAddress(),
          ethers.utils.id(ERC1400_TOKENS_SENDER),
          ZERO_ADDRESS
        );
      await registry
        .connect(recipientSigner)
        .setInterfaceImplementer(
          recipientSigner.getAddress(),
          ethers.utils.id(ERC1400_TOKENS_RECIPIENT),
          ZERO_ADDRESS
        );
    });

    beforeEach(async function () {
      token2 = await new ERC1400HoldableCertificateToken__factory(
        controllerSigner
      ).deploy(
        'ERC1400Token',
        'DAU',
        localGranularity,
        [controllerSigner.getAddress()],
        partitions,
        extension.address,
        signer.getAddress(),
        CERTIFICATE_SIGNER,
        CERTIFICATE_VALIDATION_DEFAULT
      );

      const certificate = await craftCertificate(
        token2.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token2,
        extension,
        clock,
        controllerSigner.getAddress()
      );

      await token2
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );
    });

    describe('when checker has been setup', function () {
      let checkerContract: ERC1400TokensChecker;
      before(async function () {
        checkerContract = await new ERC1400TokensChecker__factory(
          signer
        ).deploy();
      });
      beforeEach(async function () {
        await token2
          .connect(signer)
          .setTokenExtension(
            checkerContract.address,
            ERC1400_TOKENS_CHECKER,
            true,
            true,
            true
          );
      });
      describe('when certificate is valid', function () {
        describe('when the operator is authorized', function () {
          describe('when balance is sufficient', function () {
            describe('when receiver is not the zero address', function () {
              describe('when sender is eligible', function () {
                describe('when validator is ok', function () {
                  describe('when receiver is eligible', function () {
                    describe('when the amount is a multiple of the granularity', function () {
                      it('returns Ethereum status code 51 (canTransferByPartition)', async function () {
                        const certificate = await craftCertificate(
                          token2.interface.encodeFunctionData(
                            'transferByPartition',
                            [
                              partition1,
                              await recipientSigner.getAddress(),
                              transferAmount,
                              ZERO_BYTE
                            ]
                          ),
                          token2,
                          extension,
                          clock, // clock
                          tokenHolderSigner.getAddress()
                        );

                        const response = await token2
                          .connect(tokenHolderSigner)
                          .canTransferByPartition(
                            partition1,
                            recipientSigner.getAddress(),
                            transferAmount,
                            certificate
                          );
                        await assertEscResponse(
                          response,
                          ESC_51,
                          EMPTY_BYTE32,
                          partition1
                        );
                      });
                      it('returns Ethereum status code 51 (canOperatorTransferByPartition)', async function () {
                        const certificate = await craftCertificate(
                          token2.interface.encodeFunctionData(
                            'operatorTransferByPartition',
                            [
                              partition1,
                              await tokenHolderSigner.getAddress(),
                              await recipientSigner.getAddress(),
                              transferAmount,
                              ZERO_BYTE,
                              ZERO_BYTE
                            ]
                          ),
                          token2,
                          extension,
                          clock, // clock
                          tokenHolderSigner.getAddress()
                        );
                        const response = await token2
                          .connect(tokenHolderSigner)
                          .canOperatorTransferByPartition(
                            partition1,
                            tokenHolderSigner.getAddress(),
                            recipientSigner.getAddress(),
                            transferAmount,
                            ZERO_BYTE,
                            certificate
                          );
                        await assertEscResponse(
                          response,
                          ESC_51,
                          EMPTY_BYTE32,
                          partition1
                        );
                      });
                    });
                    describe('when the amount is not a multiple of the granularity', function () {
                      it('returns Ethereum status code 50', async function () {
                        const certificate = await craftCertificate(
                          token2.interface.encodeFunctionData(
                            'transferByPartition',
                            [
                              partition1,
                              await recipientSigner.getAddress(),
                              1, // transferAmount
                              ZERO_BYTE
                            ]
                          ),
                          token2,
                          extension,
                          clock, // clock
                          tokenHolderSigner.getAddress()
                        );
                        const response = await token2
                          .connect(tokenHolderSigner)
                          .canTransferByPartition(
                            partition1,
                            recipientSigner.getAddress(),
                            1, // transferAmount
                            certificate
                          );
                        await assertEscResponse(
                          response,
                          ESC_50,
                          EMPTY_BYTE32,
                          partition1
                        );
                      });
                    });
                  });
                  describe('when receiver is not eligible', function () {
                    it('returns Ethereum status code 57', async function () {
                      await setCertificateActivated(
                        extension,
                        token2,
                        controllerSigner,
                        CERTIFICATE_VALIDATION_NONE
                      );

                      await assertCertificateActivated(
                        extension,
                        token2,
                        CERTIFICATE_VALIDATION_NONE
                      );

                      await extension
                        .connect(controllerSigner)
                        .addAllowlisted(
                          token2.address,
                          tokenHolderSigner.getAddress()
                        );
                      await extension
                        .connect(controllerSigner)
                        .addAllowlisted(
                          token2.address,
                          recipientSigner.getAddress()
                        );

                      const response = await token2
                        .connect(tokenHolderSigner)
                        .canTransferByPartition(
                          partition1,
                          recipientSigner.getAddress(),
                          transferAmount,
                          INVALID_CERTIFICATE_RECIPIENT
                        );
                      await assertEscResponse(
                        response,
                        ESC_57,
                        EMPTY_BYTE32,
                        partition1
                      );
                    });
                  });
                });
                describe('when validator is not ok', function () {
                  it('returns Ethereum status code 54 (canTransferByPartition)', async function () {
                    const holdId = newHoldId();
                    const secretHashPair = newSecretHashPair();
                    const certificate = await craftCertificate(
                      extension.interface.encodeFunctionData('holdFrom', [
                        token2.address,
                        holdId,
                        await tokenHolderSigner.getAddress(),
                        await recipientSigner.getAddress(),
                        await notarySigner.getAddress(),
                        partition1,
                        issuanceAmount,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        ZERO_BYTE
                      ]),
                      token2,
                      extension,
                      clock, // clock
                      controllerSigner.getAddress()
                    );
                    await extension
                      .connect(controllerSigner)
                      .holdFrom(
                        token2.address,
                        holdId,
                        tokenHolderSigner.getAddress(),
                        recipientSigner.getAddress(),
                        notarySigner.getAddress(),
                        partition1,
                        issuanceAmount,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        certificate
                      );

                    const certificate2 = await craftCertificate(
                      token2.interface.encodeFunctionData(
                        'transferByPartition',
                        [
                          partition1,
                          await recipientSigner.getAddress(),
                          transferAmount,
                          ZERO_BYTE
                        ]
                      ),
                      token2,
                      extension,
                      clock, // clock
                      tokenHolderSigner.getAddress()
                    );
                    const response = await token2
                      .connect(tokenHolderSigner)
                      .canTransferByPartition(
                        partition1,
                        recipientSigner.getAddress(),
                        transferAmount,
                        certificate2
                      );
                    await assertEscResponse(
                      response,
                      ESC_54,
                      EMPTY_BYTE32,
                      partition1
                    );
                  });
                });
              });
              describe('when sender is not eligible', function () {
                it('returns Ethereum status code 56', async function () {
                  const response = await token2
                    .connect(tokenHolderSigner)
                    .canTransferByPartition(
                      partition1,
                      recipientSigner.getAddress(),
                      transferAmount,
                      INVALID_CERTIFICATE_SENDER
                    );
                  await assertEscResponse(
                    response,
                    ESC_56,
                    EMPTY_BYTE32,
                    partition1
                  );
                });
              });
            });
            describe('when receiver is the zero address', function () {
              it('returns Ethereum status code 57', async function () {
                const certificate = await craftCertificate(
                  token2.interface.encodeFunctionData('transferByPartition', [
                    partition1,
                    ZERO_ADDRESS,
                    transferAmount,
                    ZERO_BYTE
                  ]),
                  token2,
                  extension,
                  clock, // clock
                  tokenHolderSigner.getAddress()
                );
                const response = await token2
                  .connect(tokenHolderSigner)
                  .canTransferByPartition(
                    partition1,
                    ZERO_ADDRESS,
                    transferAmount,
                    certificate
                  );
                await assertEscResponse(
                  response,
                  ESC_57,
                  EMPTY_BYTE32,
                  partition1
                );
              });
            });
          });
          describe('when balance is not sufficient', function () {
            it('returns Ethereum status code 52 (insuficient global balance)', async function () {
              const certificate = await craftCertificate(
                token2.interface.encodeFunctionData('transferByPartition', [
                  partition1,
                  await recipientSigner.getAddress(),
                  issuanceAmount + localGranularity,
                  ZERO_BYTE
                ]),
                token2,
                extension,
                clock, // clock
                tokenHolderSigner.getAddress()
              );
              const response = await token2
                .connect(tokenHolderSigner)
                .canTransferByPartition(
                  partition1,
                  recipientSigner.getAddress(),
                  issuanceAmount + localGranularity,
                  certificate
                );
              await assertEscResponse(
                response,
                ESC_52,
                EMPTY_BYTE32,
                partition1
              );
            });
            it('returns Ethereum status code 52 (insuficient partition balance)', async function () {
              const issuanceCertificate = await craftCertificate(
                token2.interface.encodeFunctionData('issueByPartition', [
                  partition2,
                  await tokenHolderSigner.getAddress(),
                  localGranularity,
                  ZERO_BYTE
                ]),
                token2,
                extension,
                clock, // clock
                controllerSigner.getAddress()
              );
              await token2
                .connect(controllerSigner)
                .issueByPartition(
                  partition2,
                  tokenHolderSigner.getAddress(),
                  localGranularity,
                  issuanceCertificate
                );
              const certificate = await craftCertificate(
                token2.interface.encodeFunctionData('transferByPartition', [
                  partition2,
                  await recipientSigner.getAddress(),
                  transferAmount,
                  ZERO_BYTE
                ]),
                token2,
                extension,
                clock, // clock
                tokenHolderSigner.getAddress()
              );
              const response = await token2
                .connect(tokenHolderSigner)
                .canTransferByPartition(
                  partition2,
                  recipientSigner.getAddress(),
                  transferAmount,
                  certificate
                );
              await assertEscResponse(
                response,
                ESC_52,
                EMPTY_BYTE32,
                partition2
              );
            });
          });
        });
        describe('when the operator is not authorized', function () {
          it('returns Ethereum status code 58 (canOperatorTransferByPartition)', async function () {
            const certificate = await craftCertificate(
              token2.interface.encodeFunctionData(
                'operatorTransferByPartition',
                [
                  partition1,
                  await operatorSigner.getAddress(),
                  await recipientSigner.getAddress(),
                  transferAmount,
                  ZERO_BYTE,
                  ZERO_BYTE
                ]
              ),
              token2,
              extension,
              clock, // clock
              tokenHolderSigner.getAddress()
            );
            const response = await token2
              .connect(tokenHolderSigner)
              .canOperatorTransferByPartition(
                partition1,
                operatorSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE,
                certificate
              );
            await assertEscResponse(response, ESC_58, EMPTY_BYTE32, partition1);
          });
        });
      });
      describe('when certificate is not valid', function () {
        it('returns Ethereum status code 54 (canTransferByPartition)', async function () {
          const response = await token2
            .connect(tokenHolderSigner)
            .canTransferByPartition(
              partition1,
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE
            );
          await assertEscResponse(response, ESC_54, EMPTY_BYTE32, partition1);
        });
        it('returns Ethereum status code 54 (canOperatorTransferByPartition)', async function () {
          const response = await token2
            .connect(tokenHolderSigner)
            .canOperatorTransferByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE,
              ZERO_BYTE
            );
          await assertEscResponse(response, ESC_54, EMPTY_BYTE32, partition1);
        });
      });
    });
    describe('when checker has not been setup', function () {
      it('returns empty Ethereum status code 00 (canTransferByPartition)', async function () {
        const certificate = await craftCertificate(
          token2.interface.encodeFunctionData('transferByPartition', [
            partition1,
            await recipientSigner.getAddress(),
            transferAmount,
            ZERO_BYTE
          ]),
          token2,
          extension,
          clock, // clock
          tokenHolderSigner.getAddress()
        );
        const response = await token2
          .connect(tokenHolderSigner)
          .canTransferByPartition(
            partition1,
            recipientSigner.getAddress(),
            transferAmount,
            certificate
          );
        await assertEscResponse(response, ESC_00, EMPTY_BYTE32, partition1);
      });
    });
  });

  // CERTIFICATE EXTENSION
  describe('certificate', function () {
    const redeemAmount = 50;
    const transferAmount = 300;
    beforeEach(async function () {
      await assertTokenHasExtension(registry, extension, token);

      await assertCertificateActivated(
        extension,
        token,
        CERTIFICATE_VALIDATION_SALT
      );

      await assertAllowListActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );

      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );
    });
    describe('when certificate is valid', function () {
      describe('ERC1400 functions', function () {
        describe('issue', function () {
          it('issues new tokens when certificate is provided', async function () {
            const certificate = await craftCertificate(
              token.interface.encodeFunctionData('issue', [
                await tokenHolderSigner.getAddress(),
                issuanceAmount,
                ZERO_BYTE
              ]),
              token,
              extension,
              clock, // clock
              controllerSigner.getAddress()
            );
            await token
              .connect(controllerSigner)
              .issue(
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              );
            await assertTotalSupply(token, 2 * issuanceAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              2 * issuanceAmount
            );
          });
          it('fails issuing when when certificate is not provided', async function () {
            await assertRevert(
              token
                .connect(controllerSigner)
                .issue(
                  tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTE
                )
            );
          });
        });
        describe('issueByPartition', function () {
          it('issues new tokens when certificate is provided', async function () {
            const certificate = await craftCertificate(
              token.interface.encodeFunctionData('issueByPartition', [
                partition1,
                await tokenHolderSigner.getAddress(),
                issuanceAmount,
                ZERO_BYTE
              ]),
              token,
              extension,
              clock, // clock
              controllerSigner.getAddress()
            );
            await token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              );
            await assertTotalSupply(token, 2 * issuanceAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              2 * issuanceAmount
            );
          });
          it('issues new tokens when certificate is not provided, but sender is certificate signer', async function () {
            await extension
              .connect(controllerSigner)
              .addCertificateSigner(
                token.address,
                controllerSigner.getAddress()
              );
            await token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                ZERO_BYTE
              );
            await assertTotalSupply(token, 2 * issuanceAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              2 * issuanceAmount
            );
          });
          it('fails issuing when certificate is not provided', async function () {
            await assertRevert(
              token
                .connect(controllerSigner)
                .issueByPartition(
                  partition1,
                  tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTE
                )
            );
          });
          it('fails issuing when certificate is not provided (even if allowlisted)', async function () {
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, tokenHolderSigner.getAddress());
            await assertRevert(
              token
                .connect(controllerSigner)
                .issueByPartition(
                  partition1,
                  tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTE
                )
            );
          });
        });
        describe('redeem', function () {
          it('redeeems the requested amount when certificate is provided', async function () {
            await assertTotalSupply(token, issuanceAmount);
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );

            const certificate = await craftCertificate(
              token.interface.encodeFunctionData('redeem', [
                issuanceAmount,
                ZERO_BYTE
              ]),
              token,
              extension,
              clock, // clock
              tokenHolderSigner.getAddress()
            );
            await token
              .connect(tokenHolderSigner)
              .redeem(issuanceAmount, certificate);

            await assertTotalSupply(token, 0);
            await assertBalance(token, tokenHolderSigner.getAddress(), 0);
          });
          it('fails redeeming when certificate is not provided', async function () {
            await assertTotalSupply(token, issuanceAmount);
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );

            await assertRevert(
              token.connect(tokenHolderSigner).redeem(issuanceAmount, ZERO_BYTE)
            );

            await assertTotalSupply(token, issuanceAmount);
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
          });
        });
        describe('redeemFrom', function () {
          it('redeems the requested amount when certificate is provided', async function () {
            await assertTotalSupply(token, issuanceAmount);
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );

            await token
              .connect(tokenHolderSigner)
              .authorizeOperator(operatorSigner.getAddress());

            const certificate = await craftCertificate(
              token.interface.encodeFunctionData('redeemFrom', [
                await tokenHolderSigner.getAddress(),
                issuanceAmount,
                ZERO_BYTE
              ]),
              token,
              extension,
              clock, // clock
              operatorSigner.getAddress()
            );
            await token
              .connect(operatorSigner)
              .redeemFrom(
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              );

            await assertTotalSupply(token, 0);
            await assertBalance(token, tokenHolderSigner.getAddress(), 0);
          });
          it('fails redeeming the requested amount when certificate is not provided', async function () {
            await assertTotalSupply(token, issuanceAmount);
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );

            await token
              .connect(tokenHolderSigner)
              .authorizeOperator(operatorSigner.getAddress());
            await assertRevert(
              token
                .connect(operatorSigner)
                .redeemFrom(
                  tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTE
                )
            );

            await assertTotalSupply(token, issuanceAmount);
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
          });
        });
        describe('redeemByPartition', function () {
          it('redeems the requested amount when certificate is provided', async function () {
            const certificate = await craftCertificate(
              token.interface.encodeFunctionData('redeemByPartition', [
                partition1,
                redeemAmount,
                ZERO_BYTE
              ]),
              token,
              extension,
              clock, // clock
              tokenHolderSigner.getAddress()
            );
            await token
              .connect(tokenHolderSigner)
              .redeemByPartition(partition1, redeemAmount, certificate);
            await assertTotalSupply(token, issuanceAmount - redeemAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount - redeemAmount
            );
          });
          it('fails redeems when sender when certificate is not provided', async function () {
            await assertRevert(
              token
                .connect(tokenHolderSigner)
                .redeemByPartition(partition1, redeemAmount, ZERO_BYTE)
            );
            await assertTotalSupply(token, issuanceAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount
            );
          });
          it('fails redeems when sender when certificate is not provided (even if allowlisted)', async function () {
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, tokenHolderSigner.getAddress());
            await assertRevert(
              token
                .connect(tokenHolderSigner)
                .redeemByPartition(partition1, redeemAmount, ZERO_BYTE)
            );
            await assertTotalSupply(token, issuanceAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount
            );
          });
        });
        describe('operatorRedeemByPartition', function () {
          it('redeems the requested amount when certificate is provided', async function () {
            await token
              .connect(tokenHolderSigner)
              .authorizeOperatorByPartition(
                partition1,
                operatorSigner.getAddress()
              );

            const certificate = await craftCertificate(
              token.interface.encodeFunctionData('operatorRedeemByPartition', [
                partition1,
                await tokenHolderSigner.getAddress(),
                redeemAmount,
                ZERO_BYTE
              ]),
              token,
              extension,
              clock, // clock
              operatorSigner.getAddress()
            );
            await token
              .connect(operatorSigner)
              .operatorRedeemByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                redeemAmount,
                certificate
              );

            await assertTotalSupply(token, issuanceAmount - redeemAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount - redeemAmount
            );
          });
          it('redeems the requested amount when certificate is provided, but sender is certificate signer', async function () {
            await token
              .connect(tokenHolderSigner)
              .authorizeOperatorByPartition(
                partition1,
                operatorSigner.getAddress()
              );

            await extension
              .connect(controllerSigner)
              .addCertificateSigner(token.address, operatorSigner.getAddress());

            await token
              .connect(operatorSigner)
              .operatorRedeemByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                redeemAmount,
                ZERO_BYTE
              );

            await assertTotalSupply(token, issuanceAmount - redeemAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount - redeemAmount
            );
          });
          it('fails redeeming when certificate is not provided', async function () {
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
                  redeemAmount,
                  ZERO_BYTE
                )
            );

            await assertTotalSupply(token, issuanceAmount);
            await assertBalanceOfSecurityToken(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount
            );
          });
        });
        describe('transferWithData', function () {
          it('transfers the requested amount when certificate is provided', async function () {
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);

            const certificate = await craftCertificate(
              token.interface.encodeFunctionData('transferWithData', [
                await recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE
              ]),
              token,
              extension,
              clock, // clock
              tokenHolderSigner.getAddress()
            );
            await token
              .connect(tokenHolderSigner)
              .transferWithData(
                recipientSigner.getAddress(),
                transferAmount,
                certificate
              );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount - transferAmount
            );
            await assertBalance(
              token,
              recipientSigner.getAddress(),
              transferAmount
            );
          });
          it('fails transferring when certificate is not provided', async function () {
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);

            await assertRevert(
              token
                .connect(tokenHolderSigner)
                .transferWithData(
                  recipientSigner.getAddress(),
                  transferAmount,
                  ZERO_BYTE
                )
            );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);
          });
        });
        describe('transferFromWithData', function () {
          it('transfers the requested amount when certificate is provided', async function () {
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);

            await token
              .connect(tokenHolderSigner)
              .authorizeOperator(operatorSigner.getAddress());

            const certificate = await craftCertificate(
              token.interface.encodeFunctionData('transferFromWithData', [
                await tokenHolderSigner.getAddress(),
                await recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE
              ]),
              token,
              extension,
              clock, // clock
              operatorSigner.getAddress()
            );
            await token
              .connect(operatorSigner)
              .transferFromWithData(
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount,
                certificate
              );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount - transferAmount
            );
            await assertBalance(
              token,
              recipientSigner.getAddress(),
              transferAmount
            );
          });
          it('fails transferring when certificate is not provided', async function () {
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);

            await token
              .connect(tokenHolderSigner)
              .authorizeOperator(operatorSigner.getAddress());

            await assertRevert(
              token
                .connect(operatorSigner)
                .transferFromWithData(
                  tokenHolderSigner.getAddress(),
                  recipientSigner.getAddress(),
                  transferAmount,
                  ZERO_BYTE
                )
            );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);
          });
        });
        describe('transferByPartition', function () {
          it('transfers the requested amount when certificate is provided', async function () {
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

            const certificate = await craftCertificate(
              token.interface.encodeFunctionData('transferByPartition', [
                partition1,
                await recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE
              ]),
              token,
              extension,
              clock, // clock
              tokenHolderSigner.getAddress()
            );
            await token
              .connect(tokenHolderSigner)
              .transferByPartition(
                partition1,
                recipientSigner.getAddress(),
                transferAmount,
                certificate
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
          it('fails transferring when certificate is not provided', async function () {
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
                  ZERO_BYTE
                )
            );

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
          });
          it('fails transferring when certificate is not provided (even when allowlisted)', async function () {
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, tokenHolderSigner.getAddress());
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, recipientSigner.getAddress());
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
                  ZERO_BYTE
                )
            );

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
          });
        });
        describe('operatorTransferByPartition', function () {
          it('transfers the requested amount when certificate is provided', async function () {
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
              ).toNumber(),
              0
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
              ).toNumber(),
              approvedAmount
            );
            const certificate = await craftCertificate(
              token.interface.encodeFunctionData(
                'operatorTransferByPartition',
                [
                  partition1,
                  await tokenHolderSigner.getAddress(),
                  await recipientSigner.getAddress(),
                  transferAmount,
                  ZERO_BYTE,
                  ZERO_BYTE
                ]
              ),
              token,
              extension,
              clock, // clock
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
                certificate
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
              ).toNumber(),
              approvedAmount - transferAmount
            );
          });
          it('transfers the requested amount when certificate is provided, but sender is certificate signer', async function () {
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
              ).toNumber(),
              0
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
              ).toNumber(),
              approvedAmount
            );

            await extension
              .connect(controllerSigner)
              .addCertificateSigner(token.address, operatorSigner.getAddress());
            await token
              .connect(operatorSigner)
              .operatorTransferByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE,
                ZERO_BYTE
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
              ).toNumber(),
              approvedAmount - transferAmount
            );
          });
          it('updates the token partition', async function () {
            await assertBalanceOfByPartition(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount
            );

            const updateAmount = 400;

            const certificate = await craftCertificate(
              token.interface.encodeFunctionData(
                'operatorTransferByPartition',
                [
                  partition1,
                  await tokenHolderSigner.getAddress(),
                  await tokenHolderSigner.getAddress(),
                  updateAmount,
                  changeToPartition2,
                  ZERO_BYTE
                ]
              ),
              token,
              extension,
              clock, // clock
              controllerSigner.getAddress()
            );
            await token
              .connect(controllerSigner)
              .operatorTransferByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                tokenHolderSigner.getAddress(),
                updateAmount,
                changeToPartition2,
                certificate
              );

            await assertBalanceOfByPartition(
              token,
              tokenHolderSigner.getAddress(),
              partition1,
              issuanceAmount - updateAmount
            );
            await assertBalanceOfByPartition(
              token,
              tokenHolderSigner.getAddress(),
              partition2,
              updateAmount
            );
          });
          it('fails transferring when certificate is not provided', async function () {
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
              ).toNumber(),
              0
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
              ).toNumber(),
              approvedAmount
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
                  ZERO_BYTE
                )
            );

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
              ).toNumber(),
              approvedAmount
            );
          });
        });
      });
      describe('ERC20 functions', function () {
        describe('transfer', function () {
          it('transfers the requested amount when sender and recipient are allowlisted', async function () {
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, tokenHolderSigner.getAddress());
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, recipientSigner.getAddress());
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);

            await token
              .connect(tokenHolderSigner)
              .transfer(recipientSigner.getAddress(), transferAmount);

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount - transferAmount
            );
            await assertBalance(
              token,
              recipientSigner.getAddress(),
              transferAmount
            );
          });
          it('fails transferring when sender and is not allowlisted', async function () {
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, recipientSigner.getAddress());
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);

            await assertRevert(
              token
                .connect(tokenHolderSigner)
                .transfer(recipientSigner.getAddress(), transferAmount)
            );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);
          });
          it('fails transferring when recipient and is not allowlisted', async function () {
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, tokenHolderSigner.getAddress());
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);

            await assertRevert(
              token
                .connect(tokenHolderSigner)
                .transfer(recipientSigner.getAddress(), transferAmount)
            );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);
          });
        });
        describe('transferFrom', function () {
          it('transfers the requested amount when sender and recipient are allowlisted', async function () {
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, tokenHolderSigner.getAddress());
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, recipientSigner.getAddress());
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);

            await token
              .connect(tokenHolderSigner)
              .authorizeOperator(operatorSigner.getAddress());
            await token
              .connect(operatorSigner)
              .transferFrom(
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount
              );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount - transferAmount
            );
            await assertBalance(
              token,
              recipientSigner.getAddress(),
              transferAmount
            );
          });
          it('fails transferring when sender is not allowlisted', async function () {
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, recipientSigner.getAddress());
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);

            await token
              .connect(tokenHolderSigner)
              .authorizeOperator(operatorSigner.getAddress());
            await assertRevert(
              token
                .connect(operatorSigner)
                .transferFrom(
                  tokenHolderSigner.getAddress(),
                  recipientSigner.getAddress(),
                  transferAmount
                )
            );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);
          });
          it('fails transferring when recipient is not allowlisted', async function () {
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, tokenHolderSigner.getAddress());
            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);

            await token
              .connect(tokenHolderSigner)
              .authorizeOperator(operatorSigner.getAddress());
            await assertRevert(
              token
                .connect(operatorSigner)
                .transferFrom(
                  tokenHolderSigner.getAddress(),
                  recipientSigner.getAddress(),
                  transferAmount
                )
            );

            await assertBalance(
              token,
              tokenHolderSigner.getAddress(),
              issuanceAmount
            );
            await assertBalance(token, recipientSigner.getAddress(), 0);
          });
        });
      });
    });
    describe('when certificate is not valid', function () {
      describe('salt-based certificate control', function () {
        it('issues new tokens when certificate is valid', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await token
            .connect(controllerSigner)
            .issueByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              certificate
            );
          await assertTotalSupply(token, 2 * issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            2 * issuanceAmount
          );
        });
        it('fails issuing when certificate is not valid (wrong function selector)', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('operatorRedeemByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (wrong parameter)', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount - 1,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (expiration time is past)', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );

          // Wait until certificate expiration
          await advanceTimeAndBlock(
            CERTIFICATE_VALIDITY_PERIOD * SECONDS_IN_AN_HOUR + 100
          );

          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (certificate already used)', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await token
            .connect(controllerSigner)
            .issueByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              certificate
            );
          await assertTotalSupply(token, 2 * issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            2 * issuanceAmount
          );
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (certificate signer has been revoked)', async function () {
          await extension
            .connect(controllerSigner)
            .removeCertificateSigner(token.address, CERTIFICATE_SIGNER);

          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (wrong transaction sender)', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock,
            tokenHolderSigner.getAddress()
          );
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (certificate with v=27) [for coverage]', async function () {
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                SALT_CERTIFICATE_WITH_V_EQUAL_TO_27
              )
          );
        });
        it('fails issuing when certificate is not valid (certificate with v=28) [for coverage]', async function () {
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                SALT_CERTIFICATE_WITH_V_EQUAL_TO_28
              )
          );
        });
        it('fails issuing when certificate is not valid (certificate with v=29) [for coverage]', async function () {
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                SALT_CERTIFICATE_WITH_V_EQUAL_TO_29
              )
          );
        });
      });
      describe('nonce-based certificate control', function () {
        beforeEach(async function () {
          await setCertificateActivated(
            extension,
            token,
            controllerSigner,
            CERTIFICATE_VALIDATION_NONCE
          );

          await assertCertificateActivated(
            extension,
            token,
            CERTIFICATE_VALIDATION_NONCE
          );
        });
        it('issues new tokens when certificate is valid', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );

          await token
            .connect(controllerSigner)
            .issueByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              certificate
            );
          await assertTotalSupply(token, 2 * issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            2 * issuanceAmount
          );
        });
        it('fails issuing when certificate is not valid (wrong function selector)', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('operatorRedeemByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (wrong parameter)', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount - 1,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (expiration time is past)', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );

          // Wait until certificate expiration
          await advanceTimeAndBlock(
            CERTIFICATE_VALIDITY_PERIOD * SECONDS_IN_AN_HOUR + 100
          );

          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (certificate already used)', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await token
            .connect(controllerSigner)
            .issueByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              certificate
            );
          await assertTotalSupply(token, 2 * issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            2 * issuanceAmount
          );
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (certificate signer has been revoked)', async function () {
          await extension
            .connect(controllerSigner)
            .removeCertificateSigner(token.address, CERTIFICATE_SIGNER);

          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (wrong transaction sender)', async function () {
          const certificate = await craftCertificate(
            token.interface.encodeFunctionData('issueByPartition', [
              partition1,
              await tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock,
            tokenHolderSigner.getAddress()
          );
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                certificate
              )
          );
        });
        it('fails issuing when certificate is not valid (certificate with v=27) [for coverage]', async function () {
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                NONCE_CERTIFICATE_WITH_V_EQUAL_TO_27
              )
          );
        });
        it('fails issuing when certificate is not valid (certificate with v=28) [for coverage]', async function () {
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                NONCE_CERTIFICATE_WITH_V_EQUAL_TO_28
              )
          );
        });
        it('fails issuing when certificate is not valid (certificate with v=29) [for coverage]', async function () {
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                NONCE_CERTIFICATE_WITH_V_EQUAL_TO_29
              )
          );
        });
      });
    });
  });

  // ALLOWLIST EXTENSION
  describe('allowlist', function () {
    const redeemAmount = 50;
    const transferAmount = 300;
    beforeEach(async function () {
      await assertTokenHasExtension(registry, extension, token);

      await setCertificateActivated(
        extension,
        token,
        controllerSigner,
        CERTIFICATE_VALIDATION_NONE
      );

      await assertCertificateActivated(
        extension,
        token,
        CERTIFICATE_VALIDATION_NONE
      );

      await assertAllowListActivated(extension, token, true);

      await extension
        .connect(controllerSigner)
        .addAllowlisted(token.address, tokenHolderSigner.getAddress());

      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        );
    });
    describe('ERC1400 functions', function () {
      describe('issue', function () {
        it('issues new tokens when recipient is allowlisted', async function () {
          await token
            .connect(controllerSigner)
            .issue(tokenHolderSigner.getAddress(), issuanceAmount, ZERO_BYTE);
          await assertTotalSupply(token, 2 * issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            2 * issuanceAmount
          );
        });
        it('fails issuing when recipient is not allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, tokenHolderSigner.getAddress());
          await assertRevert(
            token
              .connect(controllerSigner)
              .issue(tokenHolderSigner.getAddress(), issuanceAmount, ZERO_BYTE)
          );
        });
      });
      describe('issueByPartition', function () {
        it('issues new tokens when recipient is allowlisted', async function () {
          await token
            .connect(controllerSigner)
            .issueByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            );
          await assertTotalSupply(token, 2 * issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            2 * issuanceAmount
          );
        });
        it('fails issuing when recipient is not allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, tokenHolderSigner.getAddress());
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                ZERO_BYTE
              )
          );
        });
      });
      describe('redeem', function () {
        it('redeeems the requested amount when sender is allowlisted', async function () {
          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );

          await token
            .connect(tokenHolderSigner)
            .redeem(issuanceAmount, ZERO_BYTE);

          await assertTotalSupply(token, 0);
          await assertBalance(token, tokenHolderSigner.getAddress(), 0);
        });
        it('fails redeeming when sender is not allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, tokenHolderSigner.getAddress());
          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );

          await assertRevert(
            token.connect(tokenHolderSigner).redeem(issuanceAmount, ZERO_BYTE)
          );

          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
        });
      });
      describe('redeemFrom', function () {
        it('redeems the requested amount when sender is allowlisted', async function () {
          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await token
            .connect(operatorSigner)
            .redeemFrom(
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            );

          await assertTotalSupply(token, 0);
          await assertBalance(token, tokenHolderSigner.getAddress(), 0);
        });
        it('fails redeeming the requested amount when sender is not allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, tokenHolderSigner.getAddress());
          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await assertRevert(
            token
              .connect(operatorSigner)
              .redeemFrom(
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                ZERO_BYTE
              )
          );

          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
        });
      });
      describe('redeemByPartition', function () {
        it('redeems the requested amount when sender is allowlisted', async function () {
          await token
            .connect(tokenHolderSigner)
            .redeemByPartition(partition1, redeemAmount, ZERO_BYTE);
          await assertTotalSupply(token, issuanceAmount - redeemAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - redeemAmount
          );
        });
        it('fails redeems when sender is not allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, tokenHolderSigner.getAddress());
          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .redeemByPartition(partition1, redeemAmount, ZERO_BYTE)
          );
          await assertTotalSupply(token, issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
        });
      });
      describe('operatorRedeemByPartition', function () {
        it('redeems the requested amount when sender is allowlisted', async function () {
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
              ZERO_BYTE
            );

          await assertTotalSupply(token, issuanceAmount - redeemAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - redeemAmount
          );
        });
        it('fails redeeming when sender is not allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, tokenHolderSigner.getAddress());
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
                redeemAmount,
                ZERO_BYTE
              )
          );

          await assertTotalSupply(token, issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
        });
      });
      describe('transferWithData', function () {
        it('transfers the requested amount when sender and recipient are allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .transferWithData(
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE
            );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount - transferAmount
          );
          await assertBalance(
            token,
            recipientSigner.getAddress(),
            transferAmount
          );
        });
        it('fails transferring when sender is not allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, tokenHolderSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transferWithData(
                recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE
              )
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
        it('fails transferring when recipient is not allowlisted', async function () {
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transferWithData(
                recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE
              )
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
      });
      describe('transferFromWithData', function () {
        it('transfers the requested amount when sender and recipient are allowliste', async function () {
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await token
            .connect(operatorSigner)
            .transferFromWithData(
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE
            );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount - transferAmount
          );
          await assertBalance(
            token,
            recipientSigner.getAddress(),
            transferAmount
          );
        });
      });
      describe('transferByPartition', function () {
        it('transfers the requested amount when sender and recipient are allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());
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
              ZERO_BYTE
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
        it('fails transferring when sender is not allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, tokenHolderSigner.getAddress());
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
                ZERO_BYTE
              )
          );

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
        });
        it('fails transferring when recipient is not allowlisted', async function () {
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
                ZERO_BYTE
              )
          );

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
        });
      });
      describe('operatorTransferByPartition', function () {
        it('transfers the requested amount when sender and recipient are allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());
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
            ).toNumber(),
            0
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
            ).toNumber(),
            approvedAmount
          );
          await token
            .connect(operatorSigner)
            .operatorTransferByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE,
              ZERO_BYTE
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
            ).toNumber(),
            approvedAmount - transferAmount
          );
        });
      });
    });
    describe('ERC20 functions', function () {
      describe('transfer', function () {
        it('transfers the requested amount when sender and recipient are allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .transfer(recipientSigner.getAddress(), transferAmount);

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount - transferAmount
          );
          await assertBalance(
            token,
            recipientSigner.getAddress(),
            transferAmount
          );
        });
        it('fails transferring when sender and is not allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, tokenHolderSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transfer(recipientSigner.getAddress(), transferAmount)
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
        it('fails transferring when recipient and is not allowlisted', async function () {
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transfer(recipientSigner.getAddress(), transferAmount)
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
      });
      describe('transferFrom', function () {
        it('transfers the requested amount when sender and recipient are allowlisted', async function () {
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await token
            .connect(operatorSigner)
            .transferFrom(
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              transferAmount
            );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount - transferAmount
          );
          await assertBalance(
            token,
            recipientSigner.getAddress(),
            transferAmount
          );
        });
        it('fails transferring when sender is not allowlisted', async function () {
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await assertRevert(
            token
              .connect(operatorSigner)
              .transferFrom(
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount
              )
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
        it('fails transferring when recipient is not allowlisted', async function () {
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await assertRevert(
            token
              .connect(operatorSigner)
              .transferFrom(
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount
              )
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
      });
    });
  });

  // BLOCKLIST EXTENSION
  describe('blocklist', function () {
    const redeemAmount = 50;
    const transferAmount = 300;
    beforeEach(async function () {
      await assertTokenHasExtension(registry, extension, token);

      await setCertificateActivated(
        extension,
        token,
        controllerSigner,
        CERTIFICATE_VALIDATION_NONE
      );

      await assertCertificateActivated(
        extension,
        token,
        CERTIFICATE_VALIDATION_NONE
      );

      await assertBlockListActivated(extension, token, true);

      await extension
        .connect(controllerSigner)
        .addAllowlisted(token.address, tokenHolderSigner.getAddress());

      await extension
        .connect(controllerSigner)
        .addAllowlisted(token.address, recipientSigner.getAddress());

      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        );
    });
    describe('ERC1400 functions', function () {
      describe('issue', function () {
        it('issues new tokens when recipient is not  blocklisted', async function () {
          await token
            .connect(controllerSigner)
            .issue(tokenHolderSigner.getAddress(), issuanceAmount, ZERO_BYTE);
          await assertTotalSupply(token, 2 * issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            2 * issuanceAmount
          );
        });
        it('issues new tokens when recipient is blocklisted, but blocklist is not activated', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
          await setBlockListActivated(
            extension,
            token,
            controllerSigner,
            false
          );

          await assertBlockListActivated(extension, token, false);
          await token
            .connect(controllerSigner)
            .issue(tokenHolderSigner.getAddress(), issuanceAmount, ZERO_BYTE);
          await assertTotalSupply(token, 2 * issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            2 * issuanceAmount
          );
        });
        it('fails issuing when recipient is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
          await extension
            .connect(controllerSigner)
            .removeBlocklisted(token.address, tokenHolderSigner.getAddress()); // for coverage
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
          await assertRevert(
            token
              .connect(controllerSigner)
              .issue(tokenHolderSigner.getAddress(), issuanceAmount, ZERO_BYTE)
          );
        });
      });
      describe('issueByPartition', function () {
        it('issues new tokens when recipient is not blocklisted', async function () {
          await token
            .connect(controllerSigner)
            .issueByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            );
          await assertTotalSupply(token, 2 * issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            2 * issuanceAmount
          );
        });
        it('fails issuing when recipient is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
          await assertRevert(
            token
              .connect(controllerSigner)
              .issueByPartition(
                partition1,
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                ZERO_BYTE
              )
          );
        });
      });
      describe('redeem', function () {
        it('redeeems the requested amount when sender is not blocklisted', async function () {
          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );

          await token
            .connect(tokenHolderSigner)
            .redeem(issuanceAmount, ZERO_BYTE);

          await assertTotalSupply(token, 0);
          await assertBalance(token, tokenHolderSigner.getAddress(), 0);
        });
        it('fails redeeming when sender is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );

          await assertRevert(
            token.connect(tokenHolderSigner).redeem(issuanceAmount, ZERO_BYTE)
          );

          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
        });
      });
      describe('redeemFrom', function () {
        it('redeems the requested amount when sender is not blocklisted', async function () {
          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await token
            .connect(operatorSigner)
            .redeemFrom(
              tokenHolderSigner.getAddress(),
              issuanceAmount,
              ZERO_BYTE
            );

          await assertTotalSupply(token, 0);
          await assertBalance(token, tokenHolderSigner.getAddress(), 0);
        });
        it('fails redeeming the requested amount when sender is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await assertRevert(
            token
              .connect(operatorSigner)
              .redeemFrom(
                tokenHolderSigner.getAddress(),
                issuanceAmount,
                ZERO_BYTE
              )
          );

          await assertTotalSupply(token, issuanceAmount);
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
        });
      });
      describe('redeemByPartition', function () {
        it('redeems the requested amount when sender is not blocklisted', async function () {
          await token
            .connect(tokenHolderSigner)
            .redeemByPartition(partition1, redeemAmount, ZERO_BYTE);
          await assertTotalSupply(token, issuanceAmount - redeemAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - redeemAmount
          );
        });
        it('fails redeems when sender is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .redeemByPartition(partition1, redeemAmount, ZERO_BYTE)
          );
          await assertTotalSupply(token, issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
        });
      });
      describe('operatorRedeemByPartition', function () {
        it('redeems the requested amount when sender is not blocklisted', async function () {
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
              ZERO_BYTE
            );

          await assertTotalSupply(token, issuanceAmount - redeemAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - redeemAmount
          );
        });
        it('fails redeeming when sender is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
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
                redeemAmount,
                ZERO_BYTE
              )
          );

          await assertTotalSupply(token, issuanceAmount);
          await assertBalanceOfSecurityToken(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
        });
      });
      describe('transferWithData', function () {
        it('transfers the requested amount when sender and recipient are not blocklisted', async function () {
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .transferWithData(
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE
            );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount - transferAmount
          );
          await assertBalance(
            token,
            recipientSigner.getAddress(),
            transferAmount
          );
        });
        it('fails transferring when sender is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transferWithData(
                recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE
              )
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
        it('fails transferring when recipient is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, recipientSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transferWithData(
                recipientSigner.getAddress(),
                transferAmount,
                ZERO_BYTE
              )
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
      });
      describe('transferFromWithData', function () {
        it('transfers the requested amount when sender and recipient are not blocklisted', async function () {
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await token
            .connect(operatorSigner)
            .transferFromWithData(
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE
            );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount - transferAmount
          );
          await assertBalance(
            token,
            recipientSigner.getAddress(),
            transferAmount
          );
        });
      });
      describe('transferByPartition', function () {
        it('transfers the requested amount when sender and recipient are not blocklisted', async function () {
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
              ZERO_BYTE
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
        it('fails transferring when sender is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
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
                ZERO_BYTE
              )
          );

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
        });
        it('fails transferring when recipient is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, recipientSigner.getAddress());
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
                ZERO_BYTE
              )
          );

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
        });
      });
      describe('operatorTransferByPartition', function () {
        it('transfers the requested amount when sender and recipient are not blocklisted', async function () {
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
            ).toNumber(),
            0
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
            ).toNumber(),
            approvedAmount
          );
          await token
            .connect(operatorSigner)
            .operatorTransferByPartition(
              partition1,
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE,
              ZERO_BYTE
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
            ).toNumber(),
            approvedAmount - transferAmount
          );
        });
      });
    });
    describe('ERC20 functions', function () {
      describe('transfer', function () {
        it('transfers the requested amount when sender and recipient are not blocklisted', async function () {
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .transfer(recipientSigner.getAddress(), transferAmount);

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount - transferAmount
          );
          await assertBalance(
            token,
            recipientSigner.getAddress(),
            transferAmount
          );
        });
        it('fails transferring when sender and is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transfer(recipientSigner.getAddress(), transferAmount)
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
        it('fails transferring when recipient is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, recipientSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transfer(recipientSigner.getAddress(), transferAmount)
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
      });
      describe('transferFrom', function () {
        it('transfers the requested amount when sender and recipient are not blocklisted', async function () {
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await token
            .connect(operatorSigner)
            .transferFrom(
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              transferAmount
            );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount - transferAmount
          );
          await assertBalance(
            token,
            recipientSigner.getAddress(),
            transferAmount
          );
        });
        it('fails transferring when sender is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, tokenHolderSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await assertRevert(
            token
              .connect(operatorSigner)
              .transferFrom(
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount
              )
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
        it('fails transferring when recipient is blocklisted', async function () {
          await extension
            .connect(controllerSigner)
            .addBlocklisted(token.address, recipientSigner.getAddress());
          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);

          await token
            .connect(tokenHolderSigner)
            .authorizeOperator(operatorSigner.getAddress());
          await assertRevert(
            token
              .connect(operatorSigner)
              .transferFrom(
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                transferAmount
              )
          );

          await assertBalance(
            token,
            tokenHolderSigner.getAddress(),
            issuanceAmount
          );
          await assertBalance(token, recipientSigner.getAddress(), 0);
        });
      });
    });
  });

  // GRANULARITY EXTENSION
  describe('partition granularity', function () {
    const localGranularity = 10;
    const amount = 10 * localGranularity;

    beforeEach(async function () {
      await setCertificateActivated(
        extension,
        token,
        controllerSigner,
        CERTIFICATE_VALIDATION_NONE
      );
      await assertCertificateActivated(
        extension,
        token,
        CERTIFICATE_VALIDATION_NONE
      );

      await setAllowListActivated(extension, token, controllerSigner, false);
      await assertAllowListActivated(extension, token, false);

      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition2,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        );
    });

    describe('when partition granularity is activated', function () {
      beforeEach(async function () {
        await assertGranularityByPartitionActivated(extension, token, true);
      });
      describe('when partition granularity is updated by a token controller', function () {
        it('updates the partition granularity', async function () {
          assert.strictEqual(
            0,
            (
              await extension.granularityByPartition(token.address, partition1)
            ).toNumber()
          );
          assert.strictEqual(
            0,
            (
              await extension.granularityByPartition(token.address, partition2)
            ).toNumber()
          );
          await extension
            .connect(controllerSigner)
            .setGranularityByPartition(
              token.address,
              partition2,
              localGranularity
            );
          assert.strictEqual(
            0,
            (
              await extension.granularityByPartition(token.address, partition1)
            ).toNumber()
          );
          assert.strictEqual(
            localGranularity,
            (
              await extension.granularityByPartition(token.address, partition2)
            ).toNumber()
          );
        });
      });
      describe('when partition granularity is not updated by a token controller', function () {
        it('reverts', async function () {
          await assertRevert(
            extension
              .connect(unknownSigner)
              .setGranularityByPartition(
                token.address,
                partition2,
                localGranularity
              )
          );
        });
      });
      describe('when partition granularity is defined', function () {
        beforeEach(async function () {
          assert.strictEqual(
            0,
            (
              await extension.granularityByPartition(token.address, partition1)
            ).toNumber()
          );
          assert.strictEqual(
            0,
            (
              await extension.granularityByPartition(token.address, partition2)
            ).toNumber()
          );
          await extension
            .connect(controllerSigner)
            .setGranularityByPartition(
              token.address,
              partition2,
              localGranularity
            );
          assert.strictEqual(
            0,
            (
              await extension.granularityByPartition(token.address, partition1)
            ).toNumber()
          );
          assert.strictEqual(
            localGranularity,
            (
              await extension.granularityByPartition(token.address, partition2)
            ).toNumber()
          );
        });
        it('transfers the requested amount when higher than the granularity', async function () {
          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition1,
            0
          );
          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition2,
            issuanceAmount
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition2,
            0
          );

          await token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition1,
              recipientSigner.getAddress(),
              amount,
              ZERO_BYTE
            );
          await token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition2,
              recipientSigner.getAddress(),
              amount,
              ZERO_BYTE
            );

          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - amount
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition1,
            amount
          );
          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition2,
            issuanceAmount - amount
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition2,
            amount
          );
        });
        it('reverts when the requested amount when lower than the granularity', async function () {
          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition1,
            0
          );
          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition2,
            issuanceAmount
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition2,
            0
          );

          await token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition1,
              recipientSigner.getAddress(),
              1,
              ZERO_BYTE
            );
          await assertRevert(
            token
              .connect(tokenHolderSigner)
              .transferByPartition(
                partition2,
                recipientSigner.getAddress(),
                1,
                ZERO_BYTE
              )
          );

          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - 1
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition1,
            1
          );
          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition2,
            issuanceAmount
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition2,
            0
          );
        });
      });
      describe('when partition granularity is not defined', function () {
        beforeEach(async function () {
          assert.strictEqual(
            0,
            (
              await extension.granularityByPartition(token.address, partition1)
            ).toNumber()
          );
          assert.strictEqual(
            0,
            (
              await extension.granularityByPartition(token.address, partition2)
            ).toNumber()
          );
        });
        it('transfers the requested amount', async function () {
          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition1,
            0
          );
          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition2,
            issuanceAmount
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition2,
            0
          );

          await token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition1,
              recipientSigner.getAddress(),
              1,
              ZERO_BYTE
            );
          await token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition2,
              recipientSigner.getAddress(),
              1,
              ZERO_BYTE
            );

          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition1,
            issuanceAmount - 1
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition1,
            1
          );
          await assertBalanceOfByPartition(
            token,
            tokenHolderSigner.getAddress(),
            partition2,
            issuanceAmount - 1
          );
          await assertBalanceOfByPartition(
            token,
            recipientSigner.getAddress(),
            partition2,
            1
          );
        });
      });
    });
    describe('when partition granularity is not activated', function () {
      beforeEach(async function () {
        await setGranularityByPartitionActivated(
          extension,
          token,
          controllerSigner,
          false
        );

        await assertGranularityByPartitionActivated(extension, token, false);
      });
      it('transfers the requested amount', async function () {
        await assertBalanceOfByPartition(
          token,
          tokenHolderSigner.getAddress(),
          partition1,
          issuanceAmount
        );
        await assertBalanceOfByPartition(
          token,
          recipientSigner.getAddress(),
          partition1,
          0
        );
        await assertBalanceOfByPartition(
          token,
          tokenHolderSigner.getAddress(),
          partition2,
          issuanceAmount
        );
        await assertBalanceOfByPartition(
          token,
          recipientSigner.getAddress(),
          partition2,
          0
        );

        await token
          .connect(tokenHolderSigner)
          .transferByPartition(
            partition1,
            recipientSigner.getAddress(),
            1,
            ZERO_BYTE
          );
        await token
          .connect(tokenHolderSigner)
          .transferByPartition(
            partition2,
            recipientSigner.getAddress(),
            1,
            ZERO_BYTE
          );

        await assertBalanceOfByPartition(
          token,
          tokenHolderSigner.getAddress(),
          partition1,
          issuanceAmount - 1
        );
        await assertBalanceOfByPartition(
          token,
          recipientSigner.getAddress(),
          partition1,
          1
        );
        await assertBalanceOfByPartition(
          token,
          tokenHolderSigner.getAddress(),
          partition2,
          issuanceAmount - 1
        );
        await assertBalanceOfByPartition(
          token,
          recipientSigner.getAddress(),
          partition2,
          1
        );
      });
    });
  });

  // TRANSFERFROM
  describe('transferFrom', function () {
    const approvedAmount = 10000;
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );

      await extension
        .connect(controllerSigner)
        .addAllowlisted(token.address, tokenHolderSigner.getAddress());
      await extension
        .connect(controllerSigner)
        .addAllowlisted(token.address, recipientSigner.getAddress());
    });

    describe('when token allowlist is activated', function () {
      beforeEach(async function () {
        await assertAllowListActivated(extension, token, true);
      });
      describe('when the sender and the recipient are allowlisted', function () {
        beforeEach(async function () {
          assert.strictEqual(
            await extension.isAllowlisted(
              token.address,
              tokenHolderSigner.getAddress()
            ),
            true
          );
          assert.strictEqual(
            await extension.isAllowlisted(
              token.address,
              recipientSigner.getAddress()
            ),
            true
          );
        });
        describe('when the operator is approved', function () {
          beforeEach(async function () {
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
                    ).toNumber(),
                    approvedAmount - amount
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
                    BigNumber.from(events![0].args?.value).eq(amount),
                    true
                  );

                  assert.strictEqual(events![1].event, 'TransferByPartition');
                  assert.strictEqual(
                    events![1].args?.fromPartition,
                    partition1
                  );
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
                    BigNumber.from(events![1].args?.value).eq(amount),
                    true
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
              const token2 = await new ERC1400HoldableCertificateToken__factory(
                controllerSigner
              ).deploy(
                'ERC1400Token',
                'DAU',
                2,
                [controllerSigner.getAddress()],
                partitions,
                extension.address,
                signer.getAddress(),
                CERTIFICATE_SIGNER,
                CERTIFICATE_VALIDATION_DEFAULT
              );
              const certificate = await craftCertificate(
                token2.interface.encodeFunctionData('issueByPartition', [
                  partition1,
                  await tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  ZERO_BYTE
                ]),
                token2,
                extension,
                clock, // clock
                controllerSigner.getAddress()
              );
              await token2
                .connect(controllerSigner)
                .issueByPartition(
                  partition1,
                  tokenHolderSigner.getAddress(),
                  issuanceAmount,
                  certificate
                );

              await assertTokenHasExtension(registry, extension, token2);
              await assertAllowListActivated(extension, token2, true);

              await extension
                .connect(controllerSigner)
                .addAllowlisted(token2.address, tokenHolderSigner.getAddress());
              await extension
                .connect(controllerSigner)
                .addAllowlisted(token2.address, recipientSigner.getAddress());

              await token2
                .connect(tokenHolderSigner)
                .approve(operatorSigner.getAddress(), approvedAmount);

              await assertRevert(
                token2
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
      describe('when the sender is not allowlisted', function () {
        const amount = approvedAmount;
        beforeEach(async function () {
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, tokenHolderSigner.getAddress());

          assert.strictEqual(
            await extension.isAllowlisted(
              token.address,
              tokenHolderSigner.getAddress()
            ),
            false
          );
          assert.strictEqual(
            await extension.isAllowlisted(
              token.address,
              recipientSigner.getAddress()
            ),
            true
          );
        });
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
      describe('when the recipient is not allowlisted', function () {
        const amount = approvedAmount;
        beforeEach(async function () {
          await extension
            .connect(controllerSigner)
            .removeAllowlisted(token.address, recipientSigner.getAddress());

          assert.strictEqual(
            await extension.isAllowlisted(
              token.address,
              tokenHolderSigner.getAddress()
            ),
            true
          );
          assert.strictEqual(
            await extension.isAllowlisted(
              token.address,
              recipientSigner.getAddress()
            ),
            false
          );
        });
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
    // describe("when token has no allowlist", function () {});
    describe('when token holds are activated', function () {
      let secretHashPair: { hash: string; secret: string };
      let holdId: string;
      let time: BigNumber;
      beforeEach(async function () {
        await assertHoldsActivated(extension, token, true);

        // Add notary as controller
        const readonlyControllers = await token.controllers();
        const controllers = Object.assign([], readonlyControllers);
        assert.strictEqual(controllers.length, 1);
        controllers.push(await notarySigner.getAddress());
        await token.connect(signer).setControllers(controllers);

        // Create hold in state Ordered
        time = await clock.getTime();
        holdId = newHoldId();
        secretHashPair = newSecretHashPair();
        const certificate2 = await craftCertificate(
          extension.interface.encodeFunctionData('hold', [
            token.address,
            holdId,
            await recipientSigner.getAddress(),
            await notarySigner.getAddress(),
            partition1,
            smallHoldAmount,
            SECONDS_IN_AN_HOUR,
            secretHashPair.hash,
            ZERO_BYTE
          ]),
          token,
          extension,
          clock, // clock
          tokenHolderSigner.getAddress()
        );
        await extension
          .connect(tokenHolderSigner)
          .hold(
            token.address,
            holdId,
            recipientSigner.getAddress(),
            notarySigner.getAddress(),
            partition1,
            smallHoldAmount,
            SECONDS_IN_AN_HOUR,
            secretHashPair.hash,
            certificate2
          );
      });
      describe('when a hold is executed', function () {
        it('executes the hold', async function () {
          const initialBalance = await token.balanceOf(
            tokenHolderSigner.getAddress()
          );
          const initialPartitionBalance = await token.balanceOfByPartition(
            partition1,
            tokenHolderSigner.getAddress()
          );

          const initialBalanceOnHold = await extension.balanceOnHold(
            token.address,
            tokenHolderSigner.getAddress()
          );
          const initialBalanceOnHoldByPartition =
            await extension.balanceOnHoldByPartition(
              token.address,
              partition1,
              tokenHolderSigner.getAddress()
            );

          const initialSpendableBalance = await extension.spendableBalanceOf(
            token.address,
            tokenHolderSigner.getAddress()
          );
          const initialSpendableBalanceByPartition =
            await extension.spendableBalanceOfByPartition(
              token.address,
              partition1,
              tokenHolderSigner.getAddress()
            );

          const initialTotalSupplyOnHold = await extension.totalSupplyOnHold(
            token.address
          );
          const initialTotalSupplyOnHoldByPartition =
            await extension.totalSupplyOnHoldByPartition(
              token.address,
              partition1
            );

          const initialRecipientBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );
          const initialRecipientPartitionBalance =
            await token.balanceOfByPartition(
              partition1,
              recipientSigner.getAddress()
            );

          await token
            .connect(notarySigner)
            .transferFrom(
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              smallHoldAmount
            );

          const finalBalance = await token.balanceOf(
            tokenHolderSigner.getAddress()
          );
          const finalPartitionBalance = await token.balanceOfByPartition(
            partition1,
            tokenHolderSigner.getAddress()
          );

          const finalBalanceOnHold = await extension.balanceOnHold(
            token.address,
            tokenHolderSigner.getAddress()
          );
          const finalBalanceOnHoldByPartition =
            await extension.balanceOnHoldByPartition(
              token.address,
              partition1,
              tokenHolderSigner.getAddress()
            );

          const finalSpendableBalance = await extension.spendableBalanceOf(
            token.address,
            tokenHolderSigner.getAddress()
          );
          const finalSpendableBalanceByPartition =
            await extension.spendableBalanceOfByPartition(
              token.address,
              partition1,
              tokenHolderSigner.getAddress()
            );

          const finalTotalSupplyOnHold = await extension.totalSupplyOnHold(
            token.address
          );
          const finalTotalSupplyOnHoldByPartition =
            await extension.totalSupplyOnHoldByPartition(
              token.address,
              partition1
            );

          const finalRecipientBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );
          const finalRecipientPartitionBalance =
            await token.balanceOfByPartition(
              partition1,
              recipientSigner.getAddress()
            );

          assert.strictEqual(initialBalance.toNumber(), issuanceAmount);
          assert.strictEqual(
            finalBalance.toNumber(),
            issuanceAmount - smallHoldAmount
          );
          assert.strictEqual(
            initialPartitionBalance.toNumber(),
            issuanceAmount
          );
          assert.strictEqual(
            finalPartitionBalance.toNumber(),
            issuanceAmount - smallHoldAmount
          );

          assert.strictEqual(initialBalanceOnHold.toNumber(), smallHoldAmount);
          assert.strictEqual(
            initialBalanceOnHoldByPartition.toNumber(),
            smallHoldAmount
          );
          assert.strictEqual(finalBalanceOnHold.toNumber(), 0);
          assert.strictEqual(finalBalanceOnHoldByPartition.toNumber(), 0);

          assert.strictEqual(
            initialSpendableBalance.toNumber(),
            issuanceAmount - smallHoldAmount
          );
          assert.strictEqual(
            initialSpendableBalanceByPartition.toNumber(),
            issuanceAmount - smallHoldAmount
          );
          assert.strictEqual(
            finalSpendableBalance.toNumber(),
            issuanceAmount - smallHoldAmount
          );
          assert.strictEqual(
            finalSpendableBalanceByPartition.toNumber(),
            issuanceAmount - smallHoldAmount
          );

          assert.strictEqual(
            initialTotalSupplyOnHold.toNumber(),
            smallHoldAmount
          );
          assert.strictEqual(
            initialTotalSupplyOnHoldByPartition.toNumber(),
            smallHoldAmount
          );
          assert.strictEqual(finalTotalSupplyOnHold.toNumber(), 0);
          assert.strictEqual(finalTotalSupplyOnHoldByPartition.toNumber(), 0);

          assert.strictEqual(initialRecipientBalance.toNumber(), 0);
          assert.strictEqual(initialRecipientPartitionBalance.toNumber(), 0);
          assert.strictEqual(finalRecipientBalance.toNumber(), smallHoldAmount);
          assert.strictEqual(
            finalRecipientPartitionBalance.toNumber(),
            smallHoldAmount
          );

          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[0], partition1);
          assert.strictEqual(holdData[1], await tokenHolderSigner.getAddress());
          assert.strictEqual(holdData[2], await recipientSigner.getAddress());
          assert.strictEqual(holdData[3], await notarySigner.getAddress());
          assert.strictEqual(holdData[4].toNumber(), smallHoldAmount);
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );
          assert.strictEqual(holdData[6], secretHashPair.hash);
          assert.strictEqual(holdData[7], EMPTY_BYTE32);
          assert.strictEqual(holdData[8], HOLD_STATUS_EXECUTED);
        });
        /* it("executes 2 holds", async function() {
          // Create a second hold in state Ordered
          time2 = await clock.getTime();
          holdId2 = newHoldId();
          secretHashPair2 = newSecretHashPair();
          const certificate = await craftCertificate(
            extension.interface.encodeFunctionData('hold', [
              token.address,
              holdId2,
              await recipientSigner.getAddress(),
              await notarySigner.getAddress(),
              partition1,
              smallHoldAmount,
              SECONDS_IN_AN_HOUR,
              secretHashPair2.hash,
              ZERO_BYTE,
            ]),
            token,
            extension,
            clock, // clock
            tokenHolder
          )
          await extension.connect(tokenHolderSigner).hold(
            token.address,
            holdId2,
            recipientSigner.getAddress(),
            notarySigner.getAddress(),
            partition1,
            smallHoldAmount,
            SECONDS_IN_AN_HOUR,
            secretHashPair2.hash,
            certificate,
            
          )
  
          const initialPartitionBalance = await token.balanceOfByPartition(partition1, tokenHolderSigner.getAddress())
          const initialRecipientPartitionBalance = await token.balanceOfByPartition(partition1, recipientSigner.getAddress())
  
          await token.connect(notarySigner).transferFrom(
            tokenHolderSigner.getAddress(),
            recipientSigner.getAddress(),
            smallHoldAmount,
            
          )
  
          const intermediatePartitionBalance = await token.balanceOfByPartition(partition1, tokenHolderSigner.getAddress())
          const intermediateRecipientPartitionBalance = await token.balanceOfByPartition(partition1, recipientSigner.getAddress())
  
          assert.strictEqual(initialPartitionBalance, issuanceAmount)
          assert.strictEqual(intermediatePartitionBalance, issuanceAmount-smallHoldAmount)
  
          assert.strictEqual(initialRecipientPartitionBalance, 0)
          assert.strictEqual(intermediateRecipientPartitionBalance, smallHoldAmount)
  
          holdData2 = await extension.retrieveHoldData(token.address, holdId2);
          assert.strictEqual(holdData2[0], partition1);
          assert.strictEqual(holdData2[1], tokenHolderSigner.getAddress());
          assert.strictEqual(holdData2[2], recipientSigner.getAddress());
          assert.strictEqual(holdData2[3], notarySigner.getAddress());
          assert.strictEqual((holdData2[4]).toNumber(), smallHoldAmount);
          assert.strictEqual((holdData2[5]).toNumber() >=  parseInt(time2)+SECONDS_IN_AN_HOUR, true);
          assert.strictEqual((holdData2[5]).toNumber() <  parseInt(time2)+SECONDS_IN_AN_HOUR+100, true);
          assert.strictEqual(holdData2[6], secretHashPair2.hash);
          assert.strictEqual(holdData2[7], EMPTY_BYTE32);
          assert.strictEqual((holdData2[8]).toNumber(), HOLD_STATUS_EXECUTED);
  
          await token.connect(notarySigner).transferFrom(
            tokenHolderSigner.getAddress(),
            recipientSigner.getAddress(),
            smallHoldAmount,
            
          )
  
          const finalPartitionBalance = await token.balanceOfByPartition(partition1, tokenHolderSigner.getAddress())
          const finalRecipientPartitionBalance = await token.balanceOfByPartition(partition1, recipientSigner.getAddress())
  
          assert.strictEqual(initialPartitionBalance, issuanceAmount)
          assert.strictEqual(finalPartitionBalance, issuanceAmount-2*smallHoldAmount)
  
          assert.strictEqual(initialRecipientPartitionBalance, 0)
          assert.strictEqual(finalRecipientPartitionBalance, 2*smallHoldAmount)
  
const holdData = await extension.retrieveHoldData(token.address, holdId);
          assert.strictEqual(holdData[0], partition1);
          assert.strictEqual(holdData[1], tokenHolderSigner.getAddress());
          assert.strictEqual(holdData[2], await recipientSigner.getAddress());
          assert.strictEqual(holdData[3], await notarySigner.getAddress());
          assert.strictEqual((holdData[4]).toNumber(), smallHoldAmount);
          assert.strictEqual((holdData[5]).toNumber() >=  time.toNumber()+SECONDS_IN_AN_HOUR, true);
          assert.strictEqual((holdData[5]).toNumber() <  time.toNumber()+SECONDS_IN_AN_HOUR+100, true);
          assert.strictEqual(holdData[6], secretHashPair.hash);
          assert.strictEqual(holdData[7], EMPTY_BYTE32);
          assert.strictEqual((holdData[8]).toNumber(), HOLD_STATUS_EXECUTED);
        }); */
      });
      // describe("when a hold is not executed", function () {
      //   beforeEach(async function () {
      //     validatorContract2 = await new ERC1400TokensValidator__factory(controllerSigner).deploy();

      //     await setNewExtensionForToken(
      //       validatorContract2,
      //       token,
      //       signer.getAddress(),
      //     );

      //     await setAllowListActivated(
      //       validatorContract2,
      //       token,
      //       controllerSigner.getAddress(),
      //       false
      //     )
      //     await assertAllowListActivated(
      //       validatorContract2,
      //       token,
      //       false
      //     );

      //     await token.connect(notarySigner).transferFrom(
      //       tokenHolderSigner.getAddress(),
      //       recipientSigner.getAddress(),
      //       smallHoldAmount,
      //
      //     );
      //     await setNewExtensionForToken(
      //       extension,
      //       token,
      //       signer.getAddress(),
      //     );
      //   });
      //   it("reverts", async function() {
      //     await assertRevert(
      //       token.connect(notarySigner).transferFrom(
      //         tokenHolderSigner.getAddress(),
      //         recipientSigner.getAddress(),
      //         smallHoldAmount,
      //
      //       )
      //     )
      //   });

      // });
    });
  });

  // PAUSABLE EXTENSION
  describe('pausable', function () {
    const transferAmount = 300;

    beforeEach(async function () {
      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );

      await setAllowListActivated(extension, token, controllerSigner, false);
      await assertAllowListActivated(extension, token, false);

      await setCertificateActivated(
        extension,
        token,
        controllerSigner,
        CERTIFICATE_VALIDATION_NONE
      );
      await assertCertificateActivated(
        extension,
        token,
        CERTIFICATE_VALIDATION_NONE
      );
    });

    describe('when contract is not paused', function () {
      beforeEach(async function () {
        await assertTokenHasExtension(registry, extension, token);

        assert.strictEqual(false, await extension.paused(token.address));
      });
      it('transfers the requested amount', async function () {
        await token
          .connect(tokenHolderSigner)
          .transfer(recipientSigner.getAddress(), transferAmount);
        await assertBalance(
          token,
          tokenHolderSigner.getAddress(),
          issuanceAmount - transferAmount
        );
        await assertBalance(
          token,
          recipientSigner.getAddress(),
          transferAmount
        );
      });
      it('transfers the requested amount (after pause/unpause)', async function () {
        assert.strictEqual(false, await extension.paused(token.address));
        await extension.connect(controllerSigner).pause(token.address);
        await assertRevert(
          extension.connect(controllerSigner).pause(token.address)
        );

        assert.strictEqual(true, await extension.paused(token.address));
        await extension.connect(controllerSigner).unpause(token.address);
        await assertRevert(
          extension.connect(controllerSigner).unpause(token.address)
        );

        assert.strictEqual(false, await extension.paused(token.address));
        await token
          .connect(tokenHolderSigner)
          .transfer(recipientSigner.getAddress(), transferAmount);
        await assertBalance(
          token,
          tokenHolderSigner.getAddress(),
          issuanceAmount - transferAmount
        );
        await assertBalance(
          token,
          recipientSigner.getAddress(),
          transferAmount
        );
      });
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
            ZERO_BYTE
          );
        await token
          .connect(tokenHolderSigner)
          .transferByPartition(
            partition1,
            recipientSigner.getAddress(),
            0,
            ZERO_BYTE
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
    describe('when contract is paused', function () {
      beforeEach(async function () {
        await assertTokenHasExtension(registry, extension, token);

        await extension.connect(controllerSigner).pause(token.address);

        assert.strictEqual(true, await extension.paused(token.address));
      });
      it('reverts', async function () {
        await assertBalance(
          token,
          tokenHolderSigner.getAddress(),
          issuanceAmount
        );
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .transfer(recipientSigner.getAddress(), issuanceAmount)
        );
      });
      it('reverts', async function () {
        await assertBalanceOfSecurityToken(
          token,
          tokenHolderSigner.getAddress(),
          partition1,
          issuanceAmount
        );

        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition1,
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE
            )
        );
      });
    });
  });

  // IS HOLDS ACTIVATED
  describe('isHoldsActivated', function () {
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      await setCertificateActivated(
        extension,
        token,
        controllerSigner,
        CERTIFICATE_VALIDATION_NONE
      );
      await assertCertificateActivated(
        extension,
        token,
        CERTIFICATE_VALIDATION_NONE
      );

      await setAllowListActivated(extension, token, controllerSigner, false);
      await assertAllowListActivated(extension, token, false);

      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        );
    });

    describe('when holds are activated by the owner', function () {
      it('activates the holds', async function () {
        await setHoldsActivated(extension, token, controllerSigner, false);
        await assertHoldsActivated(extension, token, false);
        await setHoldsActivated(extension, token, controllerSigner, true);
        await assertHoldsActivated(extension, token, true);

        const holdId = newHoldId();
        const secretHashPair = newSecretHashPair();
        await extension
          .connect(controllerSigner)
          .holdFrom(
            token.address,
            holdId,
            tokenHolderSigner.getAddress(),
            recipientSigner.getAddress(),
            notarySigner.getAddress(),
            partition1,
            holdAmount,
            SECONDS_IN_AN_HOUR,
            secretHashPair.hash,
            ZERO_BYTE
          );
        const spendableBalance = (
          await extension.spendableBalanceOf(
            token.address,
            tokenHolderSigner.getAddress()
          )
        ).toNumber();

        const transferAmount = spendableBalance + 1;
        await assertRevert(
          token
            .connect(tokenHolderSigner)
            .transferByPartition(
              partition1,
              recipientSigner.getAddress(),
              transferAmount,
              ZERO_BYTE
            )
        );

        await setHoldsActivated(extension, token, controllerSigner, false);
        await assertHoldsActivated(extension, token, false);

        assert.strictEqual(
          (
            await token.balanceOfByPartition(
              partition1,
              recipientSigner.getAddress()
            )
          ).toNumber(),
          0
        );
        await token
          .connect(tokenHolderSigner)
          .transferByPartition(
            partition1,
            recipientSigner.getAddress(),
            transferAmount,
            ZERO_BYTE
          );
        assert.strictEqual(
          (
            await token.balanceOfByPartition(
              partition1,
              recipientSigner.getAddress()
            )
          ).toNumber(),
          transferAmount
        );
      });
    });
    describe('when holds are not activated by the owner', function () {
      it('reverts', async function () {
        await setHoldsActivated(extension, token, controllerSigner, false);
        await assertHoldsActivated(extension, token, false);

        await assertRevert(
          setHoldsActivated(extension, token, tokenHolderSigner, true)
        );
      });
    });
  });

  // HOLD
  describe('hold', function () {
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );
    });

    describe('when certificate is activated', function () {
      beforeEach(async function () {
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_SALT
        );
      });
      describe('when certificate is valid', function () {
        describe('when hold recipient is not the zero address', function () {
          describe('when hold value is greater than 0', function () {
            describe("when hold ID doesn't already exist", function () {
              describe('when notary is not the zero address', function () {
                describe('when hold value is not greater than spendable balance', function () {
                  it('creates a hold', async function () {
                    const initialBalance = await token.balanceOf(
                      tokenHolderSigner.getAddress()
                    );
                    const initialPartitionBalance =
                      await token.balanceOfByPartition(
                        partition1,
                        tokenHolderSigner.getAddress()
                      );

                    const initialBalanceOnHold = await extension.balanceOnHold(
                      token.address,
                      tokenHolderSigner.getAddress()
                    );
                    const initialBalanceOnHoldByPartition =
                      await extension.balanceOnHoldByPartition(
                        token.address,
                        partition1,
                        tokenHolderSigner.getAddress()
                      );

                    const initialSpendableBalance =
                      await extension.spendableBalanceOf(
                        token.address,
                        tokenHolderSigner.getAddress()
                      );
                    const initialSpendableBalanceByPartition =
                      await extension.spendableBalanceOfByPartition(
                        token.address,
                        partition1,
                        tokenHolderSigner.getAddress()
                      );

                    const initialTotalSupplyOnHold =
                      await extension.totalSupplyOnHold(token.address);
                    const initialTotalSupplyOnHoldByPartition =
                      await extension.totalSupplyOnHoldByPartition(
                        token.address,
                        partition1
                      );

                    const time = await clock.getTime();
                    const holdId = newHoldId();
                    const secretHashPair = newSecretHashPair();
                    const certificate = await craftCertificate(
                      extension.interface.encodeFunctionData('hold', [
                        token.address,
                        holdId,
                        await recipientSigner.getAddress(),
                        await notarySigner.getAddress(),
                        partition1,
                        holdAmount,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        ZERO_BYTE
                      ]),
                      token,
                      extension,
                      clock, // clock
                      tokenHolderSigner.getAddress()
                    );
                    await extension
                      .connect(tokenHolderSigner)
                      .hold(
                        token.address,
                        holdId,
                        recipientSigner.getAddress(),
                        notarySigner.getAddress(),
                        partition1,
                        holdAmount,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        certificate
                      );

                    const finalBalance = await token.balanceOf(
                      tokenHolderSigner.getAddress()
                    );
                    const finalPartitionBalance =
                      await token.balanceOfByPartition(
                        partition1,
                        tokenHolderSigner.getAddress()
                      );

                    const finalBalanceOnHold = await extension.balanceOnHold(
                      token.address,
                      tokenHolderSigner.getAddress()
                    );
                    const finalBalanceOnHoldByPartition =
                      await extension.balanceOnHoldByPartition(
                        token.address,
                        partition1,
                        tokenHolderSigner.getAddress()
                      );

                    const finalSpendableBalance =
                      await extension.spendableBalanceOf(
                        token.address,
                        tokenHolderSigner.getAddress()
                      );
                    const finalSpendableBalanceByPartition =
                      await extension.spendableBalanceOfByPartition(
                        token.address,
                        partition1,
                        tokenHolderSigner.getAddress()
                      );

                    const finalTotalSupplyOnHold =
                      await extension.totalSupplyOnHold(token.address);
                    const finalTotalSupplyOnHoldByPartition =
                      await extension.totalSupplyOnHoldByPartition(
                        token.address,
                        partition1
                      );

                    assert.strictEqual(
                      initialBalance.toNumber(),
                      issuanceAmount
                    );
                    assert.strictEqual(finalBalance.toNumber(), issuanceAmount);
                    assert.strictEqual(
                      initialPartitionBalance.toNumber(),
                      issuanceAmount
                    );
                    assert.strictEqual(
                      finalPartitionBalance.toNumber(),
                      issuanceAmount
                    );

                    assert.strictEqual(initialBalanceOnHold.toNumber(), 0);
                    assert.strictEqual(
                      initialBalanceOnHoldByPartition.toNumber(),
                      0
                    );
                    assert.strictEqual(
                      finalBalanceOnHold.toNumber(),
                      holdAmount
                    );
                    assert.strictEqual(
                      finalBalanceOnHoldByPartition.toNumber(),
                      holdAmount
                    );

                    assert.strictEqual(
                      initialSpendableBalance.toNumber(),
                      issuanceAmount
                    );
                    assert.strictEqual(
                      initialSpendableBalanceByPartition.toNumber(),
                      issuanceAmount
                    );
                    assert.strictEqual(
                      finalSpendableBalance.toNumber(),
                      issuanceAmount - holdAmount
                    );
                    assert.strictEqual(
                      finalSpendableBalanceByPartition.toNumber(),
                      issuanceAmount - holdAmount
                    );

                    assert.strictEqual(initialTotalSupplyOnHold.toNumber(), 0);
                    assert.strictEqual(
                      initialTotalSupplyOnHoldByPartition.toNumber(),
                      0
                    );
                    assert.strictEqual(
                      finalTotalSupplyOnHold.toNumber(),
                      holdAmount
                    );
                    assert.strictEqual(
                      finalTotalSupplyOnHoldByPartition.toNumber(),
                      holdAmount
                    );

                    const holdData = await extension.retrieveHoldData(
                      token.address,
                      holdId
                    );
                    assert.strictEqual(holdData[0], partition1);
                    assert.strictEqual(
                      holdData[1],
                      await tokenHolderSigner.getAddress()
                    );
                    assert.strictEqual(
                      holdData[2],
                      await recipientSigner.getAddress()
                    );
                    assert.strictEqual(
                      holdData[3],
                      await notarySigner.getAddress()
                    );
                    assert.strictEqual(holdData[4].toNumber(), holdAmount);
                    assert.strictEqual(
                      holdData[5].toNumber() >=
                        time.toNumber() + SECONDS_IN_AN_HOUR,
                      true
                    );
                    assert.strictEqual(
                      holdData[5].toNumber() <
                        time.toNumber() + SECONDS_IN_AN_HOUR + 100,
                      true
                    );
                    assert.strictEqual(holdData[6], secretHashPair.hash);
                    assert.strictEqual(holdData[7], EMPTY_BYTE32);
                    assert.strictEqual(holdData[8], HOLD_STATUS_ORDERED);
                  });
                  it('can transfer less than spendable balance', async function () {
                    const holdId = newHoldId();
                    const secretHashPair = newSecretHashPair();
                    const certificate = await craftCertificate(
                      extension.interface.encodeFunctionData('hold', [
                        token.address,
                        holdId,
                        await recipientSigner.getAddress(),
                        await notarySigner.getAddress(),
                        partition1,
                        holdAmount,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        ZERO_BYTE
                      ]),
                      token,
                      extension,
                      clock, // clock
                      tokenHolderSigner.getAddress()
                    );
                    await extension
                      .connect(tokenHolderSigner)
                      .hold(
                        token.address,
                        holdId,
                        recipientSigner.getAddress(),
                        notarySigner.getAddress(),
                        partition1,
                        holdAmount,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        certificate
                      );
                    const initialSpendableBalance = (
                      await extension.spendableBalanceOf(
                        token.address,
                        tokenHolderSigner.getAddress()
                      )
                    ).toNumber();
                    const initialSenderBalance = (
                      await token.balanceOfByPartition(
                        partition1,
                        tokenHolderSigner.getAddress()
                      )
                    ).toNumber();
                    const initialRecipientBalance = (
                      await token.balanceOfByPartition(
                        partition1,
                        recipientSigner.getAddress()
                      )
                    ).toNumber();

                    const transferAmount = initialSpendableBalance;
                    const certificate2 = await craftCertificate(
                      token.interface.encodeFunctionData(
                        'transferByPartition',
                        [
                          partition1,
                          await recipientSigner.getAddress(),
                          transferAmount,
                          ZERO_BYTE
                        ]
                      ),
                      token,
                      extension,
                      clock, // clock
                      tokenHolderSigner.getAddress()
                    );
                    await token
                      .connect(tokenHolderSigner)
                      .transferByPartition(
                        partition1,
                        recipientSigner.getAddress(),
                        transferAmount,
                        certificate2
                      );

                    const finalSpendableBalance = (
                      await extension.spendableBalanceOf(
                        token.address,
                        tokenHolderSigner.getAddress()
                      )
                    ).toNumber();
                    const finalSenderBalance = (
                      await token.balanceOfByPartition(
                        partition1,
                        tokenHolderSigner.getAddress()
                      )
                    ).toNumber();
                    const finalRecipientBalance = (
                      await token.balanceOfByPartition(
                        partition1,
                        recipientSigner.getAddress()
                      )
                    ).toNumber();

                    assert.strictEqual(
                      initialSpendableBalance,
                      issuanceAmount - holdAmount
                    );
                    assert.strictEqual(finalSpendableBalance, 0);

                    assert.strictEqual(initialSenderBalance, issuanceAmount);
                    assert.strictEqual(initialRecipientBalance, 0);

                    assert.strictEqual(
                      finalSenderBalance,
                      issuanceAmount - transferAmount
                    );
                    assert.strictEqual(finalRecipientBalance, transferAmount);
                  });
                  it('can not transfer more than spendable balance', async function () {
                    const holdId = newHoldId();
                    const secretHashPair = newSecretHashPair();
                    const certificate = await craftCertificate(
                      extension.interface.encodeFunctionData('hold', [
                        token.address,
                        holdId,
                        await recipientSigner.getAddress(),
                        await notarySigner.getAddress(),
                        partition1,
                        holdAmount,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        ZERO_BYTE
                      ]),
                      token,
                      extension,
                      clock, // clock
                      tokenHolderSigner.getAddress()
                    );
                    await extension
                      .connect(tokenHolderSigner)
                      .hold(
                        token.address,
                        holdId,
                        recipientSigner.getAddress(),
                        notarySigner.getAddress(),
                        partition1,
                        holdAmount,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        certificate
                      );
                    const initialSpendableBalance =
                      await extension.spendableBalanceOf(
                        token.address,
                        tokenHolderSigner.getAddress()
                      );

                    const transferAmount =
                      initialSpendableBalance.toNumber() + 1;
                    const certificate2 = await craftCertificate(
                      token.interface.encodeFunctionData(
                        'transferByPartition',
                        [
                          partition1,
                          await recipientSigner.getAddress(),
                          transferAmount,
                          ZERO_BYTE
                        ]
                      ),
                      token,
                      extension,
                      clock, // clock
                      tokenHolderSigner.getAddress()
                    );
                    await assertRevert(
                      token
                        .connect(tokenHolderSigner)
                        .transferByPartition(
                          partition1,
                          recipientSigner.getAddress(),
                          transferAmount,
                          certificate2
                        )
                    );
                  });
                  it('emits an event', async function () {
                    const holdId = newHoldId();
                    const secretHashPair = newSecretHashPair();
                    const time = await clock.getTime();
                    const certificate = await craftCertificate(
                      extension.interface.encodeFunctionData('hold', [
                        token.address,
                        holdId,
                        await recipientSigner.getAddress(),
                        await notarySigner.getAddress(),
                        partition1,
                        holdAmount,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        ZERO_BYTE
                      ]),
                      token,
                      extension,
                      clock, // clock
                      tokenHolderSigner.getAddress()
                    );
                    const { events } = await extension
                      .connect(tokenHolderSigner)
                      .hold(
                        token.address,
                        holdId,
                        recipientSigner.getAddress(),
                        notarySigner.getAddress(),
                        partition1,
                        holdAmount,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        certificate
                      )
                      .then((res) => res.wait());

                    assert.strictEqual(events![0].event, 'HoldCreated');
                    assert.strictEqual(events![0].args?.token, token.address);
                    assert.strictEqual(events![0].args?.holdId, holdId);
                    assert.strictEqual(events![0].args?.partition, partition1);
                    assert.strictEqual(
                      events![0].args?.sender,
                      await tokenHolderSigner.getAddress()
                    );
                    assert.strictEqual(
                      events![0].args?.recipient,
                      await recipientSigner.getAddress()
                    );
                    assert.strictEqual(
                      events![0].args?.notary,
                      await notarySigner.getAddress()
                    );
                    assert.strictEqual(
                      BigNumber.from(events![0].args?.value).eq(holdAmount),
                      true
                    );
                    assert.strictEqual(
                      parseInt(events![0].args?.expiration) >=
                        time.toNumber() + SECONDS_IN_AN_HOUR,
                      true
                    );
                    assert.strictEqual(
                      parseInt(events![0].args?.expiration) <
                        time.toNumber() + SECONDS_IN_AN_HOUR + 100,
                      true
                    );
                    assert.strictEqual(
                      events![0].args?.secretHash,
                      secretHashPair.hash
                    );
                  });
                });
                describe('when hold value is greater than spendable balance', function () {
                  it('reverts', async function () {
                    const initialSpendableBalance = (
                      await extension.spendableBalanceOf(
                        token.address,
                        tokenHolderSigner.getAddress()
                      )
                    ).toNumber();

                    const holdId = newHoldId();
                    const secretHashPair = newSecretHashPair();
                    const certificate = await craftCertificate(
                      extension.interface.encodeFunctionData('hold', [
                        token.address,
                        holdId,
                        await recipientSigner.getAddress(),
                        await notarySigner.getAddress(),
                        partition1,
                        initialSpendableBalance + 1,
                        SECONDS_IN_AN_HOUR,
                        secretHashPair.hash,
                        ZERO_BYTE
                      ]),
                      token,
                      extension,
                      clock, // clock
                      tokenHolderSigner.getAddress()
                    );
                    await assertRevert(
                      extension
                        .connect(tokenHolderSigner)
                        .hold(
                          token.address,
                          holdId,
                          recipientSigner.getAddress(),
                          notarySigner.getAddress(),
                          partition1,
                          initialSpendableBalance + 1,
                          SECONDS_IN_AN_HOUR,
                          secretHashPair.hash,
                          certificate
                        )
                    );
                  });
                });
              });
              describe('when notary is the zero address', function () {
                it('reverts', async function () {
                  const initialBalance = await token.balanceOf(
                    tokenHolderSigner.getAddress()
                  );
                  const initialPartitionBalance =
                    await token.balanceOfByPartition(
                      partition1,
                      tokenHolderSigner.getAddress()
                    );

                  const initialBalanceOnHold = await extension.balanceOnHold(
                    token.address,
                    tokenHolderSigner.getAddress()
                  );
                  const initialBalanceOnHoldByPartition =
                    await extension.balanceOnHoldByPartition(
                      token.address,
                      partition1,
                      tokenHolderSigner.getAddress()
                    );

                  const initialSpendableBalance =
                    await extension.spendableBalanceOf(
                      token.address,
                      tokenHolderSigner.getAddress()
                    );
                  const initialSpendableBalanceByPartition =
                    await extension.spendableBalanceOfByPartition(
                      token.address,
                      partition1,
                      tokenHolderSigner.getAddress()
                    );

                  const initialTotalSupplyOnHold =
                    await extension.totalSupplyOnHold(token.address);
                  const initialTotalSupplyOnHoldByPartition =
                    await extension.totalSupplyOnHoldByPartition(
                      token.address,
                      partition1
                    );

                  const time = await clock.getTime();
                  const holdId = newHoldId();
                  const secretHashPair = newSecretHashPair();
                  const certificate = await craftCertificate(
                    extension.interface.encodeFunctionData('hold', [
                      token.address,
                      holdId,
                      await recipientSigner.getAddress(),
                      ZERO_ADDRESS,
                      partition1,
                      holdAmount,
                      SECONDS_IN_AN_HOUR,
                      secretHashPair.hash,
                      ZERO_BYTE
                    ]),
                    token,
                    extension,
                    clock, // clock
                    tokenHolderSigner.getAddress()
                  );
                  await extension
                    .connect(tokenHolderSigner)
                    .hold(
                      token.address,
                      holdId,
                      recipientSigner.getAddress(),
                      ZERO_ADDRESS,
                      partition1,
                      holdAmount,
                      SECONDS_IN_AN_HOUR,
                      secretHashPair.hash,
                      certificate
                    );

                  const finalBalance = await token.balanceOf(
                    tokenHolderSigner.getAddress()
                  );
                  const finalPartitionBalance =
                    await token.balanceOfByPartition(
                      partition1,
                      tokenHolderSigner.getAddress()
                    );

                  const finalBalanceOnHold = await extension.balanceOnHold(
                    token.address,
                    tokenHolderSigner.getAddress()
                  );
                  const finalBalanceOnHoldByPartition =
                    await extension.balanceOnHoldByPartition(
                      token.address,
                      partition1,
                      tokenHolderSigner.getAddress()
                    );

                  const finalSpendableBalance =
                    await extension.spendableBalanceOf(
                      token.address,
                      tokenHolderSigner.getAddress()
                    );
                  const finalSpendableBalanceByPartition =
                    await extension.spendableBalanceOfByPartition(
                      token.address,
                      partition1,
                      tokenHolderSigner.getAddress()
                    );

                  const finalTotalSupplyOnHold =
                    await extension.totalSupplyOnHold(token.address);
                  const finalTotalSupplyOnHoldByPartition =
                    await extension.totalSupplyOnHoldByPartition(
                      token.address,
                      partition1
                    );

                  assert.strictEqual(initialBalance.toNumber(), issuanceAmount);
                  assert.strictEqual(finalBalance.toNumber(), issuanceAmount);
                  assert.strictEqual(
                    initialPartitionBalance.toNumber(),
                    issuanceAmount
                  );
                  assert.strictEqual(
                    finalPartitionBalance.toNumber(),
                    issuanceAmount
                  );

                  assert.strictEqual(initialBalanceOnHold.toNumber(), 0);
                  assert.strictEqual(
                    initialBalanceOnHoldByPartition.toNumber(),
                    0
                  );
                  assert.strictEqual(finalBalanceOnHold.toNumber(), holdAmount);
                  assert.strictEqual(
                    finalBalanceOnHoldByPartition.toNumber(),
                    holdAmount
                  );

                  assert.strictEqual(
                    initialSpendableBalance.toNumber(),
                    issuanceAmount
                  );
                  assert.strictEqual(
                    initialSpendableBalanceByPartition.toNumber(),
                    issuanceAmount
                  );
                  assert.strictEqual(
                    finalSpendableBalance.toNumber(),
                    issuanceAmount - holdAmount
                  );
                  assert.strictEqual(
                    finalSpendableBalanceByPartition.toNumber(),
                    issuanceAmount - holdAmount
                  );

                  assert.strictEqual(initialTotalSupplyOnHold.toNumber(), 0);
                  assert.strictEqual(
                    initialTotalSupplyOnHoldByPartition.toNumber(),
                    0
                  );
                  assert.strictEqual(
                    finalTotalSupplyOnHold.toNumber(),
                    holdAmount
                  );
                  assert.strictEqual(
                    finalTotalSupplyOnHoldByPartition.toNumber(),
                    holdAmount
                  );

                  const holdData = await extension.retrieveHoldData(
                    token.address,
                    holdId
                  );
                  assert.strictEqual(holdData[0], partition1);
                  assert.strictEqual(
                    holdData[1],
                    await tokenHolderSigner.getAddress()
                  );
                  assert.strictEqual(
                    holdData[2],
                    await recipientSigner.getAddress()
                  );
                  assert.strictEqual(holdData[3], ZERO_ADDRESS);
                  assert.strictEqual(holdData[4].toNumber(), holdAmount);
                  assert.strictEqual(
                    holdData[5].toNumber() >=
                      time.toNumber() + SECONDS_IN_AN_HOUR,
                    true
                  );
                  assert.strictEqual(
                    holdData[5].toNumber() <
                      time.toNumber() + SECONDS_IN_AN_HOUR + 100,
                    true
                  );
                  assert.strictEqual(holdData[6], secretHashPair.hash);
                  assert.strictEqual(holdData[7], EMPTY_BYTE32);
                  assert.strictEqual(holdData[8], HOLD_STATUS_ORDERED);
                });
              });
            });
            describe('when hold ID already exists', function () {
              it('reverts', async function () {
                const holdId = newHoldId();
                const secretHashPair = newSecretHashPair();
                const certificate = await craftCertificate(
                  extension.interface.encodeFunctionData('hold', [
                    token.address,
                    holdId,
                    await recipientSigner.getAddress(),
                    await notarySigner.getAddress(),
                    partition1,
                    1,
                    SECONDS_IN_AN_HOUR,
                    secretHashPair.hash,
                    ZERO_BYTE
                  ]),
                  token,
                  extension,
                  clock, // clock
                  tokenHolderSigner.getAddress()
                );
                await extension
                  .connect(tokenHolderSigner)
                  .hold(
                    token.address,
                    holdId,
                    recipientSigner.getAddress(),
                    notarySigner.getAddress(),
                    partition1,
                    1,
                    SECONDS_IN_AN_HOUR,
                    secretHashPair.hash,
                    certificate
                  );

                const certificate2 = await craftCertificate(
                  extension.interface.encodeFunctionData('hold', [
                    token.address,
                    holdId,
                    await recipientSigner.getAddress(),
                    await notarySigner.getAddress(),
                    partition1,
                    1,
                    SECONDS_IN_AN_HOUR,
                    secretHashPair.hash,
                    ZERO_BYTE
                  ]),
                  token,
                  extension,
                  clock, // clock
                  tokenHolderSigner.getAddress()
                );
                await assertRevert(
                  extension
                    .connect(tokenHolderSigner)
                    .hold(
                      token.address,
                      holdId,
                      recipientSigner.getAddress(),
                      notarySigner.getAddress(),
                      partition1,
                      1,
                      SECONDS_IN_AN_HOUR,
                      secretHashPair.hash,
                      certificate2
                    )
                );
              });
            });
          });
          describe('when hold value is not greater than 0', function () {
            it('reverts', async function () {
              const holdId = newHoldId();
              const secretHashPair = newSecretHashPair();
              const certificate = await craftCertificate(
                extension.interface.encodeFunctionData('hold', [
                  token.address,
                  holdId,
                  await recipientSigner.getAddress(),
                  await notarySigner.getAddress(),
                  partition1,
                  0,
                  SECONDS_IN_AN_HOUR,
                  secretHashPair.hash,
                  ZERO_BYTE
                ]),
                token,
                extension,
                clock, // clock
                tokenHolderSigner.getAddress()
              );
              await assertRevert(
                extension
                  .connect(tokenHolderSigner)
                  .hold(
                    token.address,
                    holdId,
                    recipientSigner.getAddress(),
                    notarySigner.getAddress(),
                    partition1,
                    0,
                    SECONDS_IN_AN_HOUR,
                    secretHashPair.hash,
                    certificate
                  )
              );
            });
          });
        });
        describe('when hold recipient is the zero address', function () {
          it('reverts', async function () {
            const holdId = newHoldId();
            const secretHashPair = newSecretHashPair();
            const certificate = await craftCertificate(
              extension.interface.encodeFunctionData('hold', [
                token.address,
                holdId,
                ZERO_ADDRESS,
                await notarySigner.getAddress(),
                partition1,
                holdAmount,
                SECONDS_IN_AN_HOUR,
                secretHashPair.hash,
                ZERO_BYTE
              ]),
              token,
              extension,
              clock, // clock
              tokenHolderSigner.getAddress()
            );
            await assertRevert(
              extension
                .connect(tokenHolderSigner)
                .hold(
                  token.address,
                  holdId,
                  ZERO_ADDRESS,
                  notarySigner.getAddress(),
                  partition1,
                  holdAmount,
                  SECONDS_IN_AN_HOUR,
                  secretHashPair.hash,
                  certificate
                )
            );
          });
        });
      });
      describe('when certificate is not valid', function () {
        it('creates a hold', async function () {
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await assertRevert(
            extension
              .connect(tokenHolderSigner)
              .hold(
                token.address,
                holdId,
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                SECONDS_IN_AN_HOUR,
                secretHashPair.hash,
                ZERO_BYTE
              )
          );
        });
      });
    });
    describe('when certificate is not activated', function () {
      beforeEach(async function () {
        await setCertificateActivated(
          extension,
          token,
          controllerSigner,
          CERTIFICATE_VALIDATION_NONE
        );

        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_NONE
        );
      });
      it('creates a hold', async function () {
        const initialBalance = await token.balanceOf(
          tokenHolderSigner.getAddress()
        );
        const initialPartitionBalance = await token.balanceOfByPartition(
          partition1,
          tokenHolderSigner.getAddress()
        );

        const initialBalanceOnHold = await extension.balanceOnHold(
          token.address,
          tokenHolderSigner.getAddress()
        );
        const initialBalanceOnHoldByPartition =
          await extension.balanceOnHoldByPartition(
            token.address,
            partition1,
            tokenHolderSigner.getAddress()
          );

        const initialSpendableBalance = await extension.spendableBalanceOf(
          token.address,
          tokenHolderSigner.getAddress()
        );
        const initialSpendableBalanceByPartition =
          await extension.spendableBalanceOfByPartition(
            token.address,
            partition1,
            tokenHolderSigner.getAddress()
          );

        const initialTotalSupplyOnHold = await extension.totalSupplyOnHold(
          token.address
        );
        const initialTotalSupplyOnHoldByPartition =
          await extension.totalSupplyOnHoldByPartition(
            token.address,
            partition1
          );

        const time = await clock.getTime();
        const holdId = newHoldId();
        const secretHashPair = newSecretHashPair();
        await extension
          .connect(tokenHolderSigner)
          .hold(
            token.address,
            holdId,
            recipientSigner.getAddress(),
            notarySigner.getAddress(),
            partition1,
            holdAmount,
            SECONDS_IN_AN_HOUR,
            secretHashPair.hash,
            ZERO_BYTE
          );

        const finalBalance = await token.balanceOf(
          tokenHolderSigner.getAddress()
        );
        const finalPartitionBalance = await token.balanceOfByPartition(
          partition1,
          tokenHolderSigner.getAddress()
        );

        const finalBalanceOnHold = await extension.balanceOnHold(
          token.address,
          tokenHolderSigner.getAddress()
        );
        const finalBalanceOnHoldByPartition =
          await extension.balanceOnHoldByPartition(
            token.address,
            partition1,
            tokenHolderSigner.getAddress()
          );

        const finalSpendableBalance = await extension.spendableBalanceOf(
          token.address,
          tokenHolderSigner.getAddress()
        );
        const finalSpendableBalanceByPartition =
          await extension.spendableBalanceOfByPartition(
            token.address,
            partition1,
            tokenHolderSigner.getAddress()
          );

        const finalTotalSupplyOnHold = await extension.totalSupplyOnHold(
          token.address
        );
        const finalTotalSupplyOnHoldByPartition =
          await extension.totalSupplyOnHoldByPartition(
            token.address,
            partition1
          );

        assert.strictEqual(initialBalance.toNumber(), issuanceAmount);
        assert.strictEqual(finalBalance.toNumber(), issuanceAmount);
        assert.strictEqual(initialPartitionBalance.toNumber(), issuanceAmount);
        assert.strictEqual(finalPartitionBalance.toNumber(), issuanceAmount);

        assert.strictEqual(initialBalanceOnHold.toNumber(), 0);
        assert.strictEqual(initialBalanceOnHoldByPartition.toNumber(), 0);
        assert.strictEqual(finalBalanceOnHold.toNumber(), holdAmount);
        assert.strictEqual(
          finalBalanceOnHoldByPartition.toNumber(),
          holdAmount
        );

        assert.strictEqual(initialSpendableBalance.toNumber(), issuanceAmount);
        assert.strictEqual(
          initialSpendableBalanceByPartition.toNumber(),
          issuanceAmount
        );
        assert.strictEqual(
          finalSpendableBalance.toNumber(),
          issuanceAmount - holdAmount
        );
        assert.strictEqual(
          finalSpendableBalanceByPartition.toNumber(),
          issuanceAmount - holdAmount
        );

        assert.strictEqual(initialTotalSupplyOnHold.toNumber(), 0);
        assert.strictEqual(initialTotalSupplyOnHoldByPartition.toNumber(), 0);
        assert.strictEqual(finalTotalSupplyOnHold.toNumber(), holdAmount);
        assert.strictEqual(
          finalTotalSupplyOnHoldByPartition.toNumber(),
          holdAmount
        );

        const holdData = await extension.retrieveHoldData(
          token.address,
          holdId
        );
        assert.strictEqual(holdData[0], partition1);
        assert.strictEqual(holdData[1], await tokenHolderSigner.getAddress());
        assert.strictEqual(holdData[2], await recipientSigner.getAddress());
        assert.strictEqual(holdData[3], await notarySigner.getAddress());
        assert.strictEqual(holdData[4].toNumber(), holdAmount);
        assert.strictEqual(
          holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR,
          true
        );
        assert.strictEqual(
          holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
          true
        );
        assert.strictEqual(holdData[6], secretHashPair.hash);
        assert.strictEqual(holdData[7], EMPTY_BYTE32);
        assert.strictEqual(holdData[8], HOLD_STATUS_ORDERED);
      });
    });
  });

  // HOLD WITH EXPIRATION DATE
  describe('holdWithExpirationDate', function () {
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );
    });

    describe('when certificate is not activated', function () {
      beforeEach(async function () {
        await setCertificateActivated(
          extension,
          token,
          controllerSigner,
          CERTIFICATE_VALIDATION_NONE
        );
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_NONE
        );
      });
      describe('when expiration date is valid', function () {
        describe('when expiration date is in the future', function () {
          it('creates a hold', async function () {
            const time = (await clock.getTime()).toNumber();
            const holdId = newHoldId();
            const secretHashPair = newSecretHashPair();
            const { events } = await extension
              .connect(tokenHolderSigner)
              .holdWithExpirationDate(
                token.address,
                holdId,
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                time + SECONDS_IN_AN_HOUR,
                secretHashPair.hash,
                ZERO_BYTE
              )
              .then((res) => res.wait());
            assert.strictEqual(
              parseInt(events![0].args?.expiration),
              time + SECONDS_IN_AN_HOUR
            );
            const holdData = await extension.retrieveHoldData(
              token.address,
              holdId
            );
            assert.strictEqual(
              holdData[5].toNumber(),
              time + SECONDS_IN_AN_HOUR
            );
          });
        });
        describe('when there is no expiration date', function () {
          it('creates a hold', async function () {
            const holdId = newHoldId();
            const secretHashPair = newSecretHashPair();
            const { events } = await extension
              .connect(tokenHolderSigner)
              .holdWithExpirationDate(
                token.address,
                holdId,
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                0,
                secretHashPair.hash,
                ZERO_BYTE
              )
              .then((res) => res.wait());
            assert.strictEqual(parseInt(events![0].args?.expiration), 0);
            const holdData = await extension.retrieveHoldData(
              token.address,
              holdId
            );
            assert.strictEqual(holdData[5].toNumber(), 0);
          });
        });
      });
      describe('when expiration date is not valid', function () {
        it('reverts', async function () {
          const time = (await clock.getTime()).toNumber();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await assertRevert(
            extension
              .connect(tokenHolderSigner)
              .holdWithExpirationDate(
                token.address,
                holdId,
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                time - 1,
                secretHashPair.hash,
                ZERO_BYTE
              )
          );
        });
      });
    });
    describe('when certificate is activated', function () {
      beforeEach(async function () {
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_SALT
        );
      });
      describe('when certificate is valid', function () {
        it('creates a hold', async function () {
          const time = (await clock.getTime()).toNumber();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          const certificate = await craftCertificate(
            extension.interface.encodeFunctionData('holdWithExpirationDate', [
              token.address,
              holdId,
              await recipientSigner.getAddress(),
              await notarySigner.getAddress(),
              partition1,
              holdAmount,
              time + SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock,
            tokenHolderSigner.getAddress()
          );
          const { events } = await extension
            .connect(tokenHolderSigner)
            .holdWithExpirationDate(
              token.address,
              holdId,
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              time + SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              certificate
            )
            .then((res) => res.wait());
          assert.strictEqual(
            parseInt(events![0].args?.expiration),
            time + SECONDS_IN_AN_HOUR
          );
          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[5].toNumber(), time + SECONDS_IN_AN_HOUR);
        });
      });
      describe('when certificate is not valid', function () {
        it('reverts', async function () {
          const time = (await clock.getTime()).toNumber();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await assertRevert(
            extension
              .connect(tokenHolderSigner)
              .holdWithExpirationDate(
                token.address,
                holdId,
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                time + SECONDS_IN_AN_HOUR,
                secretHashPair.hash,
                ZERO_BYTE
              )
          );
        });
      });
    });
  });

  // HOLD FROM
  describe('holdFrom', function () {
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );
    });

    describe('when certificate is not activated', function () {
      beforeEach(async function () {
        await setCertificateActivated(
          extension,
          token,
          controllerSigner,
          CERTIFICATE_VALIDATION_NONE
        );
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_NONE
        );
      });
      describe('when hold sender is not the zero address', function () {
        describe('when hold is created by a token controller', function () {
          it('creates a hold', async function () {
            assert.strictEqual(
              (
                await extension.balanceOnHoldByPartition(
                  token.address,
                  partition1,
                  tokenHolderSigner.getAddress()
                )
              ).toNumber(),
              0
            );
            const holdId = newHoldId();
            const secretHashPair = newSecretHashPair();
            await extension
              .connect(controllerSigner)
              .holdFrom(
                token.address,
                holdId,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                SECONDS_IN_AN_HOUR,
                secretHashPair.hash,
                ZERO_BYTE
              );
            assert.strictEqual(
              (
                await extension.balanceOnHoldByPartition(
                  token.address,
                  partition1,
                  tokenHolderSigner.getAddress()
                )
              ).toNumber(),
              holdAmount
            );
          });
        });
        describe('when hold is not created by a token controller', function () {
          it('reverts', async function () {
            const holdId = newHoldId();
            const secretHashPair = newSecretHashPair();
            await assertRevert(
              extension
                .connect(recipientSigner)
                .holdFrom(
                  token.address,
                  holdId,
                  tokenHolderSigner.getAddress(),
                  recipientSigner.getAddress(),
                  notarySigner.getAddress(),
                  partition1,
                  holdAmount,
                  SECONDS_IN_AN_HOUR,
                  secretHashPair.hash,
                  ZERO_BYTE
                )
            );
          });
        });
      });
      describe('when hold sender is the zero address', function () {
        it('reverts', async function () {
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await assertRevert(
            extension
              .connect(controllerSigner)
              .holdFrom(
                token.address,
                holdId,
                ZERO_ADDRESS,
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                SECONDS_IN_AN_HOUR,
                secretHashPair.hash,
                ZERO_BYTE
              )
          );
        });
      });
    });
    describe('when certificate is activated', function () {
      beforeEach(async function () {
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_SALT
        );
      });
      describe('when certificate is valid', function () {
        it('creates a hold', async function () {
          assert.strictEqual(
            (
              await extension.balanceOnHoldByPartition(
                token.address,
                partition1,
                tokenHolderSigner.getAddress()
              )
            ).toNumber(),
            0
          );
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          const certificate = await craftCertificate(
            extension.interface.encodeFunctionData('holdFrom', [
              token.address,
              holdId,
              await tokenHolderSigner.getAddress(),
              await recipientSigner.getAddress(),
              await notarySigner.getAddress(),
              partition1,
              holdAmount,
              SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await extension
            .connect(controllerSigner)
            .holdFrom(
              token.address,
              holdId,
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              certificate
            );
          assert.strictEqual(
            (
              await extension.balanceOnHoldByPartition(
                token.address,
                partition1,
                tokenHolderSigner.getAddress()
              )
            ).toNumber(),
            holdAmount
          );
        });
      });
      describe('when certificate is not valid', function () {
        it('creates a hold', async function () {
          assert.strictEqual(
            (
              await extension.balanceOnHoldByPartition(
                token.address,
                partition1,
                tokenHolderSigner.getAddress()
              )
            ).toNumber(),
            0
          );
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await assertRevert(
            extension
              .connect(controllerSigner)
              .holdFrom(
                token.address,
                holdId,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                SECONDS_IN_AN_HOUR,
                secretHashPair.hash,
                ZERO_BYTE
              )
          );
        });
      });
    });
  });

  // HOLD FROM WITH EXPIRATION DATE
  describe('holdFromWithExpirationDate', function () {
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );
    });

    describe('when certificate is not activated', function () {
      beforeEach(async function () {
        await setCertificateActivated(
          extension,
          token,
          controllerSigner,
          CERTIFICATE_VALIDATION_NONE
        );
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_NONE
        );
      });
      describe('when expiration date is valid', function () {
        describe('when expiration date is in the future', function () {
          describe('when hold sender is not the zero address', function () {
            describe('when hold is created by a token controller', function () {
              it('creates a hold', async function () {
                assert.strictEqual(
                  (
                    await extension.balanceOnHoldByPartition(
                      token.address,
                      partition1,
                      tokenHolderSigner.getAddress()
                    )
                  ).toNumber(),
                  0
                );
                const time = (await clock.getTime()).toNumber();
                const holdId = newHoldId();
                const secretHashPair = newSecretHashPair();
                const { events } = await extension
                  .connect(controllerSigner)
                  .holdFromWithExpirationDate(
                    token.address,
                    holdId,
                    tokenHolderSigner.getAddress(),
                    recipientSigner.getAddress(),
                    notarySigner.getAddress(),
                    partition1,
                    holdAmount,
                    time + SECONDS_IN_AN_HOUR,
                    secretHashPair.hash,
                    ZERO_BYTE
                  )
                  .then((res) => res.wait());
                assert.strictEqual(
                  (
                    await extension.balanceOnHoldByPartition(
                      token.address,
                      partition1,
                      tokenHolderSigner.getAddress()
                    )
                  ).toNumber(),
                  holdAmount
                );

                assert.strictEqual(
                  events![0].args?.expiration.toNumber(),
                  time + SECONDS_IN_AN_HOUR
                );
                const holdData = await extension.retrieveHoldData(
                  token.address,
                  holdId
                );
                assert.strictEqual(
                  holdData[5].toNumber(),
                  time + SECONDS_IN_AN_HOUR
                );
              });
            });
            describe('when hold is not created by a token controller', function () {
              it('reverts', async function () {
                const time = (await clock.getTime()).toNumber();
                const holdId = newHoldId();
                const secretHashPair = newSecretHashPair();
                await assertRevert(
                  extension
                    .connect(recipientSigner)
                    .holdFromWithExpirationDate(
                      token.address,
                      holdId,
                      tokenHolderSigner.getAddress(),
                      recipientSigner.getAddress(),
                      notarySigner.getAddress(),
                      partition1,
                      holdAmount,
                      time + SECONDS_IN_AN_HOUR,
                      secretHashPair.hash,
                      ZERO_BYTE
                    )
                );
              });
            });
          });
          describe('when hold sender is the zero address', function () {
            it('reverts', async function () {
              const time = (await clock.getTime()).toNumber();
              const holdId = newHoldId();
              const secretHashPair = newSecretHashPair();
              await assertRevert(
                extension
                  .connect(controllerSigner)
                  .holdFromWithExpirationDate(
                    token.address,
                    holdId,
                    ZERO_ADDRESS,
                    recipientSigner.getAddress(),
                    notarySigner.getAddress(),
                    partition1,
                    holdAmount,
                    time + SECONDS_IN_AN_HOUR,
                    secretHashPair.hash,
                    ZERO_BYTE
                  )
              );
            });
          });
        });
        describe('when there is no expiration date', function () {
          it('creates a hold', async function () {
            assert.strictEqual(
              (
                await extension.balanceOnHoldByPartition(
                  token.address,
                  partition1,
                  tokenHolderSigner.getAddress()
                )
              ).toNumber(),
              0
            );
            // const time = (await clock.getTime()).toNumber();
            const holdId = newHoldId();
            const secretHashPair = newSecretHashPair();
            const { events } = await extension
              .connect(controllerSigner)
              .holdFromWithExpirationDate(
                token.address,
                holdId,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                0,
                secretHashPair.hash,
                ZERO_BYTE
              )
              .then((res) => res.wait());
            assert.strictEqual(
              (
                await extension.balanceOnHoldByPartition(
                  token.address,
                  partition1,
                  tokenHolderSigner.getAddress()
                )
              ).toNumber(),
              holdAmount
            );

            assert.strictEqual(events![0].args?.expiration.toNumber(), 0);
            const holdData = await extension.retrieveHoldData(
              token.address,
              holdId
            );
            assert.strictEqual(holdData[5].toNumber(), 0);
          });
        });
      });
      describe('when expiration date is not valid', function () {
        it('reverts', async function () {
          const time = (await clock.getTime()).toNumber();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await assertRevert(
            extension
              .connect(controllerSigner)
              .holdFromWithExpirationDate(
                token.address,
                holdId,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                time - 1,
                secretHashPair.hash,
                ZERO_BYTE
              )
          );
        });
      });
    });
    describe('when certificate is activated', function () {
      beforeEach(async function () {
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_SALT
        );
      });
      describe('when certificate is valid', function () {
        it('creates a hold', async function () {
          assert.strictEqual(
            (
              await extension.balanceOnHoldByPartition(
                token.address,
                partition1,
                tokenHolderSigner.getAddress()
              )
            ).toNumber(),
            0
          );
          const time = (await clock.getTime()).toNumber();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          const certificate = await craftCertificate(
            extension.interface.encodeFunctionData(
              'holdFromWithExpirationDate',
              [
                token.address,
                holdId,
                await tokenHolderSigner.getAddress(),
                await recipientSigner.getAddress(),
                await notarySigner.getAddress(),
                partition1,
                holdAmount,
                time + SECONDS_IN_AN_HOUR,
                secretHashPair.hash,
                ZERO_BYTE
              ]
            ),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          const { events } = await extension
            .connect(controllerSigner)
            .holdFromWithExpirationDate(
              token.address,
              holdId,
              tokenHolderSigner.getAddress(),
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              time + SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              certificate
            )
            .then((res) => res.wait());
          assert.strictEqual(
            (
              await extension.balanceOnHoldByPartition(
                token.address,
                partition1,
                tokenHolderSigner.getAddress()
              )
            ).toNumber(),
            holdAmount
          );

          assert.strictEqual(
            events![0].args?.expiration.toNumber(),
            time + SECONDS_IN_AN_HOUR
          );
          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[5].toNumber(), time + SECONDS_IN_AN_HOUR);
        });
      });
      describe('when certificate is not valid', function () {
        it('reverts', async function () {
          assert.strictEqual(
            (
              await extension.balanceOnHoldByPartition(
                token.address,
                partition1,
                tokenHolderSigner.getAddress()
              )
            ).toNumber(),
            0
          );
          const time = (await clock.getTime()).toNumber();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await assertRevert(
            extension
              .connect(controllerSigner)
              .holdFromWithExpirationDate(
                token.address,
                holdId,
                tokenHolderSigner.getAddress(),
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                time + SECONDS_IN_AN_HOUR,
                secretHashPair.hash,
                ZERO_BYTE
              )
          );
        });
      });
    });
  });

  // RELEASE HOLD
  describe('releaseHold', function () {
    let holdId: string;
    let time: BigNumber;
    let secretHashPair: { hash: string; secret: string };
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );

      // Create hold in state Ordered
      time = await clock.getTime();
      holdId = newHoldId();
      secretHashPair = newSecretHashPair();
      const certificate2 = await craftCertificate(
        extension.interface.encodeFunctionData('hold', [
          token.address,
          holdId,
          await recipientSigner.getAddress(),
          await notarySigner.getAddress(),
          partition1,
          holdAmount,
          SECONDS_IN_AN_HOUR,
          secretHashPair.hash,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        tokenHolderSigner.getAddress()
      );
      await extension
        .connect(tokenHolderSigner)
        .hold(
          token.address,
          holdId,
          recipientSigner.getAddress(),
          notarySigner.getAddress(),
          partition1,
          holdAmount,
          SECONDS_IN_AN_HOUR,
          secretHashPair.hash,
          certificate2
        );
    });

    describe('when hold is in status Ordered', function () {
      describe('when hold can be released', function () {
        describe('when hold expiration date is past', function () {
          it('releases the hold', async function () {
            const initialBalance = await token.balanceOf(
              tokenHolderSigner.getAddress()
            );
            const initialPartitionBalance = await token.balanceOfByPartition(
              partition1,
              tokenHolderSigner.getAddress()
            );

            const initialBalanceOnHold = await extension.balanceOnHold(
              token.address,
              tokenHolderSigner.getAddress()
            );
            const initialBalanceOnHoldByPartition =
              await extension.balanceOnHoldByPartition(
                token.address,
                partition1,
                tokenHolderSigner.getAddress()
              );

            const initialSpendableBalance = await extension.spendableBalanceOf(
              token.address,
              tokenHolderSigner.getAddress()
            );
            const initialSpendableBalanceByPartition =
              await extension.spendableBalanceOfByPartition(
                token.address,
                partition1,
                tokenHolderSigner.getAddress()
              );

            const initialTotalSupplyOnHold = await extension.totalSupplyOnHold(
              token.address
            );
            const initialTotalSupplyOnHoldByPartition =
              await extension.totalSupplyOnHoldByPartition(
                token.address,
                partition1
              );

            // Wait for 1 hour
            await advanceTimeAndBlock(SECONDS_IN_AN_HOUR + 100);
            await extension
              .connect(tokenHolderSigner)
              .releaseHold(token.address, holdId);

            const finalBalance = await token.balanceOf(
              tokenHolderSigner.getAddress()
            );
            const finalPartitionBalance = await token.balanceOfByPartition(
              partition1,
              tokenHolderSigner.getAddress()
            );

            const finalBalanceOnHold = await extension.balanceOnHold(
              token.address,
              tokenHolderSigner.getAddress()
            );
            const finalBalanceOnHoldByPartition =
              await extension.balanceOnHoldByPartition(
                token.address,
                partition1,
                tokenHolderSigner.getAddress()
              );

            const finalSpendableBalance = await extension.spendableBalanceOf(
              token.address,
              tokenHolderSigner.getAddress()
            );
            const finalSpendableBalanceByPartition =
              await extension.spendableBalanceOfByPartition(
                token.address,
                partition1,
                tokenHolderSigner.getAddress()
              );

            const finalTotalSupplyOnHold = await extension.totalSupplyOnHold(
              token.address
            );
            const finalTotalSupplyOnHoldByPartition =
              await extension.totalSupplyOnHoldByPartition(
                token.address,
                partition1
              );

            assert.strictEqual(initialBalance.toNumber(), issuanceAmount);
            assert.strictEqual(finalBalance.toNumber(), issuanceAmount);
            assert.strictEqual(
              initialPartitionBalance.toNumber(),
              issuanceAmount
            );
            assert.strictEqual(
              finalPartitionBalance.toNumber(),
              issuanceAmount
            );

            assert.strictEqual(initialBalanceOnHold.toNumber(), holdAmount);
            assert.strictEqual(
              initialBalanceOnHoldByPartition.toNumber(),
              holdAmount
            );
            assert.strictEqual(finalBalanceOnHold.toNumber(), 0);
            assert.strictEqual(finalBalanceOnHoldByPartition.toNumber(), 0);

            assert.strictEqual(
              initialSpendableBalance.toNumber(),
              issuanceAmount - holdAmount
            );
            assert.strictEqual(
              initialSpendableBalanceByPartition.toNumber(),
              issuanceAmount - holdAmount
            );
            assert.strictEqual(
              finalSpendableBalance.toNumber(),
              issuanceAmount
            );
            assert.strictEqual(
              finalSpendableBalanceByPartition.toNumber(),
              issuanceAmount
            );

            assert.strictEqual(initialTotalSupplyOnHold.toNumber(), holdAmount);
            assert.strictEqual(
              initialTotalSupplyOnHoldByPartition.toNumber(),
              holdAmount
            );
            assert.strictEqual(finalTotalSupplyOnHold.toNumber(), 0);
            assert.strictEqual(finalTotalSupplyOnHoldByPartition.toNumber(), 0);

            const holdData = await extension.retrieveHoldData(
              token.address,
              holdId
            );
            assert.strictEqual(holdData[0], partition1);
            assert.strictEqual(
              holdData[1],
              await tokenHolderSigner.getAddress()
            );
            assert.strictEqual(holdData[2], await recipientSigner.getAddress());
            assert.strictEqual(holdData[3], await notarySigner.getAddress());
            assert.strictEqual(holdData[4].toNumber(), holdAmount);
            assert.strictEqual(
              holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR,
              true
            );
            assert.strictEqual(
              holdData[5].toNumber() <
                time.toNumber() + SECONDS_IN_AN_HOUR + 100,
              true
            );
            assert.strictEqual(holdData[6], secretHashPair.hash);
            assert.strictEqual(holdData[7], EMPTY_BYTE32);
            assert.strictEqual(holdData[8], HOLD_STATUS_RELEASED_ON_EXPIRATION);
          });
          it('emits an event', async function () {
            // Wait for 1 hour
            await advanceTimeAndBlock(SECONDS_IN_AN_HOUR + 100);
            const { events } = await extension
              .connect(tokenHolderSigner)
              .releaseHold(token.address, holdId)
              .then((res) => res.wait());

            assert.strictEqual(events![0].event, 'HoldReleased');
            assert.strictEqual(events![0].args?.token, token.address);
            assert.strictEqual(events![0].args?.holdId, holdId);
            assert.strictEqual(
              events![0].args?.notary,
              await notarySigner.getAddress()
            );
            assert.strictEqual(
              events![0].args?.status,
              HOLD_STATUS_RELEASED_ON_EXPIRATION
            );
          });
        });
        describe('when hold is released by the notary', function () {
          it('releases the hold', async function () {
            const initialSpendableBalance = (
              await extension.spendableBalanceOf(
                token.address,
                tokenHolderSigner.getAddress()
              )
            ).toNumber();
            assert.strictEqual(
              initialSpendableBalance,
              issuanceAmount - holdAmount
            );

            const { events } = await extension
              .connect(notarySigner)
              .releaseHold(token.address, holdId)
              .then((res) => res.wait());

            const finalSpendableBalance = (
              await extension.spendableBalanceOf(
                token.address,
                tokenHolderSigner.getAddress()
              )
            ).toNumber();
            assert.strictEqual(finalSpendableBalance, issuanceAmount);

            const holdData = await extension.retrieveHoldData(
              token.address,
              holdId
            );
            assert.strictEqual(holdData[8], HOLD_STATUS_RELEASED_BY_NOTARY);
            assert.strictEqual(
              events![0].args?.status,
              HOLD_STATUS_RELEASED_BY_NOTARY
            );
          });
        });
        describe('when hold is released by the recipient', function () {
          it('releases the hold', async function () {
            const initialSpendableBalance = (
              await extension.spendableBalanceOf(
                token.address,
                tokenHolderSigner.getAddress()
              )
            ).toNumber();
            assert.strictEqual(
              initialSpendableBalance,
              issuanceAmount - holdAmount
            );

            const { events } = await extension
              .connect(recipientSigner)
              .releaseHold(token.address, holdId)
              .then((res) => res.wait());

            const finalSpendableBalance = (
              await extension.spendableBalanceOf(
                token.address,
                tokenHolderSigner.getAddress()
              )
            ).toNumber();
            assert.strictEqual(finalSpendableBalance, issuanceAmount);

            const holdData = await extension.retrieveHoldData(
              token.address,
              holdId
            );
            assert.strictEqual(holdData[8], HOLD_STATUS_RELEASED_BY_PAYEE);
            assert.strictEqual(
              events![0].args?.status,
              HOLD_STATUS_RELEASED_BY_PAYEE
            );
          });
        });
      });
      describe('when hold can not be released', function () {
        describe('when hold is released by the hold sender', function () {
          it('reverts', async function () {
            await assertRevert(
              extension
                .connect(tokenHolderSigner)
                .releaseHold(token.address, holdId)
            );
          });
        });
      });
    });
    describe('when hold is in status ExecutedAndKeptOpen', function () {
      it('releases the hold', async function () {
        const initialSpendableBalance = (
          await extension.spendableBalanceOf(
            token.address,
            tokenHolderSigner.getAddress()
          )
        ).toNumber();
        assert.strictEqual(
          initialSpendableBalance,
          issuanceAmount - holdAmount
        );

        let holdData = await extension.retrieveHoldData(token.address, holdId);
        assert.strictEqual(holdData[8], HOLD_STATUS_ORDERED);

        const executedAmount = 10;
        await extension
          .connect(notarySigner)
          .executeHoldAndKeepOpen(
            token.address,
            holdId,
            executedAmount,
            EMPTY_BYTE32
          );

        holdData = await extension.retrieveHoldData(token.address, holdId);
        assert.strictEqual(holdData[8], HOLD_STATUS_EXECUTED_AND_KEPT_OPEN);

        const { events } = await extension
          .connect(notarySigner)
          .releaseHold(token.address, holdId)
          .then((res) => res.wait());

        const finalSpendableBalance = (
          await extension.spendableBalanceOf(
            token.address,
            tokenHolderSigner.getAddress()
          )
        ).toNumber();
        assert.strictEqual(
          finalSpendableBalance,
          issuanceAmount - executedAmount
        );

        holdData = await extension.retrieveHoldData(token.address, holdId);
        assert.strictEqual(holdData[8], HOLD_STATUS_RELEASED_BY_NOTARY);
        assert.strictEqual(
          events![0].args?.status,
          HOLD_STATUS_RELEASED_BY_NOTARY
        );
      });
    });
    describe('when hold is neither in status Ordered, nor ExecutedAndKeptOpen', function () {
      it('reverts', async function () {
        await extension
          .connect(notarySigner)
          .releaseHold(token.address, holdId);

        const holdData = await extension.retrieveHoldData(
          token.address,
          holdId
        );
        assert.strictEqual(holdData[8], HOLD_STATUS_RELEASED_BY_NOTARY);

        await assertRevert(
          extension.connect(notarySigner).releaseHold(token.address, holdId)
        );
      });
    });
  });

  // RENEW HOLD
  describe('renewHold', function () {
    let holdId: string;
    let time: BigNumber;
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );

      // Create hold in state Ordered
      time = await clock.getTime();
      holdId = newHoldId();
      const secretHashPair = newSecretHashPair();
      const certificate2 = await craftCertificate(
        extension.interface.encodeFunctionData('hold', [
          token.address,
          holdId,
          await recipientSigner.getAddress(),
          await notarySigner.getAddress(),
          partition1,
          holdAmount,
          SECONDS_IN_AN_HOUR,
          secretHashPair.hash,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        tokenHolderSigner.getAddress()
      );
      await extension
        .connect(tokenHolderSigner)
        .hold(
          token.address,
          holdId,
          recipientSigner.getAddress(),
          notarySigner.getAddress(),
          partition1,
          holdAmount,
          SECONDS_IN_AN_HOUR,
          secretHashPair.hash,
          certificate2
        );
    });

    describe('when certificate is not activated', function () {
      beforeEach(async function () {
        await setCertificateActivated(
          extension,
          token,
          controllerSigner,
          CERTIFICATE_VALIDATION_NONE
        );
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_NONE
        );
      });
      describe('when hold can be renewed', function () {
        describe('when hold is in status Ordered', function () {
          describe('when hold is not expired', function () {
            describe('when hold is renewed by the sender', function () {
              it('renews the hold (expiration date future)', async function () {
                let holdData = await extension.retrieveHoldData(
                  token.address,
                  holdId
                );
                assert.strictEqual(
                  holdData[5].toNumber() >=
                    time.toNumber() + SECONDS_IN_AN_HOUR - 2,
                  true
                );
                assert.strictEqual(
                  holdData[5].toNumber() <
                    time.toNumber() + SECONDS_IN_AN_HOUR + 100,
                  true
                );

                time = await clock.getTime();
                await extension
                  .connect(tokenHolderSigner)
                  .renewHold(
                    token.address,
                    holdId,
                    SECONDS_IN_A_DAY,
                    ZERO_BYTE
                  );
                holdData = await extension.retrieveHoldData(
                  token.address,
                  holdId
                );
                assert.strictEqual(
                  holdData[5].toNumber() >=
                    time.toNumber() + SECONDS_IN_A_DAY - 2,
                  true
                );
                assert.strictEqual(
                  holdData[5].toNumber() <
                    time.toNumber() + SECONDS_IN_A_DAY + 100,
                  true
                );
              });
              it('renews the hold (expiration date now)', async function () {
                let holdData = await extension.retrieveHoldData(
                  token.address,
                  holdId
                );
                assert.strictEqual(
                  holdData[5].toNumber() >=
                    time.toNumber() + SECONDS_IN_AN_HOUR - 2,
                  true
                );
                assert.strictEqual(
                  holdData[5].toNumber() <
                    time.toNumber() + SECONDS_IN_AN_HOUR + 100,
                  true
                );

                time = await clock.getTime();
                await extension
                  .connect(tokenHolderSigner)
                  .renewHold(token.address, holdId, 0, ZERO_BYTE);

                holdData = await extension.retrieveHoldData(
                  token.address,
                  holdId
                );
                assert.strictEqual(holdData[5].toNumber(), 0);
              });
              it('emits an event', async function () {
                const { events } = await extension
                  .connect(tokenHolderSigner)
                  .renewHold(token.address, holdId, SECONDS_IN_A_DAY, ZERO_BYTE)
                  .then((res) => res.wait());

                assert.strictEqual(events![0].event, 'HoldRenewed');
                assert.strictEqual(events![0].args?.token, token.address);
                assert.strictEqual(events![0].args?.holdId, holdId);
                assert.strictEqual(
                  events![0].args?.notary,
                  await notarySigner.getAddress()
                );
                assert.strictEqual(
                  events![0].args?.oldExpiration.toNumber() >=
                    time.toNumber() + SECONDS_IN_AN_HOUR - 2,
                  true
                );
                assert.strictEqual(
                  events![0].args?.oldExpiration.toNumber() <
                    time.toNumber() + SECONDS_IN_AN_HOUR + 100,
                  true
                );
                assert.strictEqual(
                  events![0].args?.newExpiration.toNumber() >=
                    time.toNumber() + SECONDS_IN_A_DAY - 2,
                  true
                );
                assert.strictEqual(
                  events![0].args?.newExpiration.toNumber() <
                    time.toNumber() + SECONDS_IN_A_DAY + 100,
                  true
                );
              });
            });
            describe('when hold is renewed by an operator', function () {
              it('renews the hold', async function () {
                let holdData = await extension.retrieveHoldData(
                  token.address,
                  holdId
                );
                assert.strictEqual(
                  holdData[5].toNumber() >=
                    time.toNumber() + SECONDS_IN_AN_HOUR - 2,
                  true
                );
                assert.strictEqual(
                  holdData[5].toNumber() <
                    time.toNumber() + SECONDS_IN_AN_HOUR + 100,
                  true
                );

                time = await clock.getTime();
                await extension
                  .connect(controllerSigner)
                  .renewHold(
                    token.address,
                    holdId,
                    SECONDS_IN_A_DAY,
                    ZERO_BYTE
                  );

                holdData = await extension.retrieveHoldData(
                  token.address,
                  holdId
                );
                assert.strictEqual(
                  holdData[5].toNumber() >=
                    time.toNumber() + SECONDS_IN_A_DAY - 2,
                  true
                );
                assert.strictEqual(
                  holdData[5].toNumber() <
                    time.toNumber() + SECONDS_IN_A_DAY + 100,
                  true
                );
              });
            });
            describe('when hold is neither renewed by the sender, nor by an operator', function () {
              it('reverts', async function () {
                await assertRevert(
                  extension
                    .connect(recipientSigner)
                    .renewHold(
                      token.address,
                      holdId,
                      SECONDS_IN_A_DAY,
                      ZERO_BYTE
                    )
                );
              });
            });
          });
          describe('when hold is expired', function () {
            it('reverts', async function () {
              const holdData = await extension.retrieveHoldData(
                token.address,
                holdId
              );
              assert.strictEqual(
                holdData[5].toNumber() >=
                  time.toNumber() + SECONDS_IN_AN_HOUR - 2,
                true
              );
              assert.strictEqual(
                holdData[5].toNumber() <
                  time.toNumber() + SECONDS_IN_AN_HOUR + 100,
                true
              );

              // Wait for more than an hour
              await advanceTimeAndBlock(SECONDS_IN_AN_HOUR + 100);

              await assertRevert(
                extension
                  .connect(tokenHolderSigner)
                  .renewHold(token.address, holdId, SECONDS_IN_A_DAY, ZERO_BYTE)
              );
            });
          });
        });
        describe('when hold is in status ExecutedAndKeptOpen', function () {
          it('renews the hold', async function () {
            let holdData = await extension.retrieveHoldData(
              token.address,
              holdId
            );
            assert.strictEqual(holdData[8], HOLD_STATUS_ORDERED);

            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, tokenHolderSigner.getAddress());
            await extension
              .connect(controllerSigner)
              .addAllowlisted(token.address, recipientSigner.getAddress());

            const executedAmount = 10;
            await extension
              .connect(notarySigner)
              .executeHoldAndKeepOpen(
                token.address,
                holdId,
                executedAmount,
                EMPTY_BYTE32
              );

            holdData = await extension.retrieveHoldData(token.address, holdId);
            assert.strictEqual(holdData[8], HOLD_STATUS_EXECUTED_AND_KEPT_OPEN);

            holdData = await extension.retrieveHoldData(token.address, holdId);
            assert.strictEqual(
              holdData[5].toNumber() >=
                time.toNumber() + SECONDS_IN_AN_HOUR - 2,
              true
            );
            assert.strictEqual(
              holdData[5].toNumber() <
                time.toNumber() + SECONDS_IN_AN_HOUR + 100,
              true
            );

            time = await clock.getTime();
            await extension
              .connect(tokenHolderSigner)
              .renewHold(token.address, holdId, SECONDS_IN_A_DAY, ZERO_BYTE);

            holdData = await extension.retrieveHoldData(token.address, holdId);
            assert.strictEqual(
              holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_A_DAY - 2,
              true
            );
            assert.strictEqual(
              holdData[5].toNumber() < time.toNumber() + SECONDS_IN_A_DAY + 100,
              true
            );
          });
        });
      });
      describe('when hold can not be renewed', function () {
        describe('when hold is neither in status Ordered, nor ExecutedAndKeptOpen', function () {
          it('reverts', async function () {
            await extension
              .connect(notarySigner)
              .releaseHold(token.address, holdId);

            const holdData = await extension.retrieveHoldData(
              token.address,
              holdId
            );
            assert.strictEqual(holdData[8], HOLD_STATUS_RELEASED_BY_NOTARY);

            await assertRevert(
              extension
                .connect(tokenHolderSigner)
                .renewHold(token.address, holdId, SECONDS_IN_A_DAY, ZERO_BYTE)
            );
          });
        });
      });
    });
    describe('when certificate is activated', function () {
      beforeEach(async function () {
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_SALT
        );
      });
      describe('when certificate is valid', function () {
        it('renews the hold (expiration date future)', async function () {
          let holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR - 2,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );

          time = await clock.getTime();
          const certificate = await craftCertificate(
            extension.interface.encodeFunctionData('renewHold', [
              token.address,
              holdId,
              SECONDS_IN_A_DAY,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock,
            tokenHolderSigner.getAddress()
          );
          await extension
            .connect(tokenHolderSigner)
            .renewHold(token.address, holdId, SECONDS_IN_A_DAY, certificate);

          holdData = await extension.retrieveHoldData(token.address, holdId);
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_A_DAY - 2,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_A_DAY + 100,
            true
          );
        });
      });
      describe('when certificate is not valid', function () {
        it('reverts', async function () {
          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR - 2,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );

          time = await clock.getTime();
          await assertRevert(
            extension
              .connect(tokenHolderSigner)
              .renewHold(token.address, holdId, SECONDS_IN_A_DAY, ZERO_BYTE)
          );
        });
      });
    });
  });

  // RENEW HOLD WITH EXPIRATION DATE
  describe('renewHoldWithExpirationDate', function () {
    let time: BigNumber;
    let holdId: string;
    let secretHashPair: { hash: string; secret: string };
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );

      // Create hold in state Ordered
      time = await clock.getTime();
      holdId = newHoldId();
      secretHashPair = newSecretHashPair();
      const certificate2 = await craftCertificate(
        extension.interface.encodeFunctionData('hold', [
          token.address,
          holdId,
          await recipientSigner.getAddress(),
          await notarySigner.getAddress(),
          partition1,
          holdAmount,
          SECONDS_IN_AN_HOUR,
          secretHashPair.hash,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        tokenHolderSigner.getAddress()
      );
      await extension
        .connect(tokenHolderSigner)
        .hold(
          token.address,
          holdId,
          recipientSigner.getAddress(),
          notarySigner.getAddress(),
          partition1,
          holdAmount,
          SECONDS_IN_AN_HOUR,
          secretHashPair.hash,
          certificate2
        );
    });

    describe('when certificate is not activated', function () {
      beforeEach(async function () {
        await setCertificateActivated(
          extension,
          token,
          controllerSigner,
          CERTIFICATE_VALIDATION_NONE
        );
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_NONE
        );
      });
      describe('when expiration date is valid', function () {
        describe('when expiration date is in the future', function () {
          it('renews the hold', async function () {
            let holdData = await extension.retrieveHoldData(
              token.address,
              holdId
            );
            assert.strictEqual(
              holdData[5].toNumber() >=
                time.toNumber() + SECONDS_IN_AN_HOUR - 2,
              true
            );
            assert.strictEqual(
              holdData[5].toNumber() <
                time.toNumber() + SECONDS_IN_AN_HOUR + 100,
              true
            );

            time = await clock.getTime();
            const { events } = await extension
              .connect(tokenHolderSigner)
              .renewHoldWithExpirationDate(
                token.address,
                holdId,
                time.toNumber() + SECONDS_IN_A_DAY,
                ZERO_BYTE
              )
              .then((res) => res.wait());

            holdData = await extension.retrieveHoldData(token.address, holdId);
            assert.strictEqual(
              holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_A_DAY - 2,
              true
            );
            assert.strictEqual(
              holdData[5].toNumber() < time.toNumber() + SECONDS_IN_A_DAY + 100,
              true
            );

            assert.strictEqual(events![0].event, 'HoldRenewed');
            assert.strictEqual(events![0].args?.token, token.address);
            assert.strictEqual(events![0].args?.holdId, holdId);
            assert.strictEqual(
              events![0].args?.notary,
              await notarySigner.getAddress()
            );
            assert.strictEqual(
              events![0].args?.oldExpiration.toNumber() >=
                time.toNumber() + SECONDS_IN_AN_HOUR - 2,
              true
            );
            assert.strictEqual(
              events![0].args?.oldExpiration.toNumber() <
                time.toNumber() + SECONDS_IN_AN_HOUR + 100,
              true
            );
            assert.strictEqual(
              events![0].args?.newExpiration.toNumber() >=
                time.toNumber() + SECONDS_IN_A_DAY - 2,
              true
            );
            assert.strictEqual(
              events![0].args?.newExpiration.toNumber() <
                time.toNumber() + SECONDS_IN_A_DAY + 100,
              true
            );
          });
        });
        describe('when there is no expiration date', function () {
          it('renews the hold', async function () {
            let holdData = await extension.retrieveHoldData(
              token.address,
              holdId
            );
            assert.strictEqual(
              holdData[5].toNumber() >=
                time.toNumber() + SECONDS_IN_AN_HOUR - 2,
              true
            );
            assert.strictEqual(
              holdData[5].toNumber() <
                time.toNumber() + SECONDS_IN_AN_HOUR + 100,
              true
            );

            const { events } = await extension
              .connect(tokenHolderSigner)
              .renewHoldWithExpirationDate(token.address, holdId, 0, ZERO_BYTE)
              .then((res) => res.wait());

            holdData = await extension.retrieveHoldData(token.address, holdId);

            assert.strictEqual(holdData[5].toNumber(), 0);

            assert.strictEqual(events![0].event, 'HoldRenewed');
            assert.strictEqual(
              events![0].args?.oldExpiration.toNumber() >=
                time.toNumber() + SECONDS_IN_AN_HOUR - 2,
              true
            );
            assert.strictEqual(
              events![0].args?.oldExpiration.toNumber() <
                time.toNumber() + SECONDS_IN_AN_HOUR + 100,
              true
            );
            assert.strictEqual(events![0].args?.newExpiration.toNumber(), 0);
          });
        });
      });
      describe('when expiration date is not valid', function () {
        it('reverts', async function () {
          time = await clock.getTime();
          await assertRevert(
            extension
              .connect(tokenHolderSigner)
              .renewHoldWithExpirationDate(
                token.address,
                holdId,
                time.toNumber() - 1,
                ZERO_BYTE
              )
          );
        });
      });
    });
    describe('when certificate is activated', function () {
      beforeEach(async function () {
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_SALT
        );
      });
      describe('when certificate is valid', function () {
        it('renews the hold', async function () {
          let holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR - 2,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );

          time = await clock.getTime();
          const certificate = await craftCertificate(
            extension.interface.encodeFunctionData(
              'renewHoldWithExpirationDate',
              [
                token.address,
                holdId,
                time.toNumber() + SECONDS_IN_A_DAY,
                ZERO_BYTE
              ]
            ),
            token,
            extension,
            clock,
            tokenHolderSigner.getAddress()
          );

          const { events } = await extension
            .connect(tokenHolderSigner)
            .renewHoldWithExpirationDate(
              token.address,
              holdId,
              time.toNumber() + SECONDS_IN_A_DAY,
              certificate
            )
            .then((res) => res.wait());
          holdData = await extension.retrieveHoldData(token.address, holdId);
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_A_DAY - 2,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_A_DAY + 100,
            true
          );

          assert.strictEqual(events![0].event, 'HoldRenewed');
          assert.strictEqual(events![0].args?.token, token.address);
          assert.strictEqual(events![0].args?.holdId, holdId);
          assert.strictEqual(
            events![0].args?.notary,
            await notarySigner.getAddress()
          );
          assert.strictEqual(
            events![0].args?.oldExpiration.toNumber() >=
              time.toNumber() + SECONDS_IN_AN_HOUR - 2,
            true
          );
          assert.strictEqual(
            events![0].args?.oldExpiration.toNumber() <
              time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );
          assert.strictEqual(
            events![0].args?.newExpiration.toNumber() >=
              time.toNumber() + SECONDS_IN_A_DAY - 2,
            true
          );
          assert.strictEqual(
            events![0].args?.newExpiration.toNumber() <
              time.toNumber() + SECONDS_IN_A_DAY + 100,
            true
          );
        });
      });
      describe('when certificate is not valid', function () {
        it('renews the hold', async function () {
          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR - 2,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );

          time = await clock.getTime();
          await assertRevert(
            extension
              .connect(tokenHolderSigner)
              .renewHoldWithExpirationDate(
                token.address,
                holdId,
                time.toNumber() + SECONDS_IN_A_DAY,
                ZERO_BYTE
              )
          );
        });
      });
    });
  });

  // EXECUTE HOLD
  describe('executeHold', function () {
    let holdId: string;
    let time: BigNumber;
    let secretHashPair: { hash: string; secret: string };
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );

      // Create hold in state Ordered
      time = await clock.getTime();
      holdId = newHoldId();
      secretHashPair = newSecretHashPair();
      const certificate2 = await craftCertificate(
        extension.interface.encodeFunctionData('hold', [
          token.address,
          holdId,
          await recipientSigner.getAddress(),
          await notarySigner.getAddress(),
          partition1,
          holdAmount,
          SECONDS_IN_AN_HOUR,
          secretHashPair.hash,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        tokenHolderSigner.getAddress()
      );
      await extension
        .connect(tokenHolderSigner)
        .hold(
          token.address,
          holdId,
          recipientSigner.getAddress(),
          notarySigner.getAddress(),
          partition1,
          holdAmount,
          SECONDS_IN_AN_HOUR,
          secretHashPair.hash,
          certificate2
        );
    });

    describe('when hold can be executed', function () {
      describe('when hold is in status Ordered', function () {
        describe('when value is not nil', function () {
          describe('when hold is executed by the notary', function () {
            describe('when hold is not expired', function () {
              describe('when value is not higher than hold value', function () {
                describe('when hold shall not be kept open', function () {
                  describe('when the whole amount is executed', function () {
                    it('executes the hold', async function () {
                      const initialBalance = await token.balanceOf(
                        tokenHolderSigner.getAddress()
                      );
                      const initialPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const initialBalanceOnHold =
                        await extension.balanceOnHold(
                          token.address,
                          tokenHolderSigner.getAddress()
                        );
                      const initialBalanceOnHoldByPartition =
                        await extension.balanceOnHoldByPartition(
                          token.address,
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const initialSpendableBalance =
                        await extension.spendableBalanceOf(
                          token.address,
                          tokenHolderSigner.getAddress()
                        );
                      const initialSpendableBalanceByPartition =
                        await extension.spendableBalanceOfByPartition(
                          token.address,
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const initialTotalSupplyOnHold =
                        await extension.totalSupplyOnHold(token.address);
                      const initialTotalSupplyOnHoldByPartition =
                        await extension.totalSupplyOnHoldByPartition(
                          token.address,
                          partition1
                        );

                      const initialRecipientBalance = await token.balanceOf(
                        recipientSigner.getAddress()
                      );
                      const initialRecipientPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          recipientSigner.getAddress()
                        );

                      await extension
                        .connect(notarySigner)
                        .executeHold(
                          token.address,
                          holdId,
                          holdAmount,
                          EMPTY_BYTE32
                        );

                      const finalBalance = await token.balanceOf(
                        tokenHolderSigner.getAddress()
                      );
                      const finalPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const finalBalanceOnHold = await extension.balanceOnHold(
                        token.address,
                        tokenHolderSigner.getAddress()
                      );
                      const finalBalanceOnHoldByPartition =
                        await extension.balanceOnHoldByPartition(
                          token.address,
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const finalSpendableBalance =
                        await extension.spendableBalanceOf(
                          token.address,
                          tokenHolderSigner.getAddress()
                        );
                      const finalSpendableBalanceByPartition =
                        await extension.spendableBalanceOfByPartition(
                          token.address,
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const finalTotalSupplyOnHold =
                        await extension.totalSupplyOnHold(token.address);
                      const finalTotalSupplyOnHoldByPartition =
                        await extension.totalSupplyOnHoldByPartition(
                          token.address,
                          partition1
                        );

                      const finalRecipientBalance = await token.balanceOf(
                        recipientSigner.getAddress()
                      );
                      const finalRecipientPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          recipientSigner.getAddress()
                        );

                      assert.strictEqual(
                        initialBalance.toNumber(),
                        issuanceAmount
                      );
                      assert.strictEqual(
                        finalBalance.toNumber(),
                        issuanceAmount - holdAmount
                      );
                      assert.strictEqual(
                        initialPartitionBalance.toNumber(),
                        issuanceAmount
                      );
                      assert.strictEqual(
                        finalPartitionBalance.toNumber(),
                        issuanceAmount - holdAmount
                      );

                      assert.strictEqual(
                        initialBalanceOnHold.toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(
                        initialBalanceOnHoldByPartition.toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(finalBalanceOnHold.toNumber(), 0);
                      assert.strictEqual(
                        finalBalanceOnHoldByPartition.toNumber(),
                        0
                      );

                      assert.strictEqual(
                        initialSpendableBalance.toNumber(),
                        issuanceAmount - holdAmount
                      );
                      assert.strictEqual(
                        initialSpendableBalanceByPartition.toNumber(),
                        issuanceAmount - holdAmount
                      );
                      assert.strictEqual(
                        finalSpendableBalance.toNumber(),
                        issuanceAmount - holdAmount
                      );
                      assert.strictEqual(
                        finalSpendableBalanceByPartition.toNumber(),
                        issuanceAmount - holdAmount
                      );

                      assert.strictEqual(
                        initialTotalSupplyOnHold.toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(
                        initialTotalSupplyOnHoldByPartition.toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(finalTotalSupplyOnHold.toNumber(), 0);
                      assert.strictEqual(
                        finalTotalSupplyOnHoldByPartition.toNumber(),
                        0
                      );

                      assert.strictEqual(initialRecipientBalance.toNumber(), 0);
                      assert.strictEqual(
                        initialRecipientPartitionBalance.toNumber(),
                        0
                      );
                      assert.strictEqual(
                        finalRecipientBalance.toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(
                        finalRecipientPartitionBalance.toNumber(),
                        holdAmount
                      );

                      const holdData = await extension.retrieveHoldData(
                        token.address,
                        holdId
                      );
                      assert.strictEqual(holdData[0], partition1);
                      assert.strictEqual(
                        holdData[1],
                        await tokenHolderSigner.getAddress()
                      );
                      assert.strictEqual(
                        holdData[2],
                        await recipientSigner.getAddress()
                      );
                      assert.strictEqual(
                        holdData[3],
                        await notarySigner.getAddress()
                      );
                      assert.strictEqual(holdData[4].toNumber(), holdAmount);
                      assert.strictEqual(
                        holdData[5].toNumber() >=
                          time.toNumber() + SECONDS_IN_AN_HOUR,
                        true
                      );
                      assert.strictEqual(
                        holdData[5].toNumber() <
                          time.toNumber() + SECONDS_IN_AN_HOUR + 100,
                        true
                      );
                      assert.strictEqual(holdData[6], secretHashPair.hash);
                      assert.strictEqual(holdData[7], EMPTY_BYTE32);
                      assert.strictEqual(holdData[8], HOLD_STATUS_EXECUTED);
                    });
                    it('emits an event', async function () {
                      const { events } = await extension
                        .connect(notarySigner)
                        .executeHold(
                          token.address,
                          holdId,
                          holdAmount,
                          EMPTY_BYTE32
                        )
                        .then((res) => res.wait());

                      assert.strictEqual(events![0].event, 'HoldExecuted');
                      assert.strictEqual(events![0].args?.token, token.address);
                      assert.strictEqual(events![0].args?.holdId, holdId);
                      assert.strictEqual(
                        events![0].args?.notary,
                        await notarySigner.getAddress()
                      );
                      assert.strictEqual(
                        BigNumber.from(events![0].args?.heldValue).eq(
                          holdAmount
                        ),
                        true
                      );
                      assert.strictEqual(
                        BigNumber.from(events![0].args?.transferredValue).eq(
                          holdAmount
                        ),
                        true
                      );
                      assert.strictEqual(events![0].args?.secret, EMPTY_BYTE32);
                    });
                  });
                  describe('when a partial amount is executed', function () {
                    it('executes the hold', async function () {
                      const initialPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          tokenHolderSigner.getAddress()
                        );
                      const initialRecipientPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          recipientSigner.getAddress()
                        );

                      const executedAmount = 400;
                      await extension
                        .connect(notarySigner)
                        .executeHold(
                          token.address,
                          holdId,
                          executedAmount,
                          EMPTY_BYTE32
                        );

                      const finalPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          tokenHolderSigner.getAddress()
                        );
                      const finalRecipientPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          recipientSigner.getAddress()
                        );

                      assert.strictEqual(
                        initialPartitionBalance.toNumber(),
                        issuanceAmount
                      );
                      assert.strictEqual(
                        finalPartitionBalance.toNumber(),
                        issuanceAmount - executedAmount
                      );

                      assert.strictEqual(
                        initialRecipientPartitionBalance.toNumber(),
                        0
                      );
                      assert.strictEqual(
                        finalRecipientPartitionBalance.toNumber(),
                        executedAmount
                      );

                      const holdData = await extension.retrieveHoldData(
                        token.address,
                        holdId
                      );
                      assert.strictEqual(holdData[4].toNumber(), holdAmount);
                    });
                    it('emits an event', async function () {
                      const executedAmount = 400;
                      const { events } = await extension
                        .connect(notarySigner)
                        .executeHold(
                          token.address,
                          holdId,
                          executedAmount,
                          EMPTY_BYTE32
                        )
                        .then((res) => res.wait());

                      assert.strictEqual(events![0].event, 'HoldExecuted');
                      assert.strictEqual(events![0].args?.token, token.address);
                      assert.strictEqual(events![0].args?.holdId, holdId);
                      assert.strictEqual(
                        events![0].args?.notary,
                        await notarySigner.getAddress()
                      );
                      assert.strictEqual(
                        BigNumber.from(events![0].args?.heldValue).eq(
                          holdAmount
                        ),
                        true
                      );
                      assert.strictEqual(
                        BigNumber.from(
                          events![0].args?.transferredValue
                        ).toNumber(),
                        executedAmount
                      );
                      assert.strictEqual(events![0].args?.secret, EMPTY_BYTE32);
                    });
                  });
                });
                describe('when hold shall be kept open', function () {
                  describe('when value is lower than hold value', function () {
                    it('executes the hold', async function () {
                      const initialBalance = await token.balanceOf(
                        tokenHolderSigner.getAddress()
                      );
                      const initialPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const initialBalanceOnHold =
                        await extension.balanceOnHold(
                          token.address,
                          tokenHolderSigner.getAddress()
                        );
                      const initialBalanceOnHoldByPartition =
                        await extension.balanceOnHoldByPartition(
                          token.address,
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const initialSpendableBalance =
                        await extension.spendableBalanceOf(
                          token.address,
                          tokenHolderSigner.getAddress()
                        );
                      const initialSpendableBalanceByPartition =
                        await extension.spendableBalanceOfByPartition(
                          token.address,
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const initialTotalSupplyOnHold =
                        await extension.totalSupplyOnHold(token.address);
                      const initialTotalSupplyOnHoldByPartition =
                        await extension.totalSupplyOnHoldByPartition(
                          token.address,
                          partition1
                        );

                      const initialRecipientBalance = await token.balanceOf(
                        recipientSigner.getAddress()
                      );
                      const initialRecipientPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          recipientSigner.getAddress()
                        );

                      const executedAmount = 400;
                      await extension
                        .connect(notarySigner)
                        .executeHoldAndKeepOpen(
                          token.address,
                          holdId,
                          executedAmount,
                          EMPTY_BYTE32
                        );

                      const finalBalance = await token.balanceOf(
                        tokenHolderSigner.getAddress()
                      );
                      const finalPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const finalBalanceOnHold = await extension.balanceOnHold(
                        token.address,
                        tokenHolderSigner.getAddress()
                      );
                      const finalBalanceOnHoldByPartition =
                        await extension.balanceOnHoldByPartition(
                          token.address,
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const finalSpendableBalance =
                        await extension.spendableBalanceOf(
                          token.address,
                          tokenHolderSigner.getAddress()
                        );
                      const finalSpendableBalanceByPartition =
                        await extension.spendableBalanceOfByPartition(
                          token.address,
                          partition1,
                          tokenHolderSigner.getAddress()
                        );

                      const finalTotalSupplyOnHold =
                        await extension.totalSupplyOnHold(token.address);
                      const finalTotalSupplyOnHoldByPartition =
                        await extension.totalSupplyOnHoldByPartition(
                          token.address,
                          partition1
                        );

                      const finalRecipientBalance = await token.balanceOf(
                        recipientSigner.getAddress()
                      );
                      const finalRecipientPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          recipientSigner.getAddress()
                        );

                      assert.strictEqual(
                        initialBalance.toNumber(),
                        issuanceAmount
                      );
                      assert.strictEqual(
                        finalBalance.toNumber(),
                        issuanceAmount - executedAmount
                      );
                      assert.strictEqual(
                        initialPartitionBalance.toNumber(),
                        issuanceAmount
                      );
                      assert.strictEqual(
                        finalPartitionBalance.toNumber(),
                        issuanceAmount - executedAmount
                      );

                      assert.strictEqual(
                        initialBalanceOnHold.toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(
                        initialBalanceOnHoldByPartition.toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(
                        finalBalanceOnHold.toNumber(),
                        holdAmount - executedAmount
                      );
                      assert.strictEqual(
                        finalBalanceOnHoldByPartition.toNumber(),
                        holdAmount - executedAmount
                      );

                      assert.strictEqual(
                        initialSpendableBalance.toNumber(),
                        issuanceAmount - holdAmount
                      );
                      assert.strictEqual(
                        initialSpendableBalanceByPartition.toNumber(),
                        issuanceAmount - holdAmount
                      );
                      assert.strictEqual(
                        finalSpendableBalance.toNumber(),
                        issuanceAmount - holdAmount
                      );
                      assert.strictEqual(
                        finalSpendableBalanceByPartition.toNumber(),
                        issuanceAmount - holdAmount
                      );

                      assert.strictEqual(
                        initialTotalSupplyOnHold.toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(
                        initialTotalSupplyOnHoldByPartition.toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(
                        finalTotalSupplyOnHold.toNumber(),
                        holdAmount - executedAmount
                      );
                      assert.strictEqual(
                        finalTotalSupplyOnHoldByPartition.toNumber(),
                        holdAmount - executedAmount
                      );

                      assert.strictEqual(initialRecipientBalance.toNumber(), 0);
                      assert.strictEqual(
                        initialRecipientPartitionBalance.toNumber(),
                        0
                      );
                      assert.strictEqual(
                        finalRecipientBalance.toNumber(),
                        executedAmount
                      );
                      assert.strictEqual(
                        finalRecipientPartitionBalance.toNumber(),
                        executedAmount
                      );

                      const holdData = await extension.retrieveHoldData(
                        token.address,
                        holdId
                      );
                      assert.strictEqual(holdData[0], partition1);
                      assert.strictEqual(
                        holdData[1],
                        await tokenHolderSigner.getAddress()
                      );
                      assert.strictEqual(
                        holdData[2],
                        await recipientSigner.getAddress()
                      );
                      assert.strictEqual(
                        holdData[3],
                        await notarySigner.getAddress()
                      );
                      assert.strictEqual(
                        holdData[4].toNumber(),
                        holdAmount - executedAmount
                      );
                      assert.strictEqual(
                        holdData[5].toNumber() >=
                          time.toNumber() + SECONDS_IN_AN_HOUR,
                        true
                      );
                      assert.strictEqual(
                        holdData[5].toNumber() <
                          time.toNumber() + SECONDS_IN_AN_HOUR + 100,
                        true
                      );
                      assert.strictEqual(holdData[6], secretHashPair.hash);
                      assert.strictEqual(holdData[7], EMPTY_BYTE32);
                      assert.strictEqual(
                        holdData[8],
                        HOLD_STATUS_EXECUTED_AND_KEPT_OPEN
                      );
                    });
                    it('emits an event', async function () {
                      const executedAmount = 400;
                      const { events } = await extension
                        .connect(notarySigner)
                        .executeHoldAndKeepOpen(
                          token.address,
                          holdId,
                          executedAmount,
                          EMPTY_BYTE32
                        )
                        .then((res) => res.wait());

                      assert.strictEqual(
                        events![0].event,
                        'HoldExecutedAndKeptOpen'
                      );
                      assert.strictEqual(events![0].args?.token, token.address);
                      assert.strictEqual(events![0].args?.holdId, holdId);
                      assert.strictEqual(
                        events![0].args?.notary,
                        await notarySigner.getAddress()
                      );
                      assert.strictEqual(
                        BigNumber.from(events![0].args?.heldValue).toNumber(),
                        holdAmount - executedAmount
                      );
                      assert.strictEqual(
                        BigNumber.from(
                          events![0].args?.transferredValue
                        ).toNumber(),
                        executedAmount
                      );
                      assert.strictEqual(events![0].args?.secret, EMPTY_BYTE32);
                    });
                  });
                  describe('when value is equal to hold value', function () {
                    it('executes the hold', async function () {
                      const initialPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          tokenHolderSigner.getAddress()
                        );
                      const initialRecipientPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          recipientSigner.getAddress()
                        );

                      await extension
                        .connect(notarySigner)
                        .executeHoldAndKeepOpen(
                          token.address,
                          holdId,
                          holdAmount,
                          EMPTY_BYTE32
                        );

                      const finalPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          tokenHolderSigner.getAddress()
                        );
                      const finalRecipientPartitionBalance =
                        await token.balanceOfByPartition(
                          partition1,
                          recipientSigner.getAddress()
                        );

                      assert.strictEqual(
                        initialPartitionBalance.toNumber(),
                        issuanceAmount
                      );
                      assert.strictEqual(
                        finalPartitionBalance.toNumber(),
                        issuanceAmount - holdAmount
                      );

                      assert.strictEqual(
                        initialRecipientPartitionBalance.toNumber(),
                        0
                      );
                      assert.strictEqual(
                        finalRecipientPartitionBalance.toNumber(),
                        holdAmount
                      );
                    });
                    it('emits an event', async function () {
                      const { events } = await extension
                        .connect(notarySigner)
                        .executeHoldAndKeepOpen(
                          token.address,
                          holdId,
                          holdAmount,
                          EMPTY_BYTE32
                        )
                        .then((res) => res.wait());

                      assert.strictEqual(events![0].event, 'HoldExecuted');
                      assert.strictEqual(events![0].args?.token, token.address);
                      assert.strictEqual(events![0].args?.holdId, holdId);
                      assert.strictEqual(
                        events![0].args?.notary,
                        await notarySigner.getAddress()
                      );
                      assert.strictEqual(
                        BigNumber.from(events![0].args?.heldValue).toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(
                        BigNumber.from(
                          events![0].args?.transferredValue
                        ).toNumber(),
                        holdAmount
                      );
                      assert.strictEqual(events![0].args?.secret, EMPTY_BYTE32);
                    });
                  });
                });
              });
              describe('when value is higher than hold value', function () {
                it('reverts', async function () {
                  await assertRevert(
                    extension
                      .connect(notarySigner)
                      .executeHold(
                        token.address,
                        holdId,
                        holdAmount + 1,
                        EMPTY_BYTE32
                      )
                  );
                });
              });
            });
            describe('when hold is expired', function () {
              it('reverts', async function () {
                // Wait for more than an hour
                await advanceTimeAndBlock(SECONDS_IN_AN_HOUR + 100);

                await assertRevert(
                  extension
                    .connect(notarySigner)
                    .executeHold(
                      token.address,
                      holdId,
                      holdAmount,
                      EMPTY_BYTE32
                    )
                );
              });
            });
          });
          describe('when hold is executed by the secret holder', function () {
            describe('when the token sender provides the correct secret', function () {
              it('executes the hold', async function () {
                const initialPartitionBalance =
                  await token.balanceOfByPartition(
                    partition1,
                    tokenHolderSigner.getAddress()
                  );
                const initialRecipientPartitionBalance =
                  await token.balanceOfByPartition(
                    partition1,
                    recipientSigner.getAddress()
                  );

                const { events } = await extension
                  .connect(recipientSigner)
                  .executeHold(
                    token.address,
                    holdId,
                    holdAmount,
                    secretHashPair.secret
                  )
                  .then((res) => res.wait());

                const finalPartitionBalance = await token.balanceOfByPartition(
                  partition1,
                  tokenHolderSigner.getAddress()
                );
                const finalRecipientPartitionBalance =
                  await token.balanceOfByPartition(
                    partition1,
                    recipientSigner.getAddress()
                  );

                assert.strictEqual(
                  initialPartitionBalance.toNumber(),
                  issuanceAmount
                );
                assert.strictEqual(
                  finalPartitionBalance.toNumber(),
                  issuanceAmount - holdAmount
                );

                assert.strictEqual(
                  initialRecipientPartitionBalance.toNumber(),
                  0
                );
                assert.strictEqual(
                  finalRecipientPartitionBalance.toNumber(),
                  holdAmount
                );

                const holdData = await extension.retrieveHoldData(
                  token.address,
                  holdId
                );
                assert.strictEqual(holdData[4].toNumber(), holdAmount);

                assert.strictEqual(events![0].event, 'HoldExecuted');
                assert.strictEqual(
                  events![0].args?.secret,
                  secretHashPair.secret
                ); // HTLC mechanism
              });
            });
            describe("when the token sender doesn't provide the correct secret", function () {
              it('reverts', async function () {
                const fakeSecretHashPair = newSecretHashPair();
                await assertRevert(
                  extension
                    .connect(recipientSigner)
                    .executeHold(
                      token.address,
                      holdId,
                      holdAmount,
                      fakeSecretHashPair.secret
                    )
                );
              });
            });
          });
        });
        describe('when value is nil', function () {
          it('reverts', async function () {
            await assertRevert(
              extension
                .connect(notarySigner)
                .executeHold(token.address, holdId, 0, EMPTY_BYTE32)
            );
          });
        });
      });
      describe('when hold is in status ExecutedAndKeptOpen', function () {
        it('executes the hold', async function () {
          let holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[8], HOLD_STATUS_ORDERED);

          const partitionBalance1 = await token.balanceOfByPartition(
            partition1,
            tokenHolderSigner.getAddress()
          );
          const recipientPartitionBalance1 = await token.balanceOfByPartition(
            partition1,
            recipientSigner.getAddress()
          );

          const executedAmount = 10;
          await extension
            .connect(notarySigner)
            .executeHoldAndKeepOpen(
              token.address,
              holdId,
              executedAmount,
              EMPTY_BYTE32
            );

          holdData = await extension.retrieveHoldData(token.address, holdId);
          assert.strictEqual(holdData[8], HOLD_STATUS_EXECUTED_AND_KEPT_OPEN);

          const partitionBalance2 = await token.balanceOfByPartition(
            partition1,
            tokenHolderSigner.getAddress()
          );
          const recipientPartitionBalance2 = await token.balanceOfByPartition(
            partition1,
            recipientSigner.getAddress()
          );

          await extension
            .connect(notarySigner)
            .executeHold(
              token.address,
              holdId,
              holdAmount - executedAmount,
              EMPTY_BYTE32
            );

          const partitionBalance3 = await token.balanceOfByPartition(
            partition1,
            tokenHolderSigner.getAddress()
          );
          const recipientPartitionBalance3 = await token.balanceOfByPartition(
            partition1,
            recipientSigner.getAddress()
          );

          assert.strictEqual(partitionBalance1.toNumber(), issuanceAmount);
          assert.strictEqual(recipientPartitionBalance1.toNumber(), 0);

          assert.strictEqual(
            partitionBalance2.toNumber(),
            issuanceAmount - executedAmount
          );
          assert.strictEqual(
            recipientPartitionBalance2.toNumber(),
            executedAmount
          );

          assert.strictEqual(
            partitionBalance3.toNumber(),
            issuanceAmount - holdAmount
          );
          assert.strictEqual(recipientPartitionBalance3.toNumber(), holdAmount);
        });
      });
    });
    describe('when hold can not be executed', function () {
      it('reverts', async function () {
        await extension
          .connect(notarySigner)
          .releaseHold(token.address, holdId);

        const holdData = await extension.retrieveHoldData(
          token.address,
          holdId
        );
        assert.strictEqual(holdData[8], HOLD_STATUS_RELEASED_BY_NOTARY);

        await assertRevert(
          extension
            .connect(notarySigner)
            .executeHold(token.address, holdId, holdAmount, EMPTY_BYTE32)
        );
      });
    });
  });

  // SET TOKEN CONTROLLERS
  describe('setTokenControllers', function () {
    describe('when the caller is the token contract owner', function () {
      it('sets the operators as token controllers', async function () {
        await assertIsTokenController(
          extension,
          token,
          await controllerSigner.getAddress(),
          true
        );

        await assertIsTokenController(
          extension,
          token,
          await tokenController1Signer.getAddress(),
          false
        );
        await addTokenController(
          extension,
          token,
          signer,
          await tokenController1Signer.getAddress()
        );
        await assertIsTokenController(
          extension,
          token,
          await tokenController1Signer.getAddress(),
          true
        );
      });
    });
    describe('when the caller is an other token controller', function () {
      it('sets the operators as token controllers', async function () {
        await assertIsTokenController(
          extension,
          token,
          await controllerSigner.getAddress(),
          true
        );

        await assertIsTokenController(
          extension,
          token,
          await tokenController1Signer.getAddress(),
          false
        );
        await addTokenController(
          extension,
          token,
          signer,
          await tokenController1Signer.getAddress()
        );
        await assertIsTokenController(
          extension,
          token,
          await tokenController1Signer.getAddress(),
          true
        );

        await assertIsTokenController(
          extension,
          token,
          await tokenController2Signer.getAddress(),
          false
        );
        await addTokenController(
          extension,
          token,
          tokenController1Signer,
          await tokenController2Signer.getAddress()
        );
        await assertIsTokenController(
          extension,
          token,
          await tokenController2Signer.getAddress(),
          true
        );
      });
    });
    describe('when the caller is neither the token contract owner nor a token controller', function () {
      it('reverts', async function () {
        await assertRevert(
          addTokenController(
            extension,
            token,
            unknownSigner,
            await tokenController1Signer.getAddress()
          )
        );
      });
    });
  });

  // PRE-HOLDS
  describe('pre-hold', function () {
    beforeEach(async function () {
      await assertHoldsActivated(extension, token, true);

      const certificate = await craftCertificate(
        token.interface.encodeFunctionData('issueByPartition', [
          partition1,
          await tokenHolderSigner.getAddress(),
          issuanceAmount,
          ZERO_BYTE
        ]),
        token,
        extension,
        clock,
        controllerSigner.getAddress()
      );
      await token
        .connect(controllerSigner)
        .issueByPartition(
          partition1,
          tokenHolderSigner.getAddress(),
          issuanceAmount,
          certificate
        );
    });

    describe('when certificate is not activated', function () {
      beforeEach(async function () {
        await setCertificateActivated(
          extension,
          token,
          controllerSigner,
          CERTIFICATE_VALIDATION_NONE
        );
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_NONE
        );
      });
      describe('when pre-hold can be created', function () {
        it('creates a pre-hold', async function () {
          const initialBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );
          const initialPartitionBalance = await token.balanceOfByPartition(
            partition1,
            recipientSigner.getAddress()
          );

          const initialBalanceOnHold = await extension.balanceOnHold(
            token.address,
            recipientSigner.getAddress()
          );
          const initialBalanceOnHoldByPartition =
            await extension.balanceOnHoldByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const initialSpendableBalance = await extension.spendableBalanceOf(
            token.address,
            recipientSigner.getAddress()
          );
          const initialSpendableBalanceByPartition =
            await extension.spendableBalanceOfByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const initialTotalSupplyOnHold = await extension.totalSupplyOnHold(
            token.address
          );
          const initialTotalSupplyOnHoldByPartition =
            await extension.totalSupplyOnHoldByPartition(
              token.address,
              partition1
            );

          const time = await clock.getTime();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await extension
            .connect(controllerSigner)
            .preHoldFor(
              token.address,
              holdId,
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            );

          const finalBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );
          const finalPartitionBalance = await token.balanceOfByPartition(
            partition1,
            recipientSigner.getAddress()
          );

          const finalBalanceOnHold = await extension.balanceOnHold(
            token.address,
            recipientSigner.getAddress()
          );
          const finalBalanceOnHoldByPartition =
            await extension.balanceOnHoldByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const finalSpendableBalance = await extension.spendableBalanceOf(
            token.address,
            recipientSigner.getAddress()
          );
          const finalSpendableBalanceByPartition =
            await extension.spendableBalanceOfByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const finalTotalSupplyOnHold = await extension.totalSupplyOnHold(
            token.address
          );
          const finalTotalSupplyOnHoldByPartition =
            await extension.totalSupplyOnHoldByPartition(
              token.address,
              partition1
            );

          assert.strictEqual(initialBalance.toNumber(), 0);
          assert.strictEqual(finalBalance.toNumber(), 0);
          assert.strictEqual(initialPartitionBalance.toNumber(), 0);
          assert.strictEqual(finalPartitionBalance.toNumber(), 0);

          assert.strictEqual(initialBalanceOnHold.toNumber(), 0);
          assert.strictEqual(initialBalanceOnHoldByPartition.toNumber(), 0);
          assert.strictEqual(finalBalanceOnHold.toNumber(), 0);
          assert.strictEqual(finalBalanceOnHoldByPartition.toNumber(), 0);

          assert.strictEqual(initialSpendableBalance.toNumber(), 0);
          assert.strictEqual(initialSpendableBalanceByPartition.toNumber(), 0);
          assert.strictEqual(finalSpendableBalance.toNumber(), 0);
          assert.strictEqual(finalSpendableBalanceByPartition.toNumber(), 0);

          assert.strictEqual(initialTotalSupplyOnHold.toNumber(), 0);
          assert.strictEqual(initialTotalSupplyOnHoldByPartition.toNumber(), 0);
          assert.strictEqual(finalTotalSupplyOnHold.toNumber(), 0);
          assert.strictEqual(finalTotalSupplyOnHoldByPartition.toNumber(), 0);

          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[0], partition1);
          assert.strictEqual(holdData[1], ZERO_ADDRESS);
          assert.strictEqual(holdData[2], await recipientSigner.getAddress());
          assert.strictEqual(holdData[3], await notarySigner.getAddress());
          assert.strictEqual(holdData[4].toNumber(), holdAmount);
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );
          assert.strictEqual(holdData[6], secretHashPair.hash);
          assert.strictEqual(holdData[7], EMPTY_BYTE32);
          assert.strictEqual(holdData[8], HOLD_STATUS_ORDERED);
        });
        it('emits an event', async function () {
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          const time = await clock.getTime();
          const { events } = await extension
            .connect(controllerSigner)
            .preHoldFor(
              token.address,
              holdId,
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            )
            .then((res) => res.wait());

          assert.strictEqual(events![0].event, 'HoldCreated');
          assert.strictEqual(events![0].args?.token, token.address);
          assert.strictEqual(events![0].args?.holdId, holdId);
          assert.strictEqual(events![0].args?.partition, partition1);
          assert.strictEqual(events![0].args?.sender, ZERO_ADDRESS);
          assert.strictEqual(
            events![0].args?.recipient,
            await recipientSigner.getAddress()
          );
          assert.strictEqual(
            events![0].args?.notary,
            await notarySigner.getAddress()
          );
          assert.strictEqual(
            BigNumber.from(events![0].args?.value).eq(holdAmount),
            true
          );
          assert.strictEqual(
            (events![0].args?.expiration).toNumber() >=
              time.toNumber() + SECONDS_IN_AN_HOUR,
            true
          );
          assert.strictEqual(
            (events![0].args?.expiration).toNumber() <
              time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );
          assert.strictEqual(events![0].args?.secretHash, secretHashPair.hash);
        });
        it('creates a pre-hold with expiration time', async function () {
          const time = (await clock.getTime()).toNumber();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await extension
            .connect(controllerSigner)
            .preHoldForWithExpirationDate(
              token.address,
              holdId,
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              time + SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            );

          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[0], partition1);
          assert.strictEqual(holdData[1], ZERO_ADDRESS);
          assert.strictEqual(holdData[2], await recipientSigner.getAddress());
          assert.strictEqual(holdData[3], await notarySigner.getAddress());
          assert.strictEqual(holdData[4].toNumber(), holdAmount);
          assert.strictEqual(holdData[5].toNumber(), time + SECONDS_IN_AN_HOUR);
          assert.strictEqual(holdData[6], secretHashPair.hash);
          assert.strictEqual(holdData[7], EMPTY_BYTE32);
          assert.strictEqual(holdData[8], HOLD_STATUS_ORDERED);
        });
        it('creates and releases a pre-hold', async function () {
          const time = (await clock.getTime()).toNumber();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await extension
            .connect(controllerSigner)
            .preHoldForWithExpirationDate(
              token.address,
              holdId,
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              time + SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            );
          await extension
            .connect(notarySigner)
            .releaseHold(token.address, holdId);

          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[0], partition1);
          assert.strictEqual(holdData[1], ZERO_ADDRESS);
          assert.strictEqual(holdData[2], await recipientSigner.getAddress());
          assert.strictEqual(holdData[3], await notarySigner.getAddress());
          assert.strictEqual(holdData[4].toNumber(), holdAmount);
          assert.strictEqual(holdData[5].toNumber(), time + SECONDS_IN_AN_HOUR);
          assert.strictEqual(holdData[6], secretHashPair.hash);
          assert.strictEqual(holdData[7], EMPTY_BYTE32);
          assert.strictEqual(holdData[8], HOLD_STATUS_RELEASED_BY_NOTARY);
        });
        it('creates and renews a pre-hold', async function () {
          const time = (await clock.getTime()).toNumber();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await extension
            .connect(controllerSigner)
            .preHoldForWithExpirationDate(
              token.address,
              holdId,
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              time + SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            );
          await extension
            .connect(controllerSigner)
            .renewHold(token.address, holdId, SECONDS_IN_A_DAY, ZERO_BYTE);

          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[0], partition1);
          assert.strictEqual(holdData[1], ZERO_ADDRESS);
          assert.strictEqual(holdData[2], await recipientSigner.getAddress());
          assert.strictEqual(holdData[3], await notarySigner.getAddress());
          assert.strictEqual(holdData[4].toNumber(), holdAmount);
          assert.strictEqual(
            holdData[5].toNumber() >= time + SECONDS_IN_A_DAY - 2,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time + SECONDS_IN_A_DAY + 100,
            true
          );
          assert.strictEqual(holdData[6], secretHashPair.hash);
          assert.strictEqual(holdData[7], EMPTY_BYTE32);
          assert.strictEqual(holdData[8], HOLD_STATUS_ORDERED);
        });
        it('creates a pre-hold and fails renewing it', async function () {
          const time = (await clock.getTime()).toNumber();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await extension
            .connect(controllerSigner)
            .preHoldForWithExpirationDate(
              token.address,
              holdId,
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              time + SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            );
          await assertRevert(
            extension
              .connect(recipientSigner)
              .renewHold(token.address, holdId, SECONDS_IN_A_DAY, ZERO_BYTE)
          );
        });
        it('creates and executes pre-hold', async function () {
          const initialBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );
          const initialPartitionBalance = await token.balanceOfByPartition(
            partition1,
            recipientSigner.getAddress()
          );

          const initialBalanceOnHold = await extension.balanceOnHold(
            token.address,
            recipientSigner.getAddress()
          );
          const initialBalanceOnHoldByPartition =
            await extension.balanceOnHoldByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const initialSpendableBalance = await extension.spendableBalanceOf(
            token.address,
            recipientSigner.getAddress()
          );
          const initialSpendableBalanceByPartition =
            await extension.spendableBalanceOfByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const initialTotalSupplyOnHold = await extension.totalSupplyOnHold(
            token.address
          );
          const initialTotalSupplyOnHoldByPartition =
            await extension.totalSupplyOnHoldByPartition(
              token.address,
              partition1
            );

          const time = await clock.getTime();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await extension
            .connect(controllerSigner)
            .preHoldFor(
              token.address,
              holdId,
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            );
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());
          await extension
            .connect(recipientSigner)
            .executeHold(
              token.address,
              holdId,
              holdAmount,
              secretHashPair.secret
            );

          const finalBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );
          const finalPartitionBalance = await token.balanceOfByPartition(
            partition1,
            recipientSigner.getAddress()
          );

          const finalBalanceOnHold = await extension.balanceOnHold(
            token.address,
            recipientSigner.getAddress()
          );
          const finalBalanceOnHoldByPartition =
            await extension.balanceOnHoldByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const finalSpendableBalance = await extension.spendableBalanceOf(
            token.address,
            recipientSigner.getAddress()
          );
          const finalSpendableBalanceByPartition =
            await extension.spendableBalanceOfByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const finalTotalSupplyOnHold = await extension.totalSupplyOnHold(
            token.address
          );
          const finalTotalSupplyOnHoldByPartition =
            await extension.totalSupplyOnHoldByPartition(
              token.address,
              partition1
            );

          assert.strictEqual(initialBalance.toNumber(), 0);
          assert.strictEqual(finalBalance.toNumber(), holdAmount);
          assert.strictEqual(initialPartitionBalance.toNumber(), 0);
          assert.strictEqual(finalPartitionBalance.toNumber(), holdAmount);

          assert.strictEqual(initialBalanceOnHold.toNumber(), 0);
          assert.strictEqual(initialBalanceOnHoldByPartition.toNumber(), 0);
          assert.strictEqual(finalBalanceOnHold.toNumber(), 0);
          assert.strictEqual(finalBalanceOnHoldByPartition.toNumber(), 0);

          assert.strictEqual(initialSpendableBalance.toNumber(), 0);
          assert.strictEqual(initialSpendableBalanceByPartition.toNumber(), 0);
          assert.strictEqual(finalSpendableBalance.toNumber(), holdAmount);
          assert.strictEqual(
            finalSpendableBalanceByPartition.toNumber(),
            holdAmount
          );

          assert.strictEqual(initialTotalSupplyOnHold.toNumber(), 0);
          assert.strictEqual(initialTotalSupplyOnHoldByPartition.toNumber(), 0);
          assert.strictEqual(finalTotalSupplyOnHold.toNumber(), 0);
          assert.strictEqual(finalTotalSupplyOnHoldByPartition.toNumber(), 0);

          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[0], partition1);
          assert.strictEqual(holdData[1], ZERO_ADDRESS);
          assert.strictEqual(holdData[2], await recipientSigner.getAddress());
          assert.strictEqual(holdData[3], await notarySigner.getAddress());
          assert.strictEqual(holdData[4].toNumber(), holdAmount);
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );
          assert.strictEqual(holdData[6], secretHashPair.hash);
          assert.strictEqual(holdData[7], secretHashPair.secret);
          assert.strictEqual(holdData[8], HOLD_STATUS_EXECUTED);
        });
        it('creates and executes pre-hold in 2 times', async function () {
          const initialBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );

          const time = await clock.getTime();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await extension
            .connect(controllerSigner)
            .preHoldFor(
              token.address,
              holdId,
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            );
          await extension
            .connect(controllerSigner)
            .addAllowlisted(token.address, recipientSigner.getAddress());
          await extension
            .connect(recipientSigner)
            .executeHoldAndKeepOpen(
              token.address,
              holdId,
              holdAmount - 100,
              secretHashPair.secret
            );

          const intermediateBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );

          let holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[0], partition1);
          assert.strictEqual(holdData[1], ZERO_ADDRESS);
          assert.strictEqual(holdData[2], await recipientSigner.getAddress());
          assert.strictEqual(holdData[3], await notarySigner.getAddress());
          assert.strictEqual(holdData[4].toNumber(), 100);
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );
          assert.strictEqual(holdData[6], secretHashPair.hash);
          assert.strictEqual(holdData[7], secretHashPair.secret);
          assert.strictEqual(holdData[8], HOLD_STATUS_EXECUTED_AND_KEPT_OPEN);

          await extension
            .connect(recipientSigner)
            .executeHold(token.address, holdId, 100, secretHashPair.secret);

          const finalBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );

          assert.strictEqual(initialBalance.toNumber(), 0);
          assert.strictEqual(intermediateBalance.toNumber(), holdAmount - 100);
          assert.strictEqual(finalBalance.toNumber(), holdAmount);

          holdData = await extension.retrieveHoldData(token.address, holdId);
          assert.strictEqual(holdData[0], partition1);
          assert.strictEqual(holdData[1], ZERO_ADDRESS);
          assert.strictEqual(holdData[2], await recipientSigner.getAddress());
          assert.strictEqual(holdData[3], await notarySigner.getAddress());
          assert.strictEqual(holdData[4].toNumber(), 100);
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );
          assert.strictEqual(holdData[6], secretHashPair.hash);
          assert.strictEqual(holdData[7], secretHashPair.secret);
          assert.strictEqual(holdData[8], HOLD_STATUS_EXECUTED);
        });
      });
      describe('when pre-hold can not be created', function () {
        describe('when expiration date is not valid', function () {
          it('reverts', async function () {
            const time = (await clock.getTime()).toNumber();
            const holdId = newHoldId();
            const secretHashPair = newSecretHashPair();
            await assertRevert(
              extension
                .connect(controllerSigner)
                .preHoldForWithExpirationDate(
                  token.address,
                  holdId,
                  recipientSigner.getAddress(),
                  notarySigner.getAddress(),
                  partition1,
                  holdAmount,
                  time - 1,
                  secretHashPair.hash,
                  ZERO_BYTE
                )
            );
          });
        });
        describe('when caller is not a minter', function () {
          it('reverts', async function () {
            const holdId = newHoldId();
            const secretHashPair = newSecretHashPair();
            await assertRevert(
              extension
                .connect(notarySigner)
                .preHoldFor(
                  token.address,
                  holdId,
                  recipientSigner.getAddress(),
                  notarySigner.getAddress(),
                  partition1,
                  holdAmount,
                  SECONDS_IN_AN_HOUR,
                  secretHashPair.hash,
                  ZERO_BYTE
                )
            );
          });
        });
      });
    });
    describe('when certificate is activated', function () {
      beforeEach(async function () {
        await assertCertificateActivated(
          extension,
          token,
          CERTIFICATE_VALIDATION_SALT
        );
      });
      describe('when certificate is valid', function () {
        it('creates a pre-hold', async function () {
          const initialBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );
          const initialPartitionBalance = await token.balanceOfByPartition(
            partition1,
            recipientSigner.getAddress()
          );

          const initialBalanceOnHold = await extension.balanceOnHold(
            token.address,
            recipientSigner.getAddress()
          );
          const initialBalanceOnHoldByPartition =
            await extension.balanceOnHoldByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const initialSpendableBalance = await extension.spendableBalanceOf(
            token.address,
            recipientSigner.getAddress()
          );
          const initialSpendableBalanceByPartition =
            await extension.spendableBalanceOfByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const initialTotalSupplyOnHold = await extension.totalSupplyOnHold(
            token.address
          );
          const initialTotalSupplyOnHoldByPartition =
            await extension.totalSupplyOnHoldByPartition(
              token.address,
              partition1
            );

          const time = await clock.getTime();
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          const certificate = await craftCertificate(
            extension.interface.encodeFunctionData('preHoldFor', [
              token.address,
              holdId,
              await recipientSigner.getAddress(),
              await notarySigner.getAddress(),
              partition1,
              holdAmount,
              SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              ZERO_BYTE
            ]),
            token,
            extension,
            clock, // clock
            controllerSigner.getAddress()
          );
          await extension
            .connect(controllerSigner)
            .preHoldFor(
              token.address,
              holdId,
              recipientSigner.getAddress(),
              notarySigner.getAddress(),
              partition1,
              holdAmount,
              SECONDS_IN_AN_HOUR,
              secretHashPair.hash,
              certificate
            );

          const finalBalance = await token.balanceOf(
            recipientSigner.getAddress()
          );
          const finalPartitionBalance = await token.balanceOfByPartition(
            partition1,
            recipientSigner.getAddress()
          );

          const finalBalanceOnHold = await extension.balanceOnHold(
            token.address,
            recipientSigner.getAddress()
          );
          const finalBalanceOnHoldByPartition =
            await extension.balanceOnHoldByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const finalSpendableBalance = await extension.spendableBalanceOf(
            token.address,
            recipientSigner.getAddress()
          );
          const finalSpendableBalanceByPartition =
            await extension.spendableBalanceOfByPartition(
              token.address,
              partition1,
              recipientSigner.getAddress()
            );

          const finalTotalSupplyOnHold = await extension.totalSupplyOnHold(
            token.address
          );
          const finalTotalSupplyOnHoldByPartition =
            await extension.totalSupplyOnHoldByPartition(
              token.address,
              partition1
            );

          assert.strictEqual(initialBalance.toNumber(), 0);
          assert.strictEqual(finalBalance.toNumber(), 0);
          assert.strictEqual(initialPartitionBalance.toNumber(), 0);
          assert.strictEqual(finalPartitionBalance.toNumber(), 0);

          assert.strictEqual(initialBalanceOnHold.toNumber(), 0);
          assert.strictEqual(initialBalanceOnHoldByPartition.toNumber(), 0);
          assert.strictEqual(finalBalanceOnHold.toNumber(), 0);
          assert.strictEqual(finalBalanceOnHoldByPartition.toNumber(), 0);

          assert.strictEqual(initialSpendableBalance.toNumber(), 0);
          assert.strictEqual(initialSpendableBalanceByPartition.toNumber(), 0);
          assert.strictEqual(finalSpendableBalance.toNumber(), 0);
          assert.strictEqual(finalSpendableBalanceByPartition.toNumber(), 0);

          assert.strictEqual(initialTotalSupplyOnHold.toNumber(), 0);
          assert.strictEqual(initialTotalSupplyOnHoldByPartition.toNumber(), 0);
          assert.strictEqual(finalTotalSupplyOnHold.toNumber(), 0);
          assert.strictEqual(finalTotalSupplyOnHoldByPartition.toNumber(), 0);

          const holdData = await extension.retrieveHoldData(
            token.address,
            holdId
          );
          assert.strictEqual(holdData[0], partition1);
          assert.strictEqual(holdData[1], ZERO_ADDRESS);
          assert.strictEqual(holdData[2], await recipientSigner.getAddress());
          assert.strictEqual(holdData[3], await notarySigner.getAddress());
          assert.strictEqual(holdData[4].toNumber(), holdAmount);
          assert.strictEqual(
            holdData[5].toNumber() >= time.toNumber() + SECONDS_IN_AN_HOUR,
            true
          );
          assert.strictEqual(
            holdData[5].toNumber() < time.toNumber() + SECONDS_IN_AN_HOUR + 100,
            true
          );
          assert.strictEqual(holdData[6], secretHashPair.hash);
          assert.strictEqual(holdData[7], EMPTY_BYTE32);
          assert.strictEqual(holdData[8], HOLD_STATUS_ORDERED);
        });
      });
      describe('when certificate is not valid', function () {
        it('creates a pre-hold', async function () {
          const holdId = newHoldId();
          const secretHashPair = newSecretHashPair();
          await assertRevert(
            extension
              .connect(controllerSigner)
              .preHoldFor(
                token.address,
                holdId,
                recipientSigner.getAddress(),
                notarySigner.getAddress(),
                partition1,
                holdAmount,
                SECONDS_IN_AN_HOUR,
                secretHashPair.hash,
                ZERO_BYTE
              )
          );
        });
      });
    });
  });
});
