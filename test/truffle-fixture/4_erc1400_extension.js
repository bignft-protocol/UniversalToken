const Extension = artifacts.require('ERC1400TokensValidator');

module.exports = async function () {
  const extension = await Extension.new();
  Extension.setAsDeployed(extension);
  console.log('\n   > Extension deployment: Success -->', extension.address);
};
