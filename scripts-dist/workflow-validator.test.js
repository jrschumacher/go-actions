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
const workflow_validator_1 = require("./workflow-validator");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Mock fs
jest.mock('fs');
const mockFs = fs;
describe('WorkflowValidator', () => {
    let validator;
    const testWorkingDir = '/test/project';
    beforeEach(() => {
        jest.clearAllMocks();
        validator = new workflow_validator_1.WorkflowValidator(testWorkingDir);
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                if (filePath.includes('go.mod')) {
                    return true;
                }
                return false;
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml']);
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                return false; // go.mod missing
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml']);
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                const file = path.basename(filePath);
                return file === '.release-please-config.json' ||
                    file === '.release-please-manifest.json' ||
                    file === '.goreleaser.yaml';
            });
            mockFs.readdirSync.mockReturnValue(['release.yaml']);
            mockFs.readFileSync.mockReturnValue(workflowContent);
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                return false; // All release files missing
            });
            mockFs.readdirSync.mockReturnValue(['release.yaml']);
            mockFs.readFileSync.mockReturnValue(workflowContent);
            const result = validator.validate();
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(3);
            expect(result.errors.map(e => e.file)).toContain('.release-please-config.json');
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                const file = path.basename(filePath);
                return file === '.release-please-config.json' ||
                    file === '.release-please-manifest.json' ||
                    file === '.goreleaser.yml'; // Note: .yml not .yaml
            });
            mockFs.readdirSync.mockReturnValue(['release.yaml']);
            mockFs.readFileSync.mockReturnValue(workflowContent);
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
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('.github/workflows');
            });
            mockFs.readdirSync.mockReturnValue(['validator.yaml']);
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                const file = path.basename(filePath);
                return file === 'go.mod' || file === '.golangci.yml';
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml']);
            mockFs.readFileSync.mockImplementation((filePath) => {
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                const file = path.basename(filePath);
                return file === 'go.mod' || file === '.golangci.yml';
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml']);
            mockFs.readFileSync.mockImplementation((filePath) => {
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                const file = path.basename(filePath);
                return file === 'go.mod' || file === '.golangci.yml';
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml']);
            mockFs.readFileSync.mockImplementation((filePath) => {
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                const file = path.basename(filePath);
                return file === 'go.mod' || file === '.golangci.yml';
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml']);
            mockFs.readFileSync.mockImplementation((filePath) => {
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                const file = path.basename(filePath);
                return file === 'go.mod' ||
                    file === '.release-please-config.json' ||
                    file === '.release-please-manifest.json' ||
                    file === '.goreleaser.yaml';
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml', 'release.yml']);
            mockFs.readFileSync.mockImplementation((filePath) => {
                if (filePath.includes('ci.yaml')) {
                    return ciContent;
                }
                if (filePath.includes('release.yml')) {
                    return releaseContent;
                }
                return '';
            });
            const result = validator.validate();
            expect(result.isValid).toBe(true);
            expect(result.actionsFound).toContain('ci');
            expect(result.actionsFound).toContain('release');
        });
        it('should handle both .yml and .yaml workflow extensions', () => {
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('.github/workflows');
            });
            mockFs.readdirSync.mockReturnValue(['test.yml', 'deploy.yaml', 'README.md']);
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
            expect(comment).toContain('## 🔍 Go Actions Validation');
            expect(comment).toContain('✅ **All validations passed!**');
            expect(comment).toContain('ci, release');
        });
        it('should format failure comment with missing files', () => {
            const result = {
                isValid: false,
                actionsFound: ['release'],
                errors: [
                    {
                        type: 'missing_file',
                        message: '.release-please-config.json (required for release action)',
                        file: '.release-please-config.json'
                    },
                    {
                        type: 'missing_file',
                        message: '.goreleaser.yaml (required for release action)',
                        file: '.goreleaser.yaml'
                    }
                ]
            };
            const comment = validator.formatPRComment(result);
            expect(comment).toContain('❌ **Validation Failed**');
            expect(comment).toContain('.release-please-config.json');
            expect(comment).toContain('.goreleaser.yaml');
            expect(comment).toContain('### 📝 Required Configuration Examples');
            expect(comment).toContain('```json');
            expect(comment).toContain('goreleaser init');
        });
        it('should format version mismatch comment', () => {
            const result = {
                isValid: false,
                actionsFound: ['ci'],
                errors: [
                    {
                        type: 'version_mismatch',
                        message: '.golangci.yml has version v1 but workflow expects v2',
                        file: '.golangci.yml',
                        expected: 'v2',
                        actual: 'v1'
                    }
                ]
            };
            const comment = validator.formatPRComment(result);
            expect(comment).toContain('### ⚠️ Version Mismatch');
            expect(comment).toContain('golangci-lint configuration file version');
            expect(comment).toContain('```yaml\nversion: v2\n```');
        });
        it('should include all relevant file examples', () => {
            const result = {
                isValid: false,
                actionsFound: ['release'],
                errors: [
                    {
                        type: 'missing_file',
                        message: '.release-please-config.json (required)',
                        file: '.release-please-config.json'
                    },
                    {
                        type: 'missing_file',
                        message: '.release-please-manifest.json (required)',
                        file: '.release-please-manifest.json'
                    },
                    {
                        type: 'missing_file',
                        message: '.goreleaser.yaml (required)',
                        file: '.goreleaser.yaml'
                    }
                ]
            };
            const comment = validator.formatPRComment(result);
            expect(comment).toContain('**`.release-please-config.json`:**');
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
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('.github/workflows');
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml']);
            mockFs.readFileSync.mockImplementation(() => {
                throw new Error('File read error');
            });
            expect(() => validator.validate()).toThrow('File read error');
        });
        it('should handle empty workflow files', () => {
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('.github/workflows');
            });
            mockFs.readdirSync.mockReturnValue(['empty.yaml']);
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                const file = path.basename(filePath);
                return file === 'go.mod' || file === '.golangci.yml';
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml']);
            mockFs.readFileSync.mockImplementation((filePath) => {
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                const file = path.basename(filePath);
                return file === 'go.mod';
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml']);
            mockFs.readFileSync.mockImplementation((filePath) => {
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
            mockFs.existsSync.mockImplementation((filePath) => {
                if (filePath.includes('.github/workflows')) {
                    return true;
                }
                return false;
            });
            mockFs.readdirSync.mockReturnValue(['ci.yaml']);
            mockFs.readFileSync.mockImplementation((filePath) => {
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
//# sourceMappingURL=workflow-validator.test.js.map