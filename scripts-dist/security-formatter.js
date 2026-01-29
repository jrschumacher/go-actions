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
exports.parseGovulncheckJson = parseGovulncheckJson;
exports.parseGovulncheckText = parseGovulncheckText;
exports.formatSecurityOutputForPR = formatSecurityOutputForPR;
exports.getWorkflowLogsUrl = getWorkflowLogsUrl;
const fs = __importStar(require("fs"));
/**
 * Parse govulncheck JSON output (newline-delimited JSON messages)
 */
function parseGovulncheckJson(jsonContent) {
    const vulnerabilities = [];
    const osvMap = new Map();
    const findingsMap = new Map();
    // Parse newline-delimited JSON
    const lines = jsonContent.split('\n').filter(line => line.trim());
    for (const line of lines) {
        try {
            const message = JSON.parse(line);
            if (message.osv) {
                osvMap.set(message.osv.id, message.osv);
            }
            if (message.finding) {
                const existing = findingsMap.get(message.finding.osv) || [];
                existing.push(message.finding);
                findingsMap.set(message.finding.osv, existing);
            }
        }
        catch {
            // Skip malformed JSON lines
            continue;
        }
    }
    // Combine OSV info with findings
    for (const [osvId, findings] of findingsMap) {
        const osv = osvMap.get(osvId);
        if (!osv)
            continue;
        // Get the first finding for module info
        const firstFinding = findings[0];
        if (!firstFinding || !firstFinding.trace || firstFinding.trace.length === 0)
            continue;
        const moduleInfo = firstFinding.trace[0];
        // Extract severity (CVSS score if available)
        let severity;
        if (osv.severity && osv.severity.length > 0) {
            const cvss = osv.severity.find(s => s.type === 'CVSS_V3');
            if (cvss) {
                severity = cvss.score;
            }
        }
        // Get reference URL (prefer Go vulnerability database)
        let referenceUrl;
        if (osv.references) {
            const goRef = osv.references.find(r => r.url.includes('pkg.go.dev/vuln'));
            referenceUrl = goRef?.url || osv.references[0]?.url;
        }
        if (!referenceUrl && osvId.startsWith('GO-')) {
            referenceUrl = `https://pkg.go.dev/vuln/${osvId}`;
        }
        // Build callstack summary from trace
        let callstackSummary;
        const callers = firstFinding.trace
            .filter(t => t.function)
            .map(t => {
            if (t.position) {
                return `${t.package}.${t.function} (${t.position.filename}:${t.position.line})`;
            }
            return `${t.package}.${t.function}`;
        });
        if (callers.length > 0) {
            callstackSummary = callers.slice(0, 3).join(' → ');
            if (callers.length > 3) {
                callstackSummary += ` ... (${callers.length - 3} more)`;
            }
        }
        vulnerabilities.push({
            id: osvId,
            aliases: osv.aliases || [],
            summary: osv.summary,
            severity,
            module: moduleInfo.module,
            foundVersion: moduleInfo.version,
            fixedVersion: firstFinding.fixed_version,
            referenceUrl,
            callstackSummary,
        });
    }
    // Sort by severity (higher CVSS first), then by ID
    return vulnerabilities.sort((a, b) => {
        const scoreA = a.severity ? parseFloat(a.severity) : 0;
        const scoreB = b.severity ? parseFloat(b.severity) : 0;
        if (scoreB !== scoreA)
            return scoreB - scoreA;
        return a.id.localeCompare(b.id);
    });
}
/**
 * Parse govulncheck text output as fallback
 */
function parseGovulncheckText(textContent) {
    const vulnerabilities = [];
    // Pattern to match vulnerability blocks in text output
    // Format: Vulnerability #N: GO-YYYY-NNNN
    const vulnPattern = /Vulnerability #\d+: (GO-\d{4}-\d+)\s+([^\n]+)\n/g;
    const modulePattern = /Found in:\s+([^\s]+)@([^\s]+)/;
    const fixedPattern = /Fixed in:\s+([^\s]+)@([^\s]+)/;
    let match;
    while ((match = vulnPattern.exec(textContent)) !== null) {
        const id = match[1];
        const summary = match[2].trim();
        // Extract the section for this vulnerability
        const startIdx = match.index;
        const nextMatch = vulnPattern.exec(textContent);
        const endIdx = nextMatch ? nextMatch.index : textContent.length;
        vulnPattern.lastIndex = match.index + match[0].length; // Reset for next iteration
        const section = textContent.substring(startIdx, endIdx);
        // Parse module info
        const moduleMatch = section.match(modulePattern);
        const fixedMatch = section.match(fixedPattern);
        vulnerabilities.push({
            id,
            aliases: [],
            summary,
            module: moduleMatch ? moduleMatch[1] : 'unknown',
            foundVersion: moduleMatch ? moduleMatch[2] : 'unknown',
            fixedVersion: fixedMatch ? `${fixedMatch[1]}@${fixedMatch[2]}` : undefined,
            referenceUrl: `https://pkg.go.dev/vuln/${id}`,
        });
    }
    return vulnerabilities;
}
/**
 * Format a single vulnerability as markdown
 */
