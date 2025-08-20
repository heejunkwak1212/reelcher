'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { VerificationModal } from '@/components/auth/VerificationModal'
import { TossVerificationModal } from '@/components/auth/TossVerificationModal'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/hooks/use-toast'
import { Shield } from 'lucide-react'

export default function VerifyPage() {
  const router = useRouter()
  const { setIsVerified } = useAuthStore()
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [showTossModal, setShowTossModal] = useState(false)

  const handleKakaoVerification = () => {
    setShowVerificationModal(true)
  }

  const handleTossVerification = () => {
    setShowTossModal(true)
  }

  const handleSkipVerification = () => {
    router.push('/dashboard')
  }

  const handleVerificationSuccess = () => {
    setShowVerificationModal(false)
    setIsVerified(true)
    toast({
      title: '본인인증 완료',
      description: '안전하게 서비스를 이용하실 수 있습니다',
    })
    router.push('/dashboard')
  }

  const handleVerificationClose = () => {
    setShowVerificationModal(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-full mb-6">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">본인인증</h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              안전한 서비스 이용을 위해
              <br />
              본인인증을 완료해주세요.
            </p>
          </div>

          {/* Verification Buttons */}
          <div className="space-y-3 mb-8">
            <Button
              onClick={handleKakaoVerification}
              className="w-full h-12 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
              </svg>
              카카오로 인증하기
            </Button>
            
            {/* 토스 인증 - 비용 문제로 임시 비활성화 (향후 활성화 가능)
            <Button
              onClick={handleTossVerification}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              토스로 인증하기
            </Button>
            */}
          </div>

          {/* Skip Button */}
          <div className="text-center">
            <Button
              onClick={handleSkipVerification}
              variant="ghost"
              className="text-gray-500 hover:text-gray-700 font-medium"
            >
              다음에 하기
            </Button>
          </div>
        </div>
      </div>

      {/* Verification Modals */}
      <VerificationModal
        isOpen={showVerificationModal}
        onClose={handleVerificationClose}
        onSuccess={handleVerificationSuccess}
      />
      
      <TossVerificationModal
        isOpen={showTossModal}
        onClose={() => setShowTossModal(false)}
        onSuccess={() => {
          setShowTossModal(false)
          setIsVerified(true)
          toast({
            title: '본인인증 완료',
            description: '토스를 통한 본인인증이 완료되었습니다',
          })
          router.push('/dashboard')
        }}
      />
    </div>
  )
}