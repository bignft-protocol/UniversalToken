const Migrations = artifacts.require('Migrations');

module.exports = async function () {
  Migrations.setAsDeployed(await Migrations.new());
};
