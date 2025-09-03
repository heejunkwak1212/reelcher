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
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CancelSubscriptionButtonProps {
  onCancelled?: () => void;
}

// 구독 취소 사유 옵션
const CANCEL_REASONS = [
  '가격이 부담스러움',
  '원하는 기능이 부족함',
  '사용 빈도가 낮아짐',
  '다른 서비스를 사용하게 됨',
  '직접 입력'
];

export default function CancelSubscriptionButton({ onCancelled }: CancelSubscriptionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleInitialCancel = () => {
    setIsOpen(false);
    setIsConfirmOpen(true);
  };

  const handleFinalCancel = async () => {
    if (!selectedReason) {
      toast.error('취소 사유를 선택해주세요');
      return;
    }
    if (selectedReason === '직접 입력' && !customReason.trim()) {
      toast.error('취소 사유를 입력해주세요');
      return;
    }

    setIsLoading(true);
    
    try {
      const reason = selectedReason === '직접 입력' ? customReason.trim() : selectedReason;
      
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '구독 취소에 실패했습니다');
      }

      // 환불 조건에 따른 다른 처리
      if (data.isEligibleForRefund) {
        // 환불 조건 충족 시 특별한 다이얼로그 표시
        setIsConfirmOpen(false);
        setSelectedReason('');
        setCustomReason('');
        
        // 환불 완료 다이얼로그를 별도로 표시
        toast.success(data.message);
        
        setTimeout(() => {
          onCancelled?.();
        }, 2000);
      } else {
        // 일반 구독 취소
        toast.success(data.message);
        
        if (data.hasUsedCredits || !data.isEligibleForRefund) {
          toast.info(`현재 플랜은 ${new Date(data.effectiveDate).toLocaleDateString()}까지 유지됩니다`);
        }
        
        setIsConfirmOpen(false);
        setSelectedReason('');
        setCustomReason('');
        onCancelled?.();
      }
      
    } catch (error) {
      console.error('구독 취소 오류:', error);
      toast.error(error instanceof Error ? error.message : '구독 취소 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 첫 번째 확인 다이얼로그 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50">
            구독 취소
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>구독 취소</DialogTitle>
            <DialogDescription>
              현재 플랜의 구독을 취소하시겠어요?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleInitialCancel}>
              구독 취소하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 두 번째 최종 확인 다이얼로그 */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>구독 취소 확인</DialogTitle>
            <DialogDescription className="space-y-3 text-sm">
              <p className="font-medium text-gray-900">
                유료 플랜 구독 중 크레딧 사용 이력이 있는 경우, 환불이 불가능하며 결제일로부터 30일 간 해당 플랜이 유지돼요.
              </p>
              <p className="text-gray-600">
                단, 자동 결제는 더이상 갱신되지 않아요.
              </p>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">취소 사유</Label>
              <div className="space-y-3">
                {CANCEL_REASONS.map((reason) => (
                  <div key={reason} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`cancel-${reason}`}
                      name="cancelReason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Label htmlFor={`cancel-${reason}`} className="flex-1 cursor-pointer text-sm">
                      {reason}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            {selectedReason === '직접 입력' && (
              <div>
                <Textarea
                  placeholder="구독을 취소하는 이유를 알려주세요"
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
            <Button 
              variant="outline" 
              onClick={() => {
                setIsConfirmOpen(false);
                setSelectedReason('');
                setCustomReason('');
              }}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleFinalCancel}
              disabled={isLoading}
            >
              {isLoading ? '처리중...' : '확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}