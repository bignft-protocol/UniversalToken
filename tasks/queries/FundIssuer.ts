import { ethers } from 'ethers';
import { getSigners } from 'hardhat';
import { ERC1400__factory, FundIssuer__factory } from '../../typechain-types';

export default async function () {
  const [owner, signer, signer2, fundSigner] = getSigners(4);
  const token = ERC1400__factory.connect(
    '0x13774eA20E7dEa22D4CAA7b93aDd9Dc5b9BB0f87',
    owner
  );

  const fundIssuer = FundIssuer__factory.connect(
    '0x88B59f143e2Ff51d29d6Ae75f2074dea8E56C502',
    signer
  );

  console.log('\n   > FundIssuer deployment: Success -->', fundIssuer.address);

  const ret = await fundIssuer.getAssetRules(
    token.address,

    ethers.utils.hexlify(Buffer.from('reserved')).padEnd(66, '0')
  );

  console.log(ret);
}
