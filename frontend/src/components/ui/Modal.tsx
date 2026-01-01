"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Modal = DialogPrimitive.Root;

const ModalTrigger = DialogPrimitive.Trigger;

const ModalPortal = DialogPrimitive.Portal;

const ModalClose = DialogPrimitive.Close;

const ModalOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
            className
        )}
        {...props}
    />
));
ModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

const ModalContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <ModalPortal>
        <ModalOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-black border border-white/30 p-0 duration-200 data-[state=open]:animate-scale-in data-[state=closed]:animate-fade-out",
                className
            )}
            {...props}
        >
            {children}
        </DialogPrimitive.Content>
    </ModalPortal>
));
ModalContent.displayName = DialogPrimitive.Content.displayName;

const ModalHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex items-center justify-between px-6 py-4 border-b border-white/20",
            className
        )}
        {...props}
    />
);
ModalHeader.displayName = "ModalHeader";

const ModalBody = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("p-6", className)} {...props} />
);
ModalBody.displayName = "ModalBody";

const ModalFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex items-center justify-end gap-3 px-6 py-4 border-t border-white/20 bg-white/5",
            className
        )}
        {...props}
    />
);
ModalFooter.displayName = "ModalFooter";

const ModalTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn("text-lg font-semibold text-white", className)}
        {...props}
    />
));
ModalTitle.displayName = DialogPrimitive.Title.displayName;

const ModalDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-sm text-white/60", className)}
        {...props}
    />
));
ModalDescription.displayName = DialogPrimitive.Description.displayName;

const ModalCloseButton = () => (
    <ModalClose className="p-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/20">
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
    </ModalClose>
);

export {
    Modal,
    ModalPortal,
    ModalOverlay,
    ModalClose,
    ModalTrigger,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    ModalTitle,
    ModalDescription,
    ModalCloseButton,
};
