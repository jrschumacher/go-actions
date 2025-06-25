import { ProjectValidator } from './validate-project';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock dependencies
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('ProjectValidator', () => {
  let validator: ProjectValidator;
  const testWorkingDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new ProjectValidator({ workingDirectory: testWorkingDir });
  });

  describe('validate', () => {
    it('should pass with a complete Go project', () => {
      // Mock go.mod exists
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const file = path.basename(filePath as string);
        return file === 'go.mod' || 
               file === '.release-please-config.json' ||
               file === '.release-please-manifest.json' ||
               file === '.goreleaser.yaml' ||
               file === '.golangci.yml';
      });

      // Mock Go files found
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('find') && command.includes('*.go')) {
          return 'main.go\nutils.go\n';
        }
        if (command.includes('find') && command.includes('*_test.go')) {
          return 'main_test.go\nutils_test.go\n';
        }
        if (command.includes('grep') && command.includes('func Benchmark')) {
          return 'found benchmark functions';
        }
        return '';
      });

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when go.mod is missing', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockExecSync.mockReturnValue('');

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('❌ Missing go.mod file');
    });

    it('should fail when no Go files are found', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return path.basename(filePath as string) === 'go.mod';
      });

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('find') && command.includes('*.go')) {
          return ''; // No Go files found
        }
        return '';
      });

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('❌ No Go source files found');
    });

    it('should warn when test files are missing', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return path.basename(filePath as string) === 'go.mod';
      });

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('find') && command.includes('*.go')) {
          return 'main.go\n';
        }
        if (command.includes('find') && command.includes('*_test.go')) {
          return ''; // No test files
        }
        return '';
      });

      const result = validator.validate();

      expect(result.warnings).toContain('⚠️  No test files found (recommended for test job)');
    });

    it('should warn when benchmark functions are missing', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return path.basename(filePath as string) === 'go.mod';
      });

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('find') && command.includes('*.go')) {
          return 'main.go\n';
        }
        if (command.includes('find') && command.includes('*_test.go')) {
          return 'main_test.go\n';
        }
        if (command.includes('grep') && command.includes('func Benchmark')) {
          throw new Error('No benchmark functions found');
        }
        return '';
      });

      const result = validator.validate();

      expect(result.warnings).toContain('⚠️  No benchmark functions found (required for benchmark job)');
    });

    it('should warn when Release Please files are missing', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return path.basename(filePath as string) === 'go.mod';
      });

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('find') && command.includes('*.go')) {
          return 'main.go\n';
        }
        return '';
      });

      const result = validator.validate();

      expect(result.warnings).toContain('⚠️  Missing .release-please-config.json (required for release job)');
      expect(result.warnings).toContain('⚠️  Missing .release-please-manifest.json (required for release job)');
    });

    it('should warn when GoReleaser config is missing', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const file = path.basename(filePath as string);
        return file === 'go.mod' ||
               file === '.release-please-config.json' ||
               file === '.release-please-manifest.json';
      });

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('find') && command.includes('*.go')) {
          return 'main.go\n';
        }
        return '';
      });

      const result = validator.validate();

      expect(result.warnings).toContain('⚠️  Missing .goreleaser.yaml or .goreleaser.yml (required for release job)');
    });

    it('should handle both .goreleaser.yaml and .goreleaser.yml', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const file = path.basename(filePath as string);
        return file === 'go.mod' || file === '.goreleaser.yml';
      });

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('find') && command.includes('*.go')) {
          return 'main.go\n';
        }
        return '';
      });

      const result = validator.validate();

      expect(result.warnings).not.toContain(
        expect.stringContaining('.goreleaser.yaml or .goreleaser.yml')
      );
    });

    it('should handle both .golangci.yml and .golangci.yaml', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const file = path.basename(filePath as string);
        return file === 'go.mod' || file === '.golangci.yaml';
      });

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('find') && command.includes('*.go')) {
          return 'main.go\n';
        }
        return '';
      });

      const result = validator.validate();

      expect(result.warnings).not.toContain(
        expect.stringContaining('.golangci.yml or .golangci.yaml')
      );
    });

    it('should handle command execution errors gracefully', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return path.basename(filePath as string) === 'go.mod';
      });

      mockExecSync.mockImplementation(() => {
        throw new Error('Command execution failed');
      });

      const result = validator.validate();

      // Should not crash and should handle errors appropriately
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('❌ No Go source files found');
    });

    it('should use correct working directory for file operations', () => {
      const customDir = '/custom/project';
      const customValidator = new ProjectValidator({ workingDirectory: customDir });

      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('main.go\n');

      customValidator.validate();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(customDir, 'go.mod')
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining(customDir),
        expect.any(Object)
      );
    });

    it('should exclude vendor directory from searches', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return path.basename(filePath as string) === 'go.mod';
      });

      mockExecSync.mockReturnValue('main.go\n');

      validator.validate();

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-not -path "./vendor/*"'),
        expect.any(Object)
      );
    });
  });

  describe('validateProject function export', () => {
    it('should work with default working directory', () => {
      const { validateProject } = require('./validate-project');
      
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('main.go\n');
      
      const result = validateProject();
      
      expect(result.isValid).toBe(true);
    });

    it('should work with custom working directory', () => {
      const { validateProject } = require('./validate-project');
      
      mockFs.existsSync.mockReturnValue(false);
      
      const result = validateProject('/custom/dir');
      
      expect(result.isValid).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty command output', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return path.basename(filePath as string) === 'go.mod';
      });

      mockExecSync.mockReturnValue('');

      const result = validator.validate();

      expect(result.errors).toContain('❌ No Go source files found');
    });

    it('should handle whitespace-only command output', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return path.basename(filePath as string) === 'go.mod';
      });

      mockExecSync.mockReturnValue('   \n  \n   ');

      const result = validator.validate();

      expect(result.errors).toContain('❌ No Go source files found');
    });

    it('should provide helpful guidance messages', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockExecSync.mockReturnValue('');

      const result = validator.validate();

      expect(result.warnings).toContainEqual(
        expect.stringContaining('Create with:')
      );
      expect(result.warnings).toContainEqual(
        expect.stringContaining('goreleaser init')
      );
    });
  });
});