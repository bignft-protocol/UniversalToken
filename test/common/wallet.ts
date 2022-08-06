import { ethers } from 'ethers';
import { network } from 'hardhat';

// @ts-ignore
export const provider = new ethers.providers.Web3Provider(network.provider);

export function getSigners(num: number = 20): ethers.providers.JsonRpcSigner[] {
  const signers = [];
  for (let i = 0; i < num; i++) {
    signers.push(provider.getSigner(i));
  }
  return signers;
}

export function getSigner(
  addressOrIndex?: string | number
): ethers.providers.JsonRpcSigner {
  return provider.getSigner(addressOrIndex);
}
