import { artifacts } from 'hardhat';

const Migrations = artifacts.require('Migrations');

export default async function () {
  Migrations.setAsDeployed(await Migrations.new());
}
