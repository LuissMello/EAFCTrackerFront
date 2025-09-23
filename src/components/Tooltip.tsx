import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number; // ? default: 100ms
  hideDelay?: number; // ? default: 0ms
  position?: "top" | "bottom" | "left" | "right"; // ? default: 'top'
  className?: string;
  wrapperClassName?: string; // ? for customizing the wrapper div
}

interface TooltipPosition {
  top: number;
  left: number;
}

export function Tooltip({
  content,
  children,
  delay = 100,
  hideDelay = 0,
  position = "top",
  className = "",
  wrapperClassName,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [coords, setCoords] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [actualPosition, setActualPosition] = useState(position);
  const targetRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout>();
  const hideTimeoutRef = useRef<NodeJS.Timeout>();

  const calculatePosition = () => {
    if (!targetRef.current || !tooltipRef.current) return;

    const targetRect = targetRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;

    const spacing = 8; // ? Space between tooltip and target
    const viewportPadding = 10; // ? Minimum distance from viewport edges

    // ? Calculate positions for each direction
    const positions = {
      top: {
        top: targetRect.top + scrollY - tooltipRect.height - spacing,
        left: targetRect.left + scrollX + (targetRect.width - tooltipRect.width) / 2,
      },
      bottom: {
        top: targetRect.bottom + scrollY + spacing,
        left: targetRect.left + scrollX + (targetRect.width - tooltipRect.width) / 2,
      },
      left: {
        top: targetRect.top + scrollY + (targetRect.height - tooltipRect.height) / 2,
        left: targetRect.left + scrollX - tooltipRect.width - spacing,
      },
      right: {
        top: targetRect.top + scrollY + (targetRect.height - tooltipRect.height) / 2,
        left: targetRect.right + scrollX + spacing,
      },
    };

    // ? Check if position fits in viewport
    const fitsInViewport = (pos: TooltipPosition, dir: string) => {
      const tooltipRight = pos.left + tooltipRect.width;
      const tooltipBottom = pos.top + tooltipRect.height;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      return (
        pos.left >= viewportPadding &&
        pos.top >= scrollY + viewportPadding &&
        tooltipRight <= scrollX + viewportWidth - viewportPadding &&
        tooltipBottom <= scrollY + viewportHeight - viewportPadding
      );
    };

    // ? Try preferred position first
    let selectedPosition = position;
    let selectedCoords = positions[position];

    if (!fitsInViewport(selectedCoords, position)) {
      // ? Try opposite position
      const opposites = { top: "bottom", bottom: "top", left: "right", right: "left" } as const;
      const opposite = opposites[position];

      if (fitsInViewport(positions[opposite], opposite)) {
        selectedPosition = opposite;
        selectedCoords = positions[opposite];
      } else {
        // ? Try other positions
        const otherPositions = Object.keys(positions).filter((p) => p !== position && p !== opposite) as Array<
          keyof typeof positions
        >;

        for (const pos of otherPositions) {
          if (fitsInViewport(positions[pos], pos)) {
            selectedPosition = pos as typeof position;
            selectedCoords = positions[pos];
            break;
          }
        }
      }
    }

    // ? Ensure tooltip doesn't go off edges even if no position fits perfectly
    selectedCoords.left = Math.max(
      viewportPadding,
      Math.min(selectedCoords.left, scrollX + window.innerWidth - tooltipRect.width - viewportPadding)
    );
    selectedCoords.top = Math.max(
      scrollY + viewportPadding,
      Math.min(selectedCoords.top, scrollY + window.innerHeight - tooltipRect.height - viewportPadding)
    );

    setActualPosition(selectedPosition);
    setCoords(selectedCoords);
  };

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }

    // ? Mount and calculate position immediately
    setIsMounted(true);

    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = undefined;
    }

    if (hideDelay > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setIsMounted(false), 150); // ? Wait for fade out animation
      }, hideDelay);
    } else {
      setIsVisible(false);
      setTimeout(() => setIsMounted(false), 150); // ? Wait for fade out animation
    }
  };

  // ? Calculate position when mounted
  useEffect(() => {
    if (isMounted && tooltipRef.current) {
      calculatePosition();

      // ? Recalculate on scroll or resize
      const handleRecalculate = () => calculatePosition();
      window.addEventListener("scroll", handleRecalculate, true);
      window.addEventListener("resize", handleRecalculate);

      return () => {
        window.removeEventListener("scroll", handleRecalculate, true);
        window.removeEventListener("resize", handleRecalculate);
      };
    }
  }, [isMounted, position]);

  // ? Cleanup timeouts
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const tooltipClasses = `
    fixed z-[9999] px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg
    pointer-events-none whitespace-pre-line
    transition-[opacity,transform] duration-150 ease-out transform-gpu
    ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
    ${className}
  `.trim();

  return (
    <>
      <div 
        ref={targetRef} 
        onMouseEnter={handleMouseEnter} 
        onMouseLeave={handleMouseLeave} 
        className={wrapperClassName || "inline-block"}
      >
        {children}
      </div>
      {typeof document !== "undefined" &&
        isMounted &&
        createPortal(
          <div
            ref={tooltipRef}
            className={tooltipClasses}
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              visibility: coords.top !== 0 || coords.left !== 0 ? "visible" : "hidden",
            }}
            role="tooltip"
            aria-hidden={!isVisible}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
