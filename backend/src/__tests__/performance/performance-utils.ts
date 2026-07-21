/**
 * Performance Testing Utilities
 * 
 * Utilities for benchmarking service performance and analyzing results.
 */

export interface PerformanceResult {
    operationName: string;
    iterations: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    medianTime: number;
    p95Time: number;
    p99Time: number;
    operationsPerSecond: number;
    timestamp: Date;
}

export interface BenchmarkOptions {
    iterations?: number;
    warmupIterations?: number;
    cooldownMs?: number;
    logProgress?: boolean;
}

/**
 * Run a performance benchmark on an async operation
 */
export async function benchmark(
    name: string,
    operation: () => Promise<any>,
    options: BenchmarkOptions = {}
): Promise<PerformanceResult> {
    const {
        iterations = 100,
        warmupIterations = 10,
        cooldownMs = 10,
        logProgress = true
    } = options;

    const times: number[] = [];

    if (logProgress) {
        console.log(`\n🏃 Running benchmark: ${name}`);
        console.log(`   Warmup: ${warmupIterations} iterations`);
        console.log(`   Test: ${iterations} iterations\n`);
    }

    // Warmup phase
    if (logProgress) {console.log('   ⏳ Warming up...');}
    for (let i = 0; i < warmupIterations; i++) {
        try {
            await operation();
        } catch (error) {
            // Ignore warmup errors
        }
        if (cooldownMs > 0) {
            await sleep(cooldownMs);
        }
    }

    // Benchmark phase
    if (logProgress) {console.log('   📊 Benchmarking...');}
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
        const iterationStart = performance.now();
        
        try {
            await operation();
            const iterationEnd = performance.now();
            times.push(iterationEnd - iterationStart);
        } catch (error) {
            // Record failed operations as max time
            const iterationEnd = performance.now();
            times.push(iterationEnd - iterationStart);
        }

        if (cooldownMs > 0) {
            await sleep(cooldownMs);
        }

        if (logProgress && (i + 1) % 10 === 0) {
            console.log(`   Progress: ${i + 1}/${iterations}`);
        }
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Calculate statistics
    times.sort((a, b) => a - b);
    const sum = times.reduce((acc, t) => acc + t, 0);
    const average = sum / times.length;
    const min = times[0];
    const max = times[times.length - 1];
    const median = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    const opsPerSecond = (iterations / totalTime) * 1000;

    const result: PerformanceResult = {
        operationName: name,
        iterations,
        totalTime,
        averageTime: average,
        minTime: min,
        maxTime: max,
        medianTime: median,
        p95Time: p95,
        p99Time: p99,
        operationsPerSecond: opsPerSecond,
        timestamp: new Date()
    };

    if (logProgress) {
        printResults(result);
    }

    return result;
}

/**
 * Print benchmark results in a formatted table
 */
export function printResults(result: PerformanceResult): void {
    console.log('\n   ✅ Results:');
    console.log('   ┌─────────────────────┬──────────────┐');
    console.log(`   │ Total Time          │ ${result.totalTime.toFixed(2).padStart(10)} ms │`);
    console.log(`   │ Iterations          │ ${result.iterations.toString().padStart(12)} │`);
    console.log('   ├─────────────────────┼──────────────┤');
    console.log(`   │ Average Time        │ ${result.averageTime.toFixed(2).padStart(10)} ms │`);
    console.log(`   │ Median Time         │ ${result.medianTime.toFixed(2).padStart(10)} ms │`);
    console.log(`   │ Min Time            │ ${result.minTime.toFixed(2).padStart(10)} ms │`);
    console.log(`   │ Max Time            │ ${result.maxTime.toFixed(2).padStart(10)} ms │`);
    console.log('   ├─────────────────────┼──────────────┤');
    console.log(`   │ P95 Time            │ ${result.p95Time.toFixed(2).padStart(10)} ms │`);
    console.log(`   │ P99 Time            │ ${result.p99Time.toFixed(2).padStart(10)} ms │`);
    console.log('   ├─────────────────────┼──────────────┤');
    console.log(`   │ Ops/Second          │ ${result.operationsPerSecond.toFixed(2).padStart(12)} │`);
    console.log('   └─────────────────────┴──────────────┘\n');
}

/**
 * Compare multiple benchmark results
 */
