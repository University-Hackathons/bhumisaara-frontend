"use client"

import * as React from "react"
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
  SquareTerminal,
  User
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/context/AuthContext"
import { getNavGroupsForRole, ICONS_MAP } from "@/lib/navigation"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import logo from "@/app/public/logo.svg"
import { useLanguage } from "@/context/LanguageContext"
import { useApiList } from "@/hooks/use-api-resource"
import axiosInstance from "@/utils/axiosInstance"

interface NotificationItem { id: number; kind: string; message: string; targetUrl: string | null; readAt: string | null }

function AppLogo() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="hover:bg-transparent pointer-events-none data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-transparent">
            <Image src={logo} alt="BhumiSaara" className="size-full object-contain" priority />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-bold text-lg text-primary">BhumiSaara</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

interface NavMenuItem {
  title: string
  url: string
  icon?: React.ElementType
  isActive?: boolean
}

interface NavMenuGroup {
  id: string
  label: string
  items: NavMenuItem[]
}

/**
 * One SidebarGroup per functional section. The headings collapse away on their
 * own in icon mode (SidebarGroupLabel fades and pulls itself up), so grouping
 * costs nothing when the sidebar is narrowed.
 */
function NavMain({ groups }: { groups: NavMenuGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.id}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  isActive={item.isActive}
                  tooltip={item.title}
                  render={<Link href={item.url} className="flex items-center gap-2" />}
                >
                  {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}

function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const { logout } = useAuth()
  const { t } = useLanguage()
  const notifications = useApiList<NotificationItem>(["notifications"], "/notifications", { refetchInterval: 30000 })
  const unread = notifications.data.filter((item) => !item.readAt).length

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            />
          }>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-muted bg-secondary overflow-hidden">
              <User className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-muted bg-secondary overflow-hidden">
                    <User className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer">
                <BadgeCheck className="mr-2 h-4 w-4" />
                {t("Profile")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="mr-2 h-4 w-4" />
                {t("Notifications")} {unread > 0 ? `(${unread})` : ""}
              </DropdownMenuItem>
              <div className="max-h-60 overflow-y-auto px-2" aria-label={t("Notifications")}>
                {notifications.data.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No notifications yet.</p>}
                {notifications.data.map((item) => <button key={item.id} type="button"
                  className={`block w-full rounded px-2 py-2 text-left text-xs hover:bg-muted ${item.readAt ? "text-muted-foreground" : "font-semibold"}`}
                  onClick={async () => {
                    await axiosInstance.post(`/notifications/${item.id}/read`);
                    await notifications.refetch();
                    if (item.targetUrl?.startsWith("/")) router.push(item.targetUrl);
                  }}>{item.message}</button>)}
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => {
                logout();
                router.push('/auth');
              }}>
                <LogOut className="mr-2 h-4 w-4" />
                {t("Log out")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const pathname = usePathname()

  const navGroups = getNavGroupsForRole(user?.role).map((group) => ({
    id: group.id,
    label: t(group.label),
    items: group.items.map((item) => ({
      title: t(item.label),
      url: item.href,
      icon: ICONS_MAP[item.id] ?? SquareTerminal,
      // Matching on a bare `startsWith` lit up every item whose href is a
      // prefix of another's — /officer-distribution stayed highlighted while
      // /officer-distribution-history was open. Requiring the trailing slash
      // keeps a nested route active without bleeding across sibling routes.
      isActive: pathname === item.href || pathname.startsWith(`${item.href}/`),
    })),
  }))

  const navUser = user ? {
    name: user.username || "User",
    email: user.email || "user@example.com",
    avatar: "https://assets.aceternity.com/manu.png"
  } : {
    name: "Guest",
    email: "guest@example.com",
    avatar: ""
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <AppLogo />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
