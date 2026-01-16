"use client";

import { useState } from "react";
import {
    Modal,
    ModalTrigger,
    ModalContent,
    ModalHeader,
    ModalTitle,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
} from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useAuth } from "@/contexts/AuthContext";
import { User, CreditCard, History, Shield, Bell, LogOut } from "lucide-react";

interface ProfileModalProps {
    trigger: React.ReactNode;
}

export function ProfileModal({ trigger }: ProfileModalProps) {
    const { user, signOut } = useAuth();
    // In a real app we might want to update the profile via API
    // For now we just display the auth data
    const [name, setName] = useState((user as any)?.user_metadata?.full_name || (user as any)?.name || "User");
    const [email, setEmail] = useState((user as any)?.email || "");

    return (
        <Modal>
            <ModalTrigger asChild>{trigger}</ModalTrigger>
            <ModalContent className="max-w-xl">
                <ModalHeader>
                    <ModalTitle>Account Settings</ModalTitle>
                    <ModalCloseButton />
                </ModalHeader>
                <ModalBody>
                    <Tabs defaultValue="profile">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="profile" className="gap-2">
                                <User className="w-4 h-4" />
                                Profile
                            </TabsTrigger>
                            <TabsTrigger value="subscription" className="gap-2">
                                <CreditCard className="w-4 h-4" />
                                Subscription
                            </TabsTrigger>
                            <TabsTrigger value="history" className="gap-2">
                                <History className="w-4 h-4" />
                                History
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="profile">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-text-secondary mb-2 block">
                                        Display Name
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-text-secondary mb-2 block">
                                        Email
                                    </label>
                                    <Input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <Button variant="destructive" className="w-full mt-4" onClick={signOut}>
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Sign Out
                                </Button>

                                {/* Preferences */}
                                <div className="pt-4 border-t border-border-subtle">
                                    <h3 className="text-sm font-medium mb-3">Preferences</h3>
                                    <div className="space-y-3">
                                        <ToggleSetting
                                            label="Email notifications"
                                            description="Receive updates about your videos"
                                            defaultChecked
                                        />
                                        <ToggleSetting
                                            label="Dark mode"
                                            description="Always use dark theme"
                                            defaultChecked
                                        />
                                        <ToggleSetting
                                            label="Auto-save frames"
                                            description="Automatically save extracted frames"
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="subscription">
                            <div className="space-y-4">
                                {/* Current Plan */}
                                <div className="p-4 bg-gradient-to-r from-accent-purple/20 to-accent-blue/20 border border-accent-purple/30 rounded-xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-text-secondary">
                                            Current Plan
                                        </span>
                                        <span className="px-2 py-0.5 bg-accent-purple/30 text-accent-purple text-xs font-medium rounded-full">
                                            ACTIVE
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold mb-1">Pro Plan</h3>
                                    <p className="text-sm text-text-secondary">
                                        Unlimited video analysis • Priority processing • API access
                                    </p>
                                </div>

                                {/* Credits */}
                                <div className="p-4 bg-background-glass border border-border-subtle rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium">Credits</h4>
                                            <p className="text-sm text-text-secondary">
                                                Used for frame extraction
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-accent-blue">
                                                100
                                            </div>
                                            <div className="text-xs text-text-tertiary">
                                                remaining
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Button variant="accent" className="w-full">
                                    <CreditCard className="w-4 h-4" />
                                    Buy More Credits
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="history">
                            <div className="space-y-2">
                                {[
                                    { action: "Video analyzed", video: "Nike Commercial", date: "Today" },
                                    { action: "Frames exported", video: "Fashion Shoot", date: "Yesterday" },
                                    { action: "Board created", video: "Inspiration", date: "2 days ago" },
                                    { action: "50 credits added", video: "", date: "Dec 15" },
                                ].map((item, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors"
                                    >
                                        <div>
                                            <div className="text-sm">{item.action}</div>
                                            {item.video && (
                                                <div className="text-xs text-text-tertiary">
                                                    {item.video}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs text-text-tertiary">
                                            {item.date}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary">Cancel</Button>
                    <Button variant="default">Save Changes</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

function ToggleSetting({
    label,
    description,
    defaultChecked = false,
}: {
    label: string;
    description: string;
    defaultChecked?: boolean;
}) {
    const [checked, setChecked] = useState(defaultChecked);

    return (
        <div className="flex items-center justify-between">
            <div>
                <div className="text-sm">{label}</div>
                <div className="text-xs text-text-tertiary">{description}</div>
            </div>
            <button
                role="switch"
                aria-checked={checked}
                onClick={() => setChecked(!checked)}
                className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-accent-blue" : "bg-white/10"
                    }`}
            >
                <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "left-6" : "left-1"
                        }`}
                />
            </button>
        </div>
    );
}

// Settings Modal (separate for more settings)
interface SettingsModalProps {
    trigger: React.ReactNode;
}

export function SettingsModal({ trigger }: SettingsModalProps) {
    return (
        <Modal>
            <ModalTrigger asChild>{trigger}</ModalTrigger>
            <ModalContent>
                <ModalHeader>
                    <ModalTitle>Settings</ModalTitle>
                    <ModalCloseButton />
                </ModalHeader>
                <ModalBody className="space-y-6">
                    {/* Video Settings */}
                    <div>
                        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Video Processing
                        </h3>
                        <div className="space-y-3">
                            <ToggleSetting
                                label="Auto-analyze on upload"
                                description="Start analysis when video is added"
                                defaultChecked
                            />
                            <ToggleSetting
                                label="High quality thumbnails"
                                description="Generate higher resolution previews"
                            />
                        </div>
                    </div>

                    {/* Notification Settings */}
                    <div className="pt-4 border-t border-border-subtle">
                        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Bell className="w-4 h-4" />
                            Notifications
                        </h3>
                        <div className="space-y-3">
                            <ToggleSetting
                                label="Processing complete"
                                description="Notify when video analysis finishes"
                                defaultChecked
                            />
                            <ToggleSetting
                                label="Weekly digest"
                                description="Summary of your activity"
                            />
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="pt-4 border-t border-border-subtle">
                        <h3 className="text-sm font-medium text-red-400 mb-3">
                            Danger Zone
                        </h3>
                        <div className="flex items-center justify-between p-3 border border-red-500/20 rounded-lg">
                            <div>
                                <div className="text-sm">Delete Account</div>
                                <div className="text-xs text-text-tertiary">
                                    Permanently remove all data
                                </div>
                            </div>
                            <Button variant="destructive" size="sm">
                                Delete
                            </Button>
                        </div>
                    </div>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
