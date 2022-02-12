import { Application } from './diagram/model/Application';
export abstract class AbstractCodeGenerator {
  protected readonly workspaceRoot: string;
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }
  abstract getFilesToBeUpdated(app: Application): string[];
  abstract update(app: Application): void;
}
