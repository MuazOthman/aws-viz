import { Connection } from './Connection';
import { ComponentType } from './ComponentType';

export class Component {
  private readonly _inboundConnections: Array<Connection> = [];
  private readonly _outboundConnections: Array<Connection> = [];
  private readonly _properties: Record<string, string>;
  private readonly _name: string;
  private readonly _type: ComponentType;
  constructor(name: string, type: ComponentType, properties?: Record<string, string>) {
    this._name = name;
    this._type = type;
    this._properties = properties ?? {};
  }
  get name(): string {
    return this._name;
  }
  get type(): ComponentType {
    return this._type;
  }
  get inboundConnections(): Array<Connection> {
    return [...this._inboundConnections];
  }
  get outboundConnections(): Array<Connection> {
    return [...this._outboundConnections];
  }
  get properties(): Record<string, string> {
    return this._properties;
  }

  toString(): string {
    return `${this.name}: ${this.type}`;
  }

  merge(another: Component): void {
    // check for conflicts in type
    if (this.type !== another.type)
      throw new Error(
        `Failed merging component: name '${another.name}' is shared by more than one resource of different types`,
      );
    // check for conflicts in properties
    for (const k in this._properties) {
      if (k in another._properties && another._properties[k] !== this._properties[k])
        throw new Error(
          `Failed merging conflicted property values '${this._properties[k]}' and '${another._properties[k]}' for property '${k}'`,
        );
    }
    // merge properties
    for (const k in this._properties) {
      if (!(k in this._properties)) this._properties[k] = another._properties[k];
    }
    for (let i = 0; i < this._inboundConnections.length; i++) {
      const connection = this._inboundConnections[i];
      this.addInboundConnection(connection);
    }
    // merge connections
    for (let i = 0; i < this._outboundConnections.length; i++) {
      const connection = this._outboundConnections[i];
      this.addOutboundConnection(connection);
    }
  }
  addOutboundConnection(connection: Connection): void {
    const doesConnectionExist = this._outboundConnections.some(
      (c) => c.target.name == connection.target.name && c.label == connection.label,
    );
    if (!doesConnectionExist) this._outboundConnections.push(connection);
  }

  addInboundConnection(connection: Connection): void {
    const doesConnectionExist = this._inboundConnections.some(
      (c) => c.source.name == connection.source.name && c.label == connection.label,
    );
    if (!doesConnectionExist) this._inboundConnections.push(connection);
  }
}
