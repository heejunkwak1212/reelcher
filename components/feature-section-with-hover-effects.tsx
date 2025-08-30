import { cn } from "@/lib/utils";
import {
  IconAdjustmentsBolt,
  IconCloud,
  IconCurrencyDollar,
  IconEaseInOut,
  IconHeart,
  IconHelp,
  IconRouteAltLeft,
  IconTerminal2,
} from "@tabler/icons-react";

export function FeaturesSectionWithHoverEffects() {
  const features = [
    {
      title: "유튜브",
      description: "세부 검색 필터를 통해 입력한 키워드에서 가장 인기 있는 영상을 찾아드려요. 각종 업로드 시간과 제목, 썸네일까지 바로 체크할 수 있어요.",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
    },
    {
      title: "인스타그램 · 틱톡",
      description: "키워드와 관련된 영상을 리스트업하거나 원하는 계정을 검색해 해당 계정의 터진 콘텐츠와 주요 지표를 한 눈에 확인하고 대본까지 추출할 수 있어요.",
      icon: (
        <div className="flex items-center gap-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-1.032-.083 6.411 6.411 0 0 0-6.41 6.41 6.411 6.411 0 0 0 6.41 6.41 6.411 6.411 0 0 0 6.41-6.41V9.054a8.05 8.05 0 0 0 4.6 1.432v-3.4a4.751 4.751 0 0 1-.745-.4z"/>
          </svg>
        </div>
      ),
    },
    {
      title: "데이터 추출 및 활용",
      description: "검색 결과 속 모든 데이터를 정리된 엑셀 파일로 받아볼 수 있어요. 벤치마킹하고 싶은 콘텐츠의 썸네일과 영상(mp4) 파일 또한 바로 추출 가능해요.",
      icon: <IconCloud />,
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 relative z-10 py-10 max-w-6xl mx-auto">
      {features.map((feature, index) => (
        <Feature key={feature.title} {...feature} index={index} />
      ))}
    </div>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col py-10 relative group/feature border-neutral-200",
        index === 0 && "md:border-r",
        index === 1 && "md:border-r md:border-l",
        index === 2 && "md:border-l"
      )}
    >
      <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 to-transparent pointer-events-none" />
      
      {/* 아이콘과 타이틀을 한 줄에 배치 */}
      <div className={`relative z-10 px-10 mb-4 flex items-center ${index === 1 ? 'gap-1' : 'gap-2'}`}>
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 group-hover/feature:bg-black transition-all duration-200 origin-center" />
        <div className="text-neutral-600 group-hover/feature:translate-x-2 transition duration-200">
          {icon}
        </div>
        <span 
          className="group-hover/feature:translate-x-2 group-hover/feature:font-semibold transition-all duration-200 inline-block"
          style={{
            fontSize: 'var(--title-6-size)',
            lineHeight: 'var(--title-6-line-height)',
            letterSpacing: 'var(--title-6-letter-spacing)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-primary)'
          }}
        >
          {title}
        </span>
      </div>
      
      <p 
        className="relative z-10 px-10 group-hover/feature:text-gray-600 group-hover/feature:font-medium transition-all duration-200"
        style={{
          fontSize: 'var(--text-regular-size)',
          lineHeight: 'var(--text-regular-line-height)',
          letterSpacing: 'var(--text-regular-letter-spacing)',
          color: 'var(--color-text-tertiary)',
          fontWeight: '400'
        }}
      >
        {description}
      </p>
    </div>
  );
};
