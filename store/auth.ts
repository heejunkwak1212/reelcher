import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isVerified: boolean
  phoneNumber: string | null
  setIsVerified: (verified: boolean) => void
  setVerificationStatus: (verified: boolean, phoneNumber?: string | null) => void
  clearVerification: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isVerified: false,
      phoneNumber: null,
      setIsVerified: (verified: boolean) => set({ isVerified: verified }),
      setVerificationStatus: (verified: boolean, phoneNumber?: string | null) =>
        set({ isVerified: verified, phoneNumber: phoneNumber || null }),
      clearVerification: () => set({ isVerified: false, phoneNumber: null }),
    }),
    {
      name: 'auth-verification',
      partialize: (state) => ({ 
        isVerified: state.isVerified, 
        phoneNumber: state.phoneNumber 
      }),
    }
  )
)


