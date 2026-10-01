"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { InviteUserDrawer } from "@/components/users/user-form-drawer";
import { deactivateUserAction } from "@/app/actions/workforce";
import { roleLabel, type AppRole } from "@/lib/permissions";
import { fullName, initials } from "@/lib/utils";
import type { Department, Location, Position, Profile } from "@/types";

export function UsersTable({
  users,
  positions,
  locations,
  departments,
  canManage,
  currencyCode,
}: {
  users: Profile[];
  positions: Position[];
  locations: Location[];
  departments: Department[];
  canManage: boolean;
  currencyCode: string;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "instructor" | "staff">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter(
      (user) =>
        (typeFilter === "all" || user.employeeType === typeFilter) &&
        `${user.firstName} ${user.lastName} ${user.email} ${user.phone ?? ""}`
          .toLowerCase()
          .includes(q),
    );
  }, [query, typeFilter, users]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employees"
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-border bg-card p-1">
          {(["all", "instructor", "staff"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                typeFilter === type ? "bg-primary text-white" : "text-muted-foreground"
              }`}
            >
              {type === "all" ? "All" : `${type}s`}
            </button>
          ))}
        </div>
        {canManage ? (
          <Button type="button" data-testid="add-employee-button" onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Employee Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Hourly Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onClick={() => router.push(`/users/${user.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {initials(user.firstName, user.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {fullName(user.firstName, user.lastName)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="capitalize">{user.employeeType}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.phone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {roleLabel(user.roles[0] as AppRole)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {positions.find((item) => item.id === user.positionId)?.name ?? "—"}
                </TableCell>
                <TableCell>
                  {locations.find((item) => item.id === user.primaryLocationId)?.name ?? "—"}
                </TableCell>
                <TableCell>
                  {user.payType === "hourly" && user.hourlyRate !== null
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: currencyCode,
                      }).format(user.hourlyRate)
                    : "Salary"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={user.employmentStatus} />
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/users/${user.id}`}>View</Link>
                      </DropdownMenuItem>
                      {canManage ? (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href={`/users/${user.id}?edit=1`}>Edit</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                const result = await deactivateUserAction(user.id);
                                if ("error" in result && result.error) toast.error(result.error);
                                else toast.success("User deactivated");
                              })
                            }
                          >
                            Deactivate
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <InviteUserDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        positions={positions}
        departments={departments}
        locations={locations}
      />
    </div>
  );
}
