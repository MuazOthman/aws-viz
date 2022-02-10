import { Application, Component } from '../../diagram/model';
import { yamlDump, yamlParse } from 'yaml-cfn';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import isEqual from 'lodash.isequal';

export type SamWriterOptions = {
  isCorsDisabled?: boolean;
  additionalGlobalEnvironmentVariables?: Record<string, any>;
  defaultTableProperties?: any;
  lambdaXRayTracingLayer?: any;
};

export function cleanString(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '');
}

export function parseSimpleFilters(s: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (s) {
    const pairs = s.split(/[\n\r,]/g);
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const parts = pair.split('=');
      if (parts.length === 2) {
        result[parts[0].trim()] = parts[1].replace(/\"/g, '').trim();
      }
    }
  }
  return result;
}

export class SamWriter {
  public static NodeJSLambdaXRayTracingLayer = {
    'Fn::Sub': 'arn:aws:lambda:${AWS::Region}:580247275435:layer:LambdaInsightsExtension:16',
  };
  private _model: any = {};
  private readonly _options: SamWriterOptions;
  constructor(options?: SamWriterOptions) {
    this._options = options ?? {};
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

  private addEnvironmentVariable(functionName: string, variableName: string, variableValue: any): void {
    this._model.Resources[functionName].Properties.Environment.Variables[variableName] = variableValue;
  }
  private addPolicyToFunction(functionName: string, policy: any): void {
    const hasPolicy = this._model.Resources[functionName].Properties.Policies.some((p) => isEqual(p, policy));
    if (!hasPolicy) {
      this._model.Resources[functionName].Properties.Policies.push(policy);
    }
  }

  private handleFunction(f: Component): void {
    if (!(f.name in this._model.Resources)) {
      this._model.Resources[f.name] = { Properties: {} };
    }
    this._model.Resources[f.name].Type = 'AWS::Serverless::Function';
    this._model.Resources[f.name].Properties.CodeUri = `build/${f.name}`;
    this._model.Resources[f.name].Properties.Handler = `${f.name}.Handler`;
    if (!this._model.Resources[f.name].Properties.Policies) this._model.Resources[f.name].Properties.Policies = [];
    if (!this._model.Resources[f.name].Properties.Environment)
      this._model.Resources[f.name].Properties.Environment = {
        Variables: {},
      };
    if (!this._model.Resources[f.name].Properties.Events) this._model.Resources[f.name].Properties.Events = {};

    if (this._options.lambdaXRayTracingLayer) {
      this.addPolicyToFunction(f.name, 'CloudWatchLambdaInsightsExecutionRolePolicy');
    }

    for (let i = 0; i < f.outboundConnections.length; i++) {
      const conn = f.outboundConnections[i];
      switch (conn.target.type) {
        case 'Browser':
          // not supported
          break;
        case 'Bucket':
          this.addEnvironmentVariable(f.name, `${conn.target.name}BucketName`, {
            Ref: conn.target.name,
          });
          this.addPolicyToFunction(f.name, {
            S3CrudPolicy: { BucketName: { Ref: conn.target.name } },
          });
          break;
        case 'EventBus':
          this.addEnvironmentVariable(f.name, `${conn.target.name}BusName`, {
            Ref: conn.target.name,
          });
          this.addPolicyToFunction(f.name, {
            EventBridgePutEventsPolicy: { EventBusName: { Ref: conn.target.name } },
          });
          break;
        case 'Function':
          // not supported
          break;
        case 'Queue':
          this.addEnvironmentVariable(f.name, `${conn.target.name}QueueUrl`, {
            Ref: conn.target.name,
          });
          this.addPolicyToFunction(f.name, {
            SQSSendMessagePolicy: { QueueName: { 'Fn::GetAtt': [conn.target.name, 'QueueName'] } },
          });
          break;
        case 'ApiEndpoint':
          // not supported
          break;
        case 'Schedule':
          // not supported
          break;
        case 'Table':
          this.addEnvironmentVariable(f.name, `${conn.target.name}TableName`, {
            Ref: conn.target.name,
          });
          this.addPolicyToFunction(f.name, {
            DynamoDBCrudPolicy: { TableName: { Ref: conn.target.name } },
          });
          break;
        case 'Topic':
          this.addEnvironmentVariable(f.name, `${conn.target.name}TopicArn`, {
            Ref: conn.target.name,
          });
          this.addPolicyToFunction(f.name, {
            SNSPublishMessagePolicy: { TopicName: { 'Fn::GetAtt': [conn.target.name, 'TopicName'] } },
          });
          break;
      }
    }

    for (let i = 0; i < f.inboundConnections.length; i++) {
      const conn = f.inboundConnections[i];
      const cleanSourceName = cleanString(conn.source.name);
      switch (conn.source.type) {
        case 'Browser':
          // not supported
          break;
        case 'Bucket':
          let eventNames = conn.label ?? 's3:ObjectCreated:*';
          eventNames = eventNames.replace(/^['"]/g, '').replace(/['"]$/g, '');
          const eventNamesAsArray = eventNames.split('\n').filter((e) => e);
          this._model.Resources[f.name].Properties.Events[`${cleanSourceName}Bucket`] = {
            Type: 'S3',
            Properties: {
              Bucket: { Ref: conn.source.name },
              Events: eventNamesAsArray,
            },
          };
          break;
        case 'EventBus':
          this._model.Resources[f.name].Properties.Events[`${cleanSourceName}Rule`] = {
            Type: 'EventBridgeRule',
            Properties: {
              EventBusName: { Ref: conn.source.name },
              Pattern: parseSimpleFilters(conn.label),
            },
          };
          break;
        case 'Function':
          // not supported
          break;
        case 'Queue':
          this._model.Resources[f.name].Properties.Events[`${cleanSourceName}Queue`] = {
            Type: 'SQS',
            Properties: {
              Queue: { 'Fn::GetAtt': [conn.source.name, 'Arn'] },
              BatchSize: 10,
            },
          };
          break;
        case 'ApiEndpoint':
          this._model.Resources[f.name].Properties.Events[`${cleanSourceName}Api`] = {
            Type: 'Api',
            Properties: {
              Path: conn.source.properties.Endpoint,
              Method: conn.source.properties.HttpMethod,
            },
          };
          break;
        case 'Schedule':
          this._model.Resources[f.name].Properties.Events[`${cleanSourceName}TimerRule`] = {
            Type: 'Schedule',
            Properties: {
              Schedule: { Ref: `${cleanSourceName}Expression` },
            },
          };
          this._model.Parameters[`${cleanSourceName}Expression`] = {
            Type: 'String',
            Default: 'rate(1 day)',
          };
          break;
        case 'Table':
          this._model.Resources[f.name].Properties.Events[`${cleanSourceName}Stream`] = {
            Type: 'DynamoDB',
            Properties: {
              Stream: { 'Fn::GetAtt': [conn.source.name, 'StreamArn'] },
              BatchSize: 10,
              StartingPosition: 'TRIM_HORIZON',
              BisectBatchOnFunctionError: true,
            },
          };
          break;
        case 'Topic':
          // TODO: handled merging filters for the same topic
          break;
      }
    }
  }

  private handleTopic(f: Component): void {
    if (!(f.name in this._model.Resources)) {
      this._model.Resources[f.name] = {};
    }
    this._model.Resources[f.name].Type = 'AWS::SNS::Topic';
  }

  private handleBucket(f: Component): void {
    if (!(f.name in this._model.Resources)) {
      this._model.Resources[f.name] = {};
    }
    this._model.Resources[f.name].Type = 'AWS::S3::Bucket';
    const hasDirectBrowserAccess = f.inboundConnections.some((c) => c.source.type === 'Browser');
    if (hasDirectBrowserAccess) {
      this._model.Resources[f.name].Properties = {
        CorsConfiguration: {
          CorsRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['PUT'],
              AllowedOrigins: [
                {
                  Ref: 'AllowedDomain',
                },
              ],
            },
          ],
        },
      };
    }
  }

  private handleTable(t: Component): void {
    if (!(t.name in this._model.Resources)) {
      this._model.Resources[t.name] = {
        Properties: this._options.defaultTableProperties,
      };
    }
    this._model.Resources[t.name].Type = 'AWS::DynamoDB::Table';
    if (t.outboundConnections.length > 0) {
      // make sure stream is enabled
      this._model.Resources[t.name].Properties.StreamSpecification = this._model.Resources[t.name].Properties
        .StreamSpecification ?? { StreamViewType: 'NEW_AND_OLD_IMAGES' };
    }
  }

  private buildSamObject(app: Application): void {
    const hasApiEndpoint = app.components.some((c) => c.type === 'ApiEndpoint');

    if (Object.keys(this._model).length === 0) {
      this._model = {
        AWSTemplateFormatVersion: '2010-09-09',
        Transform: 'AWS::Serverless-2016-10-31',
        Description: 'SAM template generated by aws-viz.',
        Globals: {
          Function: {
            Runtime: 'nodejs14.x',
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
    }

    this._model.AWSTemplateFormatVersion = '2010-09-09';
    this._model.Transform = 'AWS::Serverless-2016-10-31';

    if (hasApiEndpoint && !this._options.isCorsDisabled) {
      this._model.Globals.Function.Environment.Variables.AllowedDomain = { Ref: 'AllowedDomain' };
      this._model.Parameters.AllowedDomain = {
        Type: 'String',
        Default: '*',
        Description: 'The allowed domain to access the stack APIs',
      };
    }

    if (!this._model.Resources) {
      this._model.Resources = {};
    }

    // add HttpApi resource if needed
    if (hasApiEndpoint) {
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

      this._model.Outputs = {
        RootUrl: {
          Description: 'Root URL for API',
          Value: {
            'Fn::Sub': 'https://${HttpApiResource}.execute-api.${AWS::Region}.amazonaws.com',
          },
        },
      };
    }

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
          break;
        case 'Function':
          this.handleFunction(component);
          break;
        case 'Queue':
          break;
        case 'ApiEndpoint':
          break;
        case 'Schedule':
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

  public generateSamFile(app: Application, file = 'template-gen.yaml'): void {
    if (!app.isCompiled) app.compile();
    if (existsSync(file)) {
      this._model = yamlParse(readFileSync(file, 'utf-8')) ?? {};
    }
    this.buildSamObject(app);
    const yml = yamlDump(this._model);
    writeFileSync(file, yml);
  }
}
