import { ethers } from 'ethers';
import { Swaps } from '../../typechain-types';

export const extractTokenAddress = (
  tokenData: Swaps.UserTradeDataStructOutput
) => {
  return ethers.utils.getAddress(tokenData.tokenAddress);
  //return ethers.utils.getAddress(`0x${tokenData.substr(26, 40)}`);
};

export const extractTokenAmount = (
  tokenData: Swaps.UserTradeDataStructOutput
) => {
  return tokenData.tokenValue;
  //return parseInt(tokenData.substr(66, 64), 16);
};
export const extractTokenId = (tokenData: Swaps.UserTradeDataStructOutput) => {
  return tokenData.tokenId;
  //return `0x${tokenData.substr(130, 64)}`;
};
export const extractTokenStandard = (
  tokenData: Swaps.UserTradeDataStructOutput
) => {
  return tokenData.tokenStandard;
  //return parseInt(`0x${tokenData.substr(194, 64)}`);
};
export const extractTokenAccepted = (
  tokenData: Swaps.UserTradeDataStructOutput
) => {
  return tokenData.accepted;
  //return `0x${tokenData.substr(258, 64)}`;
};
export const extractTokenApproved = (
  tokenData: Swaps.UserTradeDataStructOutput
) => {
  return tokenData.approved;
  //return `0x${tokenData.substr(322, 64)}`;
};
