"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenchmarkRunner = void 0;
exports.runBenchmarks = runBenchmarks;
const child_process_1 = require("child_process");
class BenchmarkRunner {
    constructor(options) {
        this.workingDir = options.workingDirectory;
        this.benchmarkArgs = options.benchmarkArgs;
        this.benchmarkCount = options.benchmarkCount;
    }
    runBenchmarks() {
        console.log('Running Go benchmarks...');
        try {
            for (let i = 1; i <= this.benchmarkCount; i++) {
                console.log(`Benchmark run ${i}/${this.benchmarkCount}`);
                (0, child_process_1.execSync)(`go test ${this.benchmarkArgs} ./...`, {
                    cwd: this.workingDir,
                    stdio: 'inherit'
                });
            }
            console.log('✅ All benchmark runs completed successfully');
            return { success: true };
        }
        catch (error) {
            console.log('❌ Benchmark run failed');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
exports.BenchmarkRunner = BenchmarkRunner;
// Main execution for github-script
function runBenchmarks(workingDirectory = '.', benchmarkArgs = '-bench=. -benchmem', benchmarkCount = 5) {
    const runner = new BenchmarkRunner({ workingDirectory, benchmarkArgs, benchmarkCount });
    return runner.runBenchmarks();
}
//# sourceMappingURL=benchmark-runner.js.map