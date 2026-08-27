import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";
import { GroupsPanel } from "@/components/GroupsPanel";
import { EmptyState } from "@/components/ui/primitives";
import { SectionTitle, IconGroups, IconBell } from "@/components/ui/icons";

export default async function GroupsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");

  const myUsername = user.profile.username.toLowerCase();
  const myEmail = user.email.toLowerCase();

  const [memberships, invites, notifications] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId: user.id },
      include: { group: { include: { _count: { select: { members: true } } } } },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.groupInvite.findMany({
      where: { status: "pending", inviteeRef: { in: [myUsername, myEmail, user.profile.username, user.email] } },
      include: { group: { select: { name: true } }, invitedBy: { select: { profile: { select: { displayName: true } } } } },
    }),
    prisma.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <>
      <TopBar />
      <SectionTitle as="h1" icon={IconGroups}>Groups</SectionTitle>
      <p className="muted small">Private crews with a members-only leaderboard.</p>

      {notifications.map((n) => (
        <div key={n.id} className="banner info row" style={{ gap: 8 }}>
          <IconBell className="i-accent" size={16} strokeWidth={2.25} aria-hidden />
          <span>{n.body}</span>
        </div>
      ))}

      <GroupsPanel
        invites={invites.map((i) => ({
          id: i.id,
          groupName: i.group.name,
          fromName: i.invitedBy.profile?.displayName ?? "Someone",
        }))}
      />

      <h2>Your groups</h2>
      {memberships.length === 0 ? (
        <EmptyState icon={IconGroups} title="No groups yet">
          <p className="muted small">Create one above or join with a code from a friend.</p>
        </EmptyState>
      ) : (
        <div className="card">
          {memberships.map((m) => (
            <Link key={m.id} href={`/groups/${m.groupId}`} className="list-item">
              <div className="grow">
                <h3 style={{ margin: 0 }}>{m.group.name}</h3>
                <span className="ti-meta">{m.group._count.members} members{m.role === "owner" ? " · owner" : ""}</span>
              </div>
              <span className="pill">Open →</span>
            </Link>
          ))}
        </div>
      )}

      <TabBar isAdmin={user.isAdmin} />
    </>
  );
}
