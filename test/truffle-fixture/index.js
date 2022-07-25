const path = require('path');

module.exports = async () => {
  const networkId = await web3.eth.net.getId();
  if (networkId === 'test') return;

  for (const file of require('fs')
    .readdirSync(__dirname)
    .filter((file) => file !== 'index.js')
    .sort(
      (f1, f2) => parseInt(f1.split('_')[0]) - parseInt(f2.split('_')[0])
    )) {
    await require('./' + file)();
  }
};
