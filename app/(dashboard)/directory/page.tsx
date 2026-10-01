import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { requireSession } from "@/lib/auth/session";
import { getLookups, listUsers } from "@/lib/db/users";
import { readWorkforceState } from "@/lib/db/workforce";
import { isManager } from "@/lib/permissions";
import { fullName, initials } from "@/lib/utils";

export default async function DirectoryPage() {
  const user = await requireSession();
  const state = await readWorkforceState();
  const people = isManager(user.roles) ? await listUsers() : state.profiles;
  const lookups = await getLookups();

  return (
    <div>
      <PageHeader title="Directory" description="Find CAL ACE instructors and staff." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => (
          <Card key={person.id}>
            <CardContent className="flex items-center gap-3 p-4">
              <Avatar>
                <AvatarFallback>{initials(person.firstName, person.lastName)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{fullName(person.firstName, person.lastName)}</p>
                <p className="text-sm text-muted-foreground">{person.email}</p>
                <p className="text-xs text-muted-foreground">
                  {lookups.positions.find((item) => item.id === person.positionId)?.name}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
