"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserFormDrawer } from "@/components/users/user-form-drawer";
import type { Department, Location, Position, Profile } from "@/types";

export function UserProfileEditor({
  user,
  positions,
  departments,
  locations,
}: {
  user: Profile;
  positions: Position[];
  departments: Department[];
  locations: Location[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit</Button>
      <UserFormDrawer
        open={open}
        onOpenChange={setOpen}
        user={user}
        positions={positions}
        departments={departments}
        locations={locations}
        title="Edit user"
        description="Update profile, role, and weekly hour limits."
      />
    </>
  );
}
