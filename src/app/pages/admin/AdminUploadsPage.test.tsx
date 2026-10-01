import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../components/admin/AdminLayout', () => ({ AdminLayout: ({ children }: any) => <div>{children}</div> }));
vi.mock('../../../lib/adminAnalytics', () => ({
  getAdminUploads: vi.fn().mockResolvedValue([
    { id: '1', userId: 'u1', userEmail: 'a@b.com', filename: 'report.pdf', contentType: 'application/pdf', sizeBytes: 2048, createdAt: '2026-10-01T00:00:00Z' },
  ]),
  downloadAdminUpload: vi.fn(),
}));

import { AdminUploadsPage } from './AdminUploadsPage';

describe('AdminUploadsPage', () => {
  it('lists uploads with uploader, size and a download button', async () => {
    render(<AdminUploadsPage />);
    expect(await screen.findByText('report.pdf')).toBeTruthy();
    expect(screen.getByText('a@b.com')).toBeTruthy();
    expect(screen.getByText('2.0 KB')).toBeTruthy();
    expect(screen.getByRole('button', { name: /download/i })).toBeTruthy();
  });
});
