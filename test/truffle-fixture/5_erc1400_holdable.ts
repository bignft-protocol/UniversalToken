import { getSigner } from '../../test/common/wallet';
import {
  ERC1400HoldableToken__factory,
  ERC1400TokensValidator__factory
} from '../../typechain-types';

const controller = '0xb5747835141b46f7C472393B31F8F5A57F74A44f';

const partition1 =
  '0x7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
const partition2 =
  '0x6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
const partition3 =
  '0x6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex
const partitions = [partition1, partition2, partition3];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ERC1400_TOKENS_VALIDATOR = 'ERC1400TokensValidator';

const CERTIFICATE_VALIDATION_NONE = 0;
const CERTIFICATE_VALIDATION_NONCE = 1;
const CERTIFICATE_VALIDATION_SALT = 2;

export default async function () {
  const owner = getSigner();
  const erc1400HoldableToken = await new ERC1400HoldableToken__factory(
    owner
  ).deploy(
    'ERC1400HoldableToken',
    'DAU',
    1,
    [controller],
    partitions,
    ZERO_ADDRESS,
    ZERO_ADDRESS
  );
  ERC1400HoldableToken__factory.setAsDeployed(erc1400HoldableToken);
  console.log(
    '\n   > ERC1400HoldableToken token deployment without extension: Success -->',
    erc1400HoldableToken.address
  );

  const extension = ERC1400TokensValidator__factory.deployed;

  const tokenInstance = await new ERC1400HoldableToken__factory(owner).deploy(
    'ERC1400HoldableToken',
    'DAU',
    1,
    [controller],
    partitions,
    extension.address,
    controller
  );

  console.log(
    '\n   > ERC1400HoldableToken token deployment with automated extension setup: Success -->',
    tokenInstance.address
  );

  const tokenInstance2 = await new ERC1400HoldableToken__factory(owner).deploy(
    'ERC1400HoldableToken',
    'DAU',
    1,
    [controller],
    partitions,
    ZERO_ADDRESS,
    ZERO_ADDRESS
  );

  console.log(
    '\n   > ERC1400HoldableToken token deployment with manual extension setup: Success -->',
    tokenInstance2.address
  );

  await extension.registerTokenSetup(
    tokenInstance2.address,
    CERTIFICATE_VALIDATION_NONE,
    true,
    true,
    true,
    true,
    [controller]
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

  await tokenInstance2.transferOwnership(controller);
  console.log('\n   > Manual token ownership transfer: Success');
}
