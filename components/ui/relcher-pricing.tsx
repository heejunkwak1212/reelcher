"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabaseBrowser } from '@/lib/supabase/client';

interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
}

interface RelcherPricingProps {
  title?: string;
  description?: string;
}

export function RelcherPricing({
  title = "투명한 맞춤형 가격",
  description = "당신에게 맞는 플랜을 선택하세요\n모든 플랜에는 플랫폼 접근, 검색 도구, 전담 지원이 포함됩니다.",
}: RelcherPricingProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  
  // 로그인 및 구독 상태 관리
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<'starter' | 'pro' | 'business' | null>(null);
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'upgrade' | 'downgrade' | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  // 로그인 및 Admin 상태 확인
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/me/subscription-status');
      if (response.ok) {
        const data = await response.json();
        setIsLoggedIn(data.isLoggedIn);
        setCurrentPlan(data.currentPlan);
        setHasActiveSubscription(data.hasActiveSubscription);
        
        // Admin 체크는 별도로 수행
        if (data.isLoggedIn) {
          try {
            const supabase = supabaseBrowser();
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
              .single();
            setIsAdmin(profile?.role === 'admin');
          } catch (adminError) {
            console.warn('Admin 체크 실패:', adminError);
            setIsAdmin(false);
          }
        }
      } else {
        setIsLoggedIn(false);
        setCurrentPlan('free');
        setHasActiveSubscription(false);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsLoggedIn(false);
      setCurrentPlan('free');
      setHasActiveSubscription(false);
      setIsAdmin(false);
    }
  };

  // 플랜 선택 핸들러
  const handlePlanSelection = (selectedPlan: 'free' | 'starter' | 'pro' | 'business') => {
    // 무료 플랜인 경우
    if (selectedPlan === 'free') {
      if (currentPlan === 'free') {
        // 이미 무료 플랜인 경우 로그인/회원가입으로 이동
        if (!isLoggedIn) {
          window.location.href = '/sign-in';
        } else {
          window.location.href = '/search';
        }
        return;
      } else {
        // 유료 플랜에서 무료 플랜으로 변경 시 구독 취소 확인
        setPendingPlan('free' as any);
        setConfirmAction('cancel');
        setShowConfirmModal(true);
        return;
      }
    }

    // 로그인되지 않은 경우
    if (!isLoggedIn) {
      setPendingPlan(selectedPlan);
      setShowLoginModal(true);
      return;
    }

    // 현재 플랜과 동일한 플랜 선택 시
    if (currentPlan === selectedPlan) {
      return; // 아무것도 하지 않음
    }

    // 무료 플랜에서 유료 플랜으로 전환 시 토스 카드 등록창 호출
    if (currentPlan === 'free') {
      openToss(selectedPlan);
      return;
    }

    // 플랜 비교를 위한 레벨 정의
    const planLevels = { free: 0, starter: 1, pro: 2, business: 3 };
    const currentLevel = planLevels[currentPlan as keyof typeof planLevels] || 0;
    const selectedLevel = planLevels[selectedPlan as keyof typeof planLevels];

    if (selectedLevel > currentLevel) {
      // 업그레이드
      setPendingPlan(selectedPlan);
      setConfirmAction('upgrade');
      setShowConfirmModal(true);
    } else if (selectedLevel < currentLevel) {
      // 다운그레이드
      setPendingPlan(selectedPlan);
      setConfirmAction('downgrade');
      setShowConfirmModal(true);
    }
  };

  // 모달 닫기 함수들
  const handleLoginModalClose = () => {
    setShowLoginModal(false);
    setPendingPlan(null);
  };

  const handleConfirmModalClose = () => {
    setShowConfirmModal(false);
    setPendingPlan(null);
    setConfirmAction(null);
  };

  // 로그인 페이지로 이동
  const handleLoginRedirect = () => {
    setShowLoginModal(false);
    window.location.href = '/sign-in';
  };

  // 확인 모달에서 확인 버튼 클릭 시
  const handleConfirmAction = async () => {
    if (confirmAction === 'cancel') {
      // 구독 취소 - billing 페이지로 이동
      setShowConfirmModal(false);
      window.location.href = '/dashboard/billing';
    } else if ((confirmAction === 'upgrade' || confirmAction === 'downgrade') && pendingPlan) {
      // 업그레이드/다운그레이드 처리 - 결제 확인 페이지로 이동
      setShowConfirmModal(false);

      // 유료 플랜에서 다른 유료 플랜으로 변경할 때는 결제 확인 페이지로 이동
      if (hasActiveSubscription) {
        // 사용자의 구독 정보를 조회하여 빌링키와 고객키를 가져옴
        try {
          const subscriptionResponse = await fetch('/api/me/subscription-status');
          if (subscriptionResponse.ok) {
            const subscriptionData = await subscriptionResponse.json();

            if (subscriptionData.subscription?.billingKey && subscriptionData.subscription?.customerKey) {
              // 결제 확인 페이지로 이동 (빌링키와 고객키 포함)
              window.location.href = `/toss/payment/confirm?upgrade=true&plan=${pendingPlan}&billingKey=${subscriptionData.subscription.billingKey}&customerKey=${subscriptionData.subscription.customerKey}`;
            } else {
              throw new Error('빌링키 정보를 찾을 수 없습니다');
            }
          } else {
            throw new Error('구독 정보를 가져올 수 없습니다');
          }
        } catch (error) {
          console.error('구독 정보 조회 실패:', error);
          alert('구독 정보를 확인하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        }
      } else {
        // 구독이 없는 경우 - 새로 카드등록 후 결제
        openToss(pendingPlan);
      }
    }
  };

  // 버튼 텍스트 결정 함수
  const getButtonText = (planName: string) => {
    if (!isLoggedIn) {
      return planName === 'FREE' ? '무료로 시작하기' : `${planName} 시작하기`;
    }

    if (currentPlan === planName.toLowerCase()) {
      return '현재 적용 중인 플랜';
    }

    const planLevels = { free: 0, starter: 1, pro: 2, business: 3 };
    const currentLevel = planLevels[currentPlan as keyof typeof planLevels] || 0;
    const targetLevel = planLevels[planName.toLowerCase() as keyof typeof planLevels];

    // 무료 플랜 사용중인 경우
    if (currentPlan === 'free') {
      if (planName === 'FREE') {
        return '무료로 시작하기';
      } else {
        return `${planName} 시작하기`;
      }
    }

    // 유료 플랜 사용중인 경우
    if (planName === 'FREE') {
      return '구독 취소하기';
    }

    if (targetLevel > currentLevel) {
      return `${planName} 업그레이드`;
    } else if (targetLevel < currentLevel) {
      return `${planName} 전환`;
    }

    return `${planName} 시작하기`;
  };

  // 토스페이 호출 함수 - 본인정보 입력을 포함한 빌링키 발급
  const openToss = async (plan: 'starter' | 'pro' | 'business') => {
    try {
      const anyWin = window as any;
      // SDK가 아직 window에 없으면 스크립트 동적 로드 후 재시도
      if (!anyWin?.TossPayments) {
        await new Promise<void>((resolve, reject) => {
          const id = 'toss-sdk';
          if (document.getElementById(id)) { 
            setTimeout(() => resolve(), 300); 
            return;
          }
          const s = document.createElement('script');
          s.id = id;
          s.src = 'https://js.tosspayments.com/v2/standard';
          s.async = true;
          s.defer = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('SDK load failed'));
          document.body.appendChild(s);
        });
      }
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) { 
        alert('NEXT_PUBLIC_TOSS_CLIENT_KEY가 설정되지 않았습니다'); 
        return;
      }
      
      const me = await fetch('/api/me', { cache: 'no-store' }).then(r => r.json());
      // 토스 공식 가이드 준수 - 사용자별 일관된 customerKey 사용
      const customerKey = me?.id ? `user_${me.id}` : `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      // V2 SDK 초기화 (토스 공식 가이드 준수)
      const tossPayments = anyWin.TossPayments(clientKey);
      const origin = window.location.origin;
      
      console.log('Starting billing auth with customerKey:', customerKey);
      console.log('TossPayments object:', tossPayments);
      
      // payment 인스턴스 생성 (V2 SDK 방식 - 빌링 전용)
      const payment = tossPayments.payment({
        customerKey: customerKey
      });
      
      // 빌링키 발급 요청 (카드 등록만, 실제 결제는 서버에서)
      await payment.requestBillingAuth({
        method: "CARD", // 자동결제(빌링)는 카드만 지원합니다
        successUrl: `${origin}/toss/billing/return?plan=${plan}&customerKey=${customerKey}`,
        failUrl: `${origin}/pricing?error=billing_failed&plan=${plan}`,
        customerEmail: me.email || "customer123@gmail.com",
        customerName: me.display_name || "김토스"
      });
    } catch (e) {
      console.error('Toss billing auth error:', e);
      alert('결제창 호출에 실패했습니다');
    }
  };

  // 플랜 정보 - PRD.MD 기준으로 수정 가능
  const plans: PricingPlan[] = [
    {
      name: "FREE", // 플랜명
      price: "0", // 월간 가격
      yearlyPrice: "0", // 연간시 월 요금
      period: "month", // 기간
      features: [
        "월 250 크레딧", // 기능 1 - PRD.MD 기준
        "최대 30개 검색 결과", // 기능 2
        "유튜브 고급 필터링",
        "엑셀 데이터 추출", // 기능 3
        "썸네일 & 영상 mp4 추출", // 기능 4
      ],
      description: "개인 사용자를 위한 기본 플랜", // 설명
      buttonText: "무료로 시작하기", // 버튼 텍스트
      href: "/sign-in", // 링크
      isPopular: false, // 인기 여부
    },
    {
      name: "STARTER", // 플랜명
      price: "19000", // 월간 가격 (원화) - PRD.MD 기준
      yearlyPrice: "15200", // 연간시 월 요금 (원화) - 20% 할인 적용 (19000*0.8)
      period: "month", // 기간
      features: [
        "월 2,000 크레딧",
        "FREE 플랜의 모든 기능", // 기능 1 - PRD.MD 기준
        "최대 60개 검색 결과", // 기능 2
        "자막 추출 기능",
      ],
      description: "소규모 비즈니스를 위한 완벽한 시작", // 설명
      buttonText: "STARTER 시작하기", // 버튼 텍스트
      href: "#", // 토스페이 연결을 위한 임시 링크
      isPopular: false, // 인기 여부
    },
    {
      name: "PRO", // 플랜명
      price: "49000", // 월간 가격 (원화) - PRD.MD 기준
      yearlyPrice: "39200", // 연간시 월 요금 (원화) - 20% 할인 적용 (49000*0.8)
      period: "month", // 기간
      features: [
        "월 7,000 크레딧",
        "STARTER 플랜의 모든 기능", // 기능 1 - PRD.MD 기준
        "최대 90개 검색 결과", // 기능 2 // 기능 6
      ],
      description: "성장하는 비즈니스를 위한 최적의 선택", // 설명
      buttonText: "PRO 시작하기", // 버튼 텍스트
      href: "#", // 토스페이 연결을 위한 임시 링크
      isPopular: true, // 인기 여부 - 추천 플랜
    },
    {
      name: "BUSINESS", // 플랜명
      price: "119000", // 월간 가격 (원화) - PRD.MD 기준
      yearlyPrice: "95200", // 연간시 월 요금 (원화) - 20% 할인 적용 (119000*0.8)
      period: "month", // 기간
      features: [
        "월 20,000 크레딧",
        "PRO 플랜의 모든 기능", // 기능 1 - PRD.MD 기준
        "최대 120개 검색 결과", // 기능 2
        "최우선 지원", // 기능 3 // 기능 4
      ],
      description: "대규모 팀과 기업을 위한 완전한 솔루션", // 설명
      buttonText: "BUSINESS 시작하기", // 버튼 텍스트
      href: "#", // 토스페이 연결을 위한 임시 링크
      isPopular: false, // 인기 여부
    },
  ];

  const handleToggle = (checked: boolean) => {
    setIsMonthly(!checked);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-20">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p className="text-muted-foreground text-base whitespace-pre-line">
          {description}
        </p>
      </div>

      <div className="flex justify-center mb-10">
        <div className="bg-white rounded-full p-3 shadow-2xl border-2 border-gray-300 backdrop-blur-sm">
          <div className="relative inline-flex items-center cursor-pointer">
            <span className={cn("mr-3 font-bold px-4 py-2 rounded-full transition-all duration-300 text-sm border", 
              isMonthly 
                ? "bg-primary text-primary-foreground shadow-xl transform scale-105 border-primary" 
                : "text-gray-700 hover:text-gray-900 border-gray-200 hover:border-gray-300"
            )}>월간</span>
            <Switch
              isSelected={!isMonthly}
              onChange={handleToggle}
              className="relative mx-3 shadow-lg scale-125 border border-gray-300 rounded-full"
            />
            <span className={cn("ml-3 font-bold px-4 py-2 rounded-full transition-all duration-300 text-sm border",
              !isMonthly 
                ? "bg-primary text-primary-foreground shadow-xl transform scale-105 border-primary" 
                : "text-gray-700 hover:text-gray-900 border-gray-200 hover:border-gray-300"
            )}>
              연간 <span className={cn(!isMonthly ? "text-primary-foreground opacity-90" : "text-orange-600 font-semibold")}>(20% 할인)</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1 max-w-7xl mx-auto">
        {plans.map((plan, index) => (
          <motion.div
            key={index}
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.6,
              delay: index * 0.1,
              ease: "easeOut",
            }}
            whileHover={{
              y: -8,
              scale: 1.02,
              transition: { duration: 0.3, ease: "easeOut" }
            }}
            className={cn(
              "rounded-xl border p-4 bg-background text-center flex flex-col relative group",
              "transition-all duration-300 ease-out",
              // 향상된 그림자 애니메이션 효과
              "shadow-sm hover:shadow-2xl hover:shadow-gray-300/60",
              "transform-gpu will-change-transform",
              plan.isPopular 
                ? "border-primary border-2 shadow-lg shadow-primary/30 hover:shadow-primary/40" 
                : "border-border hover:border-primary/60 hover:shadow-gray-400/40",
              plan.isPopular && "transform scale-105",
              // 최대 너비 제한으로 박스를 얇게 만들기
              "max-w-64 w-full mx-auto"
            )}
          >
            {plan.isPopular && (
              <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-primary py-2 px-4 rounded-full flex items-center z-10 shadow-lg">
                <Star className="text-primary-foreground h-4 w-4 fill-current mr-1" />
                <span className="text-primary-foreground text-sm font-semibold">
                  추천
                </span>
              </div>
            )}
            
            <div className="flex-1 flex flex-col">
              <p className={cn("text-lg font-bold text-foreground mb-2", 
                plan.isPopular ? "mt-10" : "mt-2"
              )}>
                {plan.name}
              </p>
              
              <div className="mt-6 flex flex-col items-center justify-center">
                {/* 연간 선택시 기존 월 요금에 취소선 표시 */}
                {!isMonthly && plan.price !== "0" && (
                  <div className="text-lg font-medium text-gray-500 mb-1" style={{ textDecoration: 'line-through' }}>
                    ₩{Number(plan.price).toLocaleString()}
                  </div>
                )}
                
                <div className="flex items-center gap-x-1">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {isMonthly 
                      ? plan.price === "0" 
                        ? "무료" 
                        : `${Number(plan.price).toLocaleString()}원`
                      : plan.yearlyPrice === "0"
                        ? "무료"
                        : `${Number(plan.yearlyPrice).toLocaleString()}원`
                    }
                  </span>
                  {plan.price !== "0" && (
                    <span className="text-sm font-semibold leading-6 tracking-wide text-muted-foreground">
                      / 월
                    </span>
                  )}
                </div>
              </div>

              {plan.price !== "0" && (
                <p className="text-xs leading-5 text-muted-foreground mt-1">
                  {isMonthly ? "월간 결제" : "연간 결제 (월 단위 요금)"}
                </p>
              )}

              <ul className="mt-6 gap-3 flex flex-col text-left">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckIcon className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-4">
                <button
                  onClick={() => handlePlanSelection(plan.name.toLowerCase() as 'free' | 'starter' | 'pro' | 'business')}
                  disabled={isLoggedIn && currentPlan === plan.name.toLowerCase()}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full group-hover:scale-105 transition-transform duration-200",
                    "transform-gpu ring-offset-current transition-all duration-300 ease-out hover:ring-2 hover:ring-primary hover:ring-offset-1",
                    // 현재 플랜인 경우 스타일 변경
                    isLoggedIn && currentPlan === plan.name.toLowerCase()
                      ? "bg-gray-100 text-gray-600 border-gray-300 cursor-not-allowed hover:bg-gray-100 hover:text-gray-600"
                      : plan.isPopular
                        ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                        : "bg-background text-foreground border-border hover:bg-primary hover:text-primary-foreground hover:border-primary"
                  )}
                >
                  {getButtonText(plan.name)}
                </button>
                
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {plan.description}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* 로그인 필요 안내 모달 */}
      <Dialog open={showLoginModal} onOpenChange={handleLoginModalClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">로그인이 필요한 서비스예요</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-center text-gray-600">
              플랜을 구독하려면 먼저 로그인해주세요.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleLoginModalClose}
                className="flex-1"
              >
                취소
              </Button>
              <Button 
                onClick={handleLoginRedirect}
                className="flex-1"
              >
                로그인
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 플랜 변경 확인 모달 */}
      <Dialog open={showConfirmModal} onOpenChange={handleConfirmModalClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              {confirmAction === 'cancel' && '구독 취소'}
              {confirmAction === 'upgrade' && '플랜 업그레이드'}
              {confirmAction === 'downgrade' && '플랜 전환'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {confirmAction === 'cancel' && (
              <>
                <p className="text-center text-gray-600">
                  현재 <span className="font-medium">{currentPlan.toUpperCase()}</span> 플랜을 구독 중이에요. 구독을 취소하시겠어요?
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleConfirmModalClose}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button 
                    onClick={handleConfirmAction}
                    className="flex-1"
                  >
                    구독 취소하기
                  </Button>
                </div>
              </>
            )}
            
            {confirmAction === 'upgrade' && pendingPlan && (
              <>
                <p className="text-center text-gray-600">
                  현재 <span className="font-medium">{currentPlan.toUpperCase()}</span> 플랜을 구독 중이에요. <span className="font-medium">{pendingPlan.toUpperCase()}</span> 플랜으로 업그레이드하시겠어요?
                </p>
                <p className="text-center text-sm text-gray-500">
                  총 {
                    pendingPlan === 'starter' ? '2,000' :
                    pendingPlan === 'pro' ? '7,000' :
                    pendingPlan === 'business' ? '20,000' : ''
                  } 크레딧이 즉시 새로 지급돼요.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleConfirmModalClose}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button 
                    onClick={handleConfirmAction}
                    className="flex-1"
                  >
                    업그레이드
                  </Button>
                </div>
              </>
            )}

            {confirmAction === 'downgrade' && pendingPlan && (
              <>
                <p className="text-center text-gray-600">
                  현재 <span className="font-medium">{currentPlan.toUpperCase()}</span> 플랜을 구독 중이에요. <span className="font-medium">{pendingPlan.toUpperCase()}</span> 플랜으로 전환하시겠어요?
                </p>
                <p className="text-center text-sm text-gray-500">
                  총 {
                    pendingPlan === 'starter' ? '2,000' :
                    pendingPlan === 'pro' ? '7,000' :
                    pendingPlan === 'business' ? '20,000' : ''
                  } 크레딧이 즉시 새로 지급돼요.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleConfirmModalClose}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button 
                    onClick={handleConfirmAction}
                    className="flex-1"
                  >
                    확인
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
