"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const self_validate_1 = require("./self-validate");
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const workflow_validator_1 = require("./workflow-validator");
// Mock dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('./workflow-validator');
const mockCore = core;
const mockGithub = github;
const mockValidateWorkflows = workflow_validator_1.validateWorkflows;
const mockWorkflowValidator = workflow_validator_1.WorkflowValidator;
describe('SelfValidator', () => {
    let validator;
    const testWorkingDir = '/test/project';
    beforeEach(() => {
        jest.clearAllMocks();
        validator = new self_validate_1.SelfValidator({ workingDirectory: testWorkingDir });
        // Setup GitHub context mock
        Object.defineProperty(github, 'context', {
            value: {
                eventName: 'pull_request',
                repo: { owner: 'test-owner', repo: 'test-repo' },
                issue: { number: 123 }
            },
            writable: true
        });
    });
    describe('validate', () => {
        it('should validate successfully when no errors', async () => {
            const mockResult = {
                isValid: true,
                actionsFound: ['ci', 'release'],
                errors: []
            };
            mockValidateWorkflows.mockReturnValue(mockResult);
            const result = await validator.validate();
            expect(mockValidateWorkflows).toHaveBeenCalledWith(testWorkingDir);
            expect(mockCore.setOutput).toHaveBeenCalledWith('actions_found', 'ci,release');
            expect(mockCore.setOutput).toHaveBeenCalledWith('validation_failed', 'false');
            expect(result).toBe(mockResult);
        });
        it('should handle validation failures', async () => {
            const mockResult = {
                isValid: false,
                actionsFound: ['ci'],
                errors: [
                    { message: 'Missing go.mod file', type: 'missing_file', file: 'go.mod' }
                ]
            };
            mockValidateWorkflows.mockReturnValue(mockResult);
            const result = await validator.validate();
            expect(mockCore.setOutput).toHaveBeenCalledWith('validation_failed', 'true');
            expect(mockCore.setOutput).toHaveBeenCalledWith('error_messages', '- Missing go.mod file');
            expect(mockCore.setFailed).toHaveBeenCalledWith('Validation failed with 1 error(s)');
            expect(result).toBe(mockResult);
        });
        it('should handle multiple validation errors', async () => {
            const mockResult = {
                isValid: false,
                actionsFound: ['release'],
                errors: [
                    { message: 'Missing config file', type: 'missing_file', file: '.release-please-config.json' },
                    { message: 'Missing manifest file', type: 'missing_file', file: '.release-please-manifest.json' }
                ]
            };
            mockValidateWorkflows.mockReturnValue(mockResult);
            await validator.validate();
            expect(mockCore.setOutput).toHaveBeenCalledWith('error_messages', '- Missing config file\n- Missing manifest file');
            expect(mockCore.setFailed).toHaveBeenCalledWith('Validation failed with 2 error(s)');
        });
    });
    describe('constructor options', () => {
        it('should use default options', () => {
            const defaultValidator = new self_validate_1.SelfValidator();
            // Access private properties through validate method behavior
            mockValidateWorkflows.mockReturnValue({
                isValid: true,
                actionsFound: [],
                errors: []
            });
            defaultValidator.validate();
            expect(mockValidateWorkflows).toHaveBeenCalledWith('.');
        });
        it('should use custom options', () => {
            const customValidator = new self_validate_1.SelfValidator({
                workingDirectory: '/custom/dir',
                workflowPaths: 'custom/path/*.yaml',
            });
            mockValidateWorkflows.mockReturnValue({
                isValid: true,
                actionsFound: [],
                errors: []
            });
            customValidator.validate();
            expect(mockValidateWorkflows).toHaveBeenCalledWith('/custom/dir');
        });
    });
});
describe('exported functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('selfValidate', () => {
        it('should work with default options', async () => {
            mockValidateWorkflows.mockReturnValue({
                isValid: true,
                actionsFound: [],
                errors: []
            });
            const result = await (0, self_validate_1.selfValidate)();
            expect(mockValidateWorkflows).toHaveBeenCalledWith('.');
            expect(result.isValid).toBe(true);
        });
        it('should work with custom options', async () => {
            mockValidateWorkflows.mockReturnValue({
                isValid: false,
                actionsFound: ['ci'],
                errors: [{ message: 'Error', type: 'missing_file', file: 'test' }]
            });
            const result = await (0, self_validate_1.selfValidate)({ workingDirectory: '/custom' });
            expect(mockValidateWorkflows).toHaveBeenCalledWith('/custom');
            expect(result.isValid).toBe(false);
        });
    });
});
//# sourceMappingURL=self-validate.test.js.map