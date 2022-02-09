import { Component } from './Component';

export class Connection {
  private readonly _source: Component;
  private readonly _target: Component;
  private readonly _label: string;

  get source(): Component {
    return this._source;
  }
  get target(): Component {
    return this._target;
  }
  get label(): string {
    return this._label;
  }

  constructor(source: Component, target: Component, label = '') {
    this._source = source;
    this._target = target;
    this._label = label ?? '';
    this._source.addOutboundConnection(this);
    this._target.addInboundConnection(this);
  }
}
