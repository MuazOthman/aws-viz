import { Application, Component } from '../model';
import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import pako from 'pako';
import { convert as extractInnerText } from 'html-to-text';

const parser = new XMLParser({ ignoreAttributes: false });

type ParsedFile = {
  mxfile: {
    diagram?: Diagram | Diagram[];
  };
};

type Diagram = {
  mxGraphModel?: { root: { mxCell: unknown[] } };
};

function decompress(diagram: Diagram) {
  const compressedText = Buffer.from(diagram['#text'], 'base64');
  const inflated = pako.inflateRaw(compressedText);
  const mxGraphModelText = decodeURIComponent(String.fromCharCode.apply(null, inflated));
  const mxGraphModel = parser.parse(mxGraphModelText);
  for (const k in mxGraphModel) {
    diagram[k] = mxGraphModel[k];
  }
  delete diagram['#text'];
}

export type ReaderOptions = {
  runtimeColorMapping?: Record<string, string>;
};

export class Reader {
  private readonly _options: ReaderOptions;

  constructor(options?: ReaderOptions) {
    this._options = options ?? {};
  }
  private _readDiagramFile(filePath: string): ParsedFile {
    const xml = fs.readFileSync(filePath).toString('utf-8');
    const parsed = parser.parse(xml) as ParsedFile;
    if (parsed.mxfile?.diagram === undefined) return undefined;
    const isCompressed = parsed.mxfile['@_compressed'] === 'true';
    if (isCompressed) {
      const diagram = parsed.mxfile.diagram;
      if (Array.isArray(diagram)) {
        for (let i = 0; i < diagram.length; i++) {
          const d = diagram[i];
          decompress(d);
        }
      } else {
        decompress(diagram);
      }
      parsed.mxfile['@_compressed'] = 'false';
    }
    return parsed;
  }

  private _getRuntime(style: string): string {
    if (this._options.runtimeColorMapping) {
      for (const color in this._options.runtimeColorMapping) {
        if (style.search(new RegExp(`fillColor=#${color}`, 'gi')) >= 0) {
          return this._options.runtimeColorMapping[color];
        }
      }
    }
    return undefined;
  }

  private _readComponent(vertex: unknown): Component {
    const style = vertex['@_style'] as string;
    const name = extractInnerText(vertex['@_value']).replace(/[\r\n]/g, '');
    if (style.search(/shape=mxgraph\.aws4\.lambda_function/g) >= 0) {
      const runtime = this._getRuntime(style);
      return new Component(name, 'Function', { runtime });
    }
    if (style.search(/shape=mxgraph\.aws4\.client/g) >= 0) return new Component(name, 'Browser');
    if (style.search(/shape=mxgraph\.aws4\.endpoint/g) >= 0) return new Component(name, 'ApiEndpoint');
    if (style.search(/shape=mxgraph\.aws4\.table/g) >= 0) return new Component(name, 'Table');
    if (style.search(/shape=mxgraph\.aws4\.topic/g) >= 0) return new Component(name, 'Topic');
    if (style.search(/shape=mxgraph\.aws4\.queue/g) >= 0) return new Component(name, 'Queue');
    if (style.search(/shape=mxgraph\.aws4\.bucket/g) >= 0) return new Component(name, 'Bucket');
    if (style.search(/shape=mxgraph\.aws4\.event_time_based/g) >= 0) return new Component(name, 'Schedule');
    return undefined;
  }

  private _readPage(diagram: Diagram, app: Application): void {
    const root = diagram.mxGraphModel.root;
    const mxCells = root.mxCell;
    const vertices = mxCells.filter((c) => c['@_vertex'] === '1');
    const edges = mxCells.filter((c) => c['@_edge'] === '1');

    // console.log('========================================================================');
    // console.log('vertices:');
    // console.log(JSON.stringify(vertices, null, 2));
    // console.log('========================================================================');
    // console.log('edges:');
    // console.log(JSON.stringify(edges, null, 2));

    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      const c = this._readComponent(vertex);
      if (c) {
        app.registerComponent(vertex['@_id'], c);
      }
    }
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      let label = edge['@_value'] as string;
      if (!label) {
        const labelElement = vertices.find(
          (v) => v['@_parent'] === edge['@_id'] && (v['@_style'] as string).search(/edgeLabel/g) >= 0,
        );
        if (labelElement) {
          label = extractInnerText(labelElement['@_value'] as string);
        }
      }
      app.registerConnection(edge['@_source'] as string, edge['@_target'] as string, label);
    }
  }

  read(filePath: string): Application {
    const fileContents = this._readDiagramFile(filePath);
    const diagram = fileContents.mxfile.diagram;
    const app = new Application();
    if (Array.isArray(diagram)) {
      for (let i = 0; i < diagram.length; i++) {
        const d = diagram[i];
        this._readPage(d, app);
      }
    } else {
      this._readPage(diagram, app);
    }
    return app;
  }
}
