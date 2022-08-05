import { ethers } from 'hardhat';
import { getSigners } from '../../test/common/wallet';

type Args = {
  num: number;
  amount: string;
};

export default async function ({ num = 10, amount = '0' }: Args) {
  //
  const signers = getSigners(num + 1);

  const sendAmount = ethers.utils.parseEther(amount);

  if (!sendAmount.isZero()) {
    for (let i = 1; i <= num; i++) {
      // wait 1 block confirm
      const res = await signers[0].sendTransaction({
        to: signers[0].address,
        value: sendAmount
      });
      // last transaction need confirm block
      if (i === num) {
        await res.wait();
      }
    }
  }

  for (let i = 0; i <= num; i++) {
    const signer = signers[i];
    console.log(i, signer.address, await signer.getBalance());
  }
}
