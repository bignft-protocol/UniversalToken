import { artifacts, ethers } from 'hardhat';
import type { ERC1820Registry, Swaps } from '../../typechain-types';

const DVPContract = artifacts.require('Swaps');

const ERC1820Registry = artifacts.require('ERC1820Registry');

const DELIVERY_VS_PAYMENT = 'DeliveryVsPayment';

export default async function () {
  const [owner] = await ethers.getSigners();

  const dvpContract: Swaps = await DVPContract.new(false);
  DVPContract.setAsDeployed(dvpContract);
  console.log('\n   > DVP deployment: Success -->', dvpContract.address);

  const registry: ERC1820Registry = await ERC1820Registry.deployed();

  await registry.setInterfaceImplementer(
    owner.address,
    ethers.utils.id(DELIVERY_VS_PAYMENT),
    dvpContract.address,
    { from: owner.address }
  );

  const registeredDVPAddress = await registry.getInterfaceImplementer(
    owner.address,
    ethers.utils.id(DELIVERY_VS_PAYMENT)
  );

  if (registeredDVPAddress === dvpContract.address) {
    console.log(
      '\n   > DVP registry in ERC1820: Success -->',
      registeredDVPAddress
    );
  }
}
