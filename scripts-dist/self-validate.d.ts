import { ValidationResult } from './workflow-validator';
export interface SelfValidateOptions {
    workingDirectory?: string;
    workflowPaths?: string;
}
export declare class SelfValidator {
    private workingDirectory;
    private workflowPaths;
    constructor(options?: SelfValidateOptions);
    validate(): Promise<ValidationResult>;
}
export declare function selfValidate(options?: SelfValidateOptions): Promise<ValidationResult>;
