import { ethers, artifacts } from 'hardhat';

async function main() {
  const Swaps = artifacts.require('Swaps');

  const [owner] = await ethers.getSigners();

  const swaps = await Swaps.new(false, {
    from: owner
  });

  Swaps.setAsDeployed(swaps);

  console.log('Swaps deployed at: ' + swaps.address);

  process.exit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
