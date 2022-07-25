async function main() {
  const ERC1400 = artifacts.require('ERC1400');

  const partition1 =
    '0x7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
  const partition2 =
    '0x6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
  const partition3 =
    '0x6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex

  const partitions = [];

  const controller = '0xdc05090A39650026E6AFe89b2e795fd57a3cfEC7';

  const erc1400 = await ERC1400.new(
    'ERC1400Token',
    'DAU',
    0,
    [controller],
    partitions
  );

  await ERC1400.deployed();

  console.log('ERC1400 deployed at: ' + erc1400.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
