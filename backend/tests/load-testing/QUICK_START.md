# K6 Load Testing: Quick Start Guide

## One-Line Setup

```bash
# Install k6
choco install k6  # Windows
brew install k6   # macOS
sudo apt-get install k6  # Linux
```

## Run Load Tests

### Fastest Start (Defaults)

```bash
k6 run backend/tests/load-testing/run-all-tests.js
```

### With Custom VUs

```bash
k6 run backend/tests/load-testing/02-fleet-api.js --vus 50 --duration 5m
```

### Using Quick-Start Script

```bash
cd backend/tests/load-testing
chmod +x quick-start.sh
./quick-start.sh --vus 30
```

## Individual Tests

| Test           | Command                             | Focus                          |
| -------------- | ----------------------------------- | ------------------------------ |
| Authentication | `k6 run 01-authentication.js`       | Login, tokens, 2FA, sessions   |
| Fleet API      | `k6 run 02-fleet-api.js`            | CRUD, assignments, composition |
| Activities     | `k6 run 03-activity-api.js`         | Scheduling, filtering, RSVP    |
| WebSocket      | `k6 run 04-websocket.js`            | Real-time connections          |
| Database       | `k6 run 05-database-performance.js` | Queries, aggregations, search  |
| All Tests      | `k6 run run-all-tests.js`           | Complete suite (realistic mix) |

## What Gets Tested

### Endpoints

- **Auth**: Login, token refresh, 2FA, sessions
- **Fleet**: List, create, update, delete, ship assignments
- **Activity**: List, create, join, update, leave, participants
- **Database**: Queries, joins, aggregations, search, pagination

### Performance Metrics

- ✅ Response times (p50, p95, p99)
- ✅ Error rates
- ✅ Throughput
- ✅ Concurrent user capacity
- ✅ Connection stability

### Thresholds (Auto-checked)

- Login time: **p95 < 500ms** ✓
- Fleet list: **p95 < 500ms** ✓
- Activity queries: **p95 < 1000ms** ✓
- Error rate: **< 5%** ✓

## Expected Results

**Light Load (10 VUs):**

```
✓ All checks passed (95%+)
  http_req_duration: avg=180ms, p(95)=420ms
  http_req_failed: 0%
```

**Moderate Load (50 VUs):**

```
✓ Most checks pass (90%+)
  http_req_duration: avg=350ms, p(95)=850ms
  http_req_failed: 1-2%
```

**High Load (100+ VUs):**

```
⚠ Some failures expected
  http_req_duration: avg=700ms, p(95)=1500ms
  http_req_failed: 3-5%
```

## Environment Variables

```bash
# Required
export BASE_URL=http://localhost:3000
export TOKEN=your_jwt_token
export ORG_ID=your_organization_id

# Optional
export LOG_LEVEL=info
```

Or pass inline:

```bash
k6 run test.js --env BASE_URL=http://localhost:3000 --env TOKEN=xxx
```

## Troubleshooting

**Connection refused?**

```bash
# Start backend first
cd backend
npm run dev
```

**Invalid token?**

```bash
# Get token from login endpoint or use test account
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass"}'
```

**Too many open files?**

```bash
# Increase file descriptor limit
ulimit -n 65535  # macOS/Linux
```

## Next Steps

1. **Run baseline test** to establish current performance
2. **Identify slow endpoints** from results
3. **Optimize** database queries, add caching, etc.
4. **Re-test** to measure improvement
5. **Monitor production** with Application Insights

## Full Documentation

See [README.md](./README.md) for comprehensive guide covering:

- Detailed test scenarios
- Load profiles (light, moderate, high, stress)
- Result interpretation
- Continuous integration setup
- Best practices

## Key Metrics to Watch

| Metric      | Good       | Warning      | Critical   |
| ----------- | ---------- | ------------ | ---------- |
| p95 latency | < 500ms    | 500-1000ms   | > 1000ms   |
| Error rate  | < 1%       | 1-5%         | > 5%       |
| Throughput  | 100+ req/s | 50-100 req/s | < 50 req/s |

---

**Ready to test?** Start with:

```bash
k6 run backend/tests/load-testing/02-fleet-api.js --vus 30 --duration 3m
```
