// import { yamlParse } from 'yaml-cfn';
// import { readFileSync } from 'fs';
// import { join } from 'path';

// const yml = yamlParse(readFileSync(join(__dirname, 'template.yaml'), 'utf-8'));

// console.log(JSON.stringify(yml, null, 2));

import * as Diagram from '../diagram';
import { DefaultSamWriter } from './generator';

const reader = new Diagram.Reader({ runtimeColorMapping: { '76608A': 'nodejs12.x' } });
const app = reader.read('Sample Files/scheduled-task.drawio');

app.compile();
const writer = new DefaultSamWriter({
  lambdaXRayTracingLayer: DefaultSamWriter.NodeJSLambdaXRayTracingLayer,
});
writer.generateSamFile(app);
