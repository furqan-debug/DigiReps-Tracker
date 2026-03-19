import { useState } from 'react';
import { 
    Camera, Clock, Monitor, Bell, Shield, 
    Save, RotateCcw, CheckCircle, ShieldAlert,
    Info, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageLayout } from '../components/ui';
import clsx from 'clsx';

const SETTINGS_KEY = 'trackora_settings';

interface AppSettings {
    screenshotIntervalMin: number;
    screenshotIntervalMax: number;
    idleThresholdSeconds: number;
    dailyHoursLimit: number;
    weeklyHoursLimit: number;
    screenshotBlur: boolean;
    trackUrls: boolean;
    trackApps: boolean;
    notifyIdle: boolean;
    notifyDailyLimit: boolean;
    autoStopOnIdle: boolean;
    idleAutoStopMinutes: number;
}

const DEFAULTS: AppSettings = {
    screenshotIntervalMin: 3,
    screenshotIntervalMax: 10,
    idleThresholdSeconds: 300,
    dailyHoursLimit: 8,
    weeklyHoursLimit: 40,
    screenshotBlur: false,
    trackUrls: true,
    trackApps: true,
    notifyIdle: true,
    notifyDailyLimit: true,
    autoStopOnIdle: false,
    idleAutoStopMinutes: 30,
};

function loadSettings(): AppSettings {
    try { 
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; 
    } catch { 
        return DEFAULTS; 
    }
}

function saveSettings(s: AppSettings) { 
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); 
}

