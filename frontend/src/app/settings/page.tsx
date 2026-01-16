"use client";

import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { User, CreditCard, History, Bell, LogOut, Loader2, Check, Video, Image, FolderPlus, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

export default function SettingsPage() {
    const { user: authUser, signOut, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();

    // Convex hooks - use Supabase user ID to look up Convex user
    const userData = useQuery(
        api.users.getBySupabaseId,
        authUser?.id ? { supabaseId: authUser.id } : "skip"
    );
    const activityData = useQuery(api.users.getActivity);
    const updateProfile = useMutation(api.users.updateProfile);

    // State
    const [name, setName] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [preferences, setPreferences] = useState<Record<string, boolean>>({
        emailNotifications: true,
        processingAlerts: true,
        weeklyDigest: false,
    });

    // Sync from Convex data when loaded
    useEffect(() => {
        if (userData) {
            setName(userData.name);
            // setPreferences({ ...preferences, ...userData.preferences }); // TODO: Match schema structure
        }
    }, [userData]);


    if (isAuthLoading || userData === undefined) {
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

    if (!authUser) {
        router.push("/login");
        return null;
    }

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        try {
            await updateProfile({ supabaseId: authUser?.id, name: name });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            alert("Failed to save profile");
        }

        setIsSaving(false);
    };

    const handleSignOut = async () => {
        if (confirm("Are you sure you want to sign out?")) {
            await signOut();
            router.push("/");
        }
    };

    // Derived values
    const credits = userData?.credits || 0;
    const activities = activityData?.activities || [];
    const activitiesLoading = activityData === undefined;

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
                        <TabsTrigger value="history" className="gap-2">
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
                                    value={userData?.email || ""}
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
                                        Signed in as <strong>{userData?.email}</strong>
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
                                checked={preferences.emailNotifications}
                                onChange={(checked) => {
                                    setPreferences(prev => ({ ...prev, emailNotifications: checked }));
                                    // api.updatePreferences({ email_notifications: checked });
                                }}
                            />
                            <ToggleSetting
                                label="Processing complete alerts"
                                description="Get notified when video analysis finishes"
                                checked={preferences.processingAlerts}
                                onChange={(checked) => {
                                    setPreferences(prev => ({ ...prev, processingAlerts: checked }));
                                    // api.updatePreferences({ processing_alerts: checked });
                                }}
                            />
                            <ToggleSetting
                                label="Weekly digest"
                                description="Summary of your activity"
                                checked={preferences.weeklyDigest}
                                onChange={(checked) => {
                                    setPreferences(prev => ({ ...prev, weeklyDigest: checked }));
                                    // api.updatePreferences({ weekly_digest: checked });
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
                                    {activities.map((activity: any) => (
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
                                                    {activity.action_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
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
