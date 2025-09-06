import { Suspense } from 'react'
import MarketingConsentList from '@/app/(app)/admin/marketing/MarketingConsentList'

export default async function AdminMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">마케팅 수신동의 사용자</h1>
        <p className="text-gray-600 mt-2">
          마케팅 정보 수신에 동의한 사용자 목록입니다.
        </p>
      </div>

      <Suspense fallback={<div>로딩 중...</div>}>
        <MarketingConsentList searchParams={params} />
      </Suspense>
    </div>
  )
}
