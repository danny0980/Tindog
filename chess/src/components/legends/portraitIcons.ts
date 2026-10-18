// Icon and size tables shared by every character / relic emblem.
import {
  Anchor, Apple, Atom, Axe, Binary, ChessKnight, Bird, BookOpen, Bone, Bot, BrainCircuit, Bug, Church, CircuitBoard, Clock, CloudLightning, Compass, Cpu,
  Crosshair, Crown, Dna, Drama, Eclipse, Eye, Factory, Feather, Flag, Flame, Flower2, Gem, Ghost, Glasses, Globe, Hammer, Hexagon, Hourglass,
  Infinity as InfinityIcon, KeyRound, Leaf, Lock, Map as MapIcon, Microchip, Moon, Mountain, Music, Network, Nut, Orbit, Palette, Pyramid, Radar, Radiation,
  Sailboat, Scale, ScanEye, ScrollText, Server, Shield, ShieldHalf, Ship, Skull, Snowflake, Sparkles, Star, Sun, Sunrise, Sword, Swords, Target,
  Telescope, Terminal, Tornado, TreePine, Waves, Wifi, Wind, Zap,
} from 'lucide-react'
import type { PortraitIcon } from '../../types/persona'

export const PORTRAIT_ICONS: Record<PortraitIcon, typeof Atom> = {
  eye: Eye, apple: Apple, flag: Flag, atom: Atom, axe: Axe, swords: Swords, leaf: Leaf, flame: Flame,
  scale: Scale, scroll: ScrollText, crown: Crown, mountain: Mountain, church: Church, moon: Moon, wind: Wind, shield: Shield,
  palette: Palette, drama: Drama, binary: Binary, zap: Zap, radiation: Radiation, feather: Feather, bird: Bird, hammer: Hammer,
  pyramid: Pyramid, 'cloud-lightning': CloudLightning, tree: TreePine, book: BookOpen, sparkles: Sparkles, ghost: Ghost, bone: Bone, snowflake: Snowflake,
  tornado: Tornado, gem: Gem, sun: Sun, anchor: Anchor, sailboat: Sailboat, skull: Skull, ship: Ship, compass: Compass,
  sword: Sword, target: Target, map: MapIcon, globe: Globe, waves: Waves, telescope: Telescope, eclipse: Eclipse, flower: Flower2,
  key: KeyRound, 'scan-eye': ScanEye, bug: Bug, terminal: Terminal, wifi: Wifi, lock: Lock, network: Network, dna: Dna,
  hexagon: Hexagon, glasses: Glasses, 'shield-half': ShieldHalf, bot: Bot, radar: Radar, factory: Factory, crosshair: Crosshair, cpu: Cpu,
  server: Server, 'brain-circuit': BrainCircuit, circuit: CircuitBoard, microchip: Microchip, clock: Clock, nut: Nut, infinity: InfinityIcon, sunrise: Sunrise,
  hourglass: Hourglass, music: Music, orbit: Orbit, star: Star, knight: ChessKnight,
}

export const PORTRAIT_SIZES = {
  xs: { box: 'size-9 rounded-xl', icon: 'size-4', mono: 'text-[9px]' },
  sm: { box: 'size-11 rounded-xl', icon: 'size-5', mono: 'text-[10px]' },
  md: { box: 'size-14 rounded-2xl', icon: 'size-7', mono: 'text-xs' },
  lg: { box: 'size-20 rounded-3xl', icon: 'size-9', mono: 'text-sm' },
  xl: { box: 'size-28 rounded-[2rem]', icon: 'size-12', mono: 'text-base' },
} as const
