import AdminOAuthPanel from '@/components/AdminOAuthPanel';
import AdminPanelLogin from '@/components/AdminPanelLogin';
import { hasAdminAccess, isAdminSecretConfigured } from '@/lib/admin-access';
import { readRuntimeOAuthConfig } from '@/lib/nextcloud-oauth-config';

export default async function AdminOAuthPage() {
  const canAccess = await hasAdminAccess();
  if (!canAccess) {
    return <AdminPanelLogin secretConfigured={isAdminSecretConfigured()} />;
  }

  const envClientId = process.env.NC_OAUTH_CLIENT_ID?.trim() || '';
  const envClientSecret = process.env.NC_OAUTH_CLIENT_SECRET?.trim() || '';
  const runtime = await readRuntimeOAuthConfig();

  const source = envClientId && envClientSecret ? 'env' : runtime ? 'runtime' : 'missing';
  const clientId = source === 'env' ? envClientId : runtime?.clientId || '';

  return <AdminOAuthPanel initialSource={source} initialClientId={clientId} />;
}
