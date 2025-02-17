import { ethers } from 'ethers';
import {
  ERC1400HoldableCertificateToken,
  ERC1400TokensValidator
} from '../../typechain-types';

export const ERC1400_TOKENS_VALIDATOR = 'ERC1400TokensValidator';

export const CERTIFICATE_VALIDATION_NONE = 0;
export const CERTIFICATE_VALIDATION_NONCE = 1;
export const CERTIFICATE_VALIDATION_SALT = 2;
export const CERTIFICATE_VALIDATION_DEFAULT = CERTIFICATE_VALIDATION_SALT;

export const setNewExtensionForToken = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _senderSigner: ethers.Signer
) => {
  const controllers = await _token.controllers();

  await _extension
    .connect(_senderSigner)
    .registerTokenSetup(
      _token.address,
      CERTIFICATE_VALIDATION_DEFAULT,
      true,
      true,
      true,
      true,
      controllers
    );

  await _token
    .connect(_senderSigner)
    .setTokenExtension(
      _extension.address,
      ERC1400_TOKENS_VALIDATOR,
      true,
      true,
      true
    );
};

export const setCertificateActivated = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _senderSigner: ethers.Signer,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  await _extension
    .connect(_senderSigner)
    .registerTokenSetup(
      _token.address,
      _value,
      tokenSetup[1],
      tokenSetup[2],
      tokenSetup[3],
      tokenSetup[4],
      tokenSetup[5]
    );
};

export const setAllowListActivated = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _senderSigner: ethers.Signer,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);

  await _extension
    .connect(_senderSigner)
    .registerTokenSetup(
      _token.address,
      tokenSetup[0],
      _value,
      tokenSetup[2],
      tokenSetup[3],
      tokenSetup[4],
      tokenSetup[5]
    );
};

export const setBlockListActivated = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _senderSigner: ethers.Signer,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);

  await _extension
    .connect(_senderSigner)
    .registerTokenSetup(
      _token.address,
      tokenSetup[0],
      tokenSetup[1],
      _value,
      tokenSetup[3],
      tokenSetup[4],
      tokenSetup[5]
    );
};

export const setGranularityByPartitionActivated = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _senderSigner: ethers.Signer,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);

  await _extension
    .connect(_senderSigner)
    .registerTokenSetup(
      _token.address,
      tokenSetup[0],
      tokenSetup[1],
      tokenSetup[2],
      _value,
      tokenSetup[4],
      tokenSetup[5]
    );
};

export const setHoldsActivated = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _senderSigner: ethers.Signer,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);

  await _extension
    .connect(_senderSigner)
    .registerTokenSetup(
      _token.address,
      tokenSetup[0],
      tokenSetup[1],
      tokenSetup[2],
      tokenSetup[3],
      _value,
      tokenSetup[5]
    );
};

export const addTokenController = async (
  _extension: ERC1400TokensValidator,
  _token: ERC1400HoldableCertificateToken,
  _senderSigner: ethers.Signer,
  _newController: string
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);

  //Need to clone the object since tokenSetup[5] is immutable
  const controllerList = Object.assign([], tokenSetup[5]);
  if (!controllerList.includes(_newController)) {
    controllerList.push(_newController);
  }
  await _extension
    .connect(_senderSigner)
    .registerTokenSetup(
      _token.address,
      tokenSetup[0],
      tokenSetup[1],
      tokenSetup[2],
      tokenSetup[3],
      tokenSetup[4],
      controllerList
    );
};
