export const addressToBytes32 = (_addr: string, pushTo = 32) => {
  return _addr.substring(2).padStart(pushTo * 2, '0');
};

export const numToNumBytes32 = (num: number, pushTo = 32) => {
  return '0x' + numTostringBytes32(num, pushTo);
};

export const numTostringBytes32 = (num: number, pushTo = 32) => {
  return num.toString(16).padStart(pushTo * 2, '0');
};
