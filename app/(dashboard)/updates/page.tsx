import { AcknowledgeButton, AnnouncementForm } from "@/components/phase5/forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhase5Context } from "@/lib/db/phase5";
import { visibleAnnouncements } from "@/lib/phase5/domain";
import { fullName } from "@/lib/utils";

export default async function UpdatesPage() {
  const { user, state } = await getPhase5Context();
  const profile = state.profiles.find((item) => item.id === user.id);
  const feed = profile ? visibleAnnouncements(state.announcements, profile) : [];
  return (
    <div className="space-y-6">
      <PageHeader title="Company updates" description="Internal announcements with audience filtering." />
      {user.permissions.includes("notifications.manage") ? (
        <Card>
          <CardHeader><CardTitle>Publish</CardTitle></CardHeader>
          <CardContent><AnnouncementForm /></CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3">
        {feed.map((item) => {
          const ack = state.announcementAcknowledgements.find((row) => row.announcementId === item.id && row.userId === user.id);
          const author = state.profiles.find((row) => row.id === item.createdBy);
          return (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{item.message}</p>
                <p className="text-muted-foreground">
                  {item.priority} · {item.publishAt.slice(0, 10)} · {author ? fullName(author.firstName, author.lastName) : "Admin"}
                </p>
                {item.requireAcknowledgement && !ack?.acknowledgedAt ? <AcknowledgeButton id={item.id} /> : <p className="text-xs text-muted-foreground">{ack?.acknowledgedAt ? "Acknowledged" : "No acknowledgement required"}</p>}
              </CardContent>
            </Card>
          );
        })}
        {feed.length === 0 ? <p className="text-sm text-muted-foreground">No updates for your audience.</p> : null}
      </div>
      {user.permissions.includes("notifications.manage") ? (
        <Card>
          <CardHeader><CardTitle>Acknowledgement report</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto text-sm">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="py-2">Employee</th>
                  <th>Announcement</th>
                  <th>Viewed</th>
                  <th>Acknowledged</th>
                  <th>Acknowledged at</th>
                </tr>
              </thead>
              <tbody>
                {state.announcements.flatMap((announcement) =>
                  state.profiles.map((person) => {
                    const ack = state.announcementAcknowledgements.find(
                      (row) => row.announcementId === announcement.id && row.userId === person.id,
                    );
                    if (!announcement.requireAcknowledgement && !ack) return null;
                    return (
                      <tr key={`${announcement.id}-${person.id}`} className="border-t border-border">
                        <td className="py-2">{fullName(person.firstName, person.lastName)}</td>
                        <td>{announcement.title}</td>
                        <td>{ack?.viewedAt ? "Yes" : "No"}</td>
                        <td>{ack?.acknowledgedAt ? "Yes" : "No"}</td>
                        <td>{ack?.acknowledgedAt?.slice(0, 16) ?? "—"}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
