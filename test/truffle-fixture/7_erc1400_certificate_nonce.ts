import { getSigners } from 'hardhat';
import { partitions } from '../../test/utils/bytes';
import {
  ERC1400HoldableCertificateToken__factory,
  ERC1400TokensValidator__factory
} from '../../typechain-types';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ERC1400_TOKENS_VALIDATOR = 'ERC1400TokensValidator';

const CERTIFICATE_VALIDATION_NONE = 0;
const CERTIFICATE_VALIDATION_NONCE = 1;
const CERTIFICATE_VALIDATION_SALT = 2;

export default async function () {
  const [owner, controllerSigner] = getSigners(2);
  const extension = ERC1400TokensValidator__factory.deployed;

  const tokenInstance = await new ERC1400HoldableCertificateToken__factory(
    owner
  ).deploy(
    'ERC1400HoldableCertificateNonceToken',
    'DAU',
    1,
    [controllerSigner.getAddress()],
    partitions,
    extension.address,
    controllerSigner.getAddress(),
    CERTIFICATE_SIGNER,
    CERTIFICATE_VALIDATION_NONCE
  );

  console.log(
    '\n   > ERC1400HoldableCertificateNonceToken token deployment with automated extension setup: Success -->',
    tokenInstance.address
  );

  const tokenInstance2 = await new ERC1400HoldableCertificateToken__factory(
    owner
  ).deploy(
    'ERC1400HoldableCertificateNonceToken',
    'DAU',
    1,
    [controllerSigner.getAddress()],
    partitions,
    ZERO_ADDRESS,
    ZERO_ADDRESS,
    CERTIFICATE_SIGNER,
    CERTIFICATE_VALIDATION_NONE
  );

  console.log(
    '\n   > ERC1400HoldableCertificateNonceToken token deployment with manual extension setup: Success -->',
    tokenInstance2.address
  );

  await extension.registerTokenSetup(
    tokenInstance2.address,
    CERTIFICATE_VALIDATION_NONCE,
    true,
    true,
    true,
    true,
    [controllerSigner.getAddress()]
  );
  console.log('\n   > Manual token extension setup: Success');

  await tokenInstance2.setTokenExtension(
    extension.address,
    ERC1400_TOKENS_VALIDATOR,
    true,
    true,
    true
  );
  console.log('\n   > Manual token connection to token extension: Success');

  await tokenInstance2.transferOwnership(controllerSigner.getAddress());
  console.log('\n   > Manual token ownership transfer: Success');
}
