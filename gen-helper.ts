import path from 'path';
import fs from 'fs';

export default async function () {
  const entries = fs
    .readdirSync(path.join('typechain-types', 'factories'))
    .filter((file) => file !== 'ContractHelper.ts')
    .map((file) => file.split('__')[0]);

  const typesVals = entries.map(
    (entry) => `import { ${entry}__factory } from './${entry}__factory';`
  );

  const funcVals = entries.map((entry) => {
    // fast check constructor method
    const hasConstructor =
      fs
        .readFileSync(
          path.join('typechain-types', 'factories', `${entry}__factory.ts`)
        )
        .toString()
        .indexOf('"constructor"') !== -1;

    if (!hasConstructor) {
      typesVals.push(`import { ${entry} } from '../${entry}';`);
    }

    return `  
  public static get ${entry}(): ${
      hasConstructor ? `${entry}__factory` : entry
    } {    
    return ${
      hasConstructor
        ? `new ${entry}__factory(this._signer)`
        : `${entry}__factory.connect('', this._signer)`
    };
  }`;
  });

  const tpl = `import { Signer } from 'ethers';
${typesVals.join('\n')}

export default class ContractHelper {
  private static _signer: Signer;
  public static setSigner(signer: Signer) {
    this._signer = signer;
  }
  ${funcVals.join('\n')}
}
`;

  // write the generated file
  fs.writeFileSync(
    path.resolve('typechain-types', 'factories', 'ContractHelper.ts'),
    tpl
  );
  // append ContractHelper to index.ts of the typechain-types package

  if (
    fs
      .readFileSync(path.resolve('typechain-types', 'index.ts'))
      .toString()
      .indexOf('ContractHelper') === -1
  ) {
    fs.appendFileSync(
      path.resolve('typechain-types', 'index.ts'),
      `\nexport { default as ContractHelper } from "./factories/ContractHelper";`
    );
  }
}
