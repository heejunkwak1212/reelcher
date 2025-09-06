'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion } from "framer-motion"
import { useState, useEffect } from 'react'
import { GradualSpacing } from '@/components/ui/gradual-spacing'

interface RelcherHeroProps {
  user: any
}

export default function RelcherHero({ user }: RelcherHeroProps) {
  const [mouseGradientStyle, setMouseGradientStyle] = useState({
    left: '0px',
    top: '0px',
    opacity: 0,
  });
  const [ripples, setRipples] = useState<Array<{id: number, x: number, y: number}>>([]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseGradientStyle({
        left: `${e.clientX}px`,
        top: `${e.clientY}px`,
        opacity: 1,
      });
    };
    const handleMouseLeave = () => {
      setMouseGradientStyle(prev => ({ ...prev, opacity: 0 }));
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const newRipple = { id: Date.now(), x: e.clientX, y: e.clientY };
      setRipples(prev => [...prev, newRipple]);
      setTimeout(() => setRipples(prev => prev.filter(r => r.id !== newRipple.id)), 1000);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const pageStyles = `
    #mouse-gradient-hero {
      position: fixed;
      pointer-events: none;
      border-radius: 9999px;
      background-image: radial-gradient(circle, rgba(59, 130, 246, 0.03), rgba(99, 102, 241, 0.03), transparent 70%);
      transform: translate(-50%, -50%);
      will-change: left, top, opacity;
      transition: left 70ms linear, top 70ms linear, opacity 300ms ease-out;
      z-index: 5;
    }
    @keyframes word-appear { 
      0% { opacity: 0; transform: translateY(30px) scale(0.8); filter: blur(10px); } 
      50% { opacity: 0.8; transform: translateY(10px) scale(0.95); filter: blur(2px); } 
      100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } 
    }

    .word-animate { 
      display: inline-block; 
      opacity: 0; 
      margin: 0 0.1em; 
      transition: color 0.3s ease, transform 0.3s ease; 
    }
    .word-animate:hover { 
      color: #3A3B3F; 
      transform: translateY(-2px); 
    }
    .ripple-effect { 
      position: fixed; 
      width: 4px; 
      height: 4px; 
      background: rgba(59, 130, 246, 0.4); 
      border-radius: 50%; 
      transform: translate(-50%, -50%); 
      pointer-events: none; 
      animation: pulse-glow 1s ease-out forwards; 
      z-index: 9999; 
    }
    @keyframes pulse-glow { 
      0%, 100% { opacity: 0.1; transform: scale(1); } 
      50% { opacity: 0.3; transform: scale(1.1); } 
    }

    @keyframes grid-draw { 
      0% { stroke-dashoffset: 1000; opacity: 0; } 
      50% { opacity: 0.1; } 
      100% { stroke-dashoffset: 0; opacity: 0.05; } 
    }
    .grid-line { 
      stroke: #e5e7eb; 
      stroke-width: 0.5; 
      opacity: 0; 
      stroke-dasharray: 5 5; 
      stroke-dashoffset: 1000; 
      animation: grid-draw 2s ease-out forwards; 
    }
    .floating-element-animate { 
      position: absolute; 
      width: 3px; 
      height: 3px; 
      background: rgba(59, 130, 246, 0.4); 
      border-radius: 50%; 
      opacity: 0; 
      animation: float 4s ease-in-out infinite, word-appear 1s ease-out forwards; 
    }
    @keyframes float { 
      0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; } 
      25% { transform: translateY(-15px) translateX(8px); opacity: 0.7; } 
      50% { transform: translateY(-8px) translateX(-5px); opacity: 0.5; } 
      75% { transform: translateY(-20px) translateX(10px); opacity: 0.9; } 
    }
  `;

  return (
    <>
      <style>{pageStyles}</style>
    <div 
      className="relative min-h-[120vh] w-full flex items-center justify-center overflow-hidden bg-white"
      style={{
        paddingTop: '1rem',
        marginTop: '-6rem'
      }}
    >
      {/* Background Grid and Effects */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <pattern id="gridHeroLight" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(229, 231, 235, 0.3)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gridHeroLight)" />
        <line x1="0" y1="20%" x2="100%" y2="20%" className="grid-line" style={{ animationDelay: '0.5s' }} />
        <line x1="0" y1="80%" x2="100%" y2="80%" className="grid-line" style={{ animationDelay: '1s' }} />
        <line x1="20%" y1="0" x2="20%" y2="100%" className="grid-line" style={{ animationDelay: '1.5s' }} />
        <line x1="80%" y1="0" x2="80%" y2="100%" className="grid-line" style={{ animationDelay: '2s' }} />
      </svg>
      
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-transparent to-indigo-50/20" />
      
      {/* Floating Elements */}
      <div className="floating-element-animate" style={{ top: '25%', left: '15%', animationDelay: '0.5s' }}></div>
      <div className="floating-element-animate" style={{ top: '60%', left: '85%', animationDelay: '1s' }}></div>
      <div className="floating-element-animate" style={{ top: '40%', left: '10%', animationDelay: '1.5s' }}></div>
      <div className="floating-element-animate" style={{ top: '75%', left: '90%', animationDelay: '2s' }}></div>
      <div className="floating-element-animate" style={{ top: '20%', left: '80%', animationDelay: '2.5s' }}></div>
      <div className="floating-element-animate" style={{ top: '70%', left: '20%', animationDelay: '3s' }}></div>



      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="max-w-6xl mx-auto text-center">


          {/* SEO H1 태그 - 화면에는 숨김 */}
          <h1 className="sr-only">릴처: 릴스 검색 사이트 | 틱톡 유튜브 다운로드 - 인스타그램 릴스, 틱톡, 유튜브 쇼츠를 쉽게 검색하고 다운로드할 수 있는 사이트</h1>
          
          {/* Main Title with GradualSpacing */}
          <div className="space-y-6 md:space-y-10">
            <div style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif', color: '#3A3B3F' }}>
              <GradualSpacing
                text="Stop scrolling,"
                duration={0.3}
                delayMultiple={0.04}
                /* 크기 조절: text-3xl md:text-6xl lg:text-7xl (작게), text-4xl md:text-7xl lg:text-8xl (중간), text-5xl md:text-8xl lg:text-9xl (크게) */
                className="text-3xl md:text-6xl lg:text-7xl font-bold tracking-tighter"
              />
            </div>
            
            <div 
              style={{ 
                fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                fontWeight: 900,
              }}
            >
              <GradualSpacing
                text="Reelcher is here."
                duration={0.3}
                delayMultiple={0.04}
                /* 크기 조절: text-5xl md:text-7xl lg:text-8xl (작게), text-6xl md:text-8xl lg:text-9xl (중간), text-7xl md:text-9xl lg:text-10xl (크게) */
                className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-black"
              />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            <p className="mt-8 text-xl md:text-1xl font-medium text-gray-500 mb-10 leading-relaxed tracking-tight max-w-4xl mx-auto px-4">
            가장 심플하지만 가장 강력한, 콘텐츠 레퍼런스 분석 솔루션
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.0 }}
            className="flex gap-4 justify-center"
          >
            {!user ? (
              <>
                <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                  <Link href="/sign-in" prefetch={false}>
                    <Button className="h-12 px-8 rounded-full bg-black text-white hover:bg-gray-800 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300">
                      무료로 시작하기
                    </Button>
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                  <Link href="/search" prefetch={false}>
                    <Button variant="outline" className="h-12 px-8 rounded-full border-2 border-gray-300 hover:border-gray-400 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300">
                      데모 보기
                    </Button>
                  </Link>
                </motion.div>
              </>
            ) : (
              <>
                <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                  <Link href="/dashboard" prefetch={false}>
                    <Button variant="outline" className="h-12 px-8 rounded-full border-2 border-gray-300 hover:border-gray-400 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300">
                      대시보드
                    </Button>
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                  <Link href="/search" prefetch={false}>
                    <Button className="h-12 px-8 rounded-full bg-black text-white hover:bg-gray-800 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300">
                      검색 바로가기
                    </Button>
                  </Link>
                </motion.div>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Mouse Gradient Effect */}
      <div 
        id="mouse-gradient-hero"
        className="w-96 h-96 blur-2xl"
        style={{
          left: mouseGradientStyle.left,
          top: mouseGradientStyle.top,
          opacity: mouseGradientStyle.opacity,
        }}
      ></div>

      {/* Ripple Effects */}
      {ripples.map(ripple => (
        <div
          key={ripple.id}
          className="ripple-effect"
          style={{ left: `${ripple.x}px`, top: `${ripple.y}px` }}
        ></div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-white/50 pointer-events-none" />
    </div>
    </>
  )
}
