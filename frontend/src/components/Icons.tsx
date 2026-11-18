import {
  FileText,
  Mic,
  BarChart3,
  Briefcase,
  Cpu,
  Zap,
  Globe,
  Sparkles,
  Target,
  Rocket,
  Star,
  Lightbulb,
  Search,
  FileEdit,
  Building2,
  GraduationCap,
  MessageSquare,
  TrendingUp,
  Trophy,
  Award,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Send,
  Play,
  Settings,
  Lock,
  LogIn,
  UserPlus,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Download,
  Eye,
  EyeOff,
  Copy,
  Wand2,
  Layout,
  FileSearch,
  ClipboardCheck,
  PenTool,
  Palette,
  Brain,
  Shield,
  Heart,
  Users,
  Calendar,
  DollarSign,
  Gift,
  Crown,
  Flame,
  ArrowRight,
  ArrowLeft,
  X,
  RotateCcw,
  CpuIcon,
  MessageCircle,
  Volume2,
  VolumeX,
  Pause,
  MoreHorizontal,
  Layers,
  Gauge,
  ShieldCheck,
  TrendingDown,
  Frown,
  Meh,
  Smile,
  ThumbsUp,
  FileUp,
  Building,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const wrap = (Icon: ComponentType<IconProps>) =>
  ({ size = 20, ...props }: IconProps) => <Icon size={size} strokeWidth={2} {...props} />;

export const ResumeIcon = wrap(FileText);
export const MicIcon = wrap(Mic);
export const ChartIcon = wrap(BarChart3);
export const HrIcon = wrap(Briefcase);
export const TechIcon = wrap(Cpu);
export const PressureIcon = wrap(Zap);
export const EnglishIcon = wrap(Globe);
export const SparkleIcon = wrap(Sparkles);
export const TargetIcon = wrap(Target);
export const RocketIcon = wrap(Rocket);
export const StarIcon = wrap(Star);
export const BulbIcon = wrap(Lightbulb);
export const SearchIcon = wrap(Search);
export const EditIcon = wrap(FileEdit);
export const BuildingIcon = wrap(Building2);
export const GraduationIcon = wrap(GraduationCap);
export const ChatIcon = wrap(MessageSquare);
export const TrendUpIcon = wrap(TrendingUp);
export const TrophyIcon = wrap(Trophy);
export const AwardIcon = wrap(Award);
export const CheckIcon = wrap(CheckCircle);
export const AlertIcon = wrap(AlertTriangle);
export const XIcon = wrap(XCircle);
export const ClockIcon = wrap(Clock);
export const RefreshIcon = wrap(RefreshCw);
export const SendIcon = wrap(Send);
export const PlayIcon = wrap(Play);
export const SettingsIcon = wrap(Settings);
export const LockIcon = wrap(Lock);
export const LoginIcon = wrap(LogIn);
export const RegisterIcon = wrap(UserPlus);
export const ChevronRightIcon = wrap(ChevronRight);
export const ChevronDownIcon = wrap(ChevronDown);
export const PlusIcon = wrap(Plus);
export const TrashIcon = wrap(Trash2);
export const DownloadIcon = wrap(Download);
export const EyeIcon = wrap(Eye);
export const EyeOffIcon = wrap(EyeOff);
export const CopyIcon = wrap(Copy);
export const WandIcon = wrap(Wand2);
export const LayoutIcon = wrap(Layout);
export const FileSearchIcon = wrap(FileSearch);
export const ClipboardIcon = wrap(ClipboardCheck);
export const PenIcon = wrap(PenTool);
export const PaletteIcon = wrap(Palette);
export const BrainIcon = wrap(Brain);
export const ShieldIcon = wrap(Shield);
export const HeartIcon = wrap(Heart);
export const UsersIcon = wrap(Users);
export const CalendarIcon = wrap(Calendar);
export const DollarIcon = wrap(DollarSign);
export const GiftIcon = wrap(Gift);
export const CrownIcon = wrap(Crown);
export const FlameIcon = wrap(Flame);
export const ArrowRightIcon = wrap(ArrowRight);
export const ArrowLeftIcon = wrap(ArrowLeft);
export const CloseIcon = wrap(X);
export const RotateIcon = wrap(RotateCcw);
export const CpuChipIcon = wrap(CpuIcon);
export const MessageIcon = wrap(MessageCircle);
export const VolumeIcon = wrap(Volume2);
export const MuteIcon = wrap(VolumeX);
export const PauseIcon = wrap(Pause);
export const MoreIcon = wrap(MoreHorizontal);
export const LayersIcon = wrap(Layers);
export const GaugeIcon = wrap(Gauge);
export const ShieldCheckIcon = wrap(ShieldCheck);
export const TrendDownIcon = wrap(TrendingDown);
export const FrownIcon = wrap(Frown);
export const MehIcon = wrap(Meh);
export const SmileIcon = wrap(Smile);
export const ThumbsUpIcon = wrap(ThumbsUp);
export const FileUpIcon = wrap(FileUp);
export const CompanyIcon = wrap(Building);