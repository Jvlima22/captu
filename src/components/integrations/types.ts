export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'apps' | 'api' | 'mcp';
  type: string;
  status: 'connected' | 'not_connected';
  isNew?: boolean;
  author?: string;
  website?: string;
  privacyPolicy?: string;
  uuid?: string;
  isDisabled?: boolean;
}

export interface MetricData {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ReactNode;
}
