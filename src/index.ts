import * as Diagram from './diagram';
import * as SAMGenerator from './sam-generator';
import * as TSGenerator from './typescript-generator';

export { Diagram, SAMGenerator, TSGenerator };

const reader = new Diagram.Reader();

export function listFilesToBeUpdated(file: string, workspaceRoot: string): string[] {
  const app = reader.read(file);
  app.compile();
  const typescriptGenerator = new TSGenerator.CodeGenerator(workspaceRoot);
  const samGenerator = new SAMGenerator.DefaultCodeGenerator(workspaceRoot);
  return [...samGenerator.getFilesToBeUpdated(), ...typescriptGenerator.getFilesToBeUpdated(app)];
}

export function updateWorkspace(file: string, workspaceRoot: string): void {
  const app = reader.read(file);
  app.compile();
  const typescriptGenerator = new TSGenerator.CodeGenerator(workspaceRoot);
  const samGenerator = new SAMGenerator.DefaultCodeGenerator(workspaceRoot);
  samGenerator.update(app);
  typescriptGenerator.update(app);
}
