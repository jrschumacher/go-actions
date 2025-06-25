import { SelfValidator, selfValidate } from './self-validate';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { validateWorkflows, WorkflowValidator } from './workflow-validator';

// Mock dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('./workflow-validator');

const mockCore = core as jest.Mocked<typeof core>;
const mockGithub = github as jest.Mocked<typeof github>;
const mockValidateWorkflows = validateWorkflows as jest.MockedFunction<typeof validateWorkflows>;
const mockWorkflowValidator = WorkflowValidator as jest.MockedClass<typeof WorkflowValidator>;

describe('SelfValidator', () => {
  let validator: SelfValidator;
  const testWorkingDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new SelfValidator({ workingDirectory: testWorkingDir });
    
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
          { message: 'Missing go.mod file', type: 'missing_file' as const, file: 'go.mod' }
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
          { message: 'Missing config file', type: 'missing_file' as const, file: '.release-please-config.json' },
          { message: 'Missing manifest file', type: 'missing_file' as const, file: '.release-please-manifest.json' }
        ]
      };
      mockValidateWorkflows.mockReturnValue(mockResult);

      await validator.validate();

      expect(mockCore.setOutput).toHaveBeenCalledWith(
        'error_messages', 
        '- Missing config file\n- Missing manifest file'
      );
      expect(mockCore.setFailed).toHaveBeenCalledWith('Validation failed with 2 error(s)');
    });
  });


  describe('constructor options', () => {
    it('should use default options', () => {
      const defaultValidator = new SelfValidator();
      
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
      const customValidator = new SelfValidator({
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

      const result = await selfValidate();

      expect(mockValidateWorkflows).toHaveBeenCalledWith('.');
      expect(result.isValid).toBe(true);
    });

    it('should work with custom options', async () => {
      mockValidateWorkflows.mockReturnValue({
        isValid: false,
        actionsFound: ['ci'],
        errors: [{ message: 'Error', type: 'missing_file', file: 'test' }]
      });

      const result = await selfValidate({ workingDirectory: '/custom' });

      expect(mockValidateWorkflows).toHaveBeenCalledWith('/custom');
      expect(result.isValid).toBe(false);
    });
  });

});