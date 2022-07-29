// @ts-nocheck
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const isValidABI = (file: string) => {
  if (!file.match(/\/[a-zA-Z0-9]+\.json$/)) return false;
  const json = JSON.parse(fs.readFileSync(file).toString());
  return json.abi.length > 0;
};

async function getFiles(dir: string): Promise<string[]> {
  const dirs = Array.isArray(dir) ? dir : [dir];
  const files: string[] = [];
  for (const dir of dirs) {
    const subdirs = await readdir(dir);
    files.push(
      ...(await Promise.all(
        subdirs.map(async (subdir) => {
          const res = path.join(dir, subdir);

          return (await stat(res)).isDirectory()
            ? getFiles(res)
            : isValidABI(res)
            ? res
            : [];
        })
      ))
    );
  }

  return files.reduce((a, f) => a.concat(f), []);
}

export default async function () {
  const files = await getFiles(path.join('artifacts', 'contracts'));
  const fileEntries = Object.fromEntries(
    files.map((file) => [path.basename(file).slice(0, -5), '../' + file])
  );
  const typesVals = Object.keys(fileEntries).map(
    (key) => `import type { ${key} } from './${key}';`
  );

  const funcVals: string[] = [];

  for (const key in fileEntries) {
    funcVals.push(`public static async ${key}(address: string): Promise<${key}> {
  const artifacts = await import(
    '${fileEntries[key]}'
  );
  const ContractFactory = TruffleContract(artifacts);
  ContractFactory.setProvider(this._provider);
  return ContractFactory.at(address);
}`);
  }

  const tpl = `// @ts-ignore
import TruffleContract from '@nomiclabs/truffle-contract';
${typesVals.join('\n')}

export default class ContractHelper {
  private static _provider: any;
  public static setProvider(provider: any) {
    this._provider = provider;
  }

  ${funcVals.join('\n\n')}
}
`;

  fs.writeFileSync(path.resolve('typechain-types', 'ContractHelper.ts'), tpl);
}
