import { ethers, assert } from 'hardhat';

const ERC1400_TOKENS_VALIDATOR = 'ERC1400TokensValidator';

export const CERTIFICATE_VALIDATION_NONE = 0;
export const CERTIFICATE_VALIDATION_NONCE = 1;
export const CERTIFICATE_VALIDATION_SALT = 2;
export const CERTIFICATE_VALIDATION_DEFAULT = CERTIFICATE_VALIDATION_SALT;

export const assertTokenHasExtension = async (
  _registry: { getInterfaceImplementer: (arg0: any, arg1: string) => any },
  _extension: { address: any },
  _token: { address: any }
) => {
  let extensionImplementer = await _registry.getInterfaceImplementer(
    _token.address,
    ethers.utils.id(ERC1400_TOKENS_VALIDATOR)
  );
  assert.equal(extensionImplementer, _extension.address);
};

export const setNewExtensionForToken = async (
  _extension: {
    registerTokenSetup: (
      arg0: any,
      arg1: number,
      arg2: boolean,
      arg3: boolean,
      arg4: boolean,
      arg5: boolean,
      arg6: any,
      arg7: { from: any }
    ) => any;
    address: any;
  },
  _token: {
    controllers: () => any;
    address: any;
    setTokenExtension: (
      arg0: any,
      arg1: string,
      arg2: boolean,
      arg3: boolean,
      arg4: boolean,
      arg5: { from: any }
    ) => any;
  },
  _sender: any
) => {
  const controllers = await _token.controllers();
  await _extension.registerTokenSetup(
    _token.address,
    CERTIFICATE_VALIDATION_DEFAULT,
    true,
    true,
    true,
    true,
    controllers,
    { from: _sender }
  );

  await _token.setTokenExtension(
    _extension.address,
    ERC1400_TOKENS_VALIDATOR,
    true,
    true,
    true,
    { from: _sender }
  );
};

export const assertCertificateActivated = async (
  _extension: { retrieveTokenSetup: (arg0: any) => any },
  _token: { address: any },
  _expectedValue: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  assert.equal(_expectedValue, parseInt(tokenSetup[0]));
};

export const setCertificateActivated = async (
  _extension: {
    retrieveTokenSetup: (arg0: any) => any;
    registerTokenSetup: (
      arg0: any,
      arg1: any,
      arg2: any,
      arg3: any,
      arg4: any,
      arg5: any,
      arg6: any,
      arg7: { from: any }
    ) => any;
  },
  _token: { address: any },
  _sender: any,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  await _extension.registerTokenSetup(
    _token.address,
    _value,
    tokenSetup[1],
    tokenSetup[2],
    tokenSetup[3],
    tokenSetup[4],
    tokenSetup[5],
    { from: _sender }
  );
};

export const assertAllowListActivated = async (
  _extension: { retrieveTokenSetup: (arg0: any) => any },
  _token: { address: any },
  _expectedValue: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  assert.equal(_expectedValue, tokenSetup[1]);
};

export const setAllowListActivated = async (
  _extension: {
    retrieveTokenSetup: (arg0: any) => any;
    registerTokenSetup: (
      arg0: any,
      arg1: any,
      arg2: any,
      arg3: any,
      arg4: any,
      arg5: any,
      arg6: any,
      arg7: { from: any }
    ) => any;
  },
  _token: { address: any },
  _sender: any,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  await _extension.registerTokenSetup(
    _token.address,
    tokenSetup[0],
    _value,
    tokenSetup[2],
    tokenSetup[3],
    tokenSetup[4],
    tokenSetup[5],
    { from: _sender }
  );
};

export const assertBlockListActivated = async (
  _extension: { retrieveTokenSetup: (arg0: any) => any },
  _token: { address: any },
  _expectedValue: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  assert.equal(_expectedValue, tokenSetup[2]);
};

export const setBlockListActivated = async (
  _extension: {
    retrieveTokenSetup: (arg0: any) => any;
    registerTokenSetup: (
      arg0: any,
      arg1: any,
      arg2: any,
      arg3: any,
      arg4: any,
      arg5: any,
      arg6: any,
      arg7: { from: any }
    ) => any;
  },
  _token: { address: any },
  _sender: any,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  await _extension.registerTokenSetup(
    _token.address,
    tokenSetup[0],
    tokenSetup[1],
    _value,
    tokenSetup[3],
    tokenSetup[4],
    tokenSetup[5],
    { from: _sender }
  );
};

export const assertGranularityByPartitionActivated = async (
  _extension: { retrieveTokenSetup: (arg0: any) => any },
  _token: { address: any },
  _expectedValue: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  assert.equal(_expectedValue, tokenSetup[3]);
};

export const setGranularityByPartitionActivated = async (
  _extension: {
    retrieveTokenSetup: (arg0: any) => any;
    registerTokenSetup: (
      arg0: any,
      arg1: any,
      arg2: any,
      arg3: any,
      arg4: any,
      arg5: any,
      arg6: any,
      arg7: { from: any }
    ) => any;
  },
  _token: { address: any },
  _sender: any,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  await _extension.registerTokenSetup(
    _token.address,
    tokenSetup[0],
    tokenSetup[1],
    tokenSetup[2],
    _value,
    tokenSetup[4],
    tokenSetup[5],
    { from: _sender }
  );
};

export const assertHoldsActivated = async (
  _extension: { retrieveTokenSetup: (arg0: any) => any },
  _token: { address: any },
  _expectedValue: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  assert.equal(_expectedValue, tokenSetup[4]);
};

export const setHoldsActivated = async (
  _extension: {
    retrieveTokenSetup: (arg0: any) => any;
    registerTokenSetup: (
      arg0: any,
      arg1: any,
      arg2: any,
      arg3: any,
      arg4: any,
      arg5: any,
      arg6: any,
      arg7: { from: any }
    ) => any;
  },
  _token: { address: any },
  _sender: any,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  await _extension.registerTokenSetup(
    _token.address,
    tokenSetup[0],
    tokenSetup[1],
    tokenSetup[2],
    tokenSetup[3],
    _value,
    tokenSetup[5],
    { from: _sender }
  );
};

export const assertIsTokenController = async (
  _extension: { retrieveTokenSetup: (arg0: any) => any },
  _token: { address: any },
  _controller: any,
  _value: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  const controllerList = tokenSetup[5];
  assert.equal(_value, controllerList.includes(_controller));
};

export const addTokenController = async (
  _extension: {
    retrieveTokenSetup: (arg0: any) => any;
    registerTokenSetup: (
      arg0: any,
      arg1: any,
      arg2: any,
      arg3: any,
      arg4: any,
      arg5: any,
      arg6: any,
      arg7: { from: any }
    ) => any;
  },
  _token: { address: any },
  _sender: any,
  _newController: any
) => {
  const tokenSetup = await _extension.retrieveTokenSetup(_token.address);
  //Need to clone the object since tokenSetup[5] is immutable
  const controllerList = Object.assign([], tokenSetup[5]);
  if (!controllerList.includes(_newController)) {
    controllerList.push(_newController);
  }
  await _extension.registerTokenSetup(
    _token.address,
    tokenSetup[0],
    tokenSetup[1],
    tokenSetup[2],
    tokenSetup[3],
    tokenSetup[4],
    controllerList,
    { from: _sender }
  );
};
