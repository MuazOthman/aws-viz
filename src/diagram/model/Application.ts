import { PendingConnection } from './PendingConnection';
import { Connection } from './Connection';
import { Component } from './Component';

export class Application {
  private readonly _aliases: Record<string, string> = {};
  private readonly _components: Record<string, Component> = {};
  private readonly _pendingConnections: Array<PendingConnection> = [];

  get components(): Component[] {
    return Object.values(this._components);
  }

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  private _isCompiled: boolean = false;

  get isCompiled(): boolean {
    return this._isCompiled;
  }

  registerComponent(alias: string, component: Component): void {
    if (this.isCompiled) throw new Error('Application is already compiled');
    if (component.name in this._components) {
      const existingComponent = this._components[component.name];
      existingComponent.merge(component);
    } else {
      this._components[component.name] = component;
    }

    this._aliases[alias] = component.name;
  }

  getComponentByName(name: string): Component {
    return name in this._components ? this._components[name] : undefined;
  }
  getComponentByAlias(alias: string): Component {
    return alias in this._aliases ? this.getComponentByName(this._aliases[alias]) : undefined;
  }

  registerConnection(sourceAlias: string, targetAlias: string, label = ''): void {
    if (this.isCompiled) throw new Error('Application is already compiled');
    this._pendingConnections.push({ sourceAlias, targetAlias, label });
  }

  compile(): void {
    if (this.isCompiled) throw new Error('Application is already compiled');
    for (let i = 0; i < this._pendingConnections.length; i++) {
      const pendingConnection = this._pendingConnections[i];
      const source = this.getComponentByAlias(pendingConnection.sourceAlias);
      if (source == undefined) continue;
      const target = this.getComponentByAlias(pendingConnection.targetAlias);
      if (target == undefined) continue;
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      new Connection(source, target, pendingConnection.label);
    }

    this._isCompiled = true;
  }
}
