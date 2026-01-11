import {
  BookOpen,
  Clock,
  Code2,
  FileCheck,
  FileText,
  History,
  LayoutDashboard,
  List,
  Play,
  Trophy,
  Users,
} from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PinProtection from "@/components/auth/pin-protection";
import AppHeader from "@/components/common/app-header";
import AppSidebar, {
  type MenuItem,
  type SidebarSection,
} from "@/components/common/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";

const mainItems: MenuItem[] = [
  {
    icon: <LayoutDashboard className="h-4 w-4" />,
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    icon: <FileText className="h-4 w-4" />,
    label: "Exams",
    defaultOpen: true,
    submenu: [
      {
        icon: <List className="h-4 w-4" />,
        label: "All Exams",
        href: "/exams",
      },
      {
        icon: <Play className="h-4 w-4" />,
        label: "Ongoing Exams",
        href: "/exams?status=ongoing",
      },
      {
        icon: <Clock className="h-4 w-4" />,
        label: "Upcoming Exams",
        href: "/exams?status=upcoming",
      },
      {
        icon: <History className="h-4 w-4" />,
        label: "Completed Exams",
        href: "/exams?status=completed",
      },
    ],
  },
  {
    icon: <BookOpen className="h-4 w-4" />,
    label: "Collections",
    href: "/collections",
  },
  {
    icon: <Code2 className="h-4 w-4" />,
    label: "Problems",
    href: "/problems",
  },
];

const mainSection: SidebarSection = {
  label: "Main",
  items: mainItems,
};

const exploreItems: MenuItem[] = [
  {
    icon: <Trophy className="h-4 w-4" />,
    label: "Leaderboard",
    href: "/leaderboard",
  },
  {
    icon: <BookOpen className="h-4 w-4" />,
    label: "Resources",
    href: "/resources",
  },
];

const exploreSection: SidebarSection = {
  label: "Explore",
  items: exploreItems,
};

const adminItems: MenuItem[] = [
  {
    icon: <Users className="h-4 w-4" />,
    label: "Users",
    href: "/users",
  },
  {
    icon: <Users className="h-4 w-4" />,
    label: "User Groups",
    href: "/user-groups",
  },
  {
    icon: <FileCheck className="h-4 w-4" />,
    label: "Submissions",
    href: "/submissions",
  },
];

const adminSection: SidebarSection = {
  label: "Admin",
  items: adminItems,
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  const role = session.user.role;

  // Define logic for sidebar sections based on role while preserving order
  const filteredMainItems = mainItems.filter((item) => {
    if (item.label === "Dashboard") return true;
    if (item.label === "Exams") return true;
    if (item.label === "Collections") return role === "instructor";
    return false; // 'Problems' is hidden for all roles
  });

  const filteredExploreItems = exploreItems.filter(() => {
    return role !== "admin"; // Students and Faculty see Leaderboard and Resources
  });

  const filteredAdminItems = adminItems.filter((item) => {
    // Admins and Instructors can see Submissions
    if (item.label === "Submissions")
      return role === "admin" || role === "instructor";
    // Only Admins see User Management
    return role === "admin";
  });

  const sections: SidebarSection[] = [
    { label: mainSection.label, items: filteredMainItems },
    { label: exploreSection.label, items: filteredExploreItems },
    { label: adminSection.label, items: filteredAdminItems },
  ].filter((section) => section.items.length > 0);

  return (
    <PinProtection>
      <SidebarProvider>
        <main className="flex w-screen h-screen">
          <AppSidebar sections={sections} />
          <div className="w-full h-full py-2 pr-2 bg-sidebar">
            <div className="flex flex-col bg-background w-full h-full overflow-auto rounded-lg border-2">
              <AppHeader />
              {children}
            </div>
          </div>
        </main>
      </SidebarProvider>
    </PinProtection>
  );
}
