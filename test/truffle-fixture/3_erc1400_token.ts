import { getSigners } from 'hardhat';
import { partitions } from '../../test/utils/bytes';
import { ERC1400__factory } from '../../typechain-types';

export default async function () {
  const [owner, controllerSigner] = getSigners(2);
  const erc1400Token = await new ERC1400__factory(owner).deploy(
    'ERC1400Token',
    'DAU',
    1,
    [controllerSigner.getAddress()],
    partitions
  );
  ERC1400__factory.setAsDeployed(erc1400Token);
  console.log(
    '\n   > ERC1400 token deployment: Success -->',
    erc1400Token.address
  );
}
