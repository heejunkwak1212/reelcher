"use client";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import {
  BarChart3,
  Users,
  Search,
  Coins,
  CreditCard,
  LogOut,
  Settings,
  Home,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { CaretSortIcon } from "@radix-ui/react-icons";
import { performCompleteLogout } from "@/lib/auth-utils";

const sidebarVariants = {
  open: {
    width: "15rem",
  },
  closed: {
    width: "3.05rem",
  },
};

const contentVariants = {
  open: { display: "block", opacity: 1 },
  closed: { display: "block", opacity: 1 },
};

const variants = {
  open: {
    x: 0,
    opacity: 1,
    transition: {
      x: { stiffness: 1000, velocity: -100 },
    },
  },
  closed: {
    x: -20,
    opacity: 0,
    transition: {
      x: { stiffness: 100 },
    },
  },
};

const transitionProps = {
  type: "tween" as const,
  ease: "easeOut" as const,
  duration: 0.2,
};

const staggerVariants = {
  open: {
    transition: { staggerChildren: 0.03, delayChildren: 0.02 },
  },
};

interface AdminSidebarProps {
  user?: any;
  onSidebarChange?: (isCollapsed: boolean) => void;
}

export function AdminSidebar({ user, onSidebarChange }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  
  const handleLogout = async () => {
    try {
      await performCompleteLogout()
      router.push('/sign-in')
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  };
  
  const handleExpand = () => {
    setIsCollapsed(false);
    onSidebarChange?.(false);
  };
  
  const handleCollapse = () => {
    setIsCollapsed(true);
    onSidebarChange?.(true);
  };
  
  return (
    <motion.div
      className={cn(
        "sidebar fixed left-0 z-40 h-full shrink-0 border-r"
      )}
      initial={isCollapsed ? "closed" : "open"}
      animate={isCollapsed ? "closed" : "open"}
      variants={sidebarVariants}
      transition={transitionProps}
      onMouseEnter={handleExpand}
      onMouseLeave={handleCollapse}
    >
      <motion.div
        className={`relative z-40 flex text-muted-foreground h-full shrink-0 flex-col bg-white transition-all`}
        variants={contentVariants}
      >
        <motion.ul variants={staggerVariants} className="flex h-full flex-col">
          <div className="flex grow flex-col items-center">
            {/* 브랜드/로고 섹션 */}
            <div className="flex h-[54px] w-full shrink-0 border-b border-gray-200 p-2">
              <div className="mt-[1.5px] flex w-full">
                <Link
                  href="/"
                  prefetch={true}
                  className="flex w-full items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded-md"
                >
                  <Avatar className="w-4 h-4 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-red-100 text-red-600">
                      {user?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <motion.div variants={variants}>
                    {!isCollapsed && (
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user?.display_name || user?.email || '관리자'}
                      </p>
                    )}
                  </motion.div>
                </Link>
              </div>
            </div>

            {/* 네비게이션 메뉴 */}
            <div className="flex h-full w-full flex-col">
              <div className="flex grow flex-col gap-4">
                <ScrollArea className="h-16 grow p-2">
                  <div className={cn("flex w-full flex-col gap-1")}>
                    <Link
                      href="/admin"
                      prefetch={true}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                        pathname === "/admin" && "bg-gray-100 text-gray-900",
                      )}
                    >
                      <BarChart3 className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && (
                          <p className="ml-2 text-sm font-medium">요약</p>
                        )}
                      </motion.li>
                    </Link>
                    
                    <Link
                      href="/admin/users"
                      prefetch={true}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                        pathname?.includes("users") && "bg-gray-100 text-gray-900",
                      )}
                    >
                      <Users className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && (
                          <p className="ml-2 text-sm font-medium">사용자</p>
                        )}
                      </motion.li>
                    </Link>
                    
                    <Link
                      href="/admin/searches"
                      prefetch={true}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                        pathname?.includes("searches") && "bg-gray-100 text-gray-900",
                      )}
                    >
                      <Search className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && (
                          <p className="ml-2 text-sm font-medium">검색</p>
                        )}
                      </motion.li>
                    </Link>
                    
                    <Link
                      href="/admin/credits"
                      prefetch={true}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                        pathname?.includes("credits") && "bg-gray-100 text-gray-900",
                      )}
                    >
                      <Coins className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && (
                          <p className="ml-2 text-sm font-medium">크레딧</p>
                        )}
                      </motion.li>
                    </Link>
                    
                    <Link
                      href="/admin/payments"
                      prefetch={true}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                        pathname?.includes("payments") && "bg-gray-100 text-gray-900",
                      )}
                    >
                      <CreditCard className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && (
                          <p className="ml-2 text-sm font-medium">결제</p>
                        )}
                      </motion.li>
                    </Link>

                    <Separator className="w-full my-2" />

                    <Link
                      href="/dashboard"
                      prefetch={true}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                      )}
                    >
                      <Home className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && (
                          <p className="ml-2 text-sm font-medium">사용자 대시보드</p>
                        )}
                      </motion.li>
                    </Link>
                  </div>
                </ScrollArea>
              </div>
              
              {/* 하단 관리자 정보 */}
              <div className="flex flex-col p-2 space-y-2">
                {/* 관리자 정보 */}
                <motion.div 
                  variants={variants}
                  className="bg-red-50 rounded-lg p-2"
                >
                  {!isCollapsed && (
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-red-500">권한</span>
                        <span className="font-medium text-red-600">관리자</span>
                      </div>
                      <div className="text-red-500 text-xs">전체 시스템 관리</div>
                    </div>
                  )}
                </motion.div>

                {/* 계정 드롭다운 */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="w-full">
                    <div className="flex h-8 w-full flex-row items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900">
                      <Avatar className="size-4">
                        <AvatarFallback className="bg-red-100 text-red-600">
                          {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <motion.li
                        variants={variants}
                        className="flex w-full items-center gap-2"
                      >
                        {!isCollapsed && (
                          <>
                            <p className="text-sm font-medium">관리자</p>
                            <CaretSortIcon className="ml-auto h-4 w-4 text-gray-400" />
                          </>
                        )}
                      </motion.li>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" sideOffset={15}>
                    <div className="flex flex-row items-center gap-2 p-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="bg-red-100 text-red-600">
                          {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-medium">
                          {user?.email || '관리자'}
                        </span>
                        <span className="line-clamp-1 text-xs text-red-500">
                          시스템 관리자
                        </span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="flex items-center gap-2">
                      <Link href="/dashboard" prefetch={true}>
                        <Home className="h-4 w-4" /> 사용자 대시보드
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="flex items-center gap-2 text-red-600 cursor-pointer"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" /> 로그아웃
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </motion.ul>
      </motion.div>
    </motion.div>
  );
}
