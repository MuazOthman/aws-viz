export type CodeGeneratorOptions = {
  isCorsDisabled?: boolean;
  defaultRuntime?: SupportedRuntime;
  additionalGlobalEnvironmentVariables?: Record<string, any>;
  defaultTableProperties?: any;
  lambdaXRayTracingLayer?: any;
  ignoreBusNamePattern?: string;
  globals?: Globals;
};

export type SupportedRuntime =
  | 'nodejs18.x'
  | 'nodejs16.x'
  | 'nodejs14.x'
  | 'python3.9'
  | 'python3.8'
  | 'python3.7'
  | 'java11'
  | 'java8.al2'
  | 'java8'
  | 'dotnet6'
  | 'dotnet5.0'
  | 'go1.x'
  | 'ruby2.7';

export type Globals = {
  Function?: {
    Runtime?: SupportedRuntime;
    MemorySize?: number;
    Timeout?: number;
    Environment?: Record<string, any>;
    Layers?: any[];
  };
};
