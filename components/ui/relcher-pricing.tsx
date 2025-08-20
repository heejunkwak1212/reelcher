"use client";

import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import Link from "next/link";
import { useState, useRef } from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import { VerificationModal } from '@/components/auth/VerificationModal';
import { useAuthStore } from '@/store/auth';

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
  
  // 본인인증 관련 상태
  const { isVerified } = useAuthStore();
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<'starter' | 'pro' | 'business' | null>(null);

  // 본인인증 확인 후 토스페이 호출 함수
  const checkVerificationAndOpenToss = (plan: 'starter' | 'pro' | 'business') => {
    if (!isVerified) {
      setPendingPlan(plan);
      setShowVerificationModal(true);
      return;
    }
    openToss(plan);
  };

  // 본인인증 성공 시 실행될 함수
  const handleVerificationSuccess = () => {
    setShowVerificationModal(false);
    if (pendingPlan) {
      openToss(pendingPlan);
      setPendingPlan(null);
    }
  };

  // 본인인증 모달 닫기 함수
  const handleVerificationClose = () => {
    setShowVerificationModal(false);
    setPendingPlan(null);
  };

  // 토스페이 호출 함수
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
          s.src = 'https://js.tosspayments.com/v1';
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
      const customerKey = me?.id || 'user';
      const tossPayments = anyWin.TossPayments(clientKey);
      const origin = window.location.origin;
      // Redirect flow: Toss 결제창 → successUrl(우리)로 돌아오면 authKey를 받아 서버에서 billingKey 발급
      await tossPayments.requestBillingAuth('카드', {
        customerKey,
        successUrl: `${origin}/toss/billing/return?plan=${plan}`,
        failUrl: `${origin}/toss/fail`
      });
    } catch (e) {
      console.error(e);
      alert('결제창 호출에 실패했습니다');
    }
  };

  // 플랜 정보 - PRD.MD 기준으로 수정 가능
  const plans: PricingPlan[] = [
    {
      name: "FREE", // 플랜명
      price: "0", // 월간 가격
      yearlyPrice: "0", // 연간 가격
      period: "month", // 기간
      features: [
        "월 250 크레딧", // 기능 1 - PRD.MD 기준
        "30개 검색 결과", // 기능 2
        "기본 분석 도구", // 기능 3
        "커뮤니티 지원", // 기능 4
      ],
      description: "개인 사용자를 위한 기본 플랜", // 설명
      buttonText: "무료로 시작하기", // 버튼 텍스트
      href: "/sign-in", // 링크
      isPopular: false, // 인기 여부
    },
    {
      name: "STARTER", // 플랜명
      price: "19000", // 월간 가격 (원화) - PRD.MD 기준
      yearlyPrice: "182400", // 연간 가격 (원화) - 20% 할인 적용 (19000*12*0.8)
      period: "month", // 기간
      features: [
        "월 2,000 크레딧", // 기능 1 - PRD.MD 기준
        "60개 검색 결과", // 기능 2
        "고급 분석 도구", // 기능 3
        "이메일 지원", // 기능 4
        "다중 키워드 검색", // 기능 5
      ],
      description: "소규모 비즈니스를 위한 완벽한 시작", // 설명
      buttonText: "STARTER 시작하기", // 버튼 텍스트
      href: "#", // 토스페이 연결을 위한 임시 링크
      isPopular: false, // 인기 여부
    },
    {
      name: "PRO", // 플랜명
      price: "49000", // 월간 가격 (원화) - PRD.MD 기준
      yearlyPrice: "470400", // 연간 가격 (원화) - 20% 할인 적용 (49000*12*0.8)
      period: "month", // 기간
      features: [
        "월 7,000 크레딧", // 기능 1 - PRD.MD 기준
        "90개 검색 결과", // 기능 2
        "프리미엄 분석 도구", // 기능 3
        "우선 지원", // 기능 4
        "고급 필터링", // 기능 5
        "자막 추출 기능", // 기능 6
      ],
      description: "성장하는 비즈니스를 위한 최적의 선택", // 설명
      buttonText: "PRO 시작하기", // 버튼 텍스트
      href: "#", // 토스페이 연결을 위한 임시 링크
      isPopular: true, // 인기 여부 - 추천 플랜
    },
    {
      name: "BUSINESS", // 플랜명
      price: "119000", // 월간 가격 (원화) - PRD.MD 기준
      yearlyPrice: "1142400", // 연간 가격 (원화) - 20% 할인 적용 (119000*12*0.8)
      period: "month", // 기간
      features: [
        "월 20,000 크레딧", // 기능 1 - PRD.MD 기준
        "120개 검색 결과", // 기능 2
        "전체 분석 도구", // 기능 3
        "24/7 전담 지원", // 기능 4
        "팀 협업 기능", // 기능 5
        "API 접근", // 기능 6
        "맞춤형 리포트", // 기능 7
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
              
              <div className="mt-6 flex items-center justify-center gap-x-1">
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
                    / {isMonthly ? "월" : "년"}
                  </span>
                )}
              </div>

              {plan.price !== "0" && (
                <p className="text-xs leading-5 text-muted-foreground mt-1">
                  {isMonthly ? "월간 결제" : "연간 결제"}
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
                {plan.name === "FREE" ? (
                  <Link
                    href="/sign-in"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full group-hover:scale-105 transition-transform duration-200",
                      "transform-gpu ring-offset-current transition-all duration-300 ease-out hover:ring-2 hover:ring-primary hover:ring-offset-1",
                      "bg-background text-foreground hover:bg-primary hover:text-primary-foreground"
                    )}
                  >
                    {plan.buttonText}
                  </Link>
                ) : (
                  <button
                    onClick={() => checkVerificationAndOpenToss(plan.name.toLowerCase() as 'starter' | 'pro' | 'business')}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full group-hover:scale-105 transition-transform duration-200",
                      "transform-gpu ring-offset-current transition-all duration-300 ease-out hover:ring-2 hover:ring-primary hover:ring-offset-1",
                      plan.isPopular
                        ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                        : "bg-background text-foreground border-border hover:bg-primary hover:text-primary-foreground hover:border-primary"
                    )}
                  >
                    {plan.buttonText}
                  </button>
                )}
                
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {plan.description}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* 본인인증 모달 */}
      <VerificationModal
        isOpen={showVerificationModal}
        onClose={handleVerificationClose}
        onSuccess={handleVerificationSuccess}
      />
    </div>
  );
}
