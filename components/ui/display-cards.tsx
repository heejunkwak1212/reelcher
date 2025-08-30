"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface DisplayCardProps {
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  date?: string;
  iconClassName?: string;
  titleClassName?: string;
}

function DisplayCard({
  className,
  icon = null,
  title = "Featured",
  description = "Discover amazing content",
  date = "",
  iconClassName = "text-blue-500",
  titleClassName = "text-gray-900",
}: DisplayCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-44 w-[26rem] -skew-y-[8deg] select-none flex-col justify-between rounded-xl border-2 border-gray-200 bg-white/80 backdrop-blur-sm px-5 py-4 transition-all duration-700 shadow-sm after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[24rem] after:bg-gradient-to-l after:from-background after:to-transparent after:content-[''] hover:border-gray-300 hover:bg-white/90 hover:shadow-md",
        className
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {icon && <div className={cn("flex-shrink-0", iconClassName)}>{icon}</div>}
          <p className={cn("text-xl font-bold", titleClassName)}>{title}</p>
        </div>
        <p className="text-base leading-relaxed text-gray-700 font-medium">{description}</p>
      </div>
      {date && <p className="text-gray-500 text-xs">{date}</p>}
    </div>
  );
}

interface DisplayCardsProps {
  cards?: DisplayCardProps[];
}

export default function DisplayCards({ cards }: DisplayCardsProps) {
  const defaultCards = [
    {
      className: "[grid-area:stack] hover:-translate-y-16 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      className: "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-8 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-2",
    },
  ];

  const displayCards = cards || defaultCards;

  return (
    <div className="grid [grid-template-areas:'stack'] place-items-center -ml-10 opacity-100 animate-in fade-in-0 duration-700">
      {displayCards.map((cardProps, index) => (
        <DisplayCard key={index} {...cardProps} />
      ))}
    </div>
  );
}