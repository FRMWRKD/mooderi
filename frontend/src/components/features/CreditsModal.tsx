"use client";

import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalTitle,
    ModalBody,
    ModalCloseButton,
} from "@/components/ui/Modal";
import { Coins, History, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    credits: number;
}

export function CreditsModal({ isOpen, onClose, credits }: CreditsModalProps) {
    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <ModalContent className="max-w-md">
                <ModalHeader>
                    <ModalTitle className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-yellow-400" />
                        My Credits
                    </ModalTitle>
                    <ModalCloseButton />
                </ModalHeader>
                <ModalBody className="space-y-6">
                    {/* Current Balance */}
                    <div className="bg-white/5 rounded-xl p-6 text-center border border-white/10">
                        <p className="text-text-secondary text-sm mb-1">Available Balance</p>
                        <div className="text-4xl font-bold text-white mb-2">{credits}</div>
                        <p className="text-xs text-text-tertiary">
                            Use credits to analyze videos and extract visual data.
                        </p>
                    </div>

                    {/* Actions Placeholder */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="secondary" className="gap-2 h-auto py-4 flex-col">
                            <History className="w-5 h-5 mb-1 text-accent-blue" />
                            <span className="text-xs">View History</span>
                        </Button>
                        <Button variant="secondary" className="gap-2 h-auto py-4 flex-col">
                            <CreditCard className="w-5 h-5 mb-1 text-accent-green" />
                            <span className="text-xs">Buy More</span>
                        </Button>
                    </div>

                    {/* Info */}
                    <div className="bg-accent-blue/10 rounded-lg p-4 border border-accent-blue/20">
                        <h4 className="text-sm font-medium text-accent-blue mb-2">How it works</h4>
                        <ul className="text-xs text-text-secondary space-y-1.5 list-disc pl-4">
                            <li>Analysis costs vary by video length and quality settings.</li>
                            <li>You are only charged for frames you choose to save.</li>
                            <li>Free daily bonus credits reset at midnight UTC.</li>
                        </ul>
                    </div>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
