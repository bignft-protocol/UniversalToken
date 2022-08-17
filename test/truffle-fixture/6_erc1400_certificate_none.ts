import { getSigners } from 'hardhat';
import { ZERO_ADDRESS } from '../../test/utils/assert';
import { partitions } from '../../test/utils/bytes';
import { ERC1400HoldableCertificateToken__factory } from '../../typechain-types';

const CERTIFICATE_SIGNER = '0xe31C41f0f70C5ff39f73B4B94bcCD767b3071630';

const CERTIFICATE_VALIDATION_NONE = 0;
const CERTIFICATE_VALIDATION_NONCE = 1;
const CERTIFICATE_VALIDATION_SALT = 2;

export default async function () {
  const [owner, controllerSigner] = getSigners(2);
  const erc1400HoldableCertificateToken =
    await new ERC1400HoldableCertificateToken__factory(owner).deploy(
      'ERC1400HoldableCertificateToken',
      'DAU',
      1,
      [controllerSigner.getAddress()],
      partitions,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      CERTIFICATE_SIGNER,
      CERTIFICATE_VALIDATION_NONE
    );
  ERC1400HoldableCertificateToken__factory.setAsDeployed(
    erc1400HoldableCertificateToken
  );
  console.log(
    '\n   > ERC1400HoldableCertificateToken token deployment without extension: Success -->',
    erc1400HoldableCertificateToken.address
  );
}
