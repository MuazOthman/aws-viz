import * as Diagram from '.';

const app = Diagram.Reader.readDiagram('Sample Files/web-app1.drawio');
app.compile();
console.log('===== Application =====');
// console.log(JSON.stringify(app));
for (let i = 0; i < app.components.length; i++) {
  const c = app.components[i];
  console.log(c.toString());
  for (let j = 0; j < c.outboundConnections.length; j++) {
    const conn = c.outboundConnections[j];
    const connectionString = conn.label ? `${conn.target} labeled: "${conn.label}"` : conn.target;
    console.log(`\t=> ${connectionString}`);
  }
}
