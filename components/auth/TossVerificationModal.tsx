'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Shield, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { ITossCertResponse, ITossCertVerifyResult } from '@/types'

interface TossVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type VerificationStatus = 'initial' | 'loading' | 'waiting' | 'success' | 'error' | 'duplicate'

export function TossVerificationModal({ isOpen, onClose, onSuccess }: TossVerificationModalProps) {
  const [status, setStatus] = useState<VerificationStatus>('initial')
  const [error, setError] = useState<string>('')
  const [txId, setTxId] = useState<string>('')
  const [authUrl, setAuthUrl] = useState<string>('')
  const [polling, setPolling] = useState(false)

  const resetModal = () => {
    setStatus('initial')
    setError('')
    setTxId('')
    setAuthUrl('')
    setPolling(false)
  }

  const handleClose = () => {
    if (polling) {
      setPolling(false)
    }
    resetModal()
    onClose()
  }

  const handleTossVerification = async () => {
    try {
      setStatus('loading')
      setError('')

      const response = await fetch('/api/auth/toss-cert/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (response.status === 429) {
        setError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')
        setStatus('error')
        return
      }

      if (!response.ok) {
        throw new Error('인증 요청에 실패했습니다.')
      }

      const data: ITossCertResponse = await response.json()
      
      setTxId(data.txId)
      setAuthUrl(data.authUrl)
      setStatus('waiting')
      
      // 폴링 시작
      startPolling(data.txId)
      
    } catch (error) {
      console.error('Toss verification error:', error)
      setError(error instanceof Error ? error.message : '인증 요청 중 오류가 발생했습니다.')
      setStatus('error')
    }
  }

  const startPolling = (txId: string) => {
    setPolling(true)
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/auth/toss-cert/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId }),
        })

        if (response.status === 429) {
          // Rate limit - 더 긴 간격으로 재시도
          clearInterval(pollInterval)
          setTimeout(() => startPolling(txId), 10000)
          return
        }

        if (!response.ok) {
          throw new Error('인증 상태 확인에 실패했습니다.')
        }

        const data: ITossCertVerifyResult = await response.json()

        if (data.status === 'SUCCESS') {
          clearInterval(pollInterval)
          setPolling(false)
          setStatus('success')
          
          // 2초 후 성공 콜백 실행
          setTimeout(() => {
            handleClose()
            onSuccess()
          }, 2000)
        } else if (data.status === 'FAILED') {
          clearInterval(pollInterval)
          setPolling(false)
          
          if (data.error === 'DUPLICATE_CI') {
            setStatus('duplicate')
          } else {
            setError(data.message || '인증에 실패했습니다.')
            setStatus('error')
          }
        }
        // PENDING인 경우 계속 폴링
        
      } catch (error) {
        console.error('Polling error:', error)
        // 에러 시에도 계속 폴링 (네트워크 일시적 문제일 수 있음)
      }
    }, 3000) // 3초마다 폴링

    // 10분 후 타임아웃
    setTimeout(() => {
      clearInterval(pollInterval)
      if (polling) {
        setPolling(false)
        setError('인증 시간이 초과되었습니다. 다시 시도해주세요.')
        setStatus('error')
      }
    }, 10 * 60 * 1000)
  }

  const openTossAuth = () => {
    if (authUrl) {
      window.open(authUrl, '_blank', 'width=400,height=600')
    }
  }

  // 모달이 열릴 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      resetModal()
    }
  }, [isOpen])

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">토스 인증을 준비하고 있습니다...</p>
          </div>
        )

      case 'waiting':
        return (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center">
                <Shield className="h-12 w-12 text-blue-600" />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold">토스에서 본인인증을 완료해주세요</h3>
                <p className="text-sm text-gray-600">
                  새 창에서 토스 인증이 진행됩니다.<br />
                  인증 완료 후 자동으로 결과가 반영됩니다.
                </p>
              </div>

              <Button 
                onClick={openTossAuth} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                토스 인증 창 열기
              </Button>

              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>인증 완료를 기다리고 있습니다...</span>
              </div>
            </div>
          </div>
        )

      case 'success':
        return (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
            <div className="space-y-2">
              <h3 className="font-semibold text-green-700">본인인증 완료!</h3>
              <p className="text-sm text-gray-600">
                토스를 통한 본인인증이 성공적으로 완료되었습니다.<br />
                잠시 후 자동으로 닫힙니다.
              </p>
            </div>
          </div>
        )

      case 'duplicate':
        return (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <XCircle className="w-16 h-16 mx-auto text-red-500" />
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
              <Button 
                onClick={() => window.location.href = '/sign-in'} 
                className="flex-1"
              >
                로그인하기
              </Button>
            </div>
          </div>
        )

      case 'error':
        return (
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleClose}>
                닫기
              </Button>
              <Button onClick={() => setStatus('initial')}>
                다시 시도
              </Button>
            </div>
          </div>
        )

      default:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Shield className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-semibold mb-2">토스 본인인증</h3>
              <p className="text-gray-600 text-sm mb-4">
                안전한 서비스 이용을 위해<br />
                토스를 통한 본인인증을 진행해주세요.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">토스 간편인증 안내</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 토스 앱이 설치되어 있어야 합니다</li>
                <li>• 본인 명의의 휴대폰으로 인증해주세요</li>
                <li>• 새 창에서 인증이 진행됩니다</li>
                <li>• 인증 완료 후 자동으로 결과가 반영됩니다</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={status === 'loading'}
              >
                취소
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleTossVerification}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    준비 중...
                  </>
                ) : (
                  '토스로 인증하기'
                )}
              </Button>
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className={status === 'initial' ? '' : 'sr-only'}>
          <DialogTitle>토스 본인인증</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
