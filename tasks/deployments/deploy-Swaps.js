async function main() {
  const Swaps = artifacts.require('Swaps');

  const from = '0x4EeABa74D7f51fe3202D7963EFf61D2e7e166cBa';

  const swaps = await Swaps.new(false, {
    from: from
  });

  console.log('Swaps deployed at: ' + swaps.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
