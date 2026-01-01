"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, icon, ...props }, ref) => {
        return (
            <div className="relative w-full">
                {icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                        {icon}
                    </div>
                )}
                <input
                    type={type}
                    className={cn(
                        "w-full bg-transparent border border-white/20 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-all duration-200 hover:border-white/40",
                        icon ? "pl-12 pr-4" : "px-4",
                        className
                    )}
                    ref={ref}
                    {...props}
                />
            </div>
        );
    }
);
Input.displayName = "Input";

export { Input };
