import React from 'react';
import type { TextStyle } from 'react-native';
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  Award,
  Badge,
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarDays,
  Camera,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  Code,
  ExternalLink,
  FileText,
  GitCommitHorizontal,
  Github,
  GraduationCap,
  Heart,
  House,
  Info,
  Key,
  Link,
  ListTodo,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Pencil,
  PencilLine,
  Plus,
  PlusCircle,
  RefreshCw,
  Save,
  SearchX,
  Settings,
  Share2,
  Shield,
  SquareCheckBig,
  Star,
  Trash2,
  Trello,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: TextStyle;
};

const featherMap = {
  'align-left': AlignLeft,
  'alert-circle': CircleAlert,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  award: Award,
  bell: Bell,
  'book-open': BookOpen,
  briefcase: Briefcase,
  calendar: CalendarDays,
  camera: Camera,
  'check-circle': CircleCheck,
  'check-square': SquareCheckBig,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  circle: Circle,
  clock: Clock,
  code: Code,
  'edit-2': Pencil,
  'edit-3': PencilLine,
  'external-link': ExternalLink,
  'git-commit': GitCommitHorizontal,
  github: Github,
  'help-circle': CircleHelp,
  home: House,
  info: Info,
  key: Key,
  link: Link,
  'log-in': LogIn,
  'log-out': LogOut,
  lock: Lock,
  mail: Mail,
  'message-circle': MessageCircle,
  'message-square': MessageSquare,
  'more-vertical': MoreVertical,
  plus: Plus,
  'plus-circle': PlusCircle,
  'refresh-cw': RefreshCw,
  save: Save,
  settings: Settings,
  'share-2': Share2,
  shield: Shield,
  trash: Trash2,
  'trash-2': Trash2,
  trello: Trello,
  user: User,
  'user-minus': UserMinus,
  'user-plus': UserPlus,
  users: Users,
  x: X,
} as const;

const materialMap = {
  assessment: ChartColumn,
  assignment: FileText,
  badge: Badge,
  campaign: Megaphone,
  dashboard: House,
  event: Calendar,
  'favorite-border': Heart,
  favorite: Heart,
  group: Users,
  'group-add': UserPlus,
  groups: Users,
  info: Info,
  'info-outline': CircleAlert,
  school: GraduationCap,
  'search-off': SearchX,
  star: Star,
  task: ListTodo,
  update: RefreshCw,
} as const;

function renderIcon(
  map: Record<string, React.ComponentType<any>>,
  { name, size = 20, color = '#FFFFFF', style }: IconProps,
  family: 'material' | 'feather' | 'ant'
) {
  const IconComp = map[name] || Circle;
  const isFill = family === 'material' && (name === 'favorite' || name === 'star');

  return (
    <IconComp
      size={size}
      color={color}
      style={style}
      strokeWidth={2}
      fill={isFill ? color : 'none'}
    />
  );
}

export const Feather = (props: IconProps) => renderIcon(featherMap as any, props, 'feather');

export const MaterialIcons = (props: IconProps) =>
  renderIcon(materialMap as any, props, 'material');

export const AntDesign = (props: IconProps) => {
  if (props.name === 'github') {
    return <Github size={props.size ?? 20} color={props.color ?? '#fff'} style={props.style} />;
  }

  return renderIcon({ github: Github }, props, 'ant');
};
