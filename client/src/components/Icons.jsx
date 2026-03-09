/**
 * Centralized icon mappings using lucide-react.
 * Replaces all emoji icons across the dashboard for a consistent look.
 */
import {
  ClipboardList, Zap, FlaskConical, CheckCircle2, Rocket, Clock, Loader2,
  XCircle, Wrench, BarChart3, Search, FileText, Tag, User, Package, Bot,
  RefreshCw, Pencil, Trash2, MessageSquare, Folder, PlusCircle, Link,
  ArrowUp, Paperclip, Puzzle, Settings, Key, Lock, Unlock, Building2,
  Timer, Lightbulb, Moon, Sun, Bell, Star, Target, Brain, Waves, Hammer,
  Glasses, Circle, AlertTriangle, Undo2, ExternalLink, Pause,
  Megaphone, TrendingUp, Activity
} from 'lucide-react';

// Status icons for task pipeline stages
export const STATUS_ICONS = {
  todo: ClipboardList,
  in_progress: Zap,
  active: Zap,
  qa: FlaskConical,
  qa_testing: FlaskConical,
  completed: CheckCircle2,
  deployed: Rocket,
  deploying: Clock,
  failed: XCircle,
  blocked: Circle,
  running: Clock,
};

// Activity log event type icons
export const ACTIVITY_ICONS = {
  created: PlusCircle,
  status: RefreshCw,
  title: Pencil,
  description: FileText,
  type: Tag,
  priority: Zap,
  assigned_agent: User,
  stage: Wrench,
  acceptance_criteria: CheckCircle2,
  result: Package,
  error: XCircle,
  qa_result: FlaskConical,
  qa_agent: Search,
  project_id: Folder,
  pull_request_url: Link,
  comment: MessageSquare,
};

// Blocker type icons
export const BLOCKER_ICONS = {
  missing_credential: Key,
  missing_config: Settings,
  permission_denied: Lock,
  permission: Lock,
  external_dependency: Link,
  infrastructure: Building2,
  ambiguous_requirement: AlertTriangle,
  human_decision: User,
};

// Agent identity icons (UI fallbacks)
export const AGENT_ICON_COMPONENTS = {
  neo: Glasses,
  mu: Wrench,
  beta: Zap,
  alpha: Brain,
  flow: Waves,
  ifra: Hammer,
  'neo-worker': Glasses,
  'beta-worker': Zap,
  'ifra-worker': Hammer,
  system: Settings,
  dante: User,
};

// Re-export commonly used icons for direct use
export {
  ClipboardList, Zap, FlaskConical, CheckCircle2, Rocket, Clock, Loader2,
  XCircle, Wrench, BarChart3, Search, FileText, Tag, User, Package, Bot,
  RefreshCw, Pencil, Trash2, MessageSquare, Folder, PlusCircle, Link,
  ArrowUp, Paperclip, Puzzle, Settings, Key, Lock, Unlock, Building2,
  Timer, Lightbulb, Moon, Sun, Bell, Star, Target, Brain, Waves, Hammer,
  Glasses, Circle, AlertTriangle, Undo2, ExternalLink, Pause,
  Megaphone, TrendingUp, Activity
};
