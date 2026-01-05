"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import TextPressure from "@/components/ui/TextPressure";
import Link from "next/link";
import { type Image, api } from "@/lib/api";
import { Menu, X, Check, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Grid position type
interface GridPosition {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface GridCell {
    type: "image" | "text" | "empty";
    position: GridPosition;
    imageIndex?: number;
    content?: string;
}

interface LayoutConfig {
    cells: GridCell[];
}

// Layouts with percentage positions - 7 varied layouts, all with 3-6 images
// No overlapping cells, proper aspect ratios (cinemascope to 9:16)
const LAYOUTS: LayoutConfig[] = [
    // Layout 1: MOODERI top right, small text middle, 4 images
    {
        cells: [
            { type: "image", position: { x: 0, y: 0, w: 50, h: 50 }, imageIndex: 0 },
            { type: "text", position: { x: 50, y: 0, w: 50, h: 25 }, content: "MOODERI" },
            { type: "image", position: { x: 50, y: 25, w: 50, h: 35 }, imageIndex: 1 },
            { type: "text", position: { x: 0, y: 50, w: 40, h: 20 }, content: "AI-GENERATED VISUAL REFERENCES FOR CREATIVE PROFESSIONALS" },
            { type: "image", position: { x: 0, y: 70, w: 40, h: 30 }, imageIndex: 2 },
            { type: "image", position: { x: 40, y: 50, w: 30, h: 50 }, imageIndex: 3 },
            { type: "image", position: { x: 70, y: 60, w: 30, h: 40 }, imageIndex: 4 },
        ]
    },
    // Layout 2: PROMPTS word + full prompt text, 3 images, no overlap
    {
        cells: [
            { type: "image", position: { x: 0, y: 0, w: 50, h: 55 }, imageIndex: 0 },
            { type: "image", position: { x: 50, y: 0, w: 50, h: 40 }, imageIndex: 1 },
            { type: "text", position: { x: 50, y: 40, w: 50, h: 25 }, content: "PROMPTS" },
            { type: "text", position: { x: 50, y: 65, w: 50, h: 35 } },
            { type: "image", position: { x: 0, y: 55, w: 50, h: 45 }, imageIndex: 2 },
        ]
    },
    // Layout 3: EXPLORE only, CREATIVE TOOLS small, 4 images
    {
        cells: [
            { type: "image", position: { x: 0, y: 0, w: 45, h: 50 }, imageIndex: 0 },
            { type: "text", position: { x: 45, y: 0, w: 30, h: 25 }, content: "EXPLORE" },
            { type: "image", position: { x: 45, y: 25, w: 30, h: 35 }, imageIndex: 1 },
            { type: "image", position: { x: 75, y: 0, w: 25, h: 60 }, imageIndex: 2 },
            { type: "image", position: { x: 0, y: 50, w: 45, h: 50 }, imageIndex: 3 },
            { type: "text", position: { x: 45, y: 60, w: 30, h: 20 }, content: "CREATIVE TOOLS" },
            { type: "text", position: { x: 45, y: 80, w: 30, h: 20 } },
            { type: "image", position: { x: 75, y: 60, w: 25, h: 40 }, imageIndex: 4 },
        ]
    },
    // Layout 4: Big image left, 3 stacked right
    {
        cells: [
            { type: "image", position: { x: 0, y: 0, w: 60, h: 100 }, imageIndex: 0 },
            { type: "image", position: { x: 60, y: 0, w: 40, h: 35 }, imageIndex: 1 },
            { type: "text", position: { x: 60, y: 35, w: 40, h: 20 } },
            { type: "image", position: { x: 60, y: 55, w: 40, h: 45 }, imageIndex: 2 },
        ]
    },
    // Layout 5: 5 images gallery mosaic
    {
        cells: [
            { type: "image", position: { x: 0, y: 0, w: 35, h: 50 }, imageIndex: 0 },
            { type: "image", position: { x: 35, y: 0, w: 35, h: 40 }, imageIndex: 1 },
            { type: "image", position: { x: 70, y: 0, w: 30, h: 55 }, imageIndex: 2 },
            { type: "image", position: { x: 0, y: 50, w: 40, h: 50 }, imageIndex: 3 },
            { type: "text", position: { x: 40, y: 40, w: 30, h: 25 } },
            { type: "image", position: { x: 40, y: 65, w: 30, h: 35 }, imageIndex: 4 },
            { type: "image", position: { x: 70, y: 55, w: 30, h: 45 }, imageIndex: 5 },
        ]
    },
    // Layout 6: CREATE word, 4 images
    {
        cells: [
            { type: "image", position: { x: 0, y: 0, w: 50, h: 60 }, imageIndex: 0 },
            { type: "image", position: { x: 50, y: 0, w: 50, h: 40 }, imageIndex: 1 },
            { type: "text", position: { x: 50, y: 40, w: 25, h: 25 }, content: "CREATE" },
            { type: "image", position: { x: 75, y: 40, w: 25, h: 60 }, imageIndex: 2 },
            { type: "image", position: { x: 0, y: 60, w: 50, h: 40 }, imageIndex: 3 },
            { type: "text", position: { x: 50, y: 65, w: 25, h: 35 } },
        ]
    },
    // Layout 7: DISCOVER, 4 images
    {
        cells: [
            { type: "image", position: { x: 0, y: 0, w: 40, h: 45 }, imageIndex: 0 },
            { type: "text", position: { x: 40, y: 0, w: 30, h: 25 }, content: "DISCOVER" },
            { type: "image", position: { x: 40, y: 25, w: 30, h: 40 }, imageIndex: 1 },
            { type: "image", position: { x: 70, y: 0, w: 30, h: 50 }, imageIndex: 2 },
            { type: "image", position: { x: 0, y: 45, w: 40, h: 55 }, imageIndex: 3 },
            { type: "text", position: { x: 40, y: 65, w: 30, h: 35 } },
            { type: "image", position: { x: 70, y: 50, w: 30, h: 50 }, imageIndex: 4 },
        ]
    },
];

// --- Hamburger Menu ---
function HamburgerMenu({ onClose, onPricing, onContact }: {
    onClose: () => void;
    onPricing: () => void;
    onContact: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-full left-0 w-56 bg-black border-2 border-white z-50"
        >
            <button onClick={() => { onPricing(); onClose(); }} className="w-full h-12 px-6 flex items-center border-b border-white hover:bg-white hover:text-black transition-colors">
                <span className="text-xs uppercase tracking-widest">Pricing</span>
            </button>
            <button onClick={() => { onContact(); onClose(); }} className="w-full h-12 px-6 flex items-center border-b border-white hover:bg-white hover:text-black transition-colors">
                <span className="text-xs uppercase tracking-widest">Contact</span>
            </button>
            <Link href="#generator" onClick={onClose} className="w-full h-12 px-6 flex items-center border-b border-white hover:bg-white hover:text-black transition-colors">
                <span className="text-xs uppercase tracking-widest">Prompt Generator</span>
            </Link>
            <Link href="/login" onClick={onClose} className="w-full h-12 px-6 flex items-center hover:bg-white hover:text-black transition-colors">
                <span className="text-xs uppercase tracking-widest">Login</span>
            </Link>
        </motion.div>
    );
}

// --- Pricing Modal ---
function PricingModal({ onClose }: { onClose: () => void }) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4 md:p-8" onClick={onClose}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="relative w-full max-w-4xl border-2 border-white bg-black" onClick={(e) => e.stopPropagation()}>
                <div className="h-14 border-b-2 border-white flex items-center justify-between px-6">
                    <span className="text-lg font-bold uppercase tracking-widest">Pricing</span>
                    <button onClick={onClose} className="p-2 hover:bg-white hover:text-black transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className="p-8 md:p-12 border-b-2 md:border-b-0 md:border-r-2 border-white flex flex-col">
                        <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Free</div>
                        <div className="text-5xl font-black mb-6">$0</div>
                        <div className="text-sm font-mono text-white/70 mb-8 leading-relaxed">Get <span className="text-white font-bold">50 Credits</span> for free access for 1 month.</div>
                        <ul className="space-y-3 flex-1">
                            <li className="flex items-center gap-3 text-sm"><Check className="w-4 h-4" /><span>50 Image Breakdowns</span></li>
                            <li className="flex items-center gap-3 text-sm"><Check className="w-4 h-4" /><span>Access for 1 Month</span></li>
                            <li className="flex items-center gap-3 text-sm"><Check className="w-4 h-4" /><span>Basic Prompt Access</span></li>
                        </ul>
                        <Link href="/login?action=signup" className="mt-8"><Button variant="ghost" className="w-full h-12 rounded-none border-2 border-white text-white hover:bg-white hover:text-black text-sm uppercase tracking-widest">Get Started Free</Button></Link>
                    </div>
                    <div className="p-8 md:p-12 bg-white text-black flex flex-col">
                        <div className="text-xs uppercase tracking-widest text-black/50 mb-2">Pro</div>
                        <div className="text-5xl font-black mb-2">$5<span className="text-xl font-normal">/month</span></div>
                        <div className="text-sm font-mono text-black/70 mb-8 leading-relaxed">Access to all files, folders, and <span className="text-black font-bold">100 Credits</span> included.</div>
                        <ul className="space-y-3 flex-1">
                            <li className="flex items-center gap-3 text-sm"><Check className="w-4 h-4" /><span>100 Image Breakdowns</span></li>
                            <li className="flex items-center gap-3 text-sm"><Check className="w-4 h-4" /><span>All Platform Features</span></li>
                            <li className="flex items-center gap-3 text-sm"><Check className="w-4 h-4" /><span>Full Prompt Library</span></li>
                            <li className="flex items-center gap-3 text-sm"><Check className="w-4 h-4" /><span>Buy Additional Credits</span></li>
                        </ul>
                        <Link href="/login?action=signup&plan=pro" className="mt-8"><Button className="w-full h-12 rounded-none bg-black text-white hover:bg-black/80 text-sm uppercase tracking-widest">Subscribe Now</Button></Link>
                    </div>
                </div>
                <div className="p-4 border-t-2 border-white text-center"><p className="text-xs font-mono text-white/50 uppercase tracking-wide">1 Credit = 1 Image Breakdown • No Rollover • Cancel Anytime</p></div>
            </motion.div>
        </motion.div>
    );
}

