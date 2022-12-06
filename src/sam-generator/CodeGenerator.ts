import { Application, Component } from '../diagram/model';
import { yamlDump, yamlParse } from 'yaml-cfn';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import isEqual from 'lodash.isequal';
import { CodeGeneratorOptions } from './CodeGeneratorOptions';
import { AbstractCodeGenerator } from '../AbstractCodeGenerator';
import { join } from 'path';

export abstract class CodeGenerator extends AbstractCodeGenerator {
  public static NodeJSLambdaXRayTracingLayer = {
    'Fn::Sub': 'arn:${AWS::Partition}:lambda:${AWS::Region}:580247275435:layer:LambdaInsightsExtension:16',
  };
  protected _model: any = {};
  protected readonly _options: CodeGeneratorOptions;
  constructor(workspaceRoot: string, options?: CodeGeneratorOptions) {
    super(workspaceRoot);
    this._options = options ?? { defaultRuntime: 'nodejs14.x' };
    if (!this._options.defaultTableProperties) {
      this._options.defaultTableProperties = {
        AttributeDefinitions: [
          {
            AttributeName: 'PK',
            AttributeType: 'S',
          },
          {
            AttributeName: 'SK',
            AttributeType: 'S',
          },
        ],
        KeySchema: [
          {
            AttributeName: 'PK',
            KeyType: 'HASH',
          },
          {
            AttributeName: 'SK',
            KeyType: 'RANGE',
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        SSESpecification: {
          SSEEnabled: true,
        },
      };
    }
  }

  protected addEnvironmentVariable(functionName: string, variableName: string, variableValue: any): void {
    this._model.Resources[functionName].Properties.Environment.Variables[variableName] = variableValue;
  }
  protected addPolicyToFunction(functionName: string, policy: any): void {
    const hasPolicy = this._model.Resources[functionName].Properties.Policies.some((p) => isEqual(p, policy));
    if (!hasPolicy) {
      this._model.Resources[functionName].Properties.Policies.push(policy);
    }
  }

  protected abstract handleFunction(f: Component): void;
  protected abstract handleTopic(f: Component): void;
  protected abstract handleBucket(f: Component): void;
  protected abstract handleTable(t: Component): void;
  protected abstract handleEventBus(t: Component): void;
  protected abstract handleQueue(t: Component): void;
  protected abstract handleWebsocketApiEndpoint(api: Component): void;

  protected initModel(app: Application): void {
    this._model = {
      ...(this._model ?? {}),
      AWSTemplateFormatVersion: '2010-09-09',
      Transform: 'AWS::Serverless-2016-10-31',
      Description: 'SAM template generated by aws-viz.',
      Globals: {
        Function: {
          Runtime: this._options.defaultRuntime ?? 'nodejs14.x',
          Timeout: 29,
          MemorySize: 128,
          Environment: {
            Variables: {
              AWS_NODEJS_CONNECTION_REUSE_ENABLED: 1,
              EnvironmentName: { Ref: 'EnvironmentName' },
            },
          },
        },
      },
      Resources: {},
      Parameters: {
        EnvironmentName: {
          Type: 'String',
          Description: 'The Environment Name',
        },
      },
    };
    if (this._options.additionalGlobalEnvironmentVariables) {
      this._model.Globals.Function.Environment.Variables = {
        ...this._model.Globals.Function.Environment.Variables,
        ...this._options.additionalGlobalEnvironmentVariables,
      };
    }
    if (this._options.lambdaXRayTracingLayer) {
      this._model.Globals.Function.Tracing = 'Active';
      this._model.Globals.Function.Layers = [this._options.lambdaXRayTracingLayer];
    }

    const hasHttpApiEndpoint = app.components.some(
      (c) => c.type === 'ApiEndpoint' && c.properties['apiType'] === 'Http',
    );
    if (!this._model.Resources) {
      this._model.Resources = {};
    }
    if (!this._model.Outputs) {
      this._model.Outputs = {};
    }

    // add HttpApi resource if needed
    if (hasHttpApiEndpoint) {
      this._model.Resources.HttpApiResource = {
        Type: 'AWS::Serverless::HttpApi',
        Properties: {},
      };

      if (!this._options.isCorsDisabled) {
        this._model.Resources.HttpApiResource.Properties.CorsConfiguration = {
          AllowHeaders: ['*'],
          AllowMethods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
          AllowOrigins: [{ Ref: 'AllowedDomain' }],
        };
      }

      this._model.Outputs.RootUrl = {
        Description: 'Root URL for API',
        Value: {
          'Fn::Sub': 'https://${HttpApiResource}.execute-api.${AWS::Region}.amazonaws.com',
        },
      };
    }
  }

  protected build;

  protected buildSamObject(app: Application): void {
    this.initModel(app);

    for (let i = 0; i < app.components.length; i++) {
      const component = app.components[i];
      switch (component.type) {
        case 'Browser':
          // nothing
          break;
        case 'Bucket':
          this.handleBucket(component);
          break;
        case 'EventBus':
          this.handleEventBus(component);
          break;
        case 'Function':
          this.handleFunction(component);
          break;
        case 'Queue':
          this.handleQueue(component);
          break;
        case 'ApiEndpoint':
          if (component.properties['apiType'] === 'Websocket') {
            this.handleWebsocketApiEndpoint(component);
          }
          break;
        case 'Schedule':
          // nothing
          break;
        case 'Table':
          this.handleTable(component);
          break;
        case 'Topic':
          this.handleTopic(component);
          break;
      }
    }
  }

  getFilesToBeUpdated(): string[] {
    return ['template.yaml'];
  }

  update(app: Application): void {
    if (!app.isCompiled) app.compile();
    const file = join(this.workspaceRoot, 'template.yaml');
    if (existsSync(file)) {
      this._model = yamlParse(readFileSync(file, 'utf-8')) ?? {};
    }
    this.buildSamObject(app);
    const yml = yamlDump(this._model);
    writeFileSync(file, yml);
  }
}
