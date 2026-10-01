import { describe, it, expect, vi } from 'vitest';

vi.mock('./apiSession', () => ({ apiCall: vi.fn(), apiRequest: vi.fn() }));

import { calculationsToCsv } from './adminAnalytics';

describe('calculationsToCsv', () => {
  it('quotes every field, escapes quotes, and tolerates a null email', () => {
    const csv = calculationsToCsv([
      { id: '1', userId: 'u1', userEmail: 'a,"b"@x.com', calculatorType: 'dscr', createdAt: '2026-10-01T00:00:00Z' },
      { id: '2', userId: 'u2', userEmail: null, calculatorType: 'ebitda', createdAt: '2026-10-02T00:00:00Z' },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('"id","userEmail","userId","calculatorType","createdAt"');
    expect(lines[1]).toBe('"1","a,""b""@x.com","u1","dscr","2026-10-01T00:00:00Z"');
    expect(lines[2]).toBe('"2","","u2","ebitda","2026-10-02T00:00:00Z"');
  });
});
