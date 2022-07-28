import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

module.exports = async () => {
  const network = await ethers.provider.getNetwork();
  if (network.name === 'test') return;

  for (const file of fs
    .readdirSync(__dirname)
    .filter((file) => file.match(/index\.(?:t|j)s/) === null)
    .sort(
      (f1, f2) => parseInt(f1.split('_')[0]) - parseInt(f2.split('_')[0])
    )) {
    const { default: fn } = await import(path.resolve(file));
    await fn();
  }
};
