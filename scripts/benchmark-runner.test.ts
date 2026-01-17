import { BenchmarkRunner } from './benchmark-runner';
import { spawnSync } from 'child_process';

// Mock spawnSync
jest.mock('child_process');

const mockSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

describe('BenchmarkRunner', () => {
  let runner: BenchmarkRunner;
  const testWorkingDir = '/test/project';
  const testBenchmarkArgs = '-bench=. -benchmem';
  const testBenchmarkCount = 3;

  beforeEach(() => {
    jest.clearAllMocks();
    runner = new BenchmarkRunner({
      workingDirectory: testWorkingDir,
      benchmarkArgs: testBenchmarkArgs,
      benchmarkCount: testBenchmarkCount
    });
  });

  describe('constructor validation', () => {
    it('should accept valid benchmark arguments', () => {
      expect(() => new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench=. -benchmem',
        benchmarkCount: 1
      })).not.toThrow();

      expect(() => new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench=BenchmarkSpecific -count=5 -cpu=1,2,4',
        benchmarkCount: 1
      })).not.toThrow();
    });

    it('should reject benchmark arguments with shell injection', () => {
      expect(() => new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench=.; rm -rf /',
        benchmarkCount: 1
      })).toThrow('Invalid benchmark arguments');

      expect(() => new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench=. && malicious',
        benchmarkCount: 1
      })).toThrow('Invalid benchmark arguments');

      expect(() => new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench=. | cat /etc/passwd',
        benchmarkCount: 1
      })).toThrow('Invalid benchmark arguments');

      expect(() => new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench=$(whoami)',
        benchmarkCount: 1
      })).toThrow('Invalid benchmark arguments');

      expect(() => new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench=`whoami`',
        benchmarkCount: 1
      })).toThrow('Invalid benchmark arguments');
    });

    it('should reject benchmark arguments with path traversal', () => {
      expect(() => new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench=../../../etc/passwd',
        benchmarkCount: 1
      })).toThrow('Invalid benchmark arguments');
    });

    it('should reject benchmark arguments with newlines', () => {
      expect(() => new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench=.\nrm -rf /',
        benchmarkCount: 1
      })).toThrow('Invalid benchmark arguments');
    });
  });

  describe('runBenchmarks', () => {
    it('should run benchmarks successfully', () => {
      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from('benchmark output'),
        stderr: Buffer.from(''),
        status: 0,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: undefined
      });

      const result = runner.runBenchmarks();

      expect(result).toEqual({ success: true });
      expect(mockSpawnSync).toHaveBeenCalledTimes(testBenchmarkCount);

      for (let i = 0; i < testBenchmarkCount; i++) {
        expect(mockSpawnSync).toHaveBeenNthCalledWith(i + 1,
          'go',
          ['test', '-bench=.', '-benchmem', './...'],
          {
            cwd: testWorkingDir,
            stdio: 'inherit'
          }
        );
      }
    });

    it('should handle benchmark failures with non-zero exit status', () => {
      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from(''),
        stderr: Buffer.from('test failed'),
        status: 1,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: undefined
      });

      const result = runner.runBenchmarks();

      expect(result).toEqual({
        success: false,
        error: 'go test exited with status 1'
      });
      expect(mockSpawnSync).toHaveBeenCalledTimes(1);
    });

    it('should handle spawnSync errors', () => {
      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        status: null,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: new Error('Spawn failed')
      });

      const result = runner.runBenchmarks();

      expect(result).toEqual({
        success: false,
        error: 'Spawn failed'
      });
      expect(mockSpawnSync).toHaveBeenCalledTimes(1);
    });

    it('should handle unknown errors', () => {
      mockSpawnSync.mockImplementation(() => {
        throw 'Unknown error type';
      });

      const result = runner.runBenchmarks();

      expect(result).toEqual({
        success: false,
        error: 'Unknown error'
      });
    });

    it('should run correct number of iterations', () => {
      const singleRunRunner = new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: testBenchmarkArgs,
        benchmarkCount: 1
      });

      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        status: 0,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: undefined
      });

      singleRunRunner.runBenchmarks();

      expect(mockSpawnSync).toHaveBeenCalledTimes(1);
    });

    it('should handle large number of benchmark runs', () => {
      const manyRunsRunner = new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: testBenchmarkArgs,
        benchmarkCount: 10
      });

      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        status: 0,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: undefined
      });

      const result = manyRunsRunner.runBenchmarks();

      expect(result.success).toBe(true);
      expect(mockSpawnSync).toHaveBeenCalledTimes(10);
    });

    it('should use correct benchmark arguments', () => {
      const customArgs = '-bench=BenchmarkSpecific -count=5';
      const customRunner = new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: customArgs,
        benchmarkCount: 1
      });

      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        status: 0,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: undefined
      });

      customRunner.runBenchmarks();

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'go',
        ['test', '-bench=BenchmarkSpecific', '-count=5', './...'],
        {
          cwd: testWorkingDir,
          stdio: 'inherit'
        }
      );
    });

    it('should fail on first error and not continue', () => {
      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        status: 1,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: undefined
      });

      const result = runner.runBenchmarks();

      expect(result.success).toBe(false);
      expect(mockSpawnSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('runBenchmarks function export', () => {
    it('should work with default parameters', () => {
      const { runBenchmarks } = require('./benchmark-runner');

      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        status: 0,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: undefined
      });

      const result = runBenchmarks();

      expect(result.success).toBe(true);
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'go',
        ['test', '-bench=.', '-benchmem', './...'],
        {
          cwd: '.',
          stdio: 'inherit'
        }
      );
    });

    it('should work with custom parameters', () => {
      const { runBenchmarks } = require('./benchmark-runner');

      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        status: 0,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: undefined
      });

      const result = runBenchmarks('/custom/dir', '-bench=Custom', 2);

      expect(result.success).toBe(true);
      expect(mockSpawnSync).toHaveBeenCalledTimes(2);
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'go',
        ['test', '-bench=Custom', './...'],
        {
          cwd: '/custom/dir',
          stdio: 'inherit'
        }
      );
    });

    it('should throw on invalid benchmark arguments in function export', () => {
      const { runBenchmarks } = require('./benchmark-runner');

      expect(() => runBenchmarks('.', '-bench=.; malicious')).toThrow('Invalid benchmark arguments');
    });
  });

  describe('argument parsing', () => {
    it('should correctly parse arguments with quotes', () => {
      const quotedRunner = new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench="Benchmark Test" -benchmem',
        benchmarkCount: 1
      });

      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        status: 0,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: undefined
      });

      quotedRunner.runBenchmarks();

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'go',
        ['test', '-bench=Benchmark Test', '-benchmem', './...'],
        {
          cwd: testWorkingDir,
          stdio: 'inherit'
        }
      );
    });

    it('should handle multiple spaces between arguments', () => {
      const spacedRunner = new BenchmarkRunner({
        workingDirectory: testWorkingDir,
        benchmarkArgs: '-bench=.    -benchmem',
        benchmarkCount: 1
      });

      mockSpawnSync.mockReturnValue({
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        status: 0,
        signal: null,
        pid: 12345,
        output: [null, Buffer.from(''), Buffer.from('')],
        error: undefined
      });

      spacedRunner.runBenchmarks();

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'go',
        ['test', '-bench=.', '-benchmem', './...'],
        {
          cwd: testWorkingDir,
          stdio: 'inherit'
        }
      );
    });
  });
});
