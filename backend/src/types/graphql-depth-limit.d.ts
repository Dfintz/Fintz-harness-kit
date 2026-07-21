declare module 'graphql-depth-limit' {
  import { ValidationRule } from 'graphql';

  interface DepthLimitOptions {
    ignore?: string[];
  }

  type DepthsByOperation = Record<string, number>;

  type DepthCallback = (depths: DepthsByOperation) => void;

  const depthLimit: (
    maxDepth: number,
    options?: DepthLimitOptions,
    callback?: DepthCallback
  ) => ValidationRule;

  export default depthLimit;
}
