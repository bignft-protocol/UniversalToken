export const bytes = /^0x([A-Fa-f0-9]{1,})$/;

export const bytes32 = /^0x([A-Fa-f0-9]{64})$/;
export const ethereumAddress = /^0x([A-Fa-f0-9]{40})$/;
export const transactionHash = /^0x([A-Fa-f0-9]{64})$/;

export const uuid4 =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
