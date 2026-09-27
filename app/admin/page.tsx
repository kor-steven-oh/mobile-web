import type { Metadata } from 'next';
import AdminApp from '../../admin/app';

export const metadata: Metadata = { title: 'SDD 2026 · 관리자', robots: { index: false, follow: false } };

export default function AdminPage() { return <AdminApp/>; }
