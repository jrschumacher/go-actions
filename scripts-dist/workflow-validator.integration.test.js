"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const workflow_validator_1 = require("./workflow-validator");
// Integration tests that use real files without mocking
describe('WorkflowValidator Integration Tests', () => {
    describe('test fixtures', () => {
        it('should validate go-valid fixture as valid', () => {
            const result = (0, workflow_validator_1.validateWorkflows)('./fixtures/go-valid');
            expect(result.isValid).toBe(true);
            expect(result.actionsFound).toEqual(['ci', 'release', 'self-validate']);
            expect(result.errors).toHaveLength(0);
        });
        it('should validate go-invalid fixture as invalid', () => {
            const result = (0, workflow_validator_1.validateWorkflows)('./fixtures/go-invalid');
            expect(result.isValid).toBe(false);
            expect(result.actionsFound).toEqual(['ci', 'release', 'self-validate']);
            // Should detect all missing files
            expect(result.errors).toHaveLength(4);
            const errorMessages = result.errors.map(e => e.message);
            expect(errorMessages).toContain('go.mod (required for CI actions)');
            expect(errorMessages).toContain('.release-please-config.json (required for release action)');
            expect(errorMessages).toContain('.release-please-manifest.json (required for release action)');
            expect(errorMessages).toContain('.goreleaser.yaml or .goreleaser.yml (required for release action)');
        });
        it('should skip validation for go-actions repository itself', () => {
            // Test that it recognizes this repository as the go-actions provider
            const result = (0, workflow_validator_1.validateWorkflows)('.');
            expect(result.isValid).toBe(true);
            expect(result.actionsFound).toEqual([]);
            expect(result.errors).toHaveLength(0);
        });
    });
    describe('example project', () => {
        it('should validate example project as valid', () => {
            const result = (0, workflow_validator_1.validateWorkflows)('./example');
            expect(result.isValid).toBe(true);
            expect(result.actionsFound).toEqual(['ci', 'self-validate']);
            expect(result.errors).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=workflow-validator.integration.test.js.map