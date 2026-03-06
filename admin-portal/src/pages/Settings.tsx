import { useState } from 'react';
import { Camera, Clock, Monitor, Bell, Shield, Save, RotateCcw, CheckCircle } from 'lucide-react';

const SETTINGS_KEY = 'digireps_settings';

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
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return DEFAULTS; }
}
function saveSettings(s: AppSettings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

export function SettingsPage() {
    const [settings, setSettings] = useState<AppSettings>(loadSettings());
    const [saved, setSaved] = useState(false);

    function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
        setSettings(prev => ({ ...prev, [key]: value }));
    }

    function handleSave() {
        saveSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
    }

    function handleReset() {
        setSettings(DEFAULTS);
        saveSettings(DEFAULTS);
    }

    return (
        <div className="p-8 max-w-[900px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Settings & Policies</h1>
                    <p className="text-slate-500 text-sm mt-1">Configure tracking behavior, limits, and notifications</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                        <RotateCcw className="w-4 h-4" /> Reset Defaults
                    </button>
                    <button onClick={handleSave}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                        {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {/* Screenshot Settings */}
                <Section icon={<Camera className="w-5 h-5 text-indigo-500" />} title="Screenshot Capture" subtitle="Control how screenshots are taken">
                    <ToggleField
                        label="Blur Screenshots"
                        description="Apply a blur effect to screenshots before uploading (privacy mode)"
                        value={settings.screenshotBlur}
                        onChange={v => update('screenshotBlur', v)}
                    />
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-xs text-indigo-600 flex items-center gap-2">
                        <Camera className="w-4 h-4 shrink-0" />
                        Screenshots are taken <strong>3 times at random moments</strong> within every 10-minute tracking window.
                    </div>
                </Section>

                {/* Idle Detection */}
                <Section icon={<Clock className="w-5 h-5 text-purple-500" />} title="Idle Detection" subtitle="Configure what counts as idle time">
                    <NumberField
                        label="Idle Threshold (seconds)"
                        description="No mouse/keyboard activity after this duration marks the user as idle"
                        value={settings.idleThresholdSeconds}
                        min={30} max={1800} step={30}
                        onChange={v => update('idleThresholdSeconds', v)}
                    />
                    <ToggleField
                        label="Auto-stop on Idle"
                        description="Automatically stop the timer if the user is idle for too long"
                        value={settings.autoStopOnIdle}
                        onChange={v => update('autoStopOnIdle', v)}
                    />
                    {settings.autoStopOnIdle && (
                        <NumberField
                            label="Auto-stop After (minutes)"
                            description="Stop tracking after this many minutes of idle"
                            value={settings.idleAutoStopMinutes}
                            min={5} max={120} step={5}
                            onChange={v => update('idleAutoStopMinutes', v)}
                        />
                    )}
                </Section>

                {/* Work Limits */}
                <Section icon={<Monitor className="w-5 h-5 text-emerald-500" />} title="Work Limits" subtitle="Set maximum daily and weekly tracking limits">
                    <div className="grid grid-cols-2 gap-6">
                        <NumberField
                            label="Daily Limit (hours)"
                            description="Max hours tracked per day per member"
                            value={settings.dailyHoursLimit}
                            min={1} max={24}
                            onChange={v => update('dailyHoursLimit', v)}
                        />
                        <NumberField
                            label="Weekly Limit (hours)"
                            description="Max hours tracked per week per member"
                            value={settings.weeklyHoursLimit}
                            min={1} max={168}
                            onChange={v => update('weeklyHoursLimit', v)}
                        />
                    </div>
                </Section>

                {/* Tracking Policies */}
                <Section icon={<Shield className="w-5 h-5 text-orange-500" />} title="Tracking Policies" subtitle="Control which data is collected">
                    <ToggleField
                        label="Track URLs / Browser Domains"
                        description="Record active browser tab domains in activity samples"
                        value={settings.trackUrls}
                        onChange={v => update('trackUrls', v)}
                    />
                    <ToggleField
                        label="Track Active Application"
                        description="Record the name and window title of the focused app"
                        value={settings.trackApps}
                        onChange={v => update('trackApps', v)}
                    />
                </Section>

                {/* Notifications */}
                <Section icon={<Bell className="w-5 h-5 text-rose-500" />} title="Notifications" subtitle="Configure admin alerts">
                    <ToggleField
                        label="Alert on Idle (Admin)"
                        description="Send notification when a member goes idle during tracking"
                        value={settings.notifyIdle}
                        onChange={v => update('notifyIdle', v)}
                    />
                    <ToggleField
                        label="Alert on Daily Limit Reached"
                        description="Notify admin when a member reaches their daily hour limit"
                        value={settings.notifyDailyLimit}
                        onChange={v => update('notifyDailyLimit', v)}
                    />
                </Section>

                {/* Current Config Summary */}
                <div className="bg-slate-900 rounded-xl p-5 text-sm font-mono text-slate-300">
                    <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-sans">Active Configuration</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                        <span className="text-slate-500">screenshot_interval:</span>
                        <span className="text-blue-400">{settings.screenshotIntervalMin}–{settings.screenshotIntervalMax} min</span>
                        <span className="text-slate-500">idle_threshold:</span>
                        <span className="text-blue-400">{settings.idleThresholdSeconds}s</span>
                        <span className="text-slate-500">daily_limit:</span>
                        <span className="text-emerald-400">{settings.dailyHoursLimit}h</span>
                        <span className="text-slate-500">weekly_limit:</span>
                        <span className="text-emerald-400">{settings.weeklyHoursLimit}h</span>
                        <span className="text-slate-500">track_urls:</span>
                        <span className={settings.trackUrls ? 'text-emerald-400' : 'text-rose-400'}>{settings.trackUrls ? 'true' : 'false'}</span>
                        <span className="text-slate-500">blur_screenshots:</span>
                        <span className={settings.screenshotBlur ? 'text-emerald-400' : 'text-rose-400'}>{settings.screenshotBlur ? 'true' : 'false'}</span>
                        <span className="text-slate-500">auto_stop_idle:</span>
                        <span className={settings.autoStopOnIdle ? 'text-emerald-400' : 'text-rose-400'}>{settings.autoStopOnIdle ? `true (${settings.idleAutoStopMinutes}m)` : 'false'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
                    <p className="text-xs text-slate-400">{subtitle}</p>
                </div>
            </div>
            <div className="p-6 space-y-5">{children}</div>
        </div>
    );
}

function NumberField({ label, description, value, min, max, step = 1, onChange }: {
    label: string; description: string; value: number;
    min: number; max: number; step?: number;
    onChange: (v: number) => void;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <p className="text-xs text-slate-400 mb-2">{description}</p>
            <div className="flex items-center gap-3">
                <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="flex-1 accent-blue-600"
                />
                <span className="text-sm font-semibold text-slate-700 w-12 text-right">{value}</span>
            </div>
        </div>
    );
}

function ToggleField({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
            <button
                onClick={() => onChange(!value)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${value ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </div>
    );
}
