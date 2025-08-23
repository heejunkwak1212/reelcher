'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'

export default function VerifyPage() {
  const router = useRouter()

  const handleContinue = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">본인인증</h1>
            <p className="text-gray-600 text-sm">
              안전한 서비스 이용을 위해<br />
              본인인증을 완료해주세요.
            </p>
          </div>

          {/* 비활성화 메시지 */}
          <div className="text-center mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="font-semibold text-yellow-800 mb-2">본인인증 일시 비활성화</p>
            <p className="text-sm text-yellow-700 leading-relaxed">
              서비스 초기 단계로 인해 본인인증 기능이 일시적으로 비활성화되어 있습니다.<br />
              향후 서비스 안정화 후 카카오/토스 본인인증을 제공할 예정입니다.
            </p>
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            className="w-full h-12 bg-black hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
          >
            대시보드로 이동
          </Button>
        </div>
      </div>
    </div>
  )
}