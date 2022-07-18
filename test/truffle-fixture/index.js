module.exports = async () => {
  const networkId = await web3.eth.net.getId();
  if (networkId === 'test') return;

  await require('./1_initial_migration')();
  await require('./2_erc1820_registry')();
  await require('./3_erc1400_token')();
  await require('./4_erc1400_extension')();
  await require('./5_erc1400_holdable')();
  await require('./6_erc1400_certificate_none')();
  await require('./7_erc1400_certificate_nonce')();
  await require('./8_erc1400_certificate_salt')();
  await require('./9_batch_reader')();
  await require('./10_batch_token_issuer')();
  await require('./11_delivery_vs_payment')();
  await require('./12_fund_issuer')();
};
