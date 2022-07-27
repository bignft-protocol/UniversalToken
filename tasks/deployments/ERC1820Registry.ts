import { ethers, artifacts } from 'hardhat';

async function main() {
  const ERC1820Registry = artifacts.require('ERC1820Registry');

  const [owner] = await ethers.getSigners();

  const erc1820Registry = await ERC1820Registry.new(false, {
    from: owner
  });

  ERC1820Registry.setAsDeployed(erc1820Registry);

  console.log('ERC1820Registry deployed at: ' + erc1820Registry.address);

  process.exit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
