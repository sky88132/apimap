import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversine, formatDistance } from './distance.js';
test('동일 좌표는 0m', () => assert.equal(haversine({ lat: 37, lon: 127 }, { lat: 37, lon: 127 }), 0));
test('적도 1도는 약 111.2km', () => assert.ok(Math.abs(haversine({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111195) < 1));
test('날짜 변경선과 대척점에서 유한한 거리', () => {
  assert.ok(haversine({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 }) < 23000);
  assert.ok(Number.isFinite(haversine({ lat: 90, lon: 0 }, { lat: -90, lon: 0 })));
});
test('미터와 킬로미터 경계', () => {
  assert.deepEqual(formatDistance(999), { value: '999', unit: 'm' });
  assert.deepEqual(formatDistance(1000), { value: '1.00', unit: 'km' });
});
