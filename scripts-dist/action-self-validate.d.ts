import { ValidationResult } from './workflow-validator';
export interface SelfValidateInputs {
    workflowPaths?: string;
    commentOnPr?: boolean;
    workingDirectory?: string;
}
/**
 * Validates go-actions configuration and handles all results
 * Consolidates all self-validation logic in one place for better testing and maintenance
 */
export declare function runSelfValidation(inputs: SelfValidateInputs): Promise<ValidationResult>;
export default function (): Promise<ValidationResult>;
