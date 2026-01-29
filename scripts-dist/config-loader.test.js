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
const config_loader_1 = require("./config-loader");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Mock fs module
jest.mock('fs');
const mockFs = fs;
describe('ConfigLoader', () => {
    let loader;
    const testWorkingDir = '/test/project';
    beforeEach(() => {
        jest.clearAllMocks();
        loader = new config_loader_1.ConfigLoader();
    });
    describe('config file discovery', () => {
        it('should find .go-actions.yaml first', () => {
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            const configPath = loader.getConfigFilePath(testWorkingDir);
            expect(configPath).toBe(path.join(testWorkingDir, '.go-actions.yaml'));
        });
        it('should find .go-actions.yml if .yaml does not exist', () => {
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yml');
            });
            const configPath = loader.getConfigFilePath(testWorkingDir);
            expect(configPath).toBe(path.join(testWorkingDir, '.go-actions.yml'));
        });
        it('should find go-actions.yaml as last option', () => {
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, 'go-actions.yaml');
            });
            const configPath = loader.getConfigFilePath(testWorkingDir);
            expect(configPath).toBe(path.join(testWorkingDir, 'go-actions.yaml'));
        });
        it('should return undefined if no config file exists', () => {
            mockFs.existsSync.mockReturnValue(false);
            const configPath = loader.getConfigFilePath(testWorkingDir);
            expect(configPath).toBeUndefined();
        });
        it('should check hasConfigFile correctly', () => {
            mockFs.existsSync.mockReturnValue(false);
            expect(loader.hasConfigFile(testWorkingDir)).toBe(false);
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            expect(loader.hasConfigFile(testWorkingDir)).toBe(true);
        });
    });
    describe('valid config parsing', () => {
        it('should parse minimal valid config', () => {
            const configContent = 'version: 1\n';
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const config = loader.loadConfig(testWorkingDir);
            expect(config.version).toBe(1);
            expect(config.ci).toBeDefined();
            expect(config.release).toBeDefined();
            expect(config.output).toBeDefined();
        });
        it('should parse complete valid config', () => {
            const configContent = `
version: 1
ci:
  go:
    version: "1.21"
    version-file: "go.mod"
  test:
    enabled: true
    args: "-v -race"
    coverage:
      enabled: true
      threshold: 80
  lint:
    enabled: true
    version: "v2.0.2"
    args: "--timeout=5m"
  benchmark:
    enabled: true
    args: "-bench=."
    count: 10
  security:
    enabled: true
    version: "latest"
    args: "./..."
    fail-on: "high"
release:
  strategy: "release-please"
  release-please:
    release-type: "go"
    extra-files:
      - "VERSION"
  goreleaser:
    args: "--clean"
local:
  hooks:
    pre-commit:
      - "go fmt"
      - "go vet"
    pre-push:
      - "go test ./..."
  agent:
    enabled: true
    auto-fix: false
output:
  format: "json"
  verbosity: "verbose"
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const config = loader.loadConfig(testWorkingDir);
            expect(config.version).toBe(1);
            expect(config.ci?.go?.version).toBe('1.21');
            expect(config.ci?.test?.coverage?.threshold).toBe(80);
            expect(config.ci?.lint?.version).toBe('v2.0.2');
            expect(config.ci?.benchmark?.enabled).toBe(true);
            expect(config.ci?.security?.['fail-on']).toBe('high');
            expect(config.release?.strategy).toBe('release-please');
            expect(config.release?.['release-please']?.['release-type']).toBe('go');
            expect(config.local?.hooks?.['pre-commit']).toEqual(['go fmt', 'go vet']);
            expect(config.local?.agent?.enabled).toBe(true);
            expect(config.output?.format).toBe('json');
            expect(config.output?.verbosity).toBe('verbose');
        });
        it('should parse config with partial sections', () => {
            const configContent = `
version: 1
ci:
  test:
    enabled: false
  lint:
    version: "v1.55.0"
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const config = loader.loadConfig(testWorkingDir);
            expect(config.version).toBe(1);
            expect(config.ci?.test?.enabled).toBe(false);
            expect(config.ci?.lint?.version).toBe('v1.55.0');
            // Defaults should still be present for other fields
            expect(config.ci?.go?.['version-file']).toBe('go.mod');
            expect(config.ci?.benchmark?.enabled).toBe(false);
        });
    });
    describe('invalid config rejection', () => {
        it('should reject config without version field', () => {
            const configContent = `
ci:
  test:
    enabled: true
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(config_loader_1.ConfigLoaderError);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(/validation failed/);
        });
        it('should reject config with wrong version', () => {
            const configContent = 'version: 2\n';
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(config_loader_1.ConfigLoaderError);
        });
        it('should reject config with invalid coverage threshold', () => {
            const configContent = `
version: 1
ci:
  test:
    coverage:
      threshold: 150
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(config_loader_1.ConfigLoaderError);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(/validation failed/);
        });
        it('should reject config with invalid fail-on value', () => {
            const configContent = `
version: 1
ci:
  security:
    fail-on: "super-critical"
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(config_loader_1.ConfigLoaderError);
        });
        it('should reject config with invalid release strategy', () => {
            const configContent = `
version: 1
release:
  strategy: "custom-strategy"
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(config_loader_1.ConfigLoaderError);
        });
        it('should reject config with invalid output format', () => {
            const configContent = `
version: 1
output:
  format: "xml"
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(config_loader_1.ConfigLoaderError);
        });
        it('should reject config with invalid YAML syntax', () => {
            const configContent = `
version: 1
ci:
  test:
    enabled: true
    invalid: [unclosed array
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(config_loader_1.ConfigLoaderError);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(/Failed to parse/);
        });
        it('should include file path in error', () => {
            const configContent = 'invalid yaml: [';
            const configPath = path.join(testWorkingDir, '.go-actions.yaml');
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === configPath;
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            try {
                loader.loadConfig(testWorkingDir);
                fail('Expected ConfigLoaderError to be thrown');
            }
            catch (error) {
                expect(error).toBeInstanceOf(config_loader_1.ConfigLoaderError);
                if (error instanceof config_loader_1.ConfigLoaderError) {
                    expect(error.filePath).toBe(configPath);
                }
            }
        });
    });
    describe('default value application', () => {
        it('should apply all default values when no config file exists', () => {
            mockFs.existsSync.mockReturnValue(false);
            const config = loader.loadConfig(testWorkingDir);
            expect(config.version).toBe(1);
            expect(config.ci?.go?.['version-file']).toBe('go.mod');
            expect(config.ci?.test?.enabled).toBe(true);
            expect(config.ci?.test?.args).toBe('-v -race -coverprofile=coverage.out ./...');
            expect(config.ci?.test?.coverage?.enabled).toBe(true);
            expect(config.ci?.test?.coverage?.threshold).toBe(0);
            expect(config.ci?.lint?.enabled).toBe(true);
            expect(config.ci?.lint?.version).toBe('v2.0.2');
            expect(config.ci?.benchmark?.enabled).toBe(false);
            expect(config.ci?.benchmark?.count).toBe(5);
            expect(config.ci?.security?.enabled).toBe(true);
            expect(config.ci?.security?.version).toBe('latest');
            expect(config.ci?.security?.['fail-on']).toBe('high');
            expect(config.release?.strategy).toBe('release-please');
            expect(config.output?.format).toBe('auto');
            expect(config.output?.verbosity).toBe('normal');
        });
        it('should merge config file with defaults', () => {
            const configContent = `
version: 1
ci:
  test:
    coverage:
      threshold: 90
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const config = loader.loadConfig(testWorkingDir);
            expect(config.ci?.test?.coverage?.threshold).toBe(90);
            // Other defaults should still be present
            expect(config.ci?.test?.enabled).toBe(true);
            expect(config.ci?.test?.args).toBe('-v -race -coverprofile=coverage.out ./...');
            expect(config.ci?.lint?.version).toBe('v2.0.2');
        });
    });
    describe('merge precedence', () => {
        it('should apply precedence: defaults < config < inputs', () => {
            const configContent = `
version: 1
ci:
  go:
    version: "1.20"
  test:
    args: "-v"
  lint:
    version: "v1.55.0"
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const overrides = {
                goVersion: '1.21',
                lintVersion: 'v2.0.0',
            };
            const config = loader.loadConfig(testWorkingDir, overrides);
            // Input overrides should win
            expect(config.ci?.go?.version).toBe('1.21');
            expect(config.ci?.lint?.version).toBe('v2.0.0');
            // Config file should override defaults
            expect(config.ci?.test?.args).toBe('-v');
            // Defaults should be present where not overridden
            expect(config.ci?.go?.['version-file']).toBe('go.mod');
        });
        it('should apply all input overrides', () => {
            mockFs.existsSync.mockReturnValue(false);
            const overrides = {
                goVersion: '1.21',
                goVersionFile: 'custom.mod',
                testArgs: '-v -short',
                lintVersion: 'v2.1.0',
                lintArgs: '--timeout=10m',
                benchmarkArgs: '-bench=Benchmark',
                benchmarkCount: 10,
                securityVersion: 'v1.0.0',
                securityArgs: '-json',
                securityFailOn: 'critical',
            };
            const config = loader.loadConfig(testWorkingDir, overrides);
            expect(config.ci?.go?.version).toBe('1.21');
            expect(config.ci?.go?.['version-file']).toBe('custom.mod');
            expect(config.ci?.test?.args).toBe('-v -short');
            expect(config.ci?.lint?.version).toBe('v2.1.0');
            expect(config.ci?.lint?.args).toBe('--timeout=10m');
            expect(config.ci?.benchmark?.args).toBe('-bench=Benchmark');
            expect(config.ci?.benchmark?.count).toBe(10);
            expect(config.ci?.security?.version).toBe('v1.0.0');
            expect(config.ci?.security?.args).toBe('-json');
            expect(config.ci?.security?.['fail-on']).toBe('critical');
        });
        it('should override config file values with inputs', () => {
            const configContent = `
version: 1
ci:
  test:
    args: "-v"
  lint:
    version: "v1.55.0"
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const overrides = {
                testArgs: '-v -race',
                lintVersion: 'v2.0.0',
            };
            const config = loader.loadConfig(testWorkingDir, overrides);
            expect(config.ci?.test?.args).toBe('-v -race');
            expect(config.ci?.lint?.version).toBe('v2.0.0');
        });
    });
    describe('missing config file handling', () => {
        it('should return defaults when config file does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            const config = loader.loadConfig(testWorkingDir);
            expect(config.version).toBe(1);
            expect(config.ci?.test?.enabled).toBe(true);
            expect(config.ci?.lint?.version).toBe('v2.0.2');
        });
        it('should not throw when config file is missing', () => {
            mockFs.existsSync.mockReturnValue(false);
            expect(() => loader.loadConfig(testWorkingDir)).not.toThrow();
        });
    });
    describe('unknown fields handling', () => {
        it('should warn about unknown top-level fields', () => {
            const configContent = `
version: 1
unknown-field: "value"
another-unknown: 123
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const config = loader.loadConfig(testWorkingDir);
            expect(config).toBeDefined();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown-field'));
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('another-unknown'));
            warnSpy.mockRestore();
        });
        it('should not fail on unknown fields (forward compatibility)', () => {
            const configContent = `
version: 1
future-feature: "something new"
ci:
  test:
    enabled: true
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            expect(() => loader.loadConfig(testWorkingDir)).not.toThrow();
            warnSpy.mockRestore();
        });
    });
    describe('edge cases', () => {
        it('should handle empty config file', () => {
            const configContent = '';
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            // Empty file should fail validation (no version)
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(config_loader_1.ConfigLoaderError);
        });
        it('should handle config with only comments', () => {
            const configContent = `
# This is a comment
# version: 1
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            // Comments-only file should fail validation
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(config_loader_1.ConfigLoaderError);
        });
        it('should handle config with zero values correctly', () => {
            const configContent = `
version: 1
ci:
  test:
    coverage:
      threshold: 0
  benchmark:
    count: 1
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const config = loader.loadConfig(testWorkingDir);
            expect(config.ci?.test?.coverage?.threshold).toBe(0);
            expect(config.ci?.benchmark?.count).toBe(1);
        });
        it('should handle config with empty strings', () => {
            const configContent = `
version: 1
ci:
  go:
    version: ""
  test:
    args: ""
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const config = loader.loadConfig(testWorkingDir);
            expect(config.ci?.go?.version).toBe('');
            expect(config.ci?.test?.args).toBe('');
        });
        it('should handle deep nesting correctly', () => {
            const configContent = `
version: 1
local:
  hooks:
    pre-commit:
      - "command1"
      - "command2"
  agent:
    enabled: true
`;
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const config = loader.loadConfig(testWorkingDir);
            expect(config.local?.hooks?.['pre-commit']).toEqual(['command1', 'command2']);
            expect(config.local?.agent?.enabled).toBe(true);
        });
    });
    describe('convenience function', () => {
        it('should work with loadConfig convenience function', () => {
            mockFs.existsSync.mockReturnValue(false);
            const config = (0, config_loader_1.loadConfig)(testWorkingDir);
            expect(config.version).toBe(1);
            expect(config.ci?.test?.enabled).toBe(true);
        });
        it('should accept overrides in convenience function', () => {
            mockFs.existsSync.mockReturnValue(false);
            const config = (0, config_loader_1.loadConfig)(testWorkingDir, { goVersion: '1.21' });
            expect(config.ci?.go?.version).toBe('1.21');
        });
    });
    describe('ConfigLoaderError', () => {
        it('should include validation errors in ConfigLoaderError', () => {
            const configContent = 'version: 2\n';
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            try {
                loader.loadConfig(testWorkingDir);
                fail('Expected ConfigLoaderError to be thrown');
            }
            catch (error) {
                expect(error).toBeInstanceOf(config_loader_1.ConfigLoaderError);
                if (error instanceof config_loader_1.ConfigLoaderError) {
                    expect(error.name).toBe('ConfigLoaderError');
                    expect(error.message).toContain('validation failed');
                    expect(error.validationErrors).toBeDefined();
                    expect(error.filePath).toBeDefined();
                }
            }
        });
    });
    describe('edge cases for input overrides', () => {
        it('should handle overrides when config sections do not exist', () => {
            // Create a minimal config without CI sections
            const configContent = 'version: 1\n';
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            mockFs.readFileSync.mockReturnValue(configContent);
            const overrides = {
                goVersion: '1.21',
                testArgs: '-v',
                lintVersion: 'v2.0.0',
                benchmarkCount: 10,
                securityVersion: 'latest',
            };
            // This should not throw even though we're applying overrides to minimal config
            const config = loader.loadConfig(testWorkingDir, overrides);
            expect(config.ci?.go?.version).toBe('1.21');
            expect(config.ci?.test?.args).toBe('-v');
            expect(config.ci?.lint?.version).toBe('v2.0.0');
            expect(config.ci?.benchmark?.count).toBe(10);
            expect(config.ci?.security?.version).toBe('latest');
        });
        it('should handle file read error that is not an Error instance', () => {
            mockFs.existsSync.mockImplementation((filePath) => {
                return filePath === path.join(testWorkingDir, '.go-actions.yaml');
            });
            // Simulate throwing a non-Error object (edge case)
            mockFs.readFileSync.mockImplementation(() => {
                throw 'string error'; // eslint-disable-line no-throw-literal
            });
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(config_loader_1.ConfigLoaderError);
            expect(() => loader.loadConfig(testWorkingDir)).toThrow(/Failed to parse config file/);
        });
    });
});
//# sourceMappingURL=config-loader.test.js.map