export function SettingsPage() {
    const { profile } = useAuth();
    const isViewer = profile?.role === 'Viewer';
    const [settings, setSettings] = useState<AppSettings>(loadSettings());
    const [saved, setSaved] = useState(false);

    function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
        if (isViewer) return;
        setSettings(prev => ({ ...prev, [key]: value }));
    }

    function handleSave() {
        if (isViewer) return;
        saveSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
    }

    function handleReset() {
        if (isViewer) return;
        setSettings(DEFAULTS);
        saveSettings(DEFAULTS);
    }

    return (
        <PageLayout
            title="Core Protocols"
            description="Configure tracking behavior, operational limits, and security protocols."
            maxWidth="full"
            actions={
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleReset}
                        disabled={isViewer}
                        className={clsx(
                            "flex items-center gap-3 px-8 py-4 rounded-[20px] text-[11px] font-black uppercase tracking-[0.2em] transition-all border border-black/[0.1] shadow-sm font-mono",
                            isViewer ? "opacity-30 cursor-not-allowed" : "text-text-muted hover:text-text-primary hover:bg-white active:scale-95"
                        )}
                    >
                        <RotateCcw className="w-4 h-4" strokeWidth={3} />
                        RESTORE DEFAULTS
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isViewer}
                        className={clsx(
                            "flex items-center gap-3 px-10 py-4 rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-xl active:scale-95 font-mono",
                            isViewer ? "bg-black/10 text-text-muted cursor-not-allowed" : 
                            (saved ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-primary text-white hover:shadow-primary/30 hover:scale-[1.02]")
                        )}
                    >
                        {saved ? <CheckCircle className="w-5 h-5 stroke-[3]" /> : <Save className="w-5 h-5 stroke-[3]" />}
                        {isViewer ? 'REGISTRY LOCKED' : (saved ? 'PROTOCOL SYNCED' : 'INITIALIZE SYNC')}
                    </button>
                </div>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 space-y-10">
                    <SettingsSection 
                        icon={<Camera className="w-5 h-5" />} 
                        title="Visual Surveillance" 
                        subtitle="Coordinate screenshot capture behavior and privacy masking"
                    >
                        <ToggleField
                            label="Privacy Shield (Blur)"
                            description="Apply a sub-pixel blur effect to screenshots before matrix upload"
                            value={settings.screenshotBlur}
                            onChange={v => update('screenshotBlur', v)}
                        />
                        <div className="bg-primary/5 border border-primary/10 rounded-[28px] p-8 text-xs text-text-primary flex items-start gap-6 shadow-sm">
                            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 border border-primary/20 shadow-sm rotate-3">
                                <Info className="w-5 h-5 text-primary" strokeWidth={2.5} />
                            </div>
                            <p className="leading-relaxed font-black uppercase tracking-wider text-[11px] font-mono opacity-80">
                                Screenshots are currently initialized <span className="text-primary font-black underline underline-offset-4 decoration-primary/30">3 times at random intervals</span> within every 10-minute operational window.
                            </p>
                        </div>
                    </SettingsSection>

                    <SettingsSection 
                        icon={<Clock className="w-5 h-5" />} 
                        title="Inactivity Detection" 
                        subtitle="Parameters for identifying standalone vs active status"
                    >
                        <div className="space-y-10">
                            <RangeField
                                label="Inactivity Threshold"
                                description="Duration of zero mouse/key events before status shift"
                                value={settings.idleThresholdSeconds}
                                unit="Sec"
                                min={30} max={1800} step={30}
                                onChange={v => update('idleThresholdSeconds', v)}
                                color="indigo"
                            />
                            <div className="h-px bg-white/5 mx-2" />
                            <ToggleField
                                label="Autonomous Termination"
                                description="Automatically cease tracking upon extended inactivity"
                                value={settings.autoStopOnIdle}
                                onChange={v => update('autoStopOnIdle', v)}
                            />
                            {settings.autoStopOnIdle && (
                                <div className="pl-6 border-l-2 border-indigo-500/30 pt-4 animate-in slide-in-from-left-4 duration-500">
                                    <RangeField
                                        label="Termination Delay"
                                        description="Interval before automatic protocol shutdown"
                                        value={settings.idleAutoStopMinutes}
                                        unit="Min"
                                        min={5} max={120} step={5}
                                        onChange={v => update('idleAutoStopMinutes', v)}
                                        color="violet"
                                    />
                                </div>
                            )}
                        </div>
                    </SettingsSection>

                    <SettingsSection 
                        icon={<Monitor className="w-5 h-5" />} 
                        title="Operational Capacity" 
                        subtitle="Hard limits for daily and weekly resource tracking"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <RangeField
                                label="Daily Capacity Cap"
                                description="Maximum hours per 24h cycle"
                                value={settings.dailyHoursLimit}
                                unit="Hr"
                                min={1} max={24}
                                onChange={v => update('dailyHoursLimit', v)}
                                color="emerald"
                            />
                            <RangeField
                                label="Weekly Capacity Cap"
                                description="Maximum hours per 7d cycle"
                                value={settings.weeklyHoursLimit}
                                unit="Hr"
                                min={1} max={168}
                                onChange={v => update('weeklyHoursLimit', v)}
                                color="emerald"
                            />
                        </div>
                    </SettingsSection>

                    <SettingsSection 
                        icon={<Shield className="w-5 h-5" />} 
                        title="Deep Tracking Protocols" 
                        subtitle="Configure collection parameters for application and web data"
                    >
                        <div className="space-y-10">
                            <ToggleField
                                label="Domain Analytics"
                                description="Record active browser domains in activity registries"
                                value={settings.trackUrls}
                                onChange={v => update('trackUrls', v)}
                            />
                            <div className="h-px bg-white/5 mx-2" />
                            <ToggleField
                                label="Environment Analysis"
                                description="Identify focused applications and window titles"
                                value={settings.trackApps}
                                onChange={v => update('trackApps', v)}
                            />
                        </div>
                    </SettingsSection>
                </div>

                <div className="lg:col-span-4 space-y-10">
                    <div className="bg-white border border-black/[0.05] rounded-[48px] p-10 shadow-2xl relative overflow-hidden group">
                        <div className="relative z-10">
                            <div className="flex items-center gap-5 mb-10">
                                <div className="w-12 h-12 rounded-[22px] bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/30 rotate-12 group-hover:rotate-0 transition-transform duration-700">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-text-primary tracking-tighter uppercase leading-none">Active Matrix</h3>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] font-mono mt-2">Core Kernel Directives</p>
                                </div>
                            </div>
                            <div className="space-y-6 font-mono">
                                <ConfigValue label="SURVEILLANCE_INT" value={`${settings.screenshotIntervalMin}-${settings.screenshotIntervalMax}m`} />
                                <ConfigValue label="IDLE_COOLDOWN" value={`${settings.idleThresholdSeconds}s`} />
                                <ConfigValue label="MAX_CAP_DAILY" value={`${settings.dailyHoursLimit}h`} />
                                <ConfigValue label="MAX_CAP_WEEKLY" value={`${settings.weeklyHoursLimit}h`} />
                                <div className="h-px bg-black/[0.05] my-2" />
                                <ConfigValue label="PRIVACY_MODE" value={settings.screenshotBlur ? 'ENABLED' : 'DISABLED'} color={settings.screenshotBlur ? 'emerald' : 'rose'} />
                                <ConfigValue label="DEEP_PROT_URL" value={settings.trackUrls ? 'ACTIVE' : 'INACTIVE'} color={settings.trackUrls ? 'emerald' : 'rose'} />
                                <ConfigValue label="DEEP_PROT_APP" value={settings.trackApps ? 'ACTIVE' : 'INACTIVE'} color={settings.trackApps ? 'emerald' : 'rose'} />
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/[0.03] blur-3xl rounded-full -mr-24 -mt-24 group-hover:bg-primary/[0.06] transition-colors duration-1000" />
                    </div>

                    <SettingsSection 
                        icon={<Bell className="w-5 h-5" />} 
                        title="Alert Handlers" 
                        subtitle="Admin notification routing"
                    >
                        <div className="space-y-8">
                            <ToggleField
                                label="Inactivity Interrupt"
                                description="Notify when unit moves to standalone status"
                                value={settings.notifyIdle}
                                onChange={v => update('notifyIdle', v)}
                            />
                            <div className="h-px bg-white/5" />
                            <ToggleField
                                label="Capacity Overflow"
                                description="Alert when unit exceeds daily hour threshold"
                                value={settings.notifyDailyLimit}
                                onChange={v => update('notifyDailyLimit', v)}
                            />
                        </div>
                    </SettingsSection>
                    
                    <div className="bg-white border border-rose-500/10 rounded-[48px] p-12 flex flex-col items-center text-center group transition-all hover:bg-rose-500/[0.02] shadow-2xl shadow-rose-900/5">
                        <div className="w-20 h-20 rounded-[32px] bg-rose-500/5 flex items-center justify-center mb-8 shadow-inner border border-rose-500/10 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-700">
                            <ShieldAlert className="w-10 h-10 text-rose-600" strokeWidth={2.5} />
                        </div>
                        <h4 className="text-2xl font-black text-text-primary tracking-tighter mb-4 uppercase leading-none">Legacy Override</h4>
                        <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] leading-relaxed mb-10 font-mono opacity-60">
                            Permanent dissolution of configuration will reset system to factory default state protocols.
                        </p>
                        <button 
                            disabled={isViewer}
                            onClick={handleReset}
                            className="w-full py-5 border border-rose-500/20 text-rose-600 text-[11px] font-black uppercase tracking-[0.3em] rounded-[24px] hover:bg-rose-600 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 font-mono shadow-sm"
                        >
                            Execute Global Reset
                        </button>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}

