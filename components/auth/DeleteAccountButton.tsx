'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface DeleteAccountButtonProps {
  hasActiveSubscription?: boolean;
}

// 회원탈퇴 사유 옵션
const DELETE_REASONS = [
  '서비스를 더 이상 사용하지 않음',
  '원하는 기능이 부족함',
  '다른 서비스를 사용하게 됨',
  '직접 입력'
];

export default function DeleteAccountButton({ hasActiveSubscription }: DeleteAccountButtonProps) {
  const [step, setStep] = useState<'closed' | 'initial' | 'reason' | 'final'>('closed');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const resetState = () => {
    setStep('closed');
    setSelectedReason('');
    setCustomReason('');
    setIsLoading(false);
  };

  const handleInitialConfirm = () => {
    if (hasActiveSubscription) {
      // 유료 구독중인 경우 바로 최종 단계로 (구독 취소 버튼 포함)
      setStep('final');
    } else {
      // 무료 사용자는 사유 선택 단계로
      setStep('reason');
    }
  };

  const handleReasonConfirm = () => {
    if (!selectedReason) {
      toast.error('탈퇴 사유를 선택해주세요');
      return;
    }
    if (selectedReason === '직접 입력' && !customReason.trim()) {
      toast.error('탈퇴 사유를 입력해주세요');
      return;
    }
    setStep('final');
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    
    try {
      const reason = selectedReason === '직접 입력' ? customReason : selectedReason;
      
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.requiresCancellation) {
          toast.error(data.error);
          resetState();
          return;
        }
        throw new Error(data.error || '회원탈퇴에 실패했습니다');
      }

      toast.success('회원탈퇴가 완료되었습니다');
      
      // 홈페이지로 리다이렉트
      setTimeout(() => {
        router.push('/');
      }, 1000);
      
    } catch (error) {
      console.error('회원탈퇴 오류:', error);
      toast.error(error instanceof Error ? error.message : '회원탈퇴 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToBilling = () => {
    resetState();
    router.push('/dashboard/billing');
  };

  return (
    <Dialog open={step !== 'closed'} onOpenChange={(open) => !open && resetState()}>
      <DialogTrigger asChild>
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={() => setStep('initial')}
        >
          회원탈퇴
        </Button>
      </DialogTrigger>
      
      {/* 첫 번째 확인 단계 */}
      {step === 'initial' && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>회원탈퇴</DialogTitle>
            <DialogDescription className="space-y-3 text-sm">
              <p className="font-medium text-gray-900">
                정말 회원탈퇴를 하시겠어요?
              </p>
              <p className="text-gray-600">
                재가입 시 크레딧이 복구되지 않아요.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={resetState}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleInitialConfirm}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      {/* 사유 선택 단계 (무료 사용자만) */}
      {step === 'reason' && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>탈퇴 사유</DialogTitle>
            <DialogDescription>
              서비스 개선을 위해 탈퇴 사유를 알려주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {DELETE_REASONS.map((reason) => (
              <div key={reason} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={reason}
                  name="deleteReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <Label htmlFor={reason} className="flex-1 cursor-pointer">
                  {reason}
                </Label>
              </div>
            ))}
            
            {selectedReason === '직접 입력' && (
              <div className="mt-3">
                <Textarea
                  placeholder="탈퇴 사유를 입력해주세요"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  maxLength={200}
                  className="min-h-[80px]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {customReason.length}/200자
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStep('initial')}>
              이전
            </Button>
            <Button variant="destructive" onClick={handleReasonConfirm}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      {/* 최종 확인 단계 */}
      {step === 'final' && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>회원탈퇴</DialogTitle>
            <DialogDescription className="space-y-3 text-sm">
              {hasActiveSubscription ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="font-medium text-red-800">
                    현재 유료 플랜을 구독중이에요. 회원탈퇴를 위해선 먼저 구독 취소를 부탁드려요.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium text-gray-900">
                    정말 계정을 삭제하시겠어요?
                  </p>
                  <p className="text-gray-600">
                    회원탈퇴 시 모든 정보가 즉시 파기되며 복구가 어려워요.
                  </p>
                  <div className="p-3 bg-gray-50 border rounded-md">
                    <p className="text-xs text-gray-600">
                      삭제되는 정보: 검색 이력, 크레딧 정보, 결제 내역, 개인정보 등 모든 데이터
                    </p>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={hasActiveSubscription ? resetState : () => setStep('reason')}
              disabled={isLoading}
            >
              취소
            </Button>
            {hasActiveSubscription ? (
              <Button 
                variant="default" 
                onClick={handleGoToBilling}
                disabled={isLoading}
              >
                구독 취소하기
              </Button>
            ) : (
              <Button 
                variant="destructive" 
                onClick={handleDeleteAccount}
                disabled={isLoading}
              >
                {isLoading ? '처리중...' : '확인'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
