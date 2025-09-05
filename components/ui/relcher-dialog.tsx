'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RelcherDialogProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  type: 'alert' | 'confirm'
  onConfirm?: () => void
  onCancel?: () => void
}

export function RelcherDialog({ isOpen, onClose, title, message, type, onConfirm, onCancel }: RelcherDialogProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isOpen) return null

  const handleConfirm = () => {
    onConfirm?.()
    onClose()
  }

  const handleCancel = () => {
    onCancel?.()
    onClose()
  }

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={handleCancel}
      />
      
      {/* 다이얼로그 */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in fade-in-0 zoom-in-95 duration-200">
        {/* 헤더 */}
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
            <button
              onClick={handleCancel}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}
        
        {/* 콘텐츠 */}
        <div className={`p-6 ${!title ? 'pt-8' : ''}`}>
          {!title && (
            <div className="flex justify-end mb-4">
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}
          
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            {message}
          </p>
          
          {/* 버튼들 */}
          <div className={`flex gap-3 ${type === 'confirm' ? 'justify-end' : 'justify-center'}`}>
            {type === 'confirm' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="text-sm border-gray-300 hover:bg-gray-50"
              >
                취소
              </Button>
            )}
            
            <Button
              size="sm"
              onClick={type === 'confirm' ? handleConfirm : handleCancel}
              className="text-sm bg-black text-white hover:bg-gray-800"
            >
              {type === 'confirm' ? '확인' : '확인'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

// 전역 함수들
let currentDialog: {
  setIsOpen: (open: boolean) => void
  setConfig: (config: Omit<RelcherDialogProps, 'isOpen' | 'onClose'>) => void
} | null = null

export function RelcherDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<Omit<RelcherDialogProps, 'isOpen' | 'onClose'>>({
    message: '',
    type: 'alert'
  })

  useEffect(() => {
    currentDialog = { setIsOpen, setConfig }
    return () => {
      currentDialog = null
    }
  }, [])

  return (
    <>
      {children}
      <RelcherDialog
        {...config}
        isOpen={isOpen}
        onClose={() => {
          // 다이얼로그가 닫힐 때 onCancel 호출 (ESC, 외부 클릭 등)
          if (config.onCancel) {
            config.onCancel()
          }
          setIsOpen(false)
        }}
      />
    </>
  )
}

// 전역 헬퍼 함수들
export const relcherAlert = (message: string, title?: string): Promise<void> => {
  return new Promise((resolve) => {
    if (currentDialog) {
      currentDialog.setConfig({
        message,
        title,
        type: 'alert',
        onConfirm: () => resolve()
      })
      currentDialog.setIsOpen(true)
    } else {
      // fallback to browser alert
      alert(message)
      resolve()
    }
  })
}

export const relcherConfirm = (message: string, title?: string): Promise<boolean> => {
  return new Promise((resolve) => {
    console.log('🔔 relcherConfirm 시작:', message)
    
    if (currentDialog) {
      let isResolved = false
      
      const handleConfirm = () => {
        console.log('✅ handleConfirm 호출됨')
        if (!isResolved) {
          isResolved = true
          resolve(true)
        }
      }
      
      const handleCancel = () => {
        console.log('❌ handleCancel 호출됨')
        if (!isResolved) {
          isResolved = true
          resolve(false)
        }
      }
      
      currentDialog.setConfig({
        message,
        title,
        type: 'confirm',
        onConfirm: handleConfirm,
        onCancel: handleCancel
      })
      
      console.log('🚀 다이얼로그 열기')
      currentDialog.setIsOpen(true)
    } else {
      console.log('⚠️ currentDialog가 없음, 기본 confirm 사용')
      resolve(confirm(message))
    }
  })
}
