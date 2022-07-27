// @ts-nocheck

import { ethers, web3 } from 'hardhat';

// ---------- Module to accelerate time -----------------------
export const advanceTime = (time: any) => {
  return ethers.provider.send('evm_increaseTime', [time]);
};

export const advanceBlock = () => {
  return ethers.provider.send('evm_mine', []);
};

export const advanceTimeAndBlock = async (time: any) => {
  await advanceTime(time);
  await advanceBlock();
  return Promise.resolve(web3.eth.getBlock('latest'));
};

export const takeSnapshot = () => {
  return ethers.provider.send('evm_snapshot', []);
};

export const revertToSnapshot = (snapShotId: any) => {
  return ethers.provider.send('evm_revert', [snapShotId]);
};

// ---------- Module to accelerate time (end)------------------

export const nowSeconds = () => Math.floor(Date.now() / 1000);
export const nowMilliseconds = () => Date.now();

export const epochSeconds = (date: { getTime: () => number }) => {
  Math.floor(date.getTime() / 1000);
};

export const sleep = async (milliseconds: number | undefined) => {
  await new Promise((r) => setTimeout(r, milliseconds));
};

export const addDays = (date: string | number | Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
