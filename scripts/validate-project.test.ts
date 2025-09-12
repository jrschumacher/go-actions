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

      // Mock valid golangci-lint config
      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  enable:\n    - gofmt\n');

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

      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  enable:\n    - gofmt\n');

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

  describe('golangci-lint configuration validation', () => {
    beforeEach(() => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const file = path.basename(filePath as string);
        return file === 'go.mod' || file === '.golangci.yml';
      });

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('find') && command.includes('*.go')) {
          return 'main.go\n';
        }
        return '';
      });
    });

    it('should pass with valid golangci-lint configuration', () => {
      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  enable:\n    - gofmt\n    - golint\n');

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when version field is missing', () => {
      mockFs.readFileSync.mockReturnValue('linters:\n  enable:\n    - gofmt\n');

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('❌ golangci-lint configuration missing required "version" field');
      expect(result.errors).toContain('   Add "version: 2" to the top of your .golangci.yml file');
      expect(result.errors).toContain('   See https://golangci-lint.run/product/migration-guide for migration instructions');
    });

    it('should fail when version is not 2', () => {
      mockFs.readFileSync.mockReturnValue('version: 1\nlinters:\n  enable:\n    - gofmt\n');

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('❌ golangci-lint configuration has unsupported version: "1"');
      expect(result.errors).toContain('   Current supported version is: 2');
      expect(result.errors).toContain('   See https://golangci-lint.run/product/migration-guide for migration instructions');
    });

    it('should accept version as string "2"', () => {
      mockFs.readFileSync.mockReturnValue('version: "2"\nlinters:\n  enable:\n    - gofmt\n');

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with invalid YAML syntax', () => {
      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  enable: [\n    - gofmt'); // Invalid YAML syntax

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('❌ golangci-lint configuration has invalid YAML syntax');
    });

    it('should fail when configuration is not a valid YAML object', () => {
      mockFs.readFileSync.mockReturnValue('just a string, not yaml object');

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('❌ golangci-lint configuration is not valid YAML object');
    });

    it('should warn about deprecated linters.enable_all', () => {
      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  enable_all: true\n');

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('⚠️  "linters.enable-all" is deprecated in v2, use "linters.preset: all" instead');
      expect(result.warnings).toContain('💡  Run "golangci-lint migrate" to automatically update your configuration');
    });

    it('should warn about deprecated linters.disable_all', () => {
      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  disable_all: true\n  enable:\n    - gofmt\n');

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('⚠️  "linters.disable-all" is deprecated in v2, use "linters.preset: none" instead');
      expect(result.warnings).toContain('💡  Run "golangci-lint migrate" to automatically update your configuration');
    });

    it('should warn about deprecated linters', () => {
      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  enable:\n    - gofmt\n    - golint\n    - maligned\n');

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('⚠️  Linter "golint" is deprecated and may not work properly');
      expect(result.warnings).toContain('⚠️  Linter "maligned" is deprecated and may not work properly');
      expect(result.warnings).toContain('💡  Run "golangci-lint migrate" to automatically update your configuration');
    });

    it('should handle file read errors gracefully', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('❌ Failed to validate golangci-lint configuration: Error: File read error');
    });

    it('should prefer .golangci.yml over .golangci.yaml', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const file = path.basename(filePath as string);
        return file === 'go.mod' || file === '.golangci.yml' || file === '.golangci.yaml';
      });

      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  enable:\n    - gofmt\n');

      validator.validate();

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(testWorkingDir, '.golangci.yml'),
        'utf8'
      );
    });

    it('should use .golangci.yaml when .golangci.yml does not exist', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        const file = path.basename(filePath as string);
        return file === 'go.mod' || file === '.golangci.yaml';
      });

      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  enable:\n    - gofmt\n');

      validator.validate();

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(testWorkingDir, '.golangci.yaml'),
        'utf8'
      );
    });

    it('should not suggest migration when no deprecated settings are used', () => {
      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  enable:\n    - gofmt\n    - staticcheck\n');

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.warnings).not.toContain(
        expect.stringContaining('golangci-lint migrate')
      );
    });

    it('should suggest migration when both deprecated settings and linters are used', () => {
      mockFs.readFileSync.mockReturnValue('version: 2\nlinters:\n  enable_all: true\n  enable:\n    - golint\n    - gofmt\n');

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('⚠️  "linters.enable-all" is deprecated in v2, use "linters.preset: all" instead');
      expect(result.warnings).toContain('⚠️  Linter "golint" is deprecated and may not work properly');
      expect(result.warnings).toContain('💡  Run "golangci-lint migrate" to automatically update your configuration');
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