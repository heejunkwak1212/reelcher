'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/hooks/use-toast'
import { Loader2, Shield, Smartphone, QrCode } from 'lucide-react'
import { TossVerificationModal } from './TossVerificationModal'
import { supabaseBrowser } from '@/lib/supabase/client'

interface VerificationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface CertificationResponse {
  tx_id: string
  app_link: string
  qr_code_url: string
}

export function VerificationModal({ isOpen, onClose, onSuccess }: VerificationModalProps) {
  const [step, setStep] = useState<'info' | 'loading' | 'waiting' | 'success' | 'duplicate'>('info')
  const [txId, setTxId] = useState('')
  const [certData, setCertData] = useState<CertificationResponse | null>(null)
  const [polling, setPolling] = useState(false)
  const [showTossModal, setShowTossModal] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const { setIsVerified } = useAuthStore()

  const resetModal = () => {
    setStep('info')
    setTxId('')
    setCertData(null)
    setPolling(false)
    setShowTossModal(false)
  }

  const handleClose = () => {
    if (polling) {
      setPolling(false)
    }
    resetModal()
    onClose()
  }

  const handleStartVerification = async () => {
    setStep('loading')

    // Admin 계정은 본인인증 우회
    if (isAdmin) {
      setIsVerified(true)
      setStep('success')
      
      toast({
        title: '관리자 계정 확인',
        description: '관리자 계정으로 본인인증이 자동 완료되었습니다.',
      })

      // Auto close and call success callback after 2 seconds
      setTimeout(() => {
        handleClose()
        onSuccess()
      }, 2000)
      return
    }

    // 일반 사용자는 본인인증 기능 준비 중 메시지
    toast({
      title: '준비 중인 기능',
      description: '본인인증 기능은 현재 준비 중입니다. 관리자에게 문의해주세요.',
      variant: 'destructive',
    })
    setStep('info')
  }

  // startPolling 함수는 더 이상 사용하지 않음 (API 구현 필요)

  const openKakaoApp = () => {
    if (certData?.app_link) {
      window.open(certData.app_link, '_blank')
    }
  }

  const handleLoginRedirect = () => {
    handleClose()
    window.location.href = '/auth/sign-in'
  }

  // Check if user is admin and reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetModal()
      checkAdminStatus()
    }
  }, [isOpen])

  const checkAdminStatus = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        
        setIsAdmin(profile?.role === 'admin')
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            본인인증
          </DialogTitle>
        </DialogHeader>

        {step === 'info' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 space-y-2">
              <p>• 1인 1계정 원칙 및 서비스 보안을 위해 본인인증이 필요합니다.</p>
              <p>• 무료 크레딧 사용 및 유료 플랜 구독 시 최초 1회만 진행됩니다.</p>
              <p>• 카카오톡 앱을 통해 간편하게 인증할 수 있습니다.</p>
            </div>
            


            <div className="space-y-3">
              <div className="flex gap-2">
                <Button onClick={handleStartVerification} className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black">
                  카카오로 인증하기
                </Button>
                {/* 토스 인증 - 비용 문제로 임시 비활성화 (향후 활성화 가능)
                <Button onClick={() => setShowTossModal(true)} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  토스로 인증하기
                </Button>
                */}
              </div>
              <Button variant="outline" onClick={handleClose} className="w-full">
                취소
              </Button>
            </div>
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center space-y-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600">인증 요청을 준비하고 있습니다...</p>
          </div>
        )}

        {step === 'waiting' && (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-4">
                <Smartphone className="h-8 w-8 text-green-600" />
                <QrCode className="h-8 w-8 text-blue-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold">카카오톡에서 본인인증을 완료해주세요</h3>
                <p className="text-sm text-gray-600">
                  모바일: 카카오톡 앱 자동 실행<br />
                  PC: QR 코드로 스캔하여 인증
                </p>
              </div>

              {certData?.qr_code_url && (
                <div className="flex justify-center">
                  <img 
                    src={certData.qr_code_url} 
                    alt="QR Code" 
                    className="w-48 h-48 border rounded-lg"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={openKakaoApp} className="flex-1">
                  <Smartphone className="h-4 w-4 mr-2" />
                  카카오톡 앱 열기
                </Button>
              </div>

              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>인증 완료를 기다리고 있습니다...</span>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center space-y-4 py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Shield className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-green-700">본인인증 완료!</h3>
              <p className="text-sm text-gray-600">
                본인인증이 성공적으로 완료되었습니다.<br />
                잠시 후 자동으로 닫힙니다.
              </p>
            </div>
          </div>
        )}

        {step === 'duplicate' && (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Shield className="h-8 w-8 text-red-600" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-red-700">인증 실패</h3>
                <p className="text-sm text-gray-600">
                  이미 동일한 명의로 등록된 계정이 존재합니다.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                취소
              </Button>
              <Button onClick={handleLoginRedirect} className="flex-1">
                로그인하기
              </Button>
            </div>
          </div>
        )}

        <TossVerificationModal
          isOpen={showTossModal}
          onClose={() => setShowTossModal(false)}
          onSuccess={() => {
            setShowTossModal(false)
            setIsVerified(true)
            handleClose()
            onSuccess()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}


