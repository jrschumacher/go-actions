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
const release_config_resolver_1 = require("./release-config-resolver");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Mock fs module
jest.mock('fs');
const mockFs = fs;
describe('release-config-resolver', () => {
    const testWorkingDir = '/test/project';
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('resolveReleaseConfig', () => {
        describe('with no config file', () => {
            beforeEach(() => {
                mockFs.existsSync.mockReturnValue(false);
            });
            it('should return default config when no config file exists', () => {
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.strategy).toBe('release-please');
                expect(config.go.version).toBe('');
                expect(config.go.versionFile).toBe('go.mod');
                expect(config.releasePlease.releaseType).toBe('go');
                expect(config.releasePlease.extraFiles).toEqual([]);
                expect(config.goreleaser.args).toBe('release --clean');
            });
            it('should apply input overrides when no config file exists', () => {
                const overrides = {
                    goVersion: '1.22',
                    goVersionFile: 'go.work',
                    releaseStrategy: 'goreleaser',
                    releasePleaseReleaseType: 'simple',
                    releasePleaseExtraFiles: ['VERSION', 'README.md'],
                    goreleaserArgs: 'release --snapshot',
                };
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir, overrides);
                expect(config.strategy).toBe('goreleaser');
                expect(config.go.version).toBe('1.22');
                expect(config.go.versionFile).toBe('go.work');
                expect(config.releasePlease.releaseType).toBe('simple');
                expect(config.releasePlease.extraFiles).toEqual(['VERSION', 'README.md']);
                expect(config.goreleaser.args).toBe('release --snapshot');
            });
        });
        describe('with minimal config file', () => {
            beforeEach(() => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue('version: 1\n');
            });
            it('should use defaults when config has no release section', () => {
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.strategy).toBe('release-please');
                expect(config.go.version).toBe('');
                expect(config.go.versionFile).toBe('go.mod');
                expect(config.releasePlease.releaseType).toBe('go');
                expect(config.releasePlease.extraFiles).toEqual([]);
                expect(config.goreleaser.args).toBe('release --clean');
            });
        });
        describe('with release strategy config', () => {
            it('should read release-please strategy from config', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  strategy: release-please
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.strategy).toBe('release-please');
            });
            it('should read goreleaser strategy from config', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  strategy: goreleaser
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.strategy).toBe('goreleaser');
            });
            it('should read manual strategy from config', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  strategy: manual
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.strategy).toBe('manual');
            });
            it('should allow input override of strategy', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  strategy: release-please
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir, {
                    releaseStrategy: 'manual',
                });
                expect(config.strategy).toBe('manual');
            });
        });
        describe('with release-please config', () => {
            it('should read release-type from config', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  release-please:
    release-type: simple
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.releasePlease.releaseType).toBe('simple');
            });
            it('should read extra-files from config', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  release-please:
    extra-files:
      - VERSION
      - README.md
      - package.json
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.releasePlease.extraFiles).toEqual([
                    'VERSION',
                    'README.md',
                    'package.json',
                ]);
            });
            it('should read complete release-please config', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  strategy: release-please
  release-please:
    release-type: node
    extra-files:
      - VERSION
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.strategy).toBe('release-please');
                expect(config.releasePlease.releaseType).toBe('node');
                expect(config.releasePlease.extraFiles).toEqual(['VERSION']);
            });
            it('should allow input override of release-type', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  release-please:
    release-type: go
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir, {
                    releasePleaseReleaseType: 'simple',
                });
                expect(config.releasePlease.releaseType).toBe('simple');
            });
            it('should allow input override of extra-files', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  release-please:
    extra-files:
      - VERSION
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir, {
                    releasePleaseExtraFiles: ['CHANGELOG.md'],
                });
                expect(config.releasePlease.extraFiles).toEqual(['CHANGELOG.md']);
            });
        });
        describe('with goreleaser config', () => {
            it('should read goreleaser args from config', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  goreleaser:
    args: release --snapshot --clean
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.goreleaser.args).toBe('release --snapshot --clean');
            });
            it('should allow input override of goreleaser args', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
release:
  goreleaser:
    args: release --clean
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir, {
                    goreleaserArgs: 'build --snapshot',
                });
                expect(config.goreleaser.args).toBe('build --snapshot');
            });
        });
        describe('with go version config', () => {
            it('should read go version from ci.go config', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  go:
    version: "1.21"
    version-file: "go.work"
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.go.version).toBe('1.21');
                expect(config.go.versionFile).toBe('go.work');
            });
            it('should allow input override of go version', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  go:
    version: "1.21"
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir, {
                    goVersion: '1.22',
                });
                expect(config.go.version).toBe('1.22');
            });
            it('should allow input override of go version-file', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  go:
    version-file: "go.mod"
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir, {
                    goVersionFile: 'go.work',
                });
                expect(config.go.versionFile).toBe('go.work');
            });
        });
        describe('with complete config', () => {
            it('should merge all config sections correctly', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  go:
    version: "1.21"
    version-file: "go.work"
release:
  strategy: release-please
  release-please:
    release-type: simple
    extra-files:
      - VERSION
      - README.md
  goreleaser:
    args: release --snapshot
`);
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir);
                expect(config.strategy).toBe('release-please');
                expect(config.go.version).toBe('1.21');
                expect(config.go.versionFile).toBe('go.work');
                expect(config.releasePlease.releaseType).toBe('simple');
                expect(config.releasePlease.extraFiles).toEqual(['VERSION', 'README.md']);
                expect(config.goreleaser.args).toBe('release --snapshot');
            });
            it('should prioritize input overrides over config file', () => {
                mockFs.existsSync.mockImplementation((filePath) => {
                    return filePath === path.join(testWorkingDir, '.go-actions.yaml');
                });
                mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  go:
    version: "1.21"
release:
  strategy: release-please
  release-please:
    release-type: go
  goreleaser:
    args: release --clean
`);
                const overrides = {
                    goVersion: '1.22',
                    releaseStrategy: 'manual',
                    releasePleaseReleaseType: 'simple',
                    goreleaserArgs: 'build',
                };
                const config = (0, release_config_resolver_1.resolveReleaseConfig)(testWorkingDir, overrides);
                expect(config.strategy).toBe('manual');
                expect(config.go.version).toBe('1.22');
                expect(config.releasePlease.releaseType).toBe('simple');
                expect(config.goreleaser.args).toBe('build');
            });
        });
    });
    describe('shouldSkipRelease', () => {
        it('should return true for manual strategy', () => {
            const config = {
                strategy: 'manual',
                go: { version: '', versionFile: 'go.mod' },
                releasePlease: { releaseType: 'go', extraFiles: [] },
                goreleaser: { args: 'release --clean' },
            };
            expect((0, release_config_resolver_1.shouldSkipRelease)(config)).toBe(true);
        });
        it('should return false for release-please strategy', () => {
            const config = {
                strategy: 'release-please',
                go: { version: '', versionFile: 'go.mod' },
                releasePlease: { releaseType: 'go', extraFiles: [] },
                goreleaser: { args: 'release --clean' },
            };
            expect((0, release_config_resolver_1.shouldSkipRelease)(config)).toBe(false);
        });
        it('should return false for goreleaser strategy', () => {
            const config = {
                strategy: 'goreleaser',
                go: { version: '', versionFile: 'go.mod' },
                releasePlease: { releaseType: 'go', extraFiles: [] },
                goreleaser: { args: 'release --clean' },
            };
            expect((0, release_config_resolver_1.shouldSkipRelease)(config)).toBe(false);
        });
    });
    describe('getStrategyDisplayName', () => {
        it('should return display name for release-please', () => {
            expect((0, release_config_resolver_1.getStrategyDisplayName)('release-please')).toBe('Release Please');
        });
        it('should return display name for goreleaser', () => {
            expect((0, release_config_resolver_1.getStrategyDisplayName)('goreleaser')).toBe('GoReleaser');
        });
        it('should return display name for manual', () => {
            expect((0, release_config_resolver_1.getStrategyDisplayName)('manual')).toBe('Manual');
        });
    });
});
//# sourceMappingURL=release-config-resolver.test.js.map