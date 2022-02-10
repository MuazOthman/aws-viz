// import { yamlParse } from 'yaml-cfn';
// import { readFileSync } from 'fs';
// import { join } from 'path';

// const yml = yamlParse(readFileSync(join(__dirname, 'template.yaml'), 'utf-8'));

// console.log(JSON.stringify(yml, null, 2));

import * as Diagram from '../diagram';
import { SamWriter } from './generator';

// const app = Diagram.Reader.readDiagram('Sample Files/dynamodb-stream.drawio');
const app = Diagram.Reader.readDiagram('Sample Files/scheduled-task.drawio');

app.compile();
const writer = new SamWriter({ lambdaXRayTracingLayer: SamWriter.NodeJSLambdaXRayTracingLayer });
writer.generateSamFile(app);
