import {
    Clock,
    Activity,
    Lightbulb,
    MapPin,
    FolderKanban,
    CalendarDays,
    FileText,
    Users,
    CircleDollarSign,
    AppWindow,
    Settings,
    Construction
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { PageLayout, Card } from '../components/ui';

const iconMap: Record<string, any> = {
    '/timesheets/approvals': Clock,
    '/activity/apps': Activity,
    '/insights/highlights': Lightbulb,
    '/insights/performance': Lightbulb,
    '/insights/unusual': Lightbulb,
    '/insights/notifications': Lightbulb,
    '/insights/output': Lightbulb,
    '/locations/job-sites': MapPin,
    '/projects/todos': FolderKanban,
    '/projects/clients': FolderKanban,
    '/calendar/time-off': CalendarDays,
    '/reports/legacy': FileText,
    '/reports/daily': FileText,
    '/reports/owed': FileText,
    '/reports/payments': FileText,
    '/reports/all': FileText,
    '/reports/custom': FileText,
    '/people/teams': Users,
    '/financials/create': CircleDollarSign,
    '/financials/past': CircleDollarSign,
    '/financials/invoices': CircleDollarSign,
    '/financials/expenses': CircleDollarSign,
    '/silent/how-it-works': AppWindow,
    '/settings/tracking': Settings,
    '/settings/integrations': Settings,
    '/settings/billing': Settings,
};

export function PlaceholderPage({ title }: { title: string }) {
    const location = useLocation();
    const IconComponent = iconMap[location.pathname] || Construction;

    return (
        <PageLayout title={title} description="This module is currently under active development." maxWidth="6xl">
            <Card className="max-w-xl mx-auto text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-surface-subtle to-surface pointer-events-none" />
                <div className="relative">
                    <div className="w-20 h-20 bg-primary/10 text-primary rounded-shell-lg flex items-center justify-center mx-auto mb-6 shadow-shell-sm ring-1 ring-primary/20">
                        <IconComponent className="w-10 h-10" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-2">
                        {title}
                    </h1>
                    <p className="text-text-secondary mb-8 max-w-sm mx-auto leading-relaxed">
                        Our engineering team is building out the data architecture to support these features.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-subtle text-text-secondary rounded-shell-md text-sm font-medium border border-border">
                        <Construction className="w-4 h-4 text-text-muted" />
                        Infrastructure scaffolding in progress
                    </div>
                    <div className="mt-12 pt-6 border-t border-border-subtle text-xs text-text-muted font-mono">
                        ROUTE MAP: {location.pathname}
                    </div>
                </div>
            </Card>
        </PageLayout>
    );
}
