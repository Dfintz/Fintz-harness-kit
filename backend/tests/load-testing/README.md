# K6 Load Testing Suite

Comprehensive performance testing suite for Star Citizen Fleet Manager API using
[k6](https://k6.io).

## Overview

This suite tests critical API endpoints under various load conditions to identify performance
bottlenecks, capacity limits, and scaling recommendations.

### Test Modules

| Module                         | Tests                                                     | Focus                                         | Thresholds                                 |
| ------------------------------ | --------------------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| **01-authentication.js**       | Discord OAuth, native login, token refresh, 2FA, sessions | Login latency, token refresh speed            | p95 < 500ms (login), p95 < 300ms (refresh) |
| **02-fleet-api.js**            | CRUD operations on fleets, ship assignments               | Fleet list performance, create/update latency | p95 < 500ms (list), p95 < 800ms (create)   |
| **03-activity-api.js**         | Activity CRUD, filtering, joining/RSVP                    | Complex query handling, filtering performance | p95 < 800ms (list), p95 < 1000ms (create)  |
| **04-websocket.js**            | WebSocket connections, message throughput                 | Real-time performance, connection stability   | p95 < 500ms (message latency)              |
| **05-database-performance.js** | Complex queries, joins, aggregations, search              | Query performance, N+1 detection, pagination  | p95 < 1500ms (aggregations)                |
| **run-all-tests.js**           | Orchestrated multi-test suite                             | Realistic mixed workload                      | p95 < 1000ms (all requests)                |

## Installation

### 1. Install k6

**Windows (with Chocolatey):**

```powershell
choco install k6
```

**Windows (with Scoop):**

```powershell
scoop install k6
```

**macOS:**

```bash
brew install k6
```

**Linux:**

```bash
sudo apt-get install k6
```

### 2. Verify Installation

```bash
k6 version
# Output: k6 vX.XX.X
```

## Setup

### Environment Variables

Create a `.env.load-test` file:

```env
BASE_URL=http://localhost:3000
TOKEN=your_test_jwt_token
ORG_ID=your_test_org_id
```

Or set them inline when running:

```bash
k6 run test.js --env BASE_URL=http://localhost:3000 --env TOKEN=your_token
```

### Test Data Requirements

1. **Valid JWT Token**: Must be a valid authentication token with permissions
2. **Organization ID**: Must be an existing organization the token user is member of
3. **Running Backend**: API server must be accessible at BASE_URL

## Running Tests

### Individual Test Modules

**Run authentication tests:**

```bash
cd backend
k6 run tests/load-testing/01-authentication.js
```

**Run with custom VUs (virtual users):**

```bash
k6 run tests/load-testing/02-fleet-api.js --vus 100 --duration 10m
```

**Run with environment variables:**

```bash
k6 run tests/load-testing/03-activity-api.js \
  --env BASE_URL=http://localhost:3000 \
  --env TOKEN=your_token \
  --env ORG_ID=your_org_id
```

### All Tests Combined

**Run complete test suite:**

```bash
k6 run tests/load-testing/run-all-tests.js
```

**Run with output to JSON:**

```bash
k6 run tests/load-testing/run-all-tests.js -o json=results.json
```

## Load Testing Scenarios

### Light Load (Development Testing)

```bash
# 10 VUs ramping to 20 over 5 minutes
k6 run test.js --vus 10 --duration 5m
```

### Moderate Load (Staging)

```bash
# Ramp to 50 VUs, sustained for 10 minutes
k6 run test.js --stages "5m:50,10m:50,5m:0"
```

### High Load (Production Simulation)

```bash
# Ramp to 100+ VUs, sustained, peak load
k6 run test.js --stages "10m:100,20m:200,5m:0"
```

### Stress Test (Find Breaking Point)

```bash
# Incrementally increase load until failures spike
k6 run test.js --stages "5m:10,5m:50,5m:100,5m:200,5m:500,5m:0"
```

## Interpreting Results

### Key Metrics

| Metric              | Interpretation           | Target                    |
| ------------------- | ------------------------ | ------------------------- |
| `http_req_duration` | Request response time    | p95 < 500ms, p99 < 1000ms |
| `http_req_failed`   | Failed requests          | < 5% failure rate         |
| `http_reqs`         | Total requests completed | Throughput metric         |
| `vus`               | Concurrent users         | Matches --vus setting     |
| `vus_max`           | Peak concurrent users    | Capacity measurement      |

### Example Output

```
✓ Auth check passed
✓ Fleet list retrieved
✓ Activity list retrieved

✗ Create fleet (52% fail rate at 200+ VUs)

checks.........................: 94.5% ✓
http_req_duration..............: avg=287ms, p(95)=621ms, p(99)=1120ms
http_req_failed................: 5.2% ✓
http_reqs......................: 14250
vus............................: 50
vus_max.........................: 200
```

## Performance Analysis

### Baseline Metrics (Expected)

| Endpoint        | p50   | p95   | p99   | p99.9  |
| --------------- | ----- | ----- | ----- | ------ |
| GET /fleets     | 45ms  | 120ms | 280ms | 500ms  |
| POST /fleets    | 120ms | 350ms | 750ms | 1200ms |
| GET /activities | 80ms  | 250ms | 600ms | 1000ms |
| GET /auth/me    | 30ms  | 80ms  | 150ms | 300ms  |

### Identifying Bottlenecks

**High response times at moderate load (< 50 VUs):**

- Check database indexes on frequently queried fields
- Verify connection pooling configuration
- Review query complexity (N+1 queries)

**Failures at specific VU count:**

- Database connection pool exhaustion
- Rate limiting triggered
- Memory limits approached
- Server resource constraints

## Exporting Results

### JSON Export (for k6 Cloud)

```bash
k6 run test.js -o json=load-test-results.json
```

### Create HTML Report

```bash
# Install html-report extension
npm install -g @grafana/k6-html-reporter

# Run tests and generate HTML
k6 run test.js -o json=results.json
k6-html-reporter -i results.json -o load-test-report.html
```

## Continuous Load Testing

### Setup in GitHub Actions

```yaml
name: Load Testing
on: [push, pull_request]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: grafana/setup-k6-action@v1
      - run: k6 run backend/tests/load-testing/run-all-tests.js
```

## Troubleshooting

### Connection Refused

```
Error: Failed to connect to http://localhost:3000
```

**Solution:** Verify backend is running:

```bash
cd backend
npm run dev
```

### Invalid Token

```
http_req_failed: 401 Unauthorized
```

**Solution:** Generate valid token or check token expiration

### Rate Limiting

```
http_req_failed: 429 Too Many Requests
```

**Solution:** Reduce VUs or check rate limiting thresholds

### Memory Issues

```
k6: too many open files
```

**Solution:** Increase system file descriptor limit:

```bash
# macOS/Linux
ulimit -n 65535

# Windows (run as admin)
# Adjust registry: HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters
```

## Best Practices

1. **Start Small**: Begin with 10 VUs before scaling to 100+
2. **Test in Staging**: Always test non-production environments first
3. **Realistic Data**: Use production-like data volume and complexity
4. **Monitor Backend**: Watch server logs, CPU, memory during tests
5. **Gradual Load**: Use stages to gradually increase load rather than sudden spikes
6. **Repeat Tests**: Run tests multiple times to ensure consistency
7. **Document Results**: Keep baseline metrics for comparison

## Resources

- [K6 Official Documentation](https://k6.io/docs/)
- [K6 HTTP Module](https://k6.io/docs/javascript-api/k6-http/)
- [K6 Cloud Integration](https://k6.io/docs/cloud/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/load-testing-best-practices/)

## Next Steps

1. **Run baseline tests** to establish current performance
2. **Identify bottlenecks** from test results
3. **Implement optimizations** (caching, indexes, query optimization)
4. **Re-test** to measure improvement
5. **Monitor production** with Application Insights metrics
6. **Schedule regular tests** as part of CI/CD pipeline
