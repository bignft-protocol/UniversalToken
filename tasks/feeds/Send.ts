import { ethers } from 'hardhat';

type Args = {
  mnemonic: string;
  num: number;
  amount: string;
};

export default async function ({ mnemonic, num = 10, amount = '0' }: Args) {
  if (!mnemonic && process.env.MNEMONIC) mnemonic = process.env.MNEMONIC;

  const signer = ethers.Wallet.fromMnemonic(
    mnemonic,
    `m/44'/60'/0'/0/0`
  ).connect(ethers.provider);

  console.log(
    await signer.getAddress(),
    signer.privateKey,
    await signer.getBalance()
  );

  const sendAmount = ethers.utils.parseEther(amount);

  const wallets = [];
  for (let i = 1; i <= num; i++) {
    const wallet = ethers.Wallet.fromMnemonic(
      mnemonic,
      `m/44'/60'/0'/0/${i}`
    ).connect(ethers.provider);

    const recipientAddress = await wallet.getAddress();
    if (!sendAmount.isZero()) {
      // wait 1 block confirm
      const res = await signer.sendTransaction({
        to: recipientAddress,
        value: sendAmount
      });
      // last transaction need confirm block
      if (i === num) {
        await res.wait();
      }
    }
    wallets.push(wallet);
  }

  for (let i = 1; i <= num; i++) {
    const wallet = wallets[i - 1];
    console.log(
      i,
      await wallet.getAddress(),
      wallet.privateKey,
      await wallet.getBalance()
    );
  }
}