export function compareResults(baseline: PerformanceResult, current: PerformanceResult): void {
    console.log('\n📊 Performance Comparison');
    console.log(`   Baseline: ${baseline.operationName} (${baseline.timestamp.toISOString()})`);
    console.log(`   Current:  ${current.operationName} (${current.timestamp.toISOString()})\n`);

    const avgDiff = ((current.averageTime - baseline.averageTime) / baseline.averageTime) * 100;
    const p95Diff = ((current.p95Time - baseline.p95Time) / baseline.p95Time) * 100;
    const opsDiff = ((current.operationsPerSecond - baseline.operationsPerSecond) / baseline.operationsPerSecond) * 100;

    console.log('   ┌─────────────────────┬──────────────┬──────────────┬──────────────┐');
    console.log('   │ Metric              │ Baseline     │ Current      │ Change       │');
    console.log('   ├─────────────────────┼──────────────┼──────────────┼──────────────┤');
    console.log(`   │ Average Time        │ ${baseline.averageTime.toFixed(2).padStart(10)} ms │ ${current.averageTime.toFixed(2).padStart(10)} ms │ ${formatDiff(avgDiff)} │`);
    console.log(`   │ P95 Time            │ ${baseline.p95Time.toFixed(2).padStart(10)} ms │ ${current.p95Time.toFixed(2).padStart(10)} ms │ ${formatDiff(p95Diff)} │`);
    console.log(`   │ Ops/Second          │ ${baseline.operationsPerSecond.toFixed(2).padStart(12)} │ ${current.operationsPerSecond.toFixed(2).padStart(12)} │ ${formatDiff(opsDiff, true)} │`);
    console.log('   └─────────────────────┴──────────────┴──────────────┴──────────────┘\n');
}

/**
 * Format percentage difference with color coding
 */
function formatDiff(diff: number, reverseColor: boolean = false): string {
    const sign = diff > 0 ? '+' : '';
    const value = `${sign}${diff.toFixed(1)}%`;
    
    // For ops/second, higher is better (reverse color)
    const isGood = reverseColor ? diff > 0 : diff < 0;
    
    if (Math.abs(diff) < 5) {
        return value.padStart(12); // Neutral
    } else if (isGood) {
        return `✅ ${value}`.padStart(12); // Good
    } else {
        return `⚠️  ${value}`.padStart(12); // Bad
    }
}

/**
 * Save results to JSON file
 */
export function saveResults(results: PerformanceResult[], filename: string): void {
    const fs = require('fs');
    const path = require('path');
    
    const outputDir = path.join(__dirname, '../../../performance-results');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    
    console.log(`\n💾 Results saved to: ${filepath}`);
}

/**
 * Load results from JSON file
 */
export function loadResults(filename: string): PerformanceResult[] {
    const fs = require('fs');
    const path = require('path');
    
    const filepath = path.join(__dirname, '../../../performance-results', filename);
    if (!fs.existsSync(filepath)) {
        return [];
    }
    
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create mock data generator for performance tests
 */
export class MockDataGenerator {
    private counter = 0;

    generateUserId(): string {
        return `perf-user-${Date.now()}-${this.counter++}`;
    }

    generateOrgId(): string {
        return `perf-org-${Date.now()}-${this.counter++}`;
    }

    generateActivityId(): string {
        return `perf-activity-${Date.now()}-${this.counter++}`;
    }

    generateActivityData(orgId: string, creatorId: string) {
        return {
            organizationId: orgId,
            title: `Performance Test Activity ${this.counter}`,
            description: 'Testing activity creation performance',
            activityType: 'mission',
            scheduledStartDate: new Date(),
            creatorId
        };
    }

    generateParticipantIds(count: number): string[] {
        return Array.from({ length: count }, () => this.generateUserId());
    }

    reset(): void {
        this.counter = 0;
    }
}

/**
 * Performance test thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
    // Aggregator operations (coordinating multiple services)
    aggregatorCreate: {
        average: 100, // ms
        p95: 200,
        p99: 500
    },
    aggregatorRead: {
        average: 50,
        p95: 100,
        p99: 200
    },
    aggregatorUpdate: {
        average: 150,
        p95: 300,
        p99: 600
    },
    
    // Simple service operations
    simpleRead: {
        average: 20,
        p95: 50,
        p99: 100
    },
    simpleWrite: {
        average: 30,
        p95: 75,
        p99: 150
    },
    
    // Complex calculations
    calculation: {
        average: 50,
        p95: 100,
        p99: 200
    }
};

/**
 * Check if results meet performance thresholds
 */
export function checkThresholds(
    result: PerformanceResult,
    thresholds: { average: number; p95: number; p99: number }
): { passed: boolean; failures: string[] } {
    const failures: string[] = [];

    if (result.averageTime > thresholds.average) {
        failures.push(`Average time ${result.averageTime.toFixed(2)}ms exceeds threshold ${thresholds.average}ms`);
    }
    if (result.p95Time > thresholds.p95) {
        failures.push(`P95 time ${result.p95Time.toFixed(2)}ms exceeds threshold ${thresholds.p95}ms`);
    }
    if (result.p99Time > thresholds.p99) {
        failures.push(`P99 time ${result.p99Time.toFixed(2)}ms exceeds threshold ${thresholds.p99}ms`);
    }

    return {
        passed: failures.length === 0,
        failures
    };
}
