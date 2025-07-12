import { ReleaseAction, validateReleaseConfiguration, validateReleaseInputs } from './release-action';
import { validateRelease } from './validate-release';
import * as core from '@actions/core';

// Mock dependencies
jest.mock('./validate-release');
jest.mock('@actions/core');

const mockValidateRelease = validateRelease as jest.MockedFunction<typeof validateRelease>;
const mockCore = core as jest.Mocked<typeof core>;

describe('ReleaseAction', () => {
  let action: ReleaseAction;
  const testWorkingDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    action = new ReleaseAction({ workingDirectory: testWorkingDir });
  });

  describe('validateConfiguration', () => {
    it('should pass validation when all files exist', () => {
      mockValidateRelease.mockReturnValue({
        isValid: true,
        missingFiles: []
      });

      const result = action.validateConfiguration();

      expect(mockValidateRelease).toHaveBeenCalledWith(testWorkingDir);
      expect(result.isValid).toBe(true);
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should fail validation when files are missing', () => {
      mockValidateRelease.mockReturnValue({
        isValid: false,
        missingFiles: ['release-please-config.json', '.release-please-manifest.json']
      });

      expect(() => action.validateConfiguration()).toThrow(
        'Missing required Release Please configuration files: release-please-config.json, .release-please-manifest.json'
      );

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'Missing required Release Please configuration files: release-please-config.json, .release-please-manifest.json'
      );
    });

    it('should fail validation for single missing file', () => {
      mockValidateRelease.mockReturnValue({
        isValid: false,
        missingFiles: ['release-please-config.json']
      });

      expect(() => action.validateConfiguration()).toThrow(
        'Missing required Release Please configuration files: release-please-config.json'
      );
    });

    it('should log helpful setup instructions on failure', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockValidateRelease.mockReturnValue({
        isValid: false,
        missingFiles: ['release-please-config.json']
      });

      expect(() => action.validateConfiguration()).toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('Create release-please-config.json (Release Please v16+ format):');
      expect(consoleSpy).toHaveBeenCalledWith('Create .release-please-manifest.json:');
      
      // Check that JSON examples were logged
      const calls = consoleSpy.mock.calls;
      const configCall = calls.find(call => 
        typeof call[0] === 'string' && call[0].includes('release-type')
      );
      const manifestCall = calls.find(call => 
        typeof call[0] === 'string' && call[0].includes('0.1.0')
      );

      expect(configCall).toBeDefined();
      expect(manifestCall).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe('getInputs', () => {
    it('should get all inputs with defaults', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'go-version': return '';
          case 'go-version-file': return '';
          case 'working-directory': return '';
          case 'release-token': return 'test-token';
          default: return '';
        }
      });

      const inputs = action.getInputs();

      expect(inputs).toEqual({
        goVersion: '',
        goVersionFile: 'go.mod',
        workingDirectory: '.',
        releaseToken: 'test-token'
      });
    });

    it('should get custom inputs', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'go-version': return '1.21';
          case 'go-version-file': return 'custom.mod';
          case 'working-directory': return '/custom/dir';
          case 'release-token': return 'custom-token';
          default: return '';
        }
      });

      const inputs = action.getInputs();

      expect(inputs).toEqual({
        goVersion: '1.21',
        goVersionFile: 'custom.mod',
        workingDirectory: '/custom/dir',
        releaseToken: 'custom-token'
      });
    });
  });

  describe('validateInputs', () => {
    it('should validate inputs successfully', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockCore.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'go-version': return '1.21';
          case 'go-version-file': return 'go.mod';
          case 'working-directory': return '.';
          case 'release-token': return 'test-token';
          default: return '';
        }
      });

      const inputs = action.validateInputs();

      expect(inputs.releaseToken).toBe('test-token');
      expect(mockCore.setFailed).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Inputs validated:');
      expect(consoleSpy).toHaveBeenCalledWith('- Go version: 1.21');
      expect(consoleSpy).toHaveBeenCalledWith('- Release token: [REDACTED]');

      consoleSpy.mockRestore();
    });

    it('should fail when release-token is missing', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'release-token': return '';
          default: return 'default-value';
        }
      });

      expect(() => action.validateInputs()).toThrow(
        'release-token is required. Please provide a Personal Access Token (PAT) as a secret.'
      );

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'release-token is required. Please provide a Personal Access Token (PAT) as a secret.'
      );
    });

    it('should show go-version-file when go-version is empty', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockCore.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'go-version': return '';
          case 'go-version-file': return 'custom.mod';
          case 'release-token': return 'test-token';
          default: return '.';
        }
      });

      action.validateInputs();

      expect(consoleSpy).toHaveBeenCalledWith('- Go version: from custom.mod');

      consoleSpy.mockRestore();
    });
  });

  describe('setOutputs', () => {
    it('should set outputs without release tag', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      action.setOutputs(false);

      expect(mockCore.setOutput).toHaveBeenCalledWith('release_created', 'false');
      expect(mockCore.setOutput).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('Set outputs: release_created=false, release_tag=N/A');

      consoleSpy.mockRestore();
    });

    it('should set outputs with release tag', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      action.setOutputs(true, 'v1.2.3');

      expect(mockCore.setOutput).toHaveBeenCalledWith('release_created', 'true');
      expect(mockCore.setOutput).toHaveBeenCalledWith('release_tag', 'v1.2.3');
      expect(consoleSpy).toHaveBeenCalledWith('Set outputs: release_created=true, release_tag=v1.2.3');

      consoleSpy.mockRestore();
    });
  });

  describe('constructor', () => {
    it('should use default working directory', () => {
      const defaultAction = new ReleaseAction();
      
      mockValidateRelease.mockReturnValue({
        isValid: true,
        missingFiles: []
      });

      defaultAction.validateConfiguration();

      expect(mockValidateRelease).toHaveBeenCalledWith('.');
    });

    it('should use custom working directory', () => {
      const customAction = new ReleaseAction({ workingDirectory: '/custom' });
      
      mockValidateRelease.mockReturnValue({
        isValid: true,
        missingFiles: []
      });

      customAction.validateConfiguration();

      expect(mockValidateRelease).toHaveBeenCalledWith('/custom');
    });
  });
});

describe('exported functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateReleaseConfiguration', () => {
    it('should work with default directory', () => {
      mockValidateRelease.mockReturnValue({
        isValid: true,
        missingFiles: []
      });

      const result = validateReleaseConfiguration();

      expect(mockValidateRelease).toHaveBeenCalledWith('.');
      expect(result.isValid).toBe(true);
    });

    it('should work with custom directory', () => {
      mockValidateRelease.mockReturnValue({
        isValid: false,
        missingFiles: ['.release-please-config.json']
      });

      expect(() => validateReleaseConfiguration('/custom')).toThrow();
      expect(mockValidateRelease).toHaveBeenCalledWith('/custom');
    });
  });

  describe('validateReleaseInputs', () => {
    it('should validate inputs', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        return name === 'release-token' ? 'test-token' : '';
      });

      const inputs = validateReleaseInputs();

      expect(inputs.releaseToken).toBe('test-token');
    });

    it('should fail with missing token', () => {
      mockCore.getInput.mockReturnValue('');

      expect(() => validateReleaseInputs()).toThrow(
        'release-token is required'
      );
    });
  });
});