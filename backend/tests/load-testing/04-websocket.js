/**
 * K6 Load Test: WebSocket Real-time Communication
 *
 * Tests:
 * - WebSocket connection establishment
 * - Concurrent socket connections
 * - Message throughput
 * - Connection stability
 *
 * Note: k6 has limited WebSocket support. For advanced testing, consider:
 * - Socket.io protocol simulation
 * - Message rate testing
 * - Drop/reconnection scenarios
 *
 * Run: k6 run backend/tests/load-testing/04-websocket.js
 */

import { check, group, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import ws from 'k6/ws';

const wsConnections = new Counter('ws_connections');
const wsErrors = new Counter('ws_errors');
const wsMessageLatency = new Trend('ws_message_latency');

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '2m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    ws_errors: ['count < 5'],
    ws_message_latency: ['p(95) < 500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = BASE_URL.replace('http', 'ws');
const TOKEN = __ENV.TOKEN || 'test_token_placeholder';

export default function () {
  group('WebSocket Connection Tests', () => {
    // Test 1: Basic WebSocket Connection
    group('Establish WebSocket Connection', () => {
      const url = `${WS_URL}/socket.io/?token=${TOKEN}&transport=websocket`;

      const res = ws.connect(url, {
        tags: { name: 'WebSocket' },
      });

      check(res, {
        'status is 101': r => r && r.status === 101,
      });

      if (res.status === 101) {
        wsConnections.add(1);

        // Send authentication message
        res.send(
          JSON.stringify({
            event: 'authenticate',
            data: {
              token: TOKEN,
            },
          })
        );

        // Listen for messages (max 10 seconds)
        let messageCount = 0;
        const startTime = Date.now();

        res.on('message', msg => {
          const latency = Date.now() - startTime;
          wsMessageLatency.add(latency);
          messageCount++;

          // Send a ping/pong to keep connection alive
          if (messageCount % 5 === 0) {
            res.send(
              JSON.stringify({
                event: 'ping',
              })
            );
          }
        });

        res.on('close', () => {
          console.log(`WebSocket closed after ${messageCount} messages`);
        });

        res.on('error', err => {
          console.error(`WebSocket error: ${err}`);
          wsErrors.add(1);
        });

        // Simulate client sending messages
        group('Send Messages', () => {
          for (let i = 0; i < 5; i++) {
            res.send(
              JSON.stringify({
                event: 'fleet:update',
                data: {
                  fleetId: 'fleet-test',
                  timestamp: new Date().toISOString(),
                },
              })
            );
            sleep(0.2);
          }
        });

        // Keep connection open for a bit
        sleep(3);

        res.close();
      } else {
        wsErrors.add(1);
      }
    });

    sleep(1);
  });
}

// Summary endpoint to measure WebSocket stats
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
