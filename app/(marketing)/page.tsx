import Link from 'next/link'

export default function MarketingPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">릴처: 인스타 릴스 분석 SaaS</h1>
        <p className="mt-4 text-neutral-600">가성비 최강의 릴스 벤치마킹. 조회수/팔로워/캡션까지 한 번에.</p>
        <div className="mt-8 flex gap-3">
          <Link href="/sign-in" className="px-4 py-2 rounded bg-black text-white">시작하기</Link>
          <Link href="/search-test" className="px-4 py-2 rounded border">데모 보기</Link>
        </div>
      </section>
    </main>
  )
}


