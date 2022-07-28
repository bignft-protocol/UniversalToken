import { artifacts, ethers } from 'hardhat';
import type { ERC1820Registry, FundIssuer } from 'typechain-types';

const FundIssuer = artifacts.require('FundIssuer');
const ERC1820Registry = artifacts.require('ERC1820Registry');

const FUND_ISSUER = 'FundIssuer';

export default async function () {
  const [owner] = await ethers.getSigners();

  const fundIssuer: FundIssuer = await FundIssuer.new();
  FundIssuer.setAsDeployed(fundIssuer);
  console.log('\n   > FundIssuer deployment: Success -->', fundIssuer.address);

  const registry: ERC1820Registry = await ERC1820Registry.deployed();

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
