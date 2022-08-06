import { ethers } from 'ethers';
import { getSigner } from '../../test/common/wallet';
import {
  ERC1820Registry__factory,
  FundIssuer__factory
} from '../../typechain-types';

const FUND_ISSUER = 'FundIssuer';

export default async function () {
  const owner = getSigner();

  const fundIssuer = await new FundIssuer__factory(owner).deploy();
  FundIssuer__factory.setAsDeployed(fundIssuer);
  console.log('\n   > FundIssuer deployment: Success -->', fundIssuer.address);

  const registry = ERC1820Registry__factory.deployed;

  await registry
    .connect(owner)
    .setInterfaceImplementer(
      owner.getAddress(),
      ethers.utils.id(FUND_ISSUER),
      fundIssuer.address
    );

  const registeredFundIssuerAddress = await registry.getInterfaceImplementer(
    owner.getAddress(),
    ethers.utils.id(FUND_ISSUER)
  );

  if (registeredFundIssuerAddress === fundIssuer.address) {
    console.log(
      '\n   > FundIssuer registry in ERC1820: Success -->',
      registeredFundIssuerAddress
    );
  }
}
