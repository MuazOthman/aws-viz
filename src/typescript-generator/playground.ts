// import { yamlParse } from 'yaml-cfn';
// import { readFileSync } from 'fs';
// import { join } from 'path';

// const yml = yamlParse(readFileSync(join(__dirname, 'template.yaml'), 'utf-8'));

// console.log(JSON.stringify(yml, null, 2));

import * as Diagram from '../diagram';
import { CodeGenerator } from './CodeGenerator';

const reader = new Diagram.Reader({ runtimeColorMapping: { '76608A': 'nodejs12.x' } });
const app = reader.read('Sample Files/web-app1.drawio');

app.compile();
const writer = new CodeGenerator('../sample-generated-code');
console.log(writer.getFilesToBeUpdated(app));
writer.update(app);
