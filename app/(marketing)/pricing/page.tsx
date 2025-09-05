import { RelcherPricing } from '@/components/ui/relcher-pricing'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata.pricing

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <RelcherPricing 
        title="릴처 요금제"
      />
    </main>
  )
}


