import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  MinusSignIcon,
  MoreHorizontalIcon,
  PanelLeftIcon as PanelLeftGlyph,
  Search01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { Icon } from '@FluxUI/Icon';

type GlyphProps = {
  className?: string;
};

/**
 * Names a glyph the way the generated components expect to import it, and draws it through the one
 * component every icon in Flux goes through.
 *
 * The registry's components import their icons from Lucide, a set banned here so that a second one
 * cannot come back a file at a time. Rewriting their markup would mean touching every generated file
 * and re-doing it on each update; giving those imports somewhere else to land costs one line per
 * file and survives being regenerated.
 *
 * @param of - Which icon, named from the icon package.
 * @param as - What the generated code calls it, which is what appears in a stack trace.
 * @returns A component drawing that glyph.
 */
const glyph = (of: IconSvgElement, as: string) => {
  const Glyph = ({ className }: GlyphProps) => (
    <Icon of={of} {...(className === undefined ? {} : { className })} />
  );

  Glyph.displayName = as;

  return Glyph;
};

const ArrowDownIcon = glyph(ArrowDown01Icon, 'ArrowDownIcon');
const CheckIcon = glyph(Tick02Icon, 'CheckIcon');
const ChevronDownIcon = glyph(ArrowDown01Icon, 'ChevronDownIcon');
const ChevronLeftIcon = glyph(ArrowLeft01Icon, 'ChevronLeftIcon');
const ChevronRightIcon = glyph(ArrowRight01Icon, 'ChevronRightIcon');
const ChevronUpIcon = glyph(ArrowUp01Icon, 'ChevronUpIcon');
const CircleCheckIcon = glyph(CheckmarkCircle02Icon, 'CircleCheckIcon');
const InfoIcon = glyph(InformationCircleIcon, 'InfoIcon');
const Loader2Icon = glyph(Loading03Icon, 'Loader2Icon');
const MinusIcon = glyph(MinusSignIcon, 'MinusIcon');
const OctagonXIcon = glyph(CancelCircleIcon, 'OctagonXIcon');
const PanelLeftIcon = glyph(PanelLeftGlyph, 'PanelLeftIcon');
const SearchIcon = glyph(Search01Icon, 'SearchIcon');
const TriangleAlertIcon = glyph(Alert02Icon, 'TriangleAlertIcon');
const XIcon = glyph(Cancel01Icon, 'XIcon');
const MoreHorizontal = glyph(MoreHorizontalIcon, 'MoreHorizontalIcon');

export {
  ArrowDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  MinusIcon,
  MoreHorizontal as MoreHorizontalIcon,
  OctagonXIcon,
  PanelLeftIcon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
};
