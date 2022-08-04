import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

export default async (steps: number[] = []) => {
  const network = await ethers.provider.getNetwork();
  if (network.name === 'test') return;

  const items = fs
    .readdirSync(__dirname)
    .filter((file) => file.match(/index\.(?:t|j)s/) === null)
    .map((f) => ({
      step: parseInt(f.split('_')[0]),
      file: path.resolve(__dirname, f)
    }))
    .filter((item) => !steps.length || steps.includes(item.step))
    .sort((item1, item2) => item1.step - item2.step);

  for (const item of items) {
    const { default: fn } = await import(item.file);
    await fn();
  }
};
