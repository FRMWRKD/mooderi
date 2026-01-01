"use client";

import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[400px] flex flex-col items-center justify-center p-8">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
                    <p className="text-text-secondary text-center max-w-md mb-6">
                        {this.state.error?.message || "An unexpected error occurred"}
                    </p>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            this.setState({ hasError: false, error: null });
                            window.location.reload();
                        }}
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reload Page
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

// Toast notification component
interface ToastProps {
    message: string;
    type?: "success" | "error" | "info";
    onClose: () => void;
}

export function Toast({ message, type = "info", onClose }: ToastProps) {
    const colors = {
        success: "bg-green-500/10 border-green-500/30 text-green-400",
        error: "bg-red-500/10 border-red-500/30 text-red-400",
        info: "bg-accent-blue/10 border-accent-blue/30 text-accent-blue",
    };

    return (
        <div
            className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg border backdrop-blur-lg animate-slide-up ${colors[type]}`}
        >
            <div className="flex items-center gap-3">
                <span>{message}</span>
                <button onClick={onClose} className="opacity-60 hover:opacity-100">
                    ×
                </button>
            </div>
        </div>
    );
}

// Simple toast hook
import { useState, useCallback } from "react";

export function useToast() {
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const ToastComponent = toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
    ) : null;

    return { showToast, ToastComponent };
}
