export type CodeGeneratorOptions = {
  isCorsDisabled?: boolean;
  defaultRuntime?: string;
  additionalGlobalEnvironmentVariables?: Record<string, any>;
  defaultTableProperties?: any;
  lambdaXRayTracingLayer?: any;
  ignoreBusNamePattern?: string;
};
