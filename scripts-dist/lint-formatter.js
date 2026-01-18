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
exports.parseLintOutput = parseLintOutput;
exports.groupIssuesByLinter = groupIssuesByLinter;
exports.formatGroupedIssues = formatGroupedIssues;
exports.formatLintOutputForPR = formatLintOutputForPR;
exports.getWorkflowLogsUrl = getWorkflowLogsUrl;
const fs = __importStar(require("fs"));
const DEFAULT_OPTIONS = {
    maxIssuesPerLinter: 10,
    maxTotalIssues: 50,
    useCollapsible: true,
};
/**
 * Parses golangci-lint JSON output file
 *
 * @param jsonFilePath - Path to golangci-lint JSON output file
 * @returns Parsed report object or null if file doesn't exist/is invalid
 */
function parseLintOutput(jsonFilePath) {
    try {
        if (!fs.existsSync(jsonFilePath)) {
            console.log(`Lint output file not found: ${jsonFilePath}`);
            return null;
        }
        const content = fs.readFileSync(jsonFilePath, 'utf8');
        // Handle empty file
        if (!content.trim()) {
            console.log('Lint output file is empty');
            return { Issues: null };
        }
        const report = JSON.parse(content);
        return report;
    }
    catch (error) {
        console.error(`Failed to parse lint output: ${error}`);
        return null;
    }
}
/**
 * Groups lint issues by linter name
 *
 * @param issues - Array of golangci-lint issues
 * @returns Map of linter name to grouped issues
 */
function groupIssuesByLinter(issues) {
    const grouped = new Map();
    for (const issue of issues) {
        const linterName = issue.FromLinter || 'unknown';
        if (!grouped.has(linterName)) {
            grouped.set(linterName, {
                linterName,
                count: 0,
                issues: [],
            });
        }
        const group = grouped.get(linterName);
        group.count++;
        group.issues.push({
            file: issue.Pos.Filename,
            line: issue.Pos.Line,
            column: issue.Pos.Column,
            message: issue.Text,
        });
    }
    // Sort issues within each group by file, then line
    for (const group of grouped.values()) {
        group.issues.sort((a, b) => {
            if (a.file !== b.file) {
                return a.file.localeCompare(b.file);
            }
            return a.line - b.line;
        });
    }
    return grouped;
}
/**
 * Formats grouped lint issues into markdown for PR comments
 *
 * @param groupedIssues - Map of linter name to grouped issues
 * @param options - Formatting options
 * @returns Formatted markdown string
 */
function formatGroupedIssues(groupedIssues, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    if (groupedIssues.size === 0) {
        return '';
    }
    // Calculate total issues
    const totalIssues = Array.from(groupedIssues.values())
        .reduce((sum, group) => sum + group.count, 0);
    // Sort linters by issue count (descending) for better visibility
    const sortedLinters = Array.from(groupedIssues.entries())
        .sort((a, b) => b[1].count - a[1].count);
    let output = '';
    let issuesShown = 0;
    let lintersShown = 0;
    const totalLinters = sortedLinters.length;
    for (const [linterName, group] of sortedLinters) {
        // Check if we've hit the total issues limit
        if (issuesShown >= opts.maxTotalIssues) {
            const remaining = totalIssues - issuesShown;
            output += `\n*...and ${remaining} more issue${remaining === 1 ? '' : 's'} from ${totalLinters - lintersShown} linter${totalLinters - lintersShown === 1 ? '' : 's'}*\n`;
            break;
        }
        lintersShown++;
        // Format linter section
        const linterTitle = `**${linterName}** (${group.count} issue${group.count === 1 ? '' : 's'})`;
        if (opts.useCollapsible) {
            // Use collapsible section for each linter
            const isOpen = lintersShown === 1; // First linter is open by default
            output += `\n<details${isOpen ? ' open' : ''}>\n<summary>${linterTitle}</summary>\n\n`;
        }
        else {
            output += `\n${linterTitle}\n`;
        }
        // Show issues up to limit
        const issuesToShow = Math.min(group.issues.length, opts.maxIssuesPerLinter);
        const remainingSpace = opts.maxTotalIssues - issuesShown;
        const actualIssuesToShow = Math.min(issuesToShow, remainingSpace);
        for (let i = 0; i < actualIssuesToShow; i++) {
            const issue = group.issues[i];
            output += `- \`${issue.file}:${issue.line}:${issue.column}\` - ${issue.message}\n`;
            issuesShown++;
        }
        // Show truncation message if needed
        if (group.issues.length > actualIssuesToShow) {
            const remaining = group.issues.length - actualIssuesToShow;
            output += `\n*...and ${remaining} more from ${linterName}*\n`;
        }
        if (opts.useCollapsible) {
            output += '\n</details>\n';
        }
    }
    return output.trim();
}
/**
 * Main function to format lint output for PR comments
 *
 * @param jsonFilePath - Path to golangci-lint JSON output file
 * @param options - Formatting options
 * @returns Formatted markdown string ready for PR comment, or null if no issues
 */
function formatLintOutputForPR(jsonFilePath, options = {}) {
    const report = parseLintOutput(jsonFilePath);
    if (!report || !report.Issues || report.Issues.length === 0) {
        return null;
    }
    const groupedIssues = groupIssuesByLinter(report.Issues);
    const formattedOutput = formatGroupedIssues(groupedIssues, options);
    if (!formattedOutput) {
        return null;
    }
    // Build header with total count
    const totalIssues = report.Issues.length;
    let header = `### 🚨 Lint Issues Found (${totalIssues} issue${totalIssues === 1 ? '' : 's'})\n\n`;
    // Add workflow logs link if provided
    if (options.workflowLogsUrl) {
        header += `[📋 View full logs](${options.workflowLogsUrl})\n\n`;
    }
    return header + formattedOutput;
}
/**
 * Extracts GitHub Actions workflow run URL for linking to logs
 *
 * @returns Workflow run URL or undefined if not in GitHub Actions
 */
function getWorkflowLogsUrl() {
    const serverUrl = process.env.GITHUB_SERVER_URL;
    const repository = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    if (serverUrl && repository && runId) {
        return `${serverUrl}/${repository}/actions/runs/${runId}`;
    }
    return undefined;
}
//# sourceMappingURL=lint-formatter.js.map