function SettingsSection({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <div className="bg-white overflow-hidden rounded-[48px] border border-black/[0.05] shadow-2xl group/section transition-all hover:border-primary/20 duration-500 mb-10 last:mb-0">
            <div className="px-12 py-10 border-b border-black/[0.03] bg-black/[0.01] flex items-center gap-8">
                <div className="w-14 h-14 rounded-[22px] bg-white border border-black/[0.05] flex items-center justify-center text-primary shadow-sm group-hover/section:scale-110 group-hover/section:rotate-3 transition-all duration-700">
                    {icon}
                </div>
                <div>
                    <h2 className="text-2xl font-black text-text-primary tracking-tighter leading-none mb-2 uppercase">{title}</h2>
                    <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono italic opacity-60">{subtitle}</p>
                </div>
            </div>
            <div className="p-12">{children}</div>
        </div>
    );
}

function RangeField({ label, description, value, unit, min, max, step = 1, onChange, color }: {
    label: string; description: string; value: number; unit: string;
    min: number; max: number; step?: number;
    onChange: (v: number) => void;
    color: 'indigo' | 'violet' | 'emerald';
}) {
    const accColors = {
        indigo: 'accent-primary',
        violet: 'accent-violet-500',
        emerald: 'accent-emerald-500'
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start pr-4">
                <div className="space-y-2">
                    <p className="text-lg font-black text-text-primary tracking-tighter leading-none uppercase">{label}</p>
                    <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.1em] font-mono italic opacity-60">{description}</p>
                </div>
                <div className="flex items-baseline gap-2 bg-black/[0.02] px-6 py-3 rounded-2xl border border-black/[0.05] shadow-inner">
                    <span className="text-3xl font-black text-text-primary tracking-tighter italic">{value}</span>
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] font-mono">{unit}</span>
                </div>
            </div>
            <div className="px-2">
                <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className={clsx("w-full h-2 rounded-full appearance-none cursor-pointer bg-black/[0.05] shadow-inner transition-all", accColors[color])}
                />
            </div>
            <div className="flex justify-between px-2 text-[10px] font-black text-text-muted/30 uppercase tracking-[0.4em] font-mono">
                <span>{min}{unit}</span>
                <span>{max}{unit}</span>
            </div>
        </div>
    );
}

function ToggleField({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center justify-between group/toggle p-2">
            <div className="space-y-2 flex-1 pr-12">
                <p className="text-lg font-black text-text-primary tracking-tighter leading-none uppercase">{label}</p>
                <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.15em] font-mono italic opacity-60">{description}</p>
            </div>
            <button
                type="button"
                onClick={() => onChange(!value)}
                className={clsx(
                    "relative inline-flex h-10 w-20 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-500 ease-in-out shadow-inner",
                    value ? "bg-primary shadow-primary/30" : "bg-black/[0.08]"
                )}
            >
                <span 
                    className={clsx(
                        "pointer-events-none inline-block h-8 w-8 rounded-full bg-white shadow-xl ring-0 transition-transform duration-500 ease-in-out mt-[2px] ml-[2px]",
                        value ? "translate-x-10" : "translate-x-0"
                    )} 
                />
            </button>
        </div>
    );
}

function ConfigValue({ label, value, color = 'indigo' }: { label: string; value: string; color?: 'indigo' | 'emerald' | 'rose' }) {
    const textColors = {
        indigo: 'text-primary',
        emerald: 'text-emerald-500',
        rose: 'text-rose-500'
    };
    
    return (
        <div className="flex justify-between items-center text-[11px] group/item">
            <span className="text-text-muted font-black tracking-[0.2em] group-hover/item:text-text-primary transition-colors uppercase">{label}</span>
            <span className={clsx("font-black tracking-widest uppercase", textColors[color])}>{value}</span>
        </div>
    );
}
