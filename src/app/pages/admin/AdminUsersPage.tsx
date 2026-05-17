import React from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { UsersManagement } from '../../components/admin/UsersManagement';

export function AdminUsersPage() {
  return (
    <AdminLayout>
      <UsersManagement />
    </AdminLayout>
  );
}
