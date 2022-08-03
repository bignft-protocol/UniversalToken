export const addressToBytes32 = (_addr: string, _fillTo = 32) => {
  const _addr2 = _addr.substring(2);
  const arr1 = [];
  for (let n = 0, l = _addr2.length; n < l; n++) {
    arr1.push(_addr2[n]);
  }
  for (let m = _addr2.length; m < 2 * _fillTo; m++) {
    arr1.unshift(0);
  }
  return arr1.join('');
};

export const NumToNumBytes32 = (_num: number, _fillTo = 32) => {
  const arr1 = [];
  const _str = _num.toString(16);
  for (let n = 0, l = _str.length; n < l; n++) {
    arr1.push(_str[n]);
  }
  for (let m = _str.length; m < 2 * _fillTo; m++) {
    arr1.unshift(0);
  }
  return `0x${arr1.join('')}`;
};

export const NumTostringBytes32 = (_num: number, _fillTo = 32) => {
  const arr1 = [];
  const _str = _num.toString(16);
  for (let n = 0, l = _str.length; n < l; n++) {
    arr1.push(_str[n]);
  }
  for (let m = _str.length; m < 2 * _fillTo; m++) {
    arr1.unshift(0);
  }
  return arr1.join('');
};
