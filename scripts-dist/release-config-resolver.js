"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveReleaseConfig = resolveReleaseConfig;
exports.shouldSkipRelease = shouldSkipRelease;
exports.getStrategyDisplayName = getStrategyDisplayName;
const config_loader_1 = require("./config-loader");
/**
 * Default resolved release configuration
 */
const DEFAULT_RESOLVED_CONFIG = {
    strategy: 'release-please',
    go: {
        version: '',
        versionFile: 'go.mod',
    },
    releasePlease: {
        releaseType: 'go',
        extraFiles: [],
    },
    goreleaser: {
        args: 'release --clean',
    },
};
/**
 * Resolve release configuration from config file and input overrides
 * @param workingDir Working directory to search for config
 * @param overrides Input overrides from workflow
 * @returns Resolved release configuration
 */
function resolveReleaseConfig(workingDir, overrides = {}) {
    const loader = new config_loader_1.ConfigLoader();
    // Build input overrides for config loader
    const configOverrides = {
        goVersion: overrides.goVersion,
        goVersionFile: overrides.goVersionFile,
    };
    // Load config with Go version overrides
    const config = loader.loadConfig(workingDir, configOverrides);
    // Start with defaults (deep clone to avoid mutation)
    const resolved = {
        strategy: DEFAULT_RESOLVED_CONFIG.strategy,
        go: {
            version: DEFAULT_RESOLVED_CONFIG.go.version,
            versionFile: DEFAULT_RESOLVED_CONFIG.go.versionFile,
        },
        releasePlease: {
            releaseType: DEFAULT_RESOLVED_CONFIG.releasePlease.releaseType,
            extraFiles: [...DEFAULT_RESOLVED_CONFIG.releasePlease.extraFiles],
        },
        goreleaser: {
            args: DEFAULT_RESOLVED_CONFIG.goreleaser.args,
        },
    };
    // Apply config file values
    if (config.release) {
        // Strategy
        if (config.release.strategy) {
            resolved.strategy = config.release.strategy;
        }
        // Release Please settings
        if (config.release['release-please']) {
            if (config.release['release-please']['release-type']) {
                resolved.releasePlease.releaseType = config.release['release-please']['release-type'];
            }
            if (config.release['release-please']['extra-files']) {
                resolved.releasePlease.extraFiles = config.release['release-please']['extra-files'];
            }
        }
        // GoReleaser settings
        if (config.release.goreleaser) {
            if (config.release.goreleaser.args) {
                resolved.goreleaser.args = config.release.goreleaser.args;
            }
        }
    }
    // Apply Go version from config
    if (config.ci?.go) {
        if (config.ci.go.version) {
            resolved.go.version = config.ci.go.version;
        }
        if (config.ci.go['version-file']) {
            resolved.go.versionFile = config.ci.go['version-file'];
        }
    }
    // Apply input overrides (highest priority)
    if (overrides.releaseStrategy !== undefined) {
        resolved.strategy = overrides.releaseStrategy;
    }
    if (overrides.releasePleaseReleaseType !== undefined) {
        resolved.releasePlease.releaseType = overrides.releasePleaseReleaseType;
    }
    if (overrides.releasePleaseExtraFiles !== undefined) {
        resolved.releasePlease.extraFiles = overrides.releasePleaseExtraFiles;
    }
    if (overrides.goreleaserArgs !== undefined) {
        resolved.goreleaser.args = overrides.goreleaserArgs;
    }
    return resolved;
}
/**
 * Check if release should be skipped based on strategy
 * @param config Resolved release configuration
 * @returns True if release should be skipped
 */
function shouldSkipRelease(config) {
    return config.strategy === 'manual';
}
/**
 * Get release strategy display name
 * @param strategy Release strategy
 * @returns Display name for the strategy
 */
function getStrategyDisplayName(strategy) {
    switch (strategy) {
        case 'release-please':
            return 'Release Please';
        case 'goreleaser':
            return 'GoReleaser';
        case 'manual':
            return 'Manual';
        default:
            return 'Unknown';
    }
}
//# sourceMappingURL=release-config-resolver.js.map