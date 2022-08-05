import { ethers } from 'hardhat';
import { getSigners } from '../../test/common/wallet';
import {
  ERC1820Registry__factory,
  FundIssuer__factory
} from '../../typechain-types';

const FUND_ISSUER = 'FundIssuer';

export default async function () {
  const [owner] = getSigners(1);

  const fundIssuer = await new FundIssuer__factory(owner).deploy();
  FundIssuer__factory.setAsDeployed(fundIssuer);
  console.log('\n   > FundIssuer deployment: Success -->', fundIssuer.address);

  const registry = ERC1820Registry__factory.deployed;

  await registry.setInterfaceImplementer(
    owner.address,
    ethers.utils.id(FUND_ISSUER),
    fundIssuer.address,
    { from: owner.address }
  );

  const registeredFundIssuerAddress = await registry.getInterfaceImplementer(
    owner.address,
    ethers.utils.id(FUND_ISSUER)
  );

  if (registeredFundIssuerAddress === fundIssuer.address) {
    console.log(
      '\n   > FundIssuer registry in ERC1820: Success -->',
      registeredFundIssuerAddress
    );
  }
}
