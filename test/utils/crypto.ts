import { randomBytes, createHash, BinaryLike } from 'crypto';

const sha256 = (x: BinaryLike) => createHash('sha256').update(x).digest();

// Format required for sending bytes through eth client:
//  - hex string representation
//  - prefixed with 0x
export const bufToStr = (b: Buffer) => '0x' + b.toString('hex');

export const random32 = () => randomBytes(32);

export const newSecretHashPair = () => {
  const secret = random32();
  const hash = sha256(secret);
  return {
    secret: bufToStr(secret),
    hash: bufToStr(hash)
  };
};

export const newHoldId = () => {
  return bufToStr(random32());
};
