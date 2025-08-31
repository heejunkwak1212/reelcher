"use client";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  History,
  CreditCard,
  Settings,
  LogOut,
  Search,
  BarChart3,
  Shield,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { CaretSortIcon } from "@radix-ui/react-icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { relcherAlert } from './relcher-dialog';

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

interface DashboardSidebarProps {
  user?: any;
  plan?: string;
  balance?: number;
  onSidebarChange?: (isCollapsed: boolean) => void;
  isAdmin?: boolean;
}

export function DashboardSidebar({ user, plan = 'free', balance = 0, onSidebarChange, isAdmin = false }: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  
  // 플랜별 크레딧 정보
  const planLimits = {
    free: 250,
    starter: 2000,
    pro: 7000,
    business: 20000
  }
  
  const totalCredits = planLimits[plan as keyof typeof planLimits] || 250
  const usedCredits = totalCredits - balance
  const usagePercentage = Math.min((usedCredits / totalCredits) * 100, 100)
  
  const planDisplayNames = {
    free: 'FREE 플랜 적용중',
    starter: 'STARTER 플랜 적용중',
    pro: 'PRO 플랜 적용중',
    business: 'BUSINESS 플랜 적용중'
  }
  
  const handleExpand = () => {
    setIsCollapsed(false);
    onSidebarChange?.(false);
  };
  
  const handleCollapse = () => {
    setIsCollapsed(true);
    onSidebarChange?.(true);
  };

  const handleLogout = async () => {
    try {
      const { performCompleteLogout } = await import('@/lib/auth-utils');
      const result = await performCompleteLogout();
      if (result.success) {
        router.push('/');
        router.refresh();
      } else {
        console.error('로그아웃 실패:', result.error);
        await relcherAlert('로그아웃 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('로그아웃 함수 호출 오류:', error);
      await relcherAlert('로그아웃 중 오류가 발생했습니다.');
    }
  };
  
  return (
    <motion.div
      className={cn(
        "sidebar fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] shrink-0 border-r"
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
            {/* 사용자 프로필 섹션 */}
            <div className="flex h-[54px] w-full shrink-0 border-b border-gray-200 p-2">
              <div className="mt-[1.5px] flex w-full">
                <div className="flex w-full items-center gap-2 px-2 py-1">
                  <Avatar className="w-4 h-4 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                      {user?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <motion.div variants={variants}>
                    {!isCollapsed && (
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user?.display_name || user?.email || '사용자'}
                      </p>
                    )}
                  </motion.div>
                </div>
              </div>
            </div>



            {/* 네비게이션 메뉴 */}
            <div className="flex h-full w-full flex-col">
              <div className="flex grow flex-col gap-4">
                <ScrollArea className="h-16 grow p-2">
                  <div className={cn("flex w-full flex-col gap-1")}>
                    <Link
                      href="/search"
                      prefetch={true}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                        pathname?.includes("search") && "bg-gray-100 text-gray-900",
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
                      href="/dashboard"
                      prefetch={true}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                        pathname === "/dashboard" && "bg-gray-100 text-gray-900",
                      )}
                    >
                      <BarChart3 className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && (
                          <p className="ml-2 text-sm font-medium">대시보드</p>
                        )}
                      </motion.li>
                    </Link>

                    <Separator className="w-full my-2 opacity-30" />

                    <Link
                      href="/dashboard/history"
                      prefetch={true}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                        pathname?.includes("history") && "bg-gray-100 text-gray-900",
                      )}
                    >
                      <History className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && (
                          <p className="ml-2 text-sm font-medium">검색 이력</p>
                        )}
                      </motion.li>
                    </Link>
                    
                    <Link
                      href="/dashboard/billing"
                      prefetch={true}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                        pathname?.includes("billing") && "bg-gray-100 text-gray-900",
                      )}
                    >
                      <CreditCard className="h-4 w-4" />
                      <motion.li variants={variants}>
                        {!isCollapsed && (
                          <p className="ml-2 text-sm font-medium">구독 관리</p>
                        )}
                      </motion.li>
                    </Link>

                    {/* 플랜 정보 카드 */}
                    <motion.div variants={variants}>
                      {!isCollapsed && (
                        <div className="mx-2 mt-3 mb-4">
                          <div className="rounded-lg bg-gray-50 border p-3 space-y-3">
                            <div className="text-sm font-semibold text-gray-900">
                              {planDisplayNames[plan as keyof typeof planDisplayNames] || 'FREE 플랜 적용중'}
                            </div>
                            
                            <div className="space-y-2">
                              <Progress 
                                value={usagePercentage} 
                                className="h-2"
                              />
                              <div className="text-xs text-gray-600 text-right">
                                {usedCredits.toLocaleString()}/{totalCredits.toLocaleString()}
                              </div>
                            </div>
                            
                            <Link href="/pricing" className="block">
                              <button className="w-full py-2 px-3 text-xs bg-black text-white rounded-md hover:bg-gray-800 transition-colors">
                                업그레이드
                              </button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* 관리자 페이지 링크 (관리자만 보임) */}
                    {isAdmin && (
                      <Link
                        href="/admin"
                        prefetch={true}
                        className={cn(
                          "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                          pathname?.includes("admin") && "bg-gray-100 text-gray-900",
                        )}
                      >
                        <Shield className="h-4 w-4" />
                        <motion.li variants={variants}>
                          {!isCollapsed && (
                            <p className="ml-2 text-sm font-medium">관리자 페이지</p>
                          )}
                        </motion.li>
                      </Link>
                    )}
                  </div>
                </ScrollArea>
              </div>
              
              {/* 하단 정보 및 계정 */}
              <div className="flex flex-col p-2 space-y-2">
                {/* 설정 링크 */}
                <Link
                  href="/dashboard/settings"
                  prefetch={true}
                  className={cn(
                    "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900",
                    pathname?.includes("settings") && "bg-gray-100 text-gray-900",
                  )}
                >
                  <Settings className="h-4 w-4" />
                  <motion.li variants={variants}>
                    {!isCollapsed && (
                      <p className="ml-2 text-sm font-medium">설정</p>
                    )}
                  </motion.li>
                </Link>

                {/* 플랜/크레딧 정보 */}
                <motion.div 
                  variants={variants}
                  className="bg-gray-50 rounded-lg p-2"
                >
                  {!isCollapsed && (
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">플랜</span>
                        <span className="font-medium capitalize">{isAdmin ? 'admin' : plan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">잔액</span>
                        <span className="font-semibold">{balance.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* 계정 드롭다운 */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="w-full">
                    <div className="flex h-8 w-full flex-row items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-gray-100 hover:text-gray-900">
                      <Avatar className="size-4">
                        <AvatarFallback>
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <motion.li
                        variants={variants}
                        className="flex w-full items-center gap-2"
                      >
                        {!isCollapsed && (
                          <>
                            <p className="text-sm font-medium">계정</p>
                            <CaretSortIcon className="ml-auto h-4 w-4 text-gray-400" />
                          </>
                        )}
                      </motion.li>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" sideOffset={15}>
                    <div className="flex flex-row items-center gap-2 p-2">
                      <Avatar className="size-6">
                        <AvatarFallback>
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-medium">
                          {user?.email || '사용자'}
                        </span>
                        <span className="line-clamp-1 text-xs text-gray-500 capitalize">
                          {isAdmin ? 'ADMIN' : plan.toUpperCase()} 플랜
                        </span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="flex items-center gap-2">
                      <Link href="/dashboard/settings" prefetch={true}>
                        <Settings className="h-4 w-4" /> 설정
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="flex items-center gap-2">
                      <Link href="/dashboard/billing" prefetch={true}>
                        <CreditCard className="h-4 w-4" /> 구독/충전
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

                {/* 독립적인 로그아웃 버튼 */}
                <button
                  onClick={handleLogout}
                  className="flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-red-50 hover:text-red-600 text-red-500"
                >
                  <LogOut className="h-4 w-4" />
                  <motion.div variants={variants}>
                    {!isCollapsed && (
                      <p className="ml-2 text-sm font-medium">로그아웃</p>
                    )}
                  </motion.div>
                </button>
              </div>
            </div>
          </div>
        </motion.ul>
      </motion.div>
    </motion.div>
  );
}
