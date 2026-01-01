"use client";

import { AppShell } from "@/components/layout";
import { ProfileModal, SettingsModal } from "@/components/features";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { User, CreditCard, History, Shield, Bell, LogOut, Settings, Key, Loader2, Check, Video, Image, FolderPlus, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function SettingsPage() {
    const { user, signOut, isLoading } = useAuth();
    const router = useRouter();
    const [name, setName] = useState(user?.user_metadata?.full_name || "");
    const [email, setEmail] = useState(user?.email || "");
    const [credits, setCredits] = useState<number>(100);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [preferences, setPreferences] = useState<Record<string, boolean>>({
        email_notifications: true,
        processing_alerts: true,
        weekly_digest: false,
    });
    const [activities, setActivities] = useState<Array<{
        id: string;
        action_type: string;
        action_details: Record<string, unknown>;
        resource_id: string | null;
        resource_type: string | null;
        created_at: string;
    }>>([]);
    const [activitiesLoading, setActivitiesLoading] = useState(false);

    useEffect(() => {
        if (user) {
            api.getCredits().then(result => {
                const data = result.data;
                if (data) {
                    setCredits(data.credits);
                    if (data.preferences) {
                        setPreferences(prev => ({ ...prev, ...data.preferences }));
                    }
                }
            });
        }
    }, [user]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        const result = await api.updateProfile({ display_name: name });

        if (result.data?.success) {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } else {
            alert(result.error || "Failed to save profile");
        }

        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <AppShell>
                <div className="max-w-2xl mx-auto p-8">
                    <div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-6" />
                    <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
                        ))}
                    </div>
                </div>
            </AppShell>
        );
    }

    if (!user) {
        router.push("/login");
        return null;
    }

    const handleSignOut = async () => {
        if (confirm("Are you sure you want to sign out?")) {
            await signOut();
            router.push("/");
        }
    };

    return (
        <AppShell>
            <div className="max-w-2xl mx-auto p-8">
                <h1 className="text-3xl font-bold mb-8">Settings</h1>

                <Tabs defaultValue="profile">
                    <TabsList className="w-full justify-start mb-6">
                        <TabsTrigger value="profile" className="gap-2">
                            <User className="w-4 h-4" />
                            Profile
                        </TabsTrigger>
                        <TabsTrigger value="subscription" className="gap-2">
                            <CreditCard className="w-4 h-4" />
                            Subscription
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="gap-2">
                            <Bell className="w-4 h-4" />
                            Notifications
                        </TabsTrigger>
                        <TabsTrigger value="history" className="gap-2" onClick={() => {
                            if (activities.length === 0) {
                                setActivitiesLoading(true);
                                api.getActivity().then(result => {
                                    if (result.data) {
                                        setActivities(result.data.activities);
                                    }
                                    setActivitiesLoading(false);
                                });
                            }
                        }}>
                            <History className="w-4 h-4" />
                            History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile">
                        <div className="space-y-6 p-6 bg-background-glass border border-border-subtle rounded-xl">
                            <div>
                                <label className="text-sm text-text-secondary mb-2 block">
                                    Display Name
                                </label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-text-secondary mb-2 block">
                                    Email
                                </label>
                                <Input
                                    type="email"
                                    value={email}
                                    disabled
                                    className="opacity-60"
                                />
                                <p className="text-xs text-text-tertiary mt-1">
                                    Email cannot be changed
                                </p>
                            </div>

                            <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium mb-1">Account</h3>
                                    <p className="text-sm text-text-secondary">
                                        Signed in as <strong>{user.email}</strong>
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        variant="default"
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                                        ) : saveSuccess ? (
                                            <><Check className="w-4 h-4 mr-2" /> Saved!</>
                                        ) : (
                                            "Save Changes"
                                        )}
                                    </Button>
                                    <Button variant="destructive" onClick={handleSignOut}>
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Sign Out
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="subscription">
                        <div className="space-y-6 p-6 bg-background-glass border border-border-subtle rounded-xl">
                            {/* Current Plan */}
                            <div className="p-4 bg-gradient-to-r from-accent-purple/20 to-accent-blue/20 border border-accent-purple/30 rounded-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-text-secondary">
                                        Current Plan
                                    </span>
                                    <span className="px-2 py-0.5 bg-accent-purple/30 text-accent-purple text-xs font-medium rounded-full">
                                        FREE TRIAL
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold mb-1">Free Plan</h3>
                                <p className="text-sm text-text-secondary">
                                    100 free credits • Basic processing • Community support
                                </p>
                            </div>

                            {/* Credits */}
                            <div className="p-4 bg-white/5 border border-border-subtle rounded-xl">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium">Credits</h4>
                                        <p className="text-sm text-text-secondary">
                                            Used for video processing
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-accent-blue">
                                            {credits}
                                        </div>
                                        <div className="text-xs text-text-tertiary">
                                            remaining
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Button variant="accent" className="w-full" disabled>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Upgrade to Pro (Coming Soon)
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="notifications">
                        <div className="space-y-4 p-6 bg-background-glass border border-border-subtle rounded-xl">
                            <ToggleSetting
                                label="Email notifications"
                                description="Receive updates about your video processing"
                                checked={preferences.email_notifications}
                                onChange={(checked) => {
                                    setPreferences(prev => ({ ...prev, email_notifications: checked }));
                                    api.updatePreferences({ email_notifications: checked });
                                }}
                            />
                            <ToggleSetting
                                label="Processing complete alerts"
                                description="Get notified when video analysis finishes"
                                checked={preferences.processing_alerts}
                                onChange={(checked) => {
                                    setPreferences(prev => ({ ...prev, processing_alerts: checked }));
                                    api.updatePreferences({ processing_alerts: checked });
                                }}
                            />
                            <ToggleSetting
                                label="Weekly digest"
                                description="Summary of your activity"
                                checked={preferences.weekly_digest}
                                onChange={(checked) => {
                                    setPreferences(prev => ({ ...prev, weekly_digest: checked }));
                                    api.updatePreferences({ weekly_digest: checked });
                                }}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="history">
                        <div className="p-6 bg-background-glass border border-border-subtle rounded-xl">
                            {activitiesLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
                                </div>
                            ) : activities.length === 0 ? (
                                <div className="text-center py-12">
                                    <History className="w-12 h-12 mx-auto mb-3 text-text-tertiary" />
                                    <p className="text-text-secondary">No activity yet</p>
                                    <p className="text-sm text-text-tertiary mt-1">
                                        Your activity will appear here as you use the app
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activities.map((activity) => (
                                        <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                                {activity.action_type === 'video_processed' && <Video className="w-4 h-4" />}
                                                {activity.action_type === 'image_saved' && <Image className="w-4 h-4" />}
                                                {activity.action_type === 'board_created' && <FolderPlus className="w-4 h-4" />}
                                                {activity.action_type === 'search' && <Search className="w-4 h-4" />}
                                                {!['video_processed', 'image_saved', 'board_created', 'search'].includes(activity.action_type) && <History className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">
                                                    {activity.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </p>
                                                <p className="text-xs text-text-tertiary">
                                                    {new Date(activity.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </AppShell >
    );
}

function ToggleSetting({
    label,
    description,
    checked = false,
    onChange,
}: {
    label: string;
    description: string;
    checked?: boolean;
    onChange?: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
            <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-text-tertiary">{description}</div>
            </div>
            <button
                role="switch"
                aria-checked={checked}
                onClick={() => onChange?.(!checked)}
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
