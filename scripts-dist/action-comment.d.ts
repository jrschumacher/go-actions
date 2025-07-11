/**
 * Posts unified CI results comment to pull requests
 * Consolidates all comment logic in one place for better testing and maintenance
 */
export declare function postUnifiedComment(githubToken?: string): Promise<void>;
export default function (): Promise<void>;
