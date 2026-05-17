import React from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { CalculatorsManagement } from '../../components/admin/CalculatorsManagement';

export function AdminCalculatorsPage() {
  return (
    <AdminLayout>
      <CalculatorsManagement />
    </AdminLayout>
  );
}