// --- Contact Modal ---
function ContactModal({ onClose }: { onClose: () => void }) {
    const [formData, setFormData] = useState({ name: "", email: "", message: "" });
    const [sent, setSent] = useState(false);
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); setSent(true); setTimeout(() => onClose(), 2000); };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4 md:p-8" onClick={onClose}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="relative w-full max-w-xl border-2 border-white bg-black" onClick={(e) => e.stopPropagation()}>
                <div className="h-14 border-b-2 border-white flex items-center justify-between px-6">
                    <span className="text-lg font-bold uppercase tracking-widest">Contact</span>
                    <button onClick={onClose} className="p-2 hover:bg-white hover:text-black transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-8">
                    {sent ? (
                        <div className="text-center py-12"><Check className="w-12 h-12 mx-auto mb-4" /><p className="text-lg uppercase tracking-widest">Message Sent</p></div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div><label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Name</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full h-12 px-4 bg-black border-2 border-white text-white" placeholder="Your name" /></div>
                            <div><label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Email</label><input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full h-12 px-4 bg-black border-2 border-white text-white" placeholder="your@email.com" /></div>
                            <div><label className="block text-xs uppercase tracking-widest text-white/50 mb-2">Message</label><textarea required rows={4} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full px-4 py-3 bg-black border-2 border-white text-white resize-none" placeholder="How can we help?" /></div>
                            <Button type="submit" className="w-full h-12 rounded-none bg-white text-black hover:bg-white/90 text-sm uppercase tracking-widest flex items-center justify-center gap-2"><Send className="w-4 h-4" /> Send Message</Button>
                        </form>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

// --- Image Modal - Vertical stack ---
function ImageModal({ image, onClose }: { image: Image | null; onClose: () => void }) {
    if (!image) return null;

    // Get prompt from multiple sources: prompt field, generated_prompts.text_to_image, or structured_analysis.short_description
    const displayPrompt = image.prompt
        || image.generated_prompts?.text_to_image
        || image.generated_prompts?.structured_analysis?.short_description
        || "No prompt available.";

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-6 md:p-12" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="w-full max-w-5xl max-h-[90vh] border-2 border-white bg-black flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-none h-10 border-b-2 border-white flex items-center justify-between px-4">
                    <span className="text-[10px] uppercase tracking-widest text-white/70">Image Detail</span>
                    <button onClick={onClose} className="p-1 hover:bg-white hover:text-black transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-none aspect-video bg-neutral-950 flex items-center justify-center border-b-2 border-white">
                    <img src={image.image_url} alt="" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex-1 overflow-auto p-4 min-h-0">
                    <h3 className="text-[10px] uppercase tracking-widest text-white/50 mb-2">Prompt</h3>
                    <p className="font-mono text-xs leading-relaxed text-white/90">{displayPrompt}</p>
                </div>
                <div className="flex-none border-t-2 border-white p-4 flex items-center justify-between">
                    <div className="flex gap-6 text-xs uppercase tracking-widest">
                        <span><span className="text-white/50">Mood:</span> {image.mood || image.generated_prompts?.structured_analysis?.mood?.emotion || "N/A"}</span>
                        <span><span className="text-white/50">Score:</span> {image.aesthetic_score?.toFixed(1) || "N/A"}</span>
                    </div>
                    <button className="h-8 px-4 border-2 border-white hover:bg-white hover:text-black transition-colors text-xs uppercase tracking-widest">Copy Prompt</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

export function LandingPage() {
    const [allImages, setAllImages] = useState<Image[]>([]);
    const [sceneIndex, setSceneIndex] = useState(0);
    const [currentImages, setCurrentImages] = useState<Image[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [selectedImage, setSelectedImage] = useState<Image | null>(null);
    const [showPricing, setShowPricing] = useState(false);
    const [showContact, setShowContact] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const lastScrollTime = useRef(0);

    useEffect(() => {
        const loadImages = async () => {
            const { data } = await api.getImages({ sort: "ranked", limit: 50 });
            if (data?.images) {
                setAllImages(data.images);
                setCurrentImages(data.images.slice(0, 6));
            }
        };
        loadImages();
    }, []);

    const nextScene = useCallback(() => {
        if (allImages.length === 0) return;
        const shuffled = [...allImages].sort(() => Math.random() - 0.5);
        setCurrentImages(shuffled.slice(0, 6));
        setSceneIndex(prev => prev + 1);
    }, [allImages]);

    useEffect(() => {
        if (!isPaused && allImages.length > 0 && !selectedImage && !showPricing && !showContact) {
            const duration = sceneIndex === 0 ? 8000 : 5500; // 5.5 seconds faster
            const timer = setTimeout(nextScene, duration);
            return () => clearTimeout(timer);
        }
    }, [sceneIndex, isPaused, nextScene, allImages.length, selectedImage, showPricing, showContact]);

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (selectedImage || showPricing || showContact) return;
            const now = Date.now();
            // Support any direction: up/down (deltaY) or left/right (deltaX)
            const scrollAmount = Math.max(Math.abs(e.deltaY), Math.abs(e.deltaX));
            if (now - lastScrollTime.current > 1000 && scrollAmount > 20) {
                nextScene();
                lastScrollTime.current = now;
            }
        };
        window.addEventListener("wheel", handleWheel, { passive: true });
        return () => window.removeEventListener("wheel", handleWheel);
    }, [nextScene, selectedImage, showPricing, showContact]);

    const layout = LAYOUTS[sceneIndex % LAYOUTS.length];

    return (
        <div className="fixed inset-0 bg-black text-white font-sans overflow-hidden">
            <div className="absolute inset-8 md:inset-12 lg:inset-16 flex flex-col border-2 border-white bg-black">

                {/* Header */}
                <header className="flex-none h-12 md:h-14 border-b-2 border-white grid grid-cols-[auto_1fr_auto_auto_auto] items-center relative">
                    <button onClick={() => setShowMenu(!showMenu)} className="h-full px-4 flex items-center border-r-2 border-white hover:bg-white hover:text-black transition-colors">
                        {showMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                    <AnimatePresence>{showMenu && <HamburgerMenu onClose={() => setShowMenu(false)} onPricing={() => setShowPricing(true)} onContact={() => setShowContact(true)} />}</AnimatePresence>
                    <div className="h-full px-4 md:px-6 flex items-center border-r-2 border-white"><span className="text-sm md:text-lg font-bold tracking-tighter uppercase">MOODERI</span></div>
                    <button onClick={() => setShowPricing(true)} className="h-full px-4 md:px-6 flex items-center border-r-2 border-white hover:bg-white hover:text-black transition-colors"><span className="text-[10px] md:text-xs uppercase tracking-widest">Pricing</span></button>
                    <button onClick={() => setShowContact(true)} className="h-full px-4 flex items-center border-r-2 border-white hover:bg-white hover:text-black transition-colors hidden md:flex"><span className="text-xs uppercase tracking-widest">Contact</span></button>
                    <Link href="/login?action=signup" className="h-full px-4 md:px-6 flex items-center bg-white text-black hover:bg-white/80 transition-colors"><span className="text-[10px] md:text-xs uppercase tracking-widest font-bold">Sign Up</span></Link>
                </header>

                {/* Main Grid - CSS transitions */}
                <main className="flex-1 relative overflow-hidden">
                    {layout.cells.map((cell, i) => (
                        <GridCell
                            key={`cell-${i}`}
                            cell={cell}
                            images={currentImages}
                            onImageClick={(img) => setSelectedImage(img)}
                        />
                    ))}
                </main>

                {/* Footer */}
                <footer className="flex-none h-10 border-t-2 border-white grid grid-cols-[1fr_1fr_2fr] text-[10px] md:text-xs uppercase tracking-widest">
                    <button onClick={() => setShowPricing(true)} className="h-full flex items-center justify-center border-r-2 border-white hover:bg-white hover:text-black transition-colors">Pricing</button>
                    <button onClick={() => setShowContact(true)} className="h-full flex items-center justify-center border-r-2 border-white hover:bg-white hover:text-black transition-colors">Contact</button>
                    <div className="h-full flex items-center px-4 relative overflow-hidden">
                        {!isPaused && !selectedImage && !showPricing && !showContact && (
                            <motion.div key={`progress-${sceneIndex}`} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: sceneIndex === 0 ? 10 : 7, ease: "linear" }} className="absolute left-0 top-0 bottom-0 bg-white/25 w-full origin-left" />
                        )}
                        <span className="relative z-10 text-white/50">Scroll to explore</span>
                    </div>
                </footer>
            </div>

            <AnimatePresence>
                {selectedImage && <ImageModal image={selectedImage} onClose={() => setSelectedImage(null)} />}
                {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
                {showContact && <ContactModal onClose={() => setShowContact(false)} />}
            </AnimatePresence>
        </div>
    );
}

// --- Grid Cell with CSS transitions ---
function GridCell({ cell, images, onImageClick }: {
    cell: GridCell;
    images: Image[];
    onImageClick: (img: Image) => void;
}) {
    const image = cell.imageIndex !== undefined ? images[cell.imageIndex] : null;
    const pos = cell.position;

    const style: React.CSSProperties = {
        position: "absolute",
        top: `${pos.y}%`,
        left: `${pos.x}%`,
        width: `${pos.w}%`,
        height: `${pos.h}%`,
        transition: `top 0.6s cubic-bezier(0.23, 1, 0.32, 1),
                     left 0.6s cubic-bezier(0.23, 1, 0.32, 1),
                     width 0.6s cubic-bezier(0.23, 1, 0.32, 1),
                     height 0.6s cubic-bezier(0.23, 1, 0.32, 1)`,
        willChange: "top, left, width, height",
        overflow: "hidden",
    };

    if (cell.type === "image" && image) {
        return (
            <div style={style} className="border border-white cursor-pointer group" onClick={() => onImageClick(image)}>
                <img src={image.image_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] uppercase tracking-widest border border-white px-3 py-2 bg-black">View Prompt</span>
                </div>
            </div>
        );
    }

    if (cell.type === "text") {
        // Check if this is a title cell - single words that get TextPressure effect
        const isBigTitle = cell.content === "MOODERI" || cell.content === "PROMPTS" || cell.content === "EXPLORE" || cell.content === "DISCOVER" || cell.content === "CREATE";
        const hasContent = cell.content && cell.content.length > 0;
        // For empty cells, show the prompt from first image
        const displayPrompt = images[0]?.prompt || "Visual intelligence powered by AI.";

        // Render title with TextPressure effect - fits container
        const renderTitle = (text: string) => {
            const lines = text.split('\n');
            // Single line title
            if (lines.length === 1) {
                return (
                    <div className="w-full h-full">
                        <TextPressure text={lines[0]} minFontSize={24} />
                    </div>
                );
            }
            // Two line title - stack them tightly
            return (
                <div className="flex flex-col items-center justify-center w-full h-full gap-0">
                    <div className="flex-1 w-full flex items-end justify-center pb-1">
                        <TextPressure text={lines[0]} minFontSize={24} />
                    </div>
                    <span className="text-xs md:text-sm lg:text-base font-medium tracking-wide text-white/60 uppercase">
                        {lines[1]}
                    </span>
                </div>
            );
        };

        return (
            <div style={style} className="border border-white flex items-center justify-center p-2 md:p-4 bg-black overflow-hidden cursor-pointer" onClick={() => images[0] && onImageClick(images[0])}>
                {isBigTitle ? (
                    renderTitle(cell.content || '')
                ) : hasContent ? (
                    // Small text for subtitles
                    <p className="text-[10px] md:text-xs font-mono leading-relaxed text-center text-white/70 uppercase tracking-wide">{cell.content}</p>
                ) : (
                    // Empty cells show the prompt text
                    <p className="text-[8px] md:text-[10px] font-mono leading-relaxed text-center text-white/40 line-clamp-4">{displayPrompt}</p>
                )}
            </div>
        );
    }

    return <div style={style} className="border border-white bg-black" />;
}
