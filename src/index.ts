import * as Diagram from './diagram';
import * as SAMGenerator from './sam-generator';
import * as TSGenerator from './typescript-generator';

export { Diagram, SAMGenerator, TSGenerator };

export type AWSVizOptions = {
  readerOptions?: Diagram.ReaderOptions;
  codeGeneratorOptions?: SAMGenerator.CodeGeneratorOptions;
};

export class AWSViz {
  private readonly _options: AWSVizOptions;

  constructor(options?: AWSVizOptions) {
    this._options = options ?? {};
    this._reader = new Diagram.Reader(this._options.readerOptions);
  }

  private readonly _reader: Diagram.Reader;

  public listFilesToBeUpdated(file: string, workspaceRoot: string): string[] {
    const app = this._reader.read(file);
    app.compile();
    const typescriptGenerator = new TSGenerator.CodeGenerator(workspaceRoot);
    const samGenerator = new SAMGenerator.DefaultCodeGenerator(workspaceRoot);
    return [...samGenerator.getFilesToBeUpdated(), ...typescriptGenerator.getFilesToBeUpdated(app)];
  }

  public updateWorkspace(file: string, workspaceRoot: string): void {
    const app = this._reader.read(file);
    app.compile();
    const typescriptGenerator = new TSGenerator.CodeGenerator(workspaceRoot);
    const samGenerator = new SAMGenerator.DefaultCodeGenerator(workspaceRoot, this._options.codeGeneratorOptions);
    samGenerator.update(app);
    typescriptGenerator.update(app);
  }
}
