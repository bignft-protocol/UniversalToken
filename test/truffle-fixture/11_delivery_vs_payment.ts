import { ethers } from 'ethers';
import { getSigner } from '../../test/common/wallet';
import {
  ERC1820Registry__factory,
  Swaps__factory
} from '../../typechain-types';

const DELIVERY_VS_PAYMENT = 'DeliveryVsPayment';

export default async function () {
  const owner = getSigner();

  const dvpContract = await new Swaps__factory(owner).deploy(false);
  Swaps__factory.setAsDeployed(dvpContract);
  console.log('\n   > DVP deployment: Success -->', dvpContract.address);

  const registry = ERC1820Registry__factory.deployed;

  await registry
    .connect(owner)
    .setInterfaceImplementer(
      owner.getAddress(),
      ethers.utils.id(DELIVERY_VS_PAYMENT),
      dvpContract.address
    );

  const registeredDVPAddress = await registry.getInterfaceImplementer(
    owner.getAddress(),
    ethers.utils.id(DELIVERY_VS_PAYMENT)
  );

  if (registeredDVPAddress === dvpContract.address) {
    console.log(
      '\n   > DVP registry in ERC1820: Success -->',
      registeredDVPAddress
    );
  }
}
