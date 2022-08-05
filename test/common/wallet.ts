import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { HDNode } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';
import { HardhatNetworkHDAccountsConfig } from 'hardhat/types';

export function getSigners(num: number = 20): SignerWithAddress[] {
  const signers = [];
  for (let i = 0; i < num; i++) {
    const { address } = HDNode.fromMnemonic(
      (network.config.accounts as HardhatNetworkHDAccountsConfig).mnemonic
    ).derivePath(`m/44'/60'/0'/0/${i}`);
    // @ts-ignore
    const signer = ethers.provider.getSigner(i) as SignerWithAddress;
    // @ts-ignore
    signer.address = address;
    signers.push(signer);
  }
  return signers;
}
