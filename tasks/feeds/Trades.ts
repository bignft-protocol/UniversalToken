import { artifacts } from 'hardhat';

import { CERTIFICATE_VALIDATION_DEFAULT } from '../../test/common/extension';
import { ZERO_BYTE } from '../../test/utils/assert';
import {
  ERC1400HoldableCertificateToken__factory,
  ERC1400TokensValidator__factory,
  Swaps__factory
} from '../../typechain-types';
import { getSigners } from '../../test/common/wallet';

type Args = {
  address: string;
};

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

export default async function (args: Args) {
  const [owner, controller, tokenHolder, recipient] = getSigners();

  // require fixture first
  await (
    await import('../../test/truffle-fixture/2_erc1820_registry')
  ).default();

  const dvp = Swaps__factory.connect(args.address, owner);
  const tradeIndex = (await dvp.getNbTrades()).toNumber();
  const trade = await dvp.getTrade(tradeIndex);
  console.log('trade', trade);

  const extension = await new ERC1400TokensValidator__factory(owner).deploy();

  const transferAmount = 300;

  const token1 = await new ERC1400HoldableCertificateToken__factory(
    controller
  ).deploy(
    'ERC1400Token',
    'DAU',
    2,
    [controller.getAddress()],
    partitions,
    extension.address,
    owner.getAddress(),
    CERTIFICATE_SIGNER,
    CERTIFICATE_VALIDATION_DEFAULT
  );

  const token2 = await new ERC1400HoldableCertificateToken__factory(
    controller
  ).deploy(
    'ERC1400Token',
    'DAU',
    2,
    [controller.getAddress()],
    partitions,
    extension.address,
    owner.getAddress(),
    CERTIFICATE_SIGNER,
    CERTIFICATE_VALIDATION_DEFAULT
  );
}
