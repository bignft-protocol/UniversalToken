import { ethers } from 'hardhat';
import {
  ERC1820Registry__factory,
  Swaps__factory
} from '../../typechain-types';

const DELIVERY_VS_PAYMENT = 'DeliveryVsPayment';

export default async function () {
  const [owner] = await ethers.getSigners();

  const dvpContract = await new Swaps__factory(owner).deploy(false);
  Swaps__factory.setAsDeployed(dvpContract);
  console.log('\n   > DVP deployment: Success -->', dvpContract.address);

  const registry = ERC1820Registry__factory.deployed;

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
