"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

const dist = (a: { x: number, y: number }, b: { x: number, y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
};

const getAttr = (distance: number, maxDist: number, minVal: number, maxVal: number) => {
    const val = maxVal - Math.abs((maxVal * distance) / maxDist);
    return Math.max(minVal, val + minVal);
};

interface TextPressureProps {
    text: string;
    width?: boolean;
    weight?: boolean;
    italic?: boolean;
    alpha?: boolean;
    flex?: boolean;
    textColor?: string;
    className?: string;
    minFontSize?: number;
}

const TextPressure = ({
    text = 'MOODERI',
    width = true,
    weight = true,
    italic = false,
    alpha = false,
    flex = true,
    textColor = '#FFFFFF',
    className = '',
    minFontSize = 48
}: TextPressureProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const spansRef = useRef<(HTMLSpanElement | null)[]>([]);

    const mouseRef = useRef({ x: 0, y: 0 });
    const cursorRef = useRef({ x: 0, y: 0 });

    const [fontSize, setFontSize] = useState(minFontSize);

    const chars = text.split('');

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            cursorRef.current.x = e.clientX;
            cursorRef.current.y = e.clientY;
        };
        const handleTouchMove = (e: TouchEvent) => {
            const t = e.touches[0];
            cursorRef.current.x = t.clientX;
            cursorRef.current.y = t.clientY;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleTouchMove, { passive: true });

        if (containerRef.current) {
            const { left, top, width, height } = containerRef.current.getBoundingClientRect();
            mouseRef.current.x = left + width / 2;
            mouseRef.current.y = top + height / 2;
            cursorRef.current.x = mouseRef.current.x;
            cursorRef.current.y = mouseRef.current.y;
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

    const setSize = useCallback(() => {
        if (!containerRef.current || !titleRef.current) return;
        const { width: containerW, height: containerH } = containerRef.current.getBoundingClientRect();
        // Calculate font size to fit container width (roughly 1.8 chars per font size unit)
        let newFontSize = containerW / (chars.length / 1.8);
        // Also check height constraint
        const maxByHeight = containerH * 0.8;
        newFontSize = Math.min(newFontSize, maxByHeight);
        newFontSize = Math.max(newFontSize, minFontSize);
        newFontSize = Math.min(newFontSize, 150); // Cap max size
        setFontSize(newFontSize);
    }, [chars.length, minFontSize]);

    useEffect(() => {
        setSize();
        window.addEventListener('resize', setSize);
        return () => window.removeEventListener('resize', setSize);
    }, [setSize]);

    useEffect(() => {
        let rafId: number;
        const animate = () => {
            mouseRef.current.x += (cursorRef.current.x - mouseRef.current.x) / 15;
            mouseRef.current.y += (cursorRef.current.y - mouseRef.current.y) / 15;

            if (titleRef.current) {
                const titleRect = titleRef.current.getBoundingClientRect();
                const maxDist = titleRect.width / 2;

                spansRef.current.forEach(span => {
                    if (!span) return;

                    const rect = span.getBoundingClientRect();
                    const charCenter = {
                        x: rect.x + rect.width / 2,
                        y: rect.y + rect.height / 2
                    };

                    const d = dist(mouseRef.current, charCenter);

                    // Width: how stretched the letter gets (100 = normal, 200 = very wide)
                    const wdth = width ? Math.floor(getAttr(d, maxDist, 100, 150)) : 100;
                    // Weight: how bold (400 = normal, 900 = very bold)
                    const wght = weight ? Math.floor(getAttr(d, maxDist, 700, 900)) : 700;
                    // Italic slant
                    const italVal = italic ? getAttr(d, maxDist, 0, 1).toFixed(2) : 0;
                    // Alpha/opacity
                    const alphaVal = alpha ? getAttr(d, maxDist, 0.5, 1).toFixed(2) : 1;

                    span.style.fontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}`;
                    span.style.fontStretch = `${wdth}%`;
                    span.style.fontWeight = `${wght}`;
                    if (alpha) span.style.opacity = String(alphaVal);
                });
            }

            rafId = requestAnimationFrame(animate);
        };

        animate();
        return () => cancelAnimationFrame(rafId);
    }, [width, weight, italic, alpha]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <h1
                ref={titleRef}
                className={flex ? 'flex justify-between' : ''}
                style={{
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    textTransform: 'uppercase',
                    fontSize: fontSize,
                    lineHeight: 0.9,
                    margin: 0,
                    textAlign: 'center',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    fontWeight: 700,
                    color: textColor,
                    letterSpacing: '-0.02em',
                }}
            >
                {chars.map((char, i) => (
                    <span
                        key={i}
                        ref={el => { spansRef.current[i] = el; }}
                        style={{
                            display: 'inline-block',
                            willChange: 'font-variation-settings, font-weight',
                            transition: 'none',
                        }}
                    >
                        {char}
                    </span>
                ))}
            </h1>
        </div>
    );
};

export default TextPressure;
