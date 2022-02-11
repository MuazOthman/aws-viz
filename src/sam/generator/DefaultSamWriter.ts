import { Component } from '../../diagram/model';
import { cleanString } from './cleanString';
import { parseSimpleFilters } from './parseSimpleFilters';
import { SamWriter } from './SamWriter';

export class DefaultSamWriter extends SamWriter {
  protected handleFunction(f: Component): void {
    if (!(f.name in this._model.Resources)) {
      this._model.Resources[f.name] = { Properties: {} };
    }
    this._model.Resources[f.name].Type = 'AWS::Serverless::Function';
    this._model.Resources[f.name].Properties.CodeUri = `build/${f.name}`;
    this._model.Resources[f.name].Properties.Handler = `${f.name}.Handler`;
    this._model.Resources[f.name].Properties.Runtime = f.properties.runtime;
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

  protected handleTopic(t: Component): void {
    if (!(t.name in this._model.Resources)) {
      this._model.Resources[t.name] = {};
    }
    this._model.Resources[t.name].Type = 'AWS::SNS::Topic';
  }

  protected handleBucket(b: Component): void {
    if (!(b.name in this._model.Resources)) {
      this._model.Resources[b.name] = {};
    }
    this._model.Resources[b.name].Type = 'AWS::S3::Bucket';
    const hasDirectBrowserAccess = b.inboundConnections.some((c) => c.source.type === 'Browser');
    if (hasDirectBrowserAccess) {
      this._model.Resources[b.name].Properties = {
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

  protected handleTable(t: Component): void {
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

  protected handleEventBus(b: Component): void {
    if (this._options.ignoreBusNamePattern) {
      if (b.name.search(new RegExp(this._options.ignoreBusNamePattern, 'g')) >= 0) {
        // no bus to create
        return;
      }
    }
    if (!(b.name in this._model.Resources)) {
      this._model.Resources[b.name] = {};
    }
    this._model.Resources[b.name].Type = 'AWS::Events::EventBus';
  }

  protected handleQueue(q: Component): void {
    if (!(q.name in this._model.Resources)) {
      this._model.Resources[q.name] = {};
    }
    this._model.Resources[q.name].Type = 'AWS::SQS::Queue';
  }
}