function formatVulnerability(vuln, index) {
    const lines = [];
    // Header with ID and severity
    let header = `#### ${index + 1}. ${vuln.id}`;
    if (vuln.severity) {
        const score = parseFloat(vuln.severity);
        const level = score >= 9.0 ? 'CRITICAL' : score >= 7.0 ? 'HIGH' : score >= 4.0 ? 'MEDIUM' : 'LOW';
        header += ` (${level}: ${vuln.severity})`;
    }
    lines.push(header);
    lines.push('');
    // Summary
    lines.push(`**${vuln.summary}**`);
    lines.push('');
    // Module info
    lines.push(`- **Module:** \`${vuln.module}@${vuln.foundVersion}\``);
    if (vuln.fixedVersion) {
        lines.push(`- **Fixed in:** \`${vuln.fixedVersion}\``);
    }
    // Aliases (CVEs)
    if (vuln.aliases.length > 0) {
        lines.push(`- **CVE:** ${vuln.aliases.join(', ')}`);
    }
    // Reference link
    if (vuln.referenceUrl) {
        lines.push(`- **Details:** [${vuln.id}](${vuln.referenceUrl})`);
    }
    // Callstack if available
    if (vuln.callstackSummary) {
        lines.push('');
        lines.push('<details><summary>Call stack</summary>');
        lines.push('');
        lines.push('```');
        lines.push(vuln.callstackSummary);
        lines.push('```');
        lines.push('</details>');
    }
    return lines.join('\n');
}
/**
 * Format govulncheck output for PR comment
 */
function formatSecurityOutputForPR(jsonFilePath, textFilePath, options = {}) {
    const maxVulnerabilities = options.maxVulnerabilities || 20;
    let vulnerabilities = [];
    // Try JSON first
    try {
        if (fs.existsSync(jsonFilePath)) {
            const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
            if (jsonContent.trim()) {
                vulnerabilities = parseGovulncheckJson(jsonContent);
            }
        }
    }
    catch {
        // JSON parsing failed, will fall back to text
    }
    // Fall back to text output if JSON didn't work
    if (vulnerabilities.length === 0) {
        try {
            if (fs.existsSync(textFilePath)) {
                const textContent = fs.readFileSync(textFilePath, 'utf8');
                if (textContent.trim()) {
                    vulnerabilities = parseGovulncheckText(textContent);
                }
            }
        }
        catch {
            return null;
        }
    }
    if (vulnerabilities.length === 0) {
        return null;
    }
    // Format markdown output
    const lines = [];
    // Summary
    lines.push(`Found **${vulnerabilities.length}** known vulnerabilit${vulnerabilities.length === 1 ? 'y' : 'ies'} in dependencies.`);
    lines.push('');
    // Group by severity if available
    const critical = vulnerabilities.filter(v => v.severity && parseFloat(v.severity) >= 9.0);
    const high = vulnerabilities.filter(v => v.severity && parseFloat(v.severity) >= 7.0 && parseFloat(v.severity) < 9.0);
    const other = vulnerabilities.filter(v => !v.severity || parseFloat(v.severity) < 7.0);
    if (critical.length > 0 || high.length > 0) {
        lines.push('| Severity | Count |');
        lines.push('|----------|-------|');
        if (critical.length > 0)
            lines.push(`| 🔴 Critical | ${critical.length} |`);
        if (high.length > 0)
            lines.push(`| 🟠 High | ${high.length} |`);
        if (other.length > 0)
            lines.push(`| 🟡 Other | ${other.length} |`);
        lines.push('');
    }
    // Show vulnerabilities (up to limit)
    const displayVulns = vulnerabilities.slice(0, maxVulnerabilities);
    for (let i = 0; i < displayVulns.length; i++) {
        lines.push(formatVulnerability(displayVulns[i], i));
        lines.push('');
        lines.push('---');
        lines.push('');
    }
    // Truncation notice
    if (vulnerabilities.length > maxVulnerabilities) {
        lines.push(`*... and ${vulnerabilities.length - maxVulnerabilities} more vulnerabilities. See workflow logs for complete list.*`);
        lines.push('');
    }
    // Remediation hint
    lines.push('**💡 To fix:** Run `go get -u` to update dependencies, or pin to a specific fixed version.');
    // Workflow logs link
    if (options.workflowLogsUrl) {
        lines.push('');
        lines.push(`📋 [View full scan output](${options.workflowLogsUrl})`);
    }
    return {
        markdown: lines.join('\n'),
        count: vulnerabilities.length,
        vulnerabilities,
    };
}
/**
 * Get workflow logs URL for GitHub Actions
 */
function getWorkflowLogsUrl() {
    const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
    const repository = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    if (repository && runId) {
        return `${serverUrl}/${repository}/actions/runs/${runId}`;
    }
    return '';
}
//# sourceMappingURL=security-formatter.js.map