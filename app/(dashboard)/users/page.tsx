import { UsersTable } from "@/components/users/users-table";
import { PageHeader } from "@/components/shared/page-header";
import { getLookups, listUsers } from "@/lib/db/users";
import { requirePermission } from "@/lib/auth/session";

export default async function UsersPage() {
  const actor = await requirePermission("users.read");
  const users = await listUsers();
  const lookups = await getLookups();

  return (
    <div>
      <PageHeader
        title="Users / Staff"
        description="Manage instructors, staff, administrators, schedulers, pay, and invitations."
      />
      <UsersTable
        users={users}
        positions={lookups.positions}
        locations={lookups.locations}
        departments={lookups.departments}
        canManage={actor.permissions.includes("users.manage")}
        currencyCode={lookups.organizationSettings.currencyCode}
      />
    </div>
  );
}
