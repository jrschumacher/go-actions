import { InputOverrides } from './config-loader';
/**
 * Input overrides specific to release workflow
 */
export interface ReleaseInputOverrides extends InputOverrides {
    /** Release strategy override */
    releaseStrategy?: 'release-please' | 'goreleaser' | 'manual';
    /** Release Please release type override */
    releasePleaseReleaseType?: string;
    /** Release Please extra files override */
    releasePleaseExtraFiles?: string[];
    /** GoReleaser args override */
    goreleaserArgs?: string;
}
/**
 * Resolved release configuration
 */
export interface ResolvedReleaseConfig {
    /** Release strategy to use */
    strategy: 'release-please' | 'goreleaser' | 'manual';
    /** Go version configuration */
    go: {
        version: string;
        versionFile: string;
    };
    /** Release Please configuration */
    releasePlease: {
        releaseType: string;
        extraFiles: string[];
    };
    /** GoReleaser configuration */
    goreleaser: {
        args: string;
    };
}
/**
 * Resolve release configuration from config file and input overrides
 * @param workingDir Working directory to search for config
 * @param overrides Input overrides from workflow
 * @returns Resolved release configuration
 */
export declare function resolveReleaseConfig(workingDir: string, overrides?: ReleaseInputOverrides): ResolvedReleaseConfig;
/**
 * Check if release should be skipped based on strategy
 * @param config Resolved release configuration
 * @returns True if release should be skipped
 */
export declare function shouldSkipRelease(config: ResolvedReleaseConfig): boolean;
/**
 * Get release strategy display name
 * @param strategy Release strategy
 * @returns Display name for the strategy
 */
export declare function getStrategyDisplayName(strategy: 'release-please' | 'goreleaser' | 'manual'): string;
