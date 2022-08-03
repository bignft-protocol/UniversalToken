import { assert, contract, ethers } from 'hardhat';

import {
  nowSeconds,
  advanceTime,
  takeSnapshot,
  revertToSnapshot
} from './utils/time';
import { newSecretHashPair } from './utils/crypto';
import { bytes32 } from './utils/regex';
import {
  ERC20HoldableToken,
  ERC20HoldableToken__factory
} from '../typechain-types';
import { ZERO_ADDRESS, ZERO_BYTE, ZERO_BYTES32 } from './utils/assert';

const HoldStatusCode = Object.freeze({
  Nonexistent: 0,
  Held: 1,
  Executed: 2,
  ExecutedAndKeptOpen: 3,
  Released: 4,
  ReleasedByPayee: 5,
  ReleasedOnExpiration: 6
});

contract(
  'Holdable Token',
  ([deployer, sender, holder, recipient, recipient2, notary]) => {
    describe('Hold and execute by notary before expiration', () => {
      const hashLock = newSecretHashPair();
      const inOneHour = nowSeconds() + 60 * 60;
      let holdId: string;
      let snapshotId: any;
      let token: ERC20HoldableToken;
      before(async () => {
        snapshotId = await takeSnapshot();
        token = await new ERC20HoldableToken__factory(
          await ethers.getSigner(deployer)
        ).deploy('ERC20Token', 'DAU20', 18);
      });
      after(async () => {
        await revertToSnapshot(snapshotId);
      });
      it('Mint 1000 tokens to holder', async () => {
        assert.equal((await token.totalSupply()).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(deployer))
          .mint(holder, 1000)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(deployer)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 1000);
        assert.equal((await token.spendableBalanceOf(sender)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal(
          (await token.spendableBalanceOf(recipient2)).toNumber(),
          0
        );
        assert.equal((await token.spendableBalanceOf(notary)).toNumber(), 0);
        assert.equal((await token.totalSupply()).toNumber(), 1000);
      });
      it('Failed hold from notary with zero address', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .hold(
              ZERO_BYTE +
                Buffer.from(ethers.utils.randomBytes(32)).toString('hex'),
              recipient2,
              ZERO_ADDRESS,
              900,
              inOneHour,
              hashLock.hash
            );
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /notary must not be a zero address/
          );
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            0
          );
          assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
          assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
        }
      });
      it('Failed hold from a zero amount', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .hold(
              ZERO_BYTE +
                Buffer.from(ethers.utils.randomBytes(32)).toString('hex'),
              recipient2,
              notary,
              0,
              inOneHour,
              hashLock.hash
            );
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /amount must be greater than zero/
          );
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            0
          );
          assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
          assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
        }
      });
      it('Recipient can not hold as they have no tokens', async () => {
        try {
          await token
            .connect(await ethers.getSigner(recipient))
            .hold(
              ZERO_BYTE +
                Buffer.from(ethers.utils.randomBytes(32)).toString('hex'),
              recipient2,
              notary,
              900,
              inOneHour,
              hashLock.hash
            );
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /amount exceeds available balance/
          );
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            0
          );
          assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
          assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
        }
      });
      it('Holder can not hold more than what they own', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .hold(
              ZERO_BYTE +
                Buffer.from(ethers.utils.randomBytes(32)).toString('hex'),
              recipient,
              notary,
              1001,
              inOneHour,
              hashLock.hash
            );
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /amount exceeds available balance/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            1000
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
          assert.equal((await token.balanceOf(holder)).toNumber(), 1000);
        }
      });
      it('Holder holds 900 tokens for the recipient with a lock hash', async () => {
        holdId =
          ZERO_BYTE + Buffer.from(ethers.utils.randomBytes(32)).toString('hex');
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .hold(holdId, recipient, notary, 900, inOneHour, hashLock.hash)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.lengthOf(receipt.logs, 1);
        assert.match(holdId, bytes32);
        assert.equal(await token.holdStatus(holdId), HoldStatusCode.Held);
        assert.equal((await token.spendableBalanceOf(deployer)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 100);
        assert.equal((await token.spendableBalanceOf(sender)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal(
          (await token.spendableBalanceOf(recipient2)).toNumber(),
          0
        );
        assert.equal((await token.spendableBalanceOf(notary)).toNumber(), 0);

        assert.equal((await token.balanceOnHold(deployer)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
        assert.equal((await token.balanceOnHold(sender)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient2)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(notary)).toNumber(), 0);

        assert.equal((await token.balanceOf(holder)).toNumber(), 1000);

        assert.equal((await token.totalSupply()).toNumber(), 1000);
      });
      it('Holder can not release the hold before expiration time', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /can only release after the expiration date/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            100
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
          assert.equal((await token.balanceOf(holder)).toNumber(), 1000);
        }
      });
      it('Recipient can not execute the hold', async () => {
        try {
          await token
            .connect(await ethers.getSigner(recipient))
            ['executeHold(bytes32,bytes32)'](holdId, hashLock.secret);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /caller must be the hold notary/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            100
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
          assert.equal((await token.balanceOf(holder)).toNumber(), 1000);
        }
      });
      it('Notary can not execute hold with the wrong lock hash', async () => {
        try {
          const incorrectHashLock = newSecretHashPair();
          await token
            .connect(await ethers.getSigner(notary))
            ['executeHold(bytes32,bytes32)'](holdId, incorrectHashLock.secret);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /preimage hash does not match lock hash/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            100
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
          assert.equal((await token.balanceOf(holder)).toNumber(), 1000);
        }
      });
      it('Notary can not execute hold with the wrong execute function', async () => {
        try {
          await token
            .connect(await ethers.getSigner(notary))
            ['executeHold(bytes32,bytes32,address)'](
              holdId,
              hashLock.secret,
              recipient2
            );
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /can not set a recipient on execution as it was set on hold/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            100
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
          assert.equal((await token.balanceOf(holder)).toNumber(), 1000);
        }
      });
      it('Recipient can not release the hold', async () => {
        try {
          await token
            .connect(await ethers.getSigner(recipient))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /caller must be the hold sender or notary/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            100
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
          assert.equal((await token.balanceOf(holder)).toNumber(), 1000);
        }
      });
      it('Holder can not transfer 200 tokens with only 100 available and 900 on hold', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .hold(
              ZERO_BYTE +
                Buffer.from(ethers.utils.randomBytes(32)).toString('hex'),
              recipient,
              notary,
              900,
              inOneHour,
              hashLock.hash
            );
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /amount exceeds available balance/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            100
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
          assert.equal((await token.balanceOf(holder)).toNumber(), 1000);
        }
      });
      it('Holder can not approve 200 tokens for recipient2 to spend with only 100 available and 900 on hold', async () => {
        try {
          assert.equal(
            (await token.allowance(holder, recipient2)).toNumber(),
            0
          );
          await token
            .connect(await ethers.getSigner(holder))
            .approve(recipient2, 200);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /amount exceeds available balance/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            100
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
          assert.equal((await token.balanceOf(holder)).toNumber(), 1000);
          assert.equal(
            (await token.allowance(holder, recipient2)).toNumber(),
            0
          );
        }
      });
      it('Holder can approve 30 tokens for recipient2 to spend', async () => {
        assert.equal((await token.allowance(holder, recipient2)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .approve(recipient2, 30)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal(
          (await token.allowance(holder, recipient2)).toNumber(),
          30
        );
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 100);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
        assert.equal((await token.balanceOf(holder)).toNumber(), 1000);
      });
      it('Holder can transfer 80 tokens with 100 available and 30 approved for spending', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .transfer(recipient2, 80)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal(receipt.status, 1);

        assert.equal((await token.spendableBalanceOf(deployer)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 20);
        assert.equal((await token.spendableBalanceOf(sender)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal(
          (await token.spendableBalanceOf(recipient2)).toNumber(),
          80
        );
        assert.equal((await token.spendableBalanceOf(notary)).toNumber(), 0);

        assert.equal((await token.balanceOnHold(deployer)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
        assert.equal((await token.balanceOnHold(sender)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient2)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(notary)).toNumber(), 0);

        assert.equal((await token.balanceOf(holder)).toNumber(), 920);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient2)).toNumber(), 80);

        assert.equal((await token.totalSupply()).toNumber(), 1000);
      });
      it('Holder can not transfer 21 tokens with 20 available', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .transfer(recipient2, 101);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /amount exceeds available balance/
          );
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 20);
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
          assert.equal((await token.balanceOf(holder)).toNumber(), 920);
        }
      });
      it('Recipient 2 can not transfer 30 approved tokens from holder as only 20 are available', async () => {
        try {
          assert.equal(
            (await token.allowance(holder, recipient2)).toNumber(),
            30
          );
          await token
            .connect(await ethers.getSigner(recipient2))
            .transferFrom(holder, recipient2, 30);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /amount exceeds available balance/
          );
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 20);
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 900);
          assert.equal((await token.balanceOf(holder)).toNumber(), 920);
          assert.equal(
            (await token.allowance(holder, recipient2)).toNumber(),
            30
          );
        }
      });
      it('Notary can not execute the hold without the lock hash', async () => {
        try {
          const result = await token
            .connect(await ethers.getSigner(notary))
            ['executeHold(bytes32)'](holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /need preimage if the hold has a lock hash/
          );
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 20);
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            0
          );
          assert.equal((await token.spendableBalanceOf(notary)).toNumber(), 0);
        }
      });
      it('Notary can not execute hold with the wrong lock hash', async () => {
        try {
          const incorrectHashLock = newSecretHashPair();
          await token
            .connect(await ethers.getSigner(notary))
            ['executeHold(bytes32,bytes32)'](holdId, incorrectHashLock.secret);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /preimage hash does not match lock hash/
          );
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 20);
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            0
          );
          assert.equal((await token.spendableBalanceOf(notary)).toNumber(), 0);
        }
      });
      it('Notary can execute the hold', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(notary))
          ['executeHold(bytes32,bytes32)'](holdId, hashLock.secret)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal(await token.holdStatus(holdId), HoldStatusCode.Executed);

        assert.equal((await token.spendableBalanceOf(deployer)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 20);
        assert.equal((await token.spendableBalanceOf(sender)).toNumber(), 0);
        assert.equal(
          (await token.spendableBalanceOf(recipient)).toNumber(),
          900
        );
        assert.equal(
          (await token.spendableBalanceOf(recipient2)).toNumber(),
          80
        );
        assert.equal((await token.spendableBalanceOf(notary)).toNumber(), 0);
        assert.equal((await token.totalSupply()).toNumber(), 1000);

        assert.equal((await token.balanceOnHold(deployer)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(sender)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient2)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(notary)).toNumber(), 0);

        assert.equal((await token.balanceOf(holder)).toNumber(), 20);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 900);
        assert.equal((await token.balanceOf(recipient2)).toNumber(), 80);

        assert.equal((await token.totalSupply()).toNumber(), 1000);
      });
      it('Notary can not execute a hold a second time', async () => {
        try {
          await token
            .connect(await ethers.getSigner(notary))
            ['executeHold(bytes32,bytes32)'](holdId, hashLock.secret);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /Hold is not in Ordered status/);
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 20);
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            900
          );
        }
      });
      it('The holder can not release a hold after execution', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /Hold is not in Ordered status/);
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 20);
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            900
          );
        }
      });
      it('The holder can not release a hold after expiration time and execution', async () => {
        await advanceTime(inOneHour + 1);
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /Hold is not in Ordered status/);
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 20);
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            900
          );
        }
      });
    });
    describe('Hold and release by notary before expiration', () => {
      const hashLock = newSecretHashPair();
      const inOneHour = nowSeconds() + 60 * 60;
      let holdId: string;
      let snapshotId: any;
      let token: ERC20HoldableToken;
      before(async () => {
        snapshotId = await takeSnapshot();
        token = await new ERC20HoldableToken__factory(
          await ethers.getSigner(deployer)
        ).deploy('ERC20Token', 'DAU20', 18);
      });
      after(async () => {
        await revertToSnapshot(snapshotId);
      });
      it('Mint 200 tokens to holder', async () => {
        assert.equal((await token.totalSupply()).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(deployer))
          .mint(holder, 200)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(deployer)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 200);
        assert.equal((await token.spendableBalanceOf(sender)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal(
          (await token.spendableBalanceOf(recipient2)).toNumber(),
          0
        );
        assert.equal((await token.spendableBalanceOf(notary)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 200);
        assert.equal((await token.totalSupply()).toNumber(), 200);
      });
      it('Holder holds 30 tokens for the recipient', async () => {
        holdId =
          ZERO_BYTE + Buffer.from(ethers.utils.randomBytes(32)).toString('hex');
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .hold(holdId, recipient, notary, 30, inOneHour, hashLock.hash)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.lengthOf(receipt.logs, 1);
        assert.match(holdId, bytes32);
        assert.equal((await token.spendableBalanceOf(deployer)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 170);
        assert.equal((await token.spendableBalanceOf(sender)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal(
          (await token.spendableBalanceOf(recipient2)).toNumber(),
          0
        );
        assert.equal((await token.spendableBalanceOf(notary)).toNumber(), 0);

        assert.equal((await token.balanceOnHold(deployer)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 30);
        assert.equal((await token.balanceOnHold(sender)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient2)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(notary)).toNumber(), 0);

        assert.equal((await token.balanceOf(holder)).toNumber(), 200);

        assert.equal((await token.totalSupply()).toNumber(), 200);
      });
      it('Holder can not hold with the same parameters again', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .hold(holdId, recipient, notary, 30, inOneHour, hashLock.hash);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /id already exists/);
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            170
          );
        }
      });
      it('Notary releases 30 tokens back to holder', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(notary))
          .releaseHold(holdId)
          .then((res) => res.wait());
        assert.equal(await token.holdStatus(holdId), HoldStatusCode.Released);
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 200);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 200);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(notary)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(notary)).toNumber(), 0);
        assert.equal((await token.balanceOf(notary)).toNumber(), 0);

        assert.equal((await token.totalSupply()).toNumber(), 200);
      });
      it('Notary can not release a hold twice', async () => {
        try {
          await token
            .connect(await ethers.getSigner(notary))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /Hold is not in Ordered status/);
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            200
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
          assert.equal((await token.balanceOf(holder)).toNumber(), 200);
          assert.equal((await token.totalSupply()).toNumber(), 200);
        }
      });
      it('Notary can not execute a hold after release', async () => {
        try {
          await token
            .connect(await ethers.getSigner(notary))
            ['executeHold(bytes32,bytes32)'](holdId, hashLock.secret);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /Hold is not in Ordered status/);
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            200
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
          assert.equal((await token.balanceOf(holder)).toNumber(), 200);
          assert.equal((await token.totalSupply()).toNumber(), 200);
        }
      });
      it('Holder can not release a hold after release', async () => {
        try {
          await token
            .connect(await ethers.getSigner(notary))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /Hold is not in Ordered status/);
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            200
          );
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
          assert.equal((await token.balanceOf(holder)).toNumber(), 200);
          assert.equal((await token.totalSupply()).toNumber(), 200);
        }
      });
    });
    describe('Hold and release by notary after expiration', () => {
      const hashLock = newSecretHashPair();
      const inOneHour = nowSeconds() + 60 * 60;
      let holdId: string;
      let snapshotId: any;
      let token: ERC20HoldableToken;
      before(async () => {
        snapshotId = await takeSnapshot();
        token = await new ERC20HoldableToken__factory(
          await ethers.getSigner(deployer)
        ).deploy('ERC20Token', 'DAU20', 18);
      });
      after(async () => {
        await revertToSnapshot(snapshotId);
      });
      it('Mint 3 tokens to holder', async () => {
        assert.equal((await token.totalSupply()).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(deployer))
          .mint(holder, 3)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 3);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        assert.equal((await token.totalSupply()).toNumber(), 3);
      });
      it('Holder holds 2 tokens for the recipient', async () => {
        holdId =
          ZERO_BYTE + Buffer.from(ethers.utils.randomBytes(32)).toString('hex');
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .hold(holdId, recipient, notary, 2, inOneHour, hashLock.hash)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.lengthOf(receipt.logs, 1);
        assert.match(holdId, bytes32);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 1);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 2);
        assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        assert.equal((await token.totalSupply()).toNumber(), 3);
      });
      it('Holder can not release the hold before expiration', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /can only release after the expiration date/
          );
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 1);
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 2);
          assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        }
      });
      it('Advance time to after expiration', async () => {
        await advanceTime(inOneHour + 1);
      });
      it('After expiration, notary releases 3 tokens back to holder', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(notary))
          .releaseHold(holdId)
          .then((res) => res.wait());
        assert.equal(await token.holdStatus(holdId), HoldStatusCode.Released);
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 3);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        assert.equal((await token.totalSupply()).toNumber(), 3);
      });
      it('Notary can not release the hold twice', async () => {
        try {
          await token
            .connect(await ethers.getSigner(notary))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /Hold is not in Ordered status/);
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 3);
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
          assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        }
      });
      it('Holder can not release the hold after release', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /Hold is not in Ordered status/);
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 3);
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
          assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        }
      });
    });
    describe('Hold and release by holder after expiration', () => {
      const hashLock = newSecretHashPair();
      const inOneHour = nowSeconds() + 60 * 60;
      let holdId: string;
      let snapshotId: any;
      let token: ERC20HoldableToken;

      before(async () => {
        snapshotId = await takeSnapshot();
        token = await new ERC20HoldableToken__factory(
          await ethers.getSigner(deployer)
        ).deploy('ERC20Token', 'DAU20', 18);
      });
      after(async () => {
        await revertToSnapshot(snapshotId);
      });
      it('Mint 3 tokens to holder', async () => {
        assert.equal((await token.totalSupply()).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(deployer))
          .mint(holder, 3)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 3);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        assert.equal((await token.totalSupply()).toNumber(), 3);
      });
      it('Holder holds 2 tokens for the recipient', async () => {
        holdId =
          ZERO_BYTE + Buffer.from(ethers.utils.randomBytes(32)).toString('hex');
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .hold(holdId, recipient, notary, 2, inOneHour, hashLock.hash)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.lengthOf(receipt.logs, 1);
        assert.match(holdId, bytes32);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 1);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 2);
        assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        assert.equal((await token.totalSupply()).toNumber(), 3);
      });
      it('Holder can not release the hold before expiration', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /can only release after the expiration date/
          );
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 1);
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 2);
          assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        }
      });
      it('After expiration, holder releases 3 tokens back to holder', async () => {
        await advanceTime(inOneHour + 1);
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .releaseHold(holdId)
          .then((res) => res.wait());
        assert.equal(
          await token.holdStatus(holdId),
          HoldStatusCode.ReleasedOnExpiration
        );
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 3);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        assert.equal((await token.totalSupply()).toNumber(), 3);
      });
      it('Holder can not release the hold twice', async () => {
        try {
          await token
            .connect(await ethers.getSigner(holder))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /Hold is not in Ordered status/);
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 3);
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
          assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        }
      });
      it('Notary can not release the hold after release', async () => {
        try {
          await token
            .connect(await ethers.getSigner(notary))
            .releaseHold(holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match((err as Error).message, /Hold is not in Ordered status/);
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 3);
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
          assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        }
      });
    });
    describe('Hold and execute by notary after expiration', () => {
      const hashLock = newSecretHashPair();
      const inOneHour = nowSeconds() + 60 * 60;
      let holdId: string;
      let snapshotId: any;
      let token: ERC20HoldableToken;
      before(async () => {
        snapshotId = await takeSnapshot();
        token = await new ERC20HoldableToken__factory(
          await ethers.getSigner(deployer)
        ).deploy('ERC20Token', 'DAU20', 18);
      });
      after(async () => {
        await revertToSnapshot(snapshotId);
      });
      it('Mint 3 tokens to holder', async () => {
        assert.equal((await token.totalSupply()).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(deployer))
          .mint(holder, 3)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 3);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        assert.equal((await token.totalSupply()).toNumber(), 3);
      });
      it('Holder holds 2 tokens for the recipient', async () => {
        holdId =
          ZERO_BYTE + Buffer.from(ethers.utils.randomBytes(32)).toString('hex');
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .hold(holdId, recipient, notary, 2, inOneHour, hashLock.hash)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.lengthOf(receipt.logs, 1);
        assert.match(holdId, bytes32);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 1);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 2);
        assert.equal((await token.balanceOf(holder)).toNumber(), 3);
        assert.equal((await token.totalSupply()).toNumber(), 3);
      });
      it('Advance time to after expiration', async () => {
        await advanceTime(inOneHour + 1);
      });
      it('After expiration, notary execute hold to recipient', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(notary))
          ['executeHold(bytes32,bytes32)'](holdId, hashLock.secret)
          .then((res) => res.wait());
        assert.equal(await token.holdStatus(holdId), HoldStatusCode.Executed);
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 1);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 1);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 2);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 2);
        assert.equal((await token.totalSupply()).toNumber(), 3);
      });
    });
    describe('Hold with no recipient, notary can execute before expiration with recipient', () => {
      const hashLock = newSecretHashPair();
      const inOneDay = nowSeconds() + 60 * 60 * 24;
      let holdId: string;
      let snapshotId: any;
      let token: ERC20HoldableToken;
      before(async () => {
        snapshotId = await takeSnapshot();
        token = await new ERC20HoldableToken__factory(
          await ethers.getSigner(deployer)
        ).deploy('ERC20Token', 'DAU20', 18);
      });
      after(async () => {
        await revertToSnapshot(snapshotId);
      });
      it('Mint 9876543210 tokens to holder', async () => {
        assert.equal((await token.totalSupply()).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(deployer))
          .mint(holder, 9876543210)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal(
          (await token.spendableBalanceOf(holder)).toNumber(),
          9876543210
        );
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 9876543210);
        assert.equal((await token.totalSupply()).toNumber(), 9876543210);
      });
      it('Holder holds 9000000000 tokens with no recipient', async () => {
        holdId =
          ZERO_BYTE + Buffer.from(ethers.utils.randomBytes(32)).toString('hex');
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .hold(
            holdId,
            ZERO_ADDRESS,
            notary,
            9000000000,
            inOneDay,
            hashLock.hash
          )
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.lengthOf(receipt.logs, 1);
        assert.match(holdId, bytes32);
        assert.equal(
          (await token.spendableBalanceOf(holder)).toNumber(),
          876543210
        );
        assert.equal(
          (await token.balanceOnHold(holder)).toNumber(),
          9000000000
        );
        assert.equal((await token.balanceOf(holder)).toNumber(), 9876543210);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.totalSupply()).toNumber(), 9876543210);
      });
      it('Recipient can not execute a hold', async () => {
        try {
          await token
            .connect(await ethers.getSigner(recipient))
            ['executeHold(bytes32,bytes32,address)'](
              holdId,
              hashLock.secret,
              recipient
            );
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /caller must be the hold notary/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            876543210
          );
          assert.equal(
            (await token.balanceOnHold(holder)).toNumber(),
            9000000000
          );
          assert.equal((await token.balanceOf(holder)).toNumber(), 9876543210);
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            0
          );
          assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
          assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
          assert.equal((await token.totalSupply()).toNumber(), 9876543210);
        }
      });
      it('Recipient can not execute a hold without specifying a recipient', async () => {
        try {
          await token
            .connect(await ethers.getSigner(notary))
            ['executeHold(bytes32,bytes32)'](holdId, hashLock.secret);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /must pass the recipient on execution as the recipient was not set on hold/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            876543210
          );
          assert.equal(
            (await token.balanceOnHold(holder)).toNumber(),
            9000000000
          );
          assert.equal((await token.balanceOf(holder)).toNumber(), 9876543210);
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            0
          );
          assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
          assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
          assert.equal((await token.totalSupply()).toNumber(), 9876543210);
        }
      });
      it('Recipient can not execute a hold with zero address as the recipient', async () => {
        try {
          await token
            .connect(await ethers.getSigner(notary))
            ['executeHold(bytes32,bytes32,address)'](
              holdId,
              hashLock.secret,
              ZERO_ADDRESS
            );
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /recipient must not be a zero address/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            876543210
          );
          assert.equal(
            (await token.balanceOnHold(holder)).toNumber(),
            9000000000
          );
          assert.equal((await token.balanceOf(holder)).toNumber(), 9876543210);
          assert.equal(
            (await token.spendableBalanceOf(recipient)).toNumber(),
            0
          );
          assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
          assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
          assert.equal((await token.totalSupply()).toNumber(), 9876543210);
        }
      });
      it('Notary can not execute the hold without the lock hash', async () => {
        try {
          const result = await token
            .connect(await ethers.getSigner(notary))
            ['executeHold(bytes32)'](holdId);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /must pass the recipient on execution as the recipient was not set on hold/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            876543210
          );
          assert.equal(
            (await token.balanceOnHold(holder)).toNumber(),
            9000000000
          );
          assert.equal((await token.balanceOf(holder)).toNumber(), 9876543210);
        }
      });
      it('Notary can not execute hold with the wrong lock hash', async () => {
        try {
          const incorrectHashLock = newSecretHashPair();
          await token
            .connect(await ethers.getSigner(notary))
            ['executeHold(bytes32,bytes32,address)'](
              holdId,
              incorrectHashLock.secret,
              recipient
            );
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /preimage hash does not match lock hash/
          );
          assert.equal(
            (await token.spendableBalanceOf(holder)).toNumber(),
            876543210
          );
          assert.equal(
            (await token.balanceOnHold(holder)).toNumber(),
            9000000000
          );
          assert.equal((await token.balanceOf(holder)).toNumber(), 9876543210);
        }
      });
      it('Notary can execute the hold specifying the recipient', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(notary))
          ['executeHold(bytes32,bytes32,address)'](
            holdId,
            hashLock.secret,
            recipient
          )
          .then((res) => res.wait());
        assert.equal(await token.holdStatus(holdId), HoldStatusCode.Executed);
        assert.equal(receipt.status, 1);
        assert.equal(
          (await token.spendableBalanceOf(holder)).toNumber(),
          876543210
        );
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 876543210);
        assert.equal(
          (await token.spendableBalanceOf(recipient)).toNumber(),
          9000000000
        );
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 9000000000);
        assert.equal((await token.totalSupply()).toNumber(), 9876543210);
      });
    });
    describe('Hold with no hash lock, notary can execute without lock secret before expiration', () => {
      const inOneWeek = nowSeconds() + 60 * 60 * 24 * 7;
      let holdId: string;
      let snapshotId: any;
      let token: ERC20HoldableToken;
      before(async () => {
        snapshotId = await takeSnapshot();
        token = await new ERC20HoldableToken__factory(
          await ethers.getSigner(deployer)
        ).deploy('ERC20Token', 'DAU20', 18);
      });
      after(async () => {
        await revertToSnapshot(snapshotId);
      });
      it('Mint 123 tokens to holder', async () => {
        assert.equal((await token.totalSupply()).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(deployer))
          .mint(holder, 123)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 123);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
      it('Holder holds 100 tokens with no hash lock', async () => {
        holdId =
          ZERO_BYTE + Buffer.from(ethers.utils.randomBytes(32)).toString('hex');
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .hold(holdId, recipient, notary, 100, inOneWeek, ZERO_BYTES32)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.lengthOf(receipt.logs, 1);
        assert.match(holdId, bytes32);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 23);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 100);
        assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
      it('Notary can execute the hold without a lock preimage', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(notary))
          ['executeHold(bytes32)'](holdId)
          .then((res) => res.wait());
        assert.equal(await token.holdStatus(holdId), HoldStatusCode.Executed);
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 23);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 23);
        assert.equal(
          (await token.spendableBalanceOf(recipient)).toNumber(),
          100
        );
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 100);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
    });
    describe('Hold with no recipient or hash lock, notary can execute before expiration', () => {
      const inOneWeek = nowSeconds() + 60 * 60 * 24 * 7;
      let holdId: string;
      let snapshotId: any;
      let token: ERC20HoldableToken;
      before(async () => {
        snapshotId = await takeSnapshot();
        token = await new ERC20HoldableToken__factory(
          await ethers.getSigner(deployer)
        ).deploy('ERC20Token', 'DAU20', 18);
      });
      after(async () => {
        await revertToSnapshot(snapshotId);
      });
      it('Mint 123 tokens to holder', async () => {
        assert.equal((await token.totalSupply()).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(deployer))
          .mint(holder, 123)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 123);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
      it('Holder holds 100 tokens with no hash lock', async () => {
        holdId =
          ZERO_BYTE + Buffer.from(ethers.utils.randomBytes(32)).toString('hex');
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .hold(holdId, ZERO_ADDRESS, notary, 100, inOneWeek, ZERO_BYTES32)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.lengthOf(receipt.logs, 1);
        assert.match(holdId, bytes32);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 23);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 100);
        assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
      it('Notary can execute the hold specifying a recipient without a lock preimage', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(notary))
          ['executeHold(bytes32,bytes32,address)'](
            holdId,
            ZERO_BYTES32,
            recipient2
          )
          .then((res) => res.wait());
        assert.equal(await token.holdStatus(holdId), HoldStatusCode.Executed);
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 23);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 23);
        assert.equal(
          (await token.spendableBalanceOf(recipient2)).toNumber(),
          100
        );
        assert.equal((await token.balanceOnHold(recipient2)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient2)).toNumber(), 100);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
    });
    describe('Hold with no expiration time, holder releases straight away', () => {
      const inOneWeek = nowSeconds() + 60 * 60 * 24 * 7;
      let holdId: string;
      let snapshotId: any;
      let token: ERC20HoldableToken;
      before(async () => {
        snapshotId = await takeSnapshot();
        token = await new ERC20HoldableToken__factory(
          await ethers.getSigner(deployer)
        ).deploy('ERC20Token', 'DAU20', 18);
      });
      after(async () => {
        await revertToSnapshot(snapshotId);
      });
      it('Mint 123 tokens to holder', async () => {
        assert.equal((await token.totalSupply()).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(deployer))
          .mint(holder, 123)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 123);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
      it('Holder holds 100 tokens with no hash lock', async () => {
        holdId =
          ZERO_BYTE + Buffer.from(ethers.utils.randomBytes(32)).toString('hex');
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .hold(holdId, ZERO_ADDRESS, notary, 100, 0, ZERO_BYTES32)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.lengthOf(receipt.logs, 1);
        assert.match(holdId, bytes32);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 23);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 100);
        assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
      it('Holder releases tokens back to holder straight away', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .releaseHold(holdId)
          .then((res) => res.wait());
        assert.equal(
          await token.holdStatus(holdId),
          HoldStatusCode.ReleasedOnExpiration
        );
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 123);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
    });
    describe('Can not burn notes on hold', () => {
      const inOneWeek = nowSeconds() + 60 * 60 * 24 * 7;
      let holdId: string;
      let snapshotId: any;
      let token: ERC20HoldableToken;
      const hashLock = newSecretHashPair();
      before(async () => {
        snapshotId = await takeSnapshot();
        token = await new ERC20HoldableToken__factory(
          await ethers.getSigner(deployer)
        ).deploy('ERC20Token', 'DAU20', 18);
      });
      after(async () => {
        await revertToSnapshot(snapshotId);
      });
      it('Mint 123 tokens to holder', async () => {
        assert.equal((await token.totalSupply()).toNumber(), 0);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        const receipt = await token
          .connect(await ethers.getSigner(deployer))
          .mint(holder, 123)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 123);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 0);
        assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
      it('Holder holds 100 tokens with no hash lock', async () => {
        holdId =
          ZERO_BYTE + Buffer.from(ethers.utils.randomBytes(32)).toString('hex');
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .hold(holdId, ZERO_ADDRESS, notary, 100, 0, ZERO_BYTES32)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.lengthOf(receipt.logs, 1);
        assert.equal(await token.holdStatus(holdId), HoldStatusCode.Held);
        assert.match(holdId, bytes32);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 23);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 100);
        assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 0);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
      it('Holder can not burn on hold tokens', async () => {
        try {
          await token.connect(await ethers.getSigner(holder)).burn(24);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /amount exceeds available balance/
          );
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 23);
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 100);
          assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        }
      });
      it('Holder approves a recipient to spend 10 tokens', async () => {
        assert.equal((await token.allowance(holder, recipient)).toNumber(), 0);

        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .approve(recipient, 10)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);

        assert.equal((await token.allowance(holder, recipient)).toNumber(), 10);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 23);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 100);
        assert.equal((await token.balanceOf(holder)).toNumber(), 123);
        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
      it('Recipient transfers 4 tokens from the holder to themselves', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(recipient))
          .transferFrom(holder, recipient, 4)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);

        assert.equal((await token.allowance(holder, recipient)).toNumber(), 6);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 19);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 100);
        assert.equal((await token.balanceOf(holder)).toNumber(), 119);

        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 4);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 4);

        assert.equal((await token.totalSupply()).toNumber(), 123);
      });
      it('Recipient burns one token held by the Holder', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(recipient))
          .burnFrom(holder, 1)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.allowance(holder, recipient)).toNumber(), 5);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 18);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 100);
        assert.equal((await token.balanceOf(holder)).toNumber(), 118);

        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 4);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 4);

        assert.equal((await token.totalSupply()).toNumber(), 122);
      });
      it('Recipient can not burn more tokens than total held by the Holder', async () => {
        try {
          await token
            .connect(await ethers.getSigner(recipient))
            .burnFrom(holder, 19);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /amount exceeds available balance/
          );
          assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 18);
          assert.equal((await token.balanceOnHold(holder)).toNumber(), 100);
          assert.equal((await token.balanceOf(holder)).toNumber(), 118);
        }
      });
      it('Holder can burn tokens not on hold', async () => {
        const receipt = await token
          .connect(await ethers.getSigner(holder))
          .burn(18)
          .then((res) => res.wait());
        assert.equal(receipt.status, 1);
        assert.equal((await token.allowance(holder, recipient)).toNumber(), 5);
        assert.equal((await token.spendableBalanceOf(holder)).toNumber(), 0);
        assert.equal((await token.balanceOnHold(holder)).toNumber(), 100);
        assert.equal((await token.balanceOf(holder)).toNumber(), 100);

        assert.equal((await token.spendableBalanceOf(recipient)).toNumber(), 4);
        assert.equal((await token.balanceOnHold(recipient)).toNumber(), 0);
        assert.equal((await token.balanceOf(recipient)).toNumber(), 4);

        assert.equal((await token.totalSupply()).toNumber(), 104);
      });
      it('Holder can not burn on hold tokens', async () => {
        try {
          await token.connect(await ethers.getSigner(holder)).burn(1);
          assert(false, 'transaction should have failed');
        } catch (err) {
          assert.instanceOf(err, Error);
          assert.match(
            (err as Error).message,
            /amount exceeds available balance/
          );
        }
      });
    });
  }
);
