export const partition1 =
  '0x7265736572766564000000000000000000000000000000000000000000000000'; // reserved in hex
export const partition2 =
  '0x6973737565640000000000000000000000000000000000000000000000000000'; // issued in hex
export const partition3 =
  '0x6c6f636b65640000000000000000000000000000000000000000000000000000'; // locked in hex
export const partition4 =
  '0x636f6c6c61746572616c00000000000000000000000000000000000000000000'; // collateral in hex
export const partitions = [partition1, partition2, partition3, partition4];

export const addressToBytes32 = (_addr: string, pushTo = 32) => {
  return _addr.substring(2).padStart(pushTo * 2, '0');
};

export const numToNumBytes32 = (num: number, pushTo = 32) => {
  return '0x' + numTostringBytes32(num, pushTo);
};

export const numTostringBytes32 = (num: number, pushTo = 32) => {
  return num.toString(16).padStart(pushTo * 2, '0');
};
