import { WorkflowValidator, validateWorkflows } from './workflow-validator';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('WorkflowValidator', () => {
  let validator: WorkflowValidator;
  const testWorkingDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new WorkflowValidator(testWorkingDir);
  });

  describe('validate', () => {
    it('should return valid result when no workflow files exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = validator.validate();

      expect(result).toEqual({
        isValid: true,
        actionsFound: [],
        errors: []
      });
    });

    it('should detect CI action usage and validate requirements', () => {
      const workflowContent = `
name: CI
jobs:
  test:
    steps:
      - uses: jrschumacher/go-actions/ci@main
        with:
          job: test
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        if (filePath.includes('go.mod')) {
          return true;
        }
        return false;
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml'] as any);
      mockFs.readFileSync.mockReturnValue(workflowContent);

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.actionsFound).toContain('ci');
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when CI action is used but go.mod is missing', () => {
      const workflowContent = `
name: CI
jobs:
  test:
    steps:
      - uses: jrschumacher/go-actions/ci@main
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        return false; // go.mod missing
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml'] as any);
      mockFs.readFileSync.mockReturnValue(workflowContent);

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        type: 'missing_file',
        message: 'go.mod (required for CI actions)',
        file: 'go.mod'
      });
    });

    it('should detect release action usage and validate requirements', () => {
      const workflowContent = `
name: Release
jobs:
  release:
    steps:
      - uses: jrschumacher/go-actions/release@main
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        const file = path.basename(filePath as string);
        return file === 'release-please-config.json' ||
               file === '.release-please-manifest.json' ||
               file === '.goreleaser.yaml';
      });

      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return workflowContent;
        }
        const file = path.basename(filePath as string);
        if (file === 'release-please-config.json') {
          return JSON.stringify({ "release-type": "go", "package-name": "test-package", "packages": { ".": {} } });
        }
        if (file === '.goreleaser.yaml') {
          return 'builds:\n  - env:\n      - CGO_ENABLED=0\n    goos:\n      - linux\n      - windows\n      - darwin';
        }
        return '{}';
      });

      mockFs.readdirSync.mockReturnValue(['release.yaml'] as any);

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.actionsFound).toContain('release');
    });

    it('should fail when release action is used but required files are missing', () => {
      const workflowContent = `
name: Release
jobs:
  release:
    steps:
      - uses: jrschumacher/go-actions/release@main
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        return false; // All release files missing
      });

      mockFs.readdirSync.mockReturnValue(['release.yaml'] as any);
      mockFs.readFileSync.mockReturnValue(workflowContent);

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.map(e => e.file)).toContain('release-please-config.json');
      expect(result.errors.map(e => e.file)).toContain('.release-please-manifest.json');
      expect(result.errors.map(e => e.file)).toContain('.goreleaser.yaml');
    });

    it('should handle .goreleaser.yml as alternative to .goreleaser.yaml', () => {
      const workflowContent = `
name: Release
jobs:
  release:
    steps:
      - uses: jrschumacher/go-actions/release@main
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        const file = path.basename(filePath as string);
        return file === 'release-please-config.json' ||
               file === '.release-please-manifest.json' ||
               file === '.goreleaser.yml'; // Note: .yml not .yaml
      });

      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return workflowContent;
        }
        const file = path.basename(filePath as string);
        if (file === 'release-please-config.json') {
          return JSON.stringify({ "release-type": "go", "package-name": "test-package", "packages": { ".": {} } });
        }
        if (file === '.goreleaser.yml') {
          return 'builds:\n  - env:\n      - CGO_ENABLED=0\n    goos:\n      - linux\n      - windows\n      - darwin';
        }
        return '{}';
      });

      mockFs.readdirSync.mockReturnValue(['release.yaml'] as any);

      const result = validator.validate();

      expect(result.isValid).toBe(true);
    });

    it('should detect self-validate action usage', () => {
      const workflowContent = `
name: Validator
jobs:
  validate:
    steps:
      - uses: jrschumacher/go-actions/self-validate@main
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath.includes('.github/workflows');
      });

      mockFs.readdirSync.mockReturnValue(['validator.yaml'] as any);
      mockFs.readFileSync.mockReturnValue(workflowContent);

      const result = validator.validate();

      expect(result.actionsFound).toContain('self-validate');
    });

    it('should validate golangci-lint version compatibility', () => {
      const workflowContent = `
name: CI
jobs:
  lint:
    steps:
      - uses: jrschumacher/go-actions/ci@main
        with:
          job: lint
          golangci-lint-version: v1
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        const file = path.basename(filePath as string);
        return file === 'go.mod' || file === '.golangci.yml';
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml'] as any);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('ci.yaml')) {
          return workflowContent;
        }
        if (filePath.includes('.golangci.yml')) {
          return 'version: v2'; // Version mismatch
        }
        return '';
      });

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      
      // First error should be incompatible version
      expect(result.errors[0].type).toBe('incompatible_versions');
      expect(result.errors[0].expected).toBe('v2.x.x');
      expect(result.errors[0].actual).toBe('v1');
      
      // Second error should be version mismatch
      expect(result.errors[1].type).toBe('version_mismatch');
      expect(result.errors[1].expected).toBe('v1');
      expect(result.errors[1].actual).toBe('v2');
    });

    it('should default to v2 when golangci-lint-version is not specified', () => {
      const workflowContent = `
name: CI
jobs:
  lint:
    steps:
      - uses: jrschumacher/go-actions/ci@main
        with:
          job: lint
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        const file = path.basename(filePath as string);
        return file === 'go.mod' || file === '.golangci.yml';
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml'] as any);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('ci.yaml')) {
          return workflowContent;
        }
        if (filePath.includes('.golangci.yml')) {
          return 'version: v1'; // Should fail against default v2
        }
        return '';
      });

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].expected).toBe('v2');
    });

    it('should treat "latest" as v2', () => {
      const workflowContent = `
name: CI
jobs:
  lint:
    steps:
      - uses: jrschumacher/go-actions/ci@main
        with:
          job: lint
          golangci-lint-version: latest
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        const file = path.basename(filePath as string);
        return file === 'go.mod' || file === '.golangci.yml';
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml'] as any);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('ci.yaml')) {
          return workflowContent;
        }
        if (filePath.includes('.golangci.yml')) {
          return 'version: v2'; // Should match
        }
        return '';
      });

      const result = validator.validate();

      expect(result.isValid).toBe(true);
    });

    it('should handle version numbers without v prefix', () => {
      const workflowContent = `
name: CI
jobs:
  lint:
    steps:
      - uses: jrschumacher/go-actions/ci@main
        with:
          job: lint
          golangci-lint-version: 2.1.0
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        const file = path.basename(filePath as string);
        return file === 'go.mod' || file === '.golangci.yml';
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml'] as any);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('ci.yaml')) {
          return workflowContent;
        }
        if (filePath.includes('.golangci.yml')) {
          return 'version: v2'; // Compatible version
        }
        return '';
      });

      const result = validator.validate();

      expect(result.isValid).toBe(true);
    });

    it('should handle multiple workflow files', () => {
      const ciContent = 'uses: jrschumacher/go-actions/ci@main';
      const releaseContent = 'uses: jrschumacher/go-actions/release@main';

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        const file = path.basename(filePath as string);
        return file === 'go.mod' ||
               file === 'release-please-config.json' ||
               file === '.release-please-manifest.json' ||
               file === '.goreleaser.yaml';
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml', 'release.yml'] as any);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('ci.yaml')) {
          return ciContent;
        }
        if (filePath.includes('release.yml')) {
          return releaseContent;
        }
        const file = path.basename(filePath as string);
        if (file === 'release-please-config.json') {
          return JSON.stringify({ "release-type": "go", "package-name": "test-package", "packages": { ".": {} } });
        }
        if (file === '.goreleaser.yaml') {
          return 'builds:\n  - env:\n      - CGO_ENABLED=0\n    goos:\n      - linux\n      - windows\n      - darwin';
        }
        return '';
      });

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.actionsFound).toContain('ci');
      expect(result.actionsFound).toContain('release');
    });

    it('should handle both .yml and .yaml workflow extensions', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath.includes('.github/workflows');
      });

      mockFs.readdirSync.mockReturnValue(['test.yml', 'deploy.yaml', 'README.md'] as any);
      mockFs.readFileSync.mockReturnValue('uses: jrschumacher/go-actions/ci@main');

      const result = validator.validate();

      // Should only process .yml and .yaml files, not .md
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('formatPRComment', () => {
    it('should format successful validation comment', () => {
      const result = {
        isValid: true,
        actionsFound: ['ci', 'release'],
        errors: []
      };

      const comment = validator.formatPRComment(result);

      expect(comment).toContain('# Go Actions Report');
      expect(comment).toContain('✅ **Validated**');
      expect(comment).toContain('ci, release');
    });

    it('should format failure comment with missing files', () => {
      const result = {
        isValid: false,
        actionsFound: ['release'],
        errors: [
          {
            type: 'missing_file' as const,
            message: 'release-please-config.json (required for release action)',
            file: 'release-please-config.json'
          },
          {
            type: 'missing_file' as const,
            message: '.goreleaser.yaml (required for release action)',
            file: '.goreleaser.yaml'
          }
        ]
      };

      const comment = validator.formatPRComment(result);

      expect(comment).toContain('❌ **Validation Failed**');
      expect(comment).toContain('release-please-config.json');
      expect(comment).toContain('.goreleaser.yaml');
      expect(comment).toContain('### 📝 Configuration Templates');
      expect(comment).toContain('```json');
      expect(comment).toContain('goreleaser init');
    });

    it('should format version mismatch comment', () => {
      const result = {
        isValid: false,
        actionsFound: ['ci'],
        errors: [
          {
            type: 'version_mismatch' as const,
            message: '.golangci.yml has version v1 but workflow expects v2',
            file: '.golangci.yml',
            expected: 'v2',
            actual: 'v1'
          }
        ]
      };

      const comment = validator.formatPRComment(result);

      expect(comment).toContain('**Version Mismatch**');
      expect(comment).toContain('Configuration file version mismatch');
      expect(comment).toContain('Update version to v2');
    });

    it('should include all relevant file examples', () => {
      const result = {
        isValid: false,
        actionsFound: ['release'],
        errors: [
          {
            type: 'missing_file' as const,
            message: 'release-please-config.json (required)',
            file: 'release-please-config.json'
          },
          {
            type: 'missing_file' as const,
            message: '.release-please-manifest.json (required)',
            file: '.release-please-manifest.json'
          },
          {
            type: 'missing_file' as const,
            message: '.goreleaser.yaml (required)',
            file: '.goreleaser.yaml'
          }
        ]
      };

      const comment = validator.formatPRComment(result);

      expect(comment).toContain('**`release-please-config.json`:**');
      expect(comment).toContain('**`.release-please-manifest.json`:**');
      expect(comment).toContain('**`.goreleaser.yaml`:**');
      expect(comment).toContain('release-type');
      expect(comment).toContain('0.1.0');
    });
  });

  describe('validateWorkflows function export', () => {
    it('should work with default working directory', () => {
      const { validateWorkflows } = require('./workflow-validator');
      
      mockFs.existsSync.mockReturnValue(false);
      
      const result = validateWorkflows();
      
      expect(result.isValid).toBe(true);
      expect(result.actionsFound).toEqual([]);
    });

    it('should work with custom working directory', () => {
      const { validateWorkflows } = require('./workflow-validator');
      
      mockFs.existsSync.mockReturnValue(false);
      
      const result = validateWorkflows('/custom/dir');
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle file read errors gracefully', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath.includes('.github/workflows');
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml'] as any);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      expect(() => validator.validate()).toThrow('File read error');
    });

    it('should handle empty workflow files', () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath.includes('.github/workflows');
      });

      mockFs.readdirSync.mockReturnValue(['empty.yaml'] as any);
      mockFs.readFileSync.mockReturnValue('');

      const result = validator.validate();

      expect(result.isValid).toBe(true);
      expect(result.actionsFound).toEqual([]);
    });

    it('should handle malformed version strings', () => {
      const workflowContent = `
name: CI
jobs:
  lint:
    steps:
      - uses: jrschumacher/go-actions/ci@main
        with:
          golangci-lint-version: "not-a-version"
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        const file = path.basename(filePath as string);
        return file === 'go.mod' || file === '.golangci.yml';
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml'] as any);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('ci.yaml')) {
          return workflowContent;
        }
        if (filePath.includes('.golangci.yml')) {
          return 'version: also-not-a-version';
        }
        return '';
      });

      const result = validator.validate();

      // Should handle gracefully, not crash
      expect(result.isValid).toBe(true); // No version extraction = no comparison
    });

    it('should detect incompatible golangci-lint versions with go-actions/ci', () => {
      const workflowContent = `
name: CI
jobs:
  lint:
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: lint
          golangci-lint-version: v1.62.2
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        const file = path.basename(filePath as string);
        return file === 'go.mod';
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml'] as any);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('ci.yaml')) {
          return workflowContent;
        }
        return '';
      });

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('incompatible_versions');
      expect(result.errors[0].message).toContain('go-actions/ci uses golangci-lint-action@v8 internally');
      expect(result.errors[0].actual).toBe('v1.62.2');
      expect(result.errors[0].expected).toBe('v2.x.x');
    });

    it('should detect incompatible direct golangci-lint-action usage', () => {
      const workflowContent = `
name: CI
jobs:
  lint:
    steps:
      - uses: golangci/golangci-lint-action@v8
        with:
          version: v1.62.2
      `;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.github/workflows')) {
          return true;
        }
        return false;
      });

      mockFs.readdirSync.mockReturnValue(['ci.yaml'] as any);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('ci.yaml')) {
          return workflowContent;
        }
        return '';
      });

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('incompatible_versions');
      expect(result.errors[0].message).toContain('golangci-lint-action@v8 requires golangci-lint v2+');
      expect(result.errors[0].actual).toBe('v1.62.2');
      expect(result.errors[0].expected).toBe('v2.x.x');
    });
  });

});