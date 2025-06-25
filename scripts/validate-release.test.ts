import { ReleaseValidator } from './validate-release';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ReleaseValidator', () => {
  let validator: ReleaseValidator;
  const testWorkingDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new ReleaseValidator({ workingDirectory: testWorkingDir });
  });

  describe('validate', () => {
    it('should pass when all required files exist', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const file = path.basename(filePath as string);
        return file === '.release-please-config.json' || 
               file === '.release-please-manifest.json';
      });

      const result = validator.validate();

      expect(result).toEqual({
        isValid: true,
        missingFiles: []
      });

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(testWorkingDir, '.release-please-config.json')
      );
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(testWorkingDir, '.release-please-manifest.json')
      );
    });

    it('should fail when release-please-config.json is missing', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const file = path.basename(filePath as string);
        return file === '.release-please-manifest.json';
      });

      const result = validator.validate();

      expect(result).toEqual({
        isValid: false,
        missingFiles: ['.release-please-config.json']
      });
    });

    it('should fail when release-please-manifest.json is missing', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const file = path.basename(filePath as string);
        return file === '.release-please-config.json';
      });

      const result = validator.validate();

      expect(result).toEqual({
        isValid: false,
        missingFiles: ['.release-please-manifest.json']
      });
    });

    it('should fail when both files are missing', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = validator.validate();

      expect(result).toEqual({
        isValid: false,
        missingFiles: ['.release-please-config.json', '.release-please-manifest.json']
      });
    });

    it('should use correct working directory', () => {
      const customDir = '/custom/project';
      const customValidator = new ReleaseValidator({ workingDirectory: customDir });
      
      mockFs.existsSync.mockReturnValue(true);

      customValidator.validate();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(customDir, '.release-please-config.json')
      );
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(customDir, '.release-please-manifest.json')
      );
    });

    it('should log appropriate messages for missing files', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockFs.existsSync.mockReturnValue(false);

      validator.validate();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing required Release Please configuration files')
      );
      expect(consoleSpy).toHaveBeenCalledWith('');
      expect(consoleSpy).toHaveBeenCalledWith('Create .release-please-config.json:');
      expect(consoleSpy).toHaveBeenCalledWith('Create .release-please-manifest.json:');

      consoleSpy.mockRestore();
    });

    it('should provide correct JSON examples', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockFs.existsSync.mockReturnValue(false);

      validator.validate();

      // Check that JSON.stringify was called with correct objects
      const calls = consoleSpy.mock.calls;
      const configCall = calls.find(call => 
        call[0] && typeof call[0] === 'string' && call[0].includes('packages')
      );
      const manifestCall = calls.find(call => 
        call[0] && typeof call[0] === 'string' && call[0].includes('0.1.0')
      );

      expect(configCall).toBeDefined();
      expect(manifestCall).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe('validateRelease function export', () => {
    it('should work with default working directory', () => {
      const { validateRelease } = require('./validate-release');
      
      mockFs.existsSync.mockReturnValue(true);
      
      const result = validateRelease();
      
      expect(result.isValid).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join('.', '.release-please-config.json')
      );
    });

    it('should work with custom working directory', () => {
      const { validateRelease } = require('./validate-release');
      
      mockFs.existsSync.mockReturnValue(false);
      
      const result = validateRelease('/custom/dir');
      
      expect(result.isValid).toBe(false);
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join('/custom/dir', '.release-please-config.json')
      );
    });
  });

  describe('edge cases', () => {
    it('should handle file system errors gracefully', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      expect(() => validator.validate()).toThrow('File system error');
    });

    it('should handle relative paths correctly', () => {
      const relativeValidator = new ReleaseValidator({ workingDirectory: '../project' });
      mockFs.existsSync.mockReturnValue(true);

      relativeValidator.validate();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join('../project', '.release-please-config.json')
      );
    });

    it('should handle empty working directory', () => {
      const emptyValidator = new ReleaseValidator({ workingDirectory: '' });
      mockFs.existsSync.mockReturnValue(true);

      emptyValidator.validate();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join('', '.release-please-config.json')
      );
    });
  });
});