import { useState, type ComponentType } from 'react';
import {
  AlignLeft,
  Image,
  PanelTop,
  RectangleHorizontal,
  SlidersHorizontal,
  SquareCheck,
  TextCursorInput,
  ToggleLeft,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Checkbox } from './components/ui/checkbox';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Slider } from './components/ui/slider';
import { Switch } from './components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { Textarea } from './components/ui/textarea';
import { baseNodeValid, type BaseNode, type NodeKind } from '@visualia/engine';
import { reactContent } from '@visualia/react';

/** Live React component from the widget registry; state lives in React, props in the doc. */
export interface WidgetNode extends BaseNode {
  type: 'widget';
  component: string;
  props?: Record<string, unknown>;
}

export interface WidgetProps {
  nodeId: string;
  props: Record<string, unknown>;
}

export interface WidgetDef {
  title: string;
  hint: string;
  group: 'element' | 'component' | 'view';
  w: number;
  h: number;
  icon: LucideIcon;
  /** content changes every frame while visible — recapture continuously */
  live?: boolean;
  /** render as visible DOM above the canvas instead of capturing into a
      texture (media that texElementImage2D can't rasterize) */
  overlay?: boolean;
  /** keep the widget renderable but leave it out of the insert palette */
  hidden?: boolean;
  Component: ComponentType<WidgetProps>;
}

/** shared wrapper: no internal padding — insets come from placement margins */
const pad = 'flex h-full w-full items-center gap-3';

function ButtonWidget(_: WidgetProps) {
  const [n, setN] = useState(0);
  return (
    <div className={pad}>
      <Button className="w-full" onClick={() => setN(n + 1)}>
        {n ? `Clicked ${n}×` : 'Button'}
      </Button>
    </div>
  );
}

function InputWidget({ nodeId }: WidgetProps) {
  return (
    <div className={pad}>
      <Input id={`in-${nodeId}`} placeholder="Type here…" />
    </div>
  );
}

function SwitchWidget({ nodeId }: WidgetProps) {
  const [on, setOn] = useState(true);
  return (
    <div className={`${pad} justify-between`}>
      <Label htmlFor={`sw-${nodeId}`}>{on ? 'Notifications are on' : 'Notifications are off'}</Label>
      <Switch id={`sw-${nodeId}`} checked={on} onCheckedChange={setOn} />
    </div>
  );
}

function SliderWidget(_: WidgetProps) {
  const [value, setValue] = useState([50]);
  return (
    <div className={pad}>
      <Slider value={value} onValueChange={setValue} max={100} step={1} />
      <span className="text-muted-foreground w-8 shrink-0 text-right text-sm tabular-nums">{value[0]}</span>
    </div>
  );
}

function TextareaWidget({ nodeId }: WidgetProps) {
  return (
    <div className={pad}>
      <Textarea id={`ta-${nodeId}`} placeholder="Type a longer text…" className="h-full min-h-0 resize-none" />
    </div>
  );
}

function CheckboxWidget({ nodeId }: WidgetProps) {
  const [checked, setChecked] = useState(true);
  return (
    <div className={pad}>
      <Checkbox id={`cb-${nodeId}`} checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
      <Label htmlFor={`cb-${nodeId}`}>Accept terms and conditions</Label>
    </div>
  );
}

function TabsWidget(_: WidgetProps) {
  return (
    <div className={pad}>
      <Tabs defaultValue="one" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

function VideoWidget({ props }: WidgetProps) {
  const src = typeof props.src === 'string' ? props.src : '/bunny.mp4';
  // muted+playsInline so autoplay is allowed
  return <video className="h-full w-full object-cover" src={src} controls autoPlay muted loop playsInline />;
}

function ImageWidget({ props }: WidgetProps) {
  const src = typeof props.src === 'string' ? props.src : '/example.jpg';
  return <img className="h-full w-full object-cover" src={src} alt="" draggable={false} />;
}

export const WIDGETS: Record<string, WidgetDef> = {
  video: { title: 'Video', hint: 'autoplay', group: 'element', w: 320, h: 180, icon: Video, overlay: true, hidden: true, Component: VideoWidget },
  image: { title: 'Image', hint: 'picture', group: 'element', w: 320, h: 240, icon: Image, Component: ImageWidget },
  button: { title: 'Button', hint: 'primary action', group: 'component', w: 320, h: 40, icon: RectangleHorizontal, Component: ButtonWidget },
  input: { title: 'Input', hint: 'text field', group: 'component', w: 320, h: 40, icon: TextCursorInput, Component: InputWidget },
  textarea: { title: 'Textarea', hint: 'multiline text', group: 'component', w: 320, h: 88, icon: AlignLeft, Component: TextareaWidget },
  checkbox: { title: 'Checkbox', hint: 'with label', group: 'component', w: 320, h: 24, icon: SquareCheck, Component: CheckboxWidget },
  switch: { title: 'Switch', hint: 'toggle with label', group: 'component', w: 320, h: 24, icon: ToggleLeft, Component: SwitchWidget },
  slider: { title: 'Slider', hint: 'range control', group: 'component', w: 320, h: 24, icon: SlidersHorizontal, Component: SliderWidget },
  tabs: { title: 'Tabs', hint: 'two tabs', group: 'component', w: 320, h: 40, icon: PanelTop, Component: TabsWidget },
};

/** Engine node kind for shadcn widgets: React content via @visualia/react. */
export const widgetKind: NodeKind<WidgetNode> = {
  type: 'widget',
  content: reactContent<WidgetNode>({
    render(node) {
      const def = WIDGETS[node.component];
      return def ? (
        <def.Component nodeId={node.id} props={node.props ?? {}} />
      ) : (
        <div style={{ padding: 12, fontSize: 13, color: '#999' }}>Unknown widget “{node.component}”</div>
      );
    },
    key: (n) => `${n.component}|${JSON.stringify(n.props ?? {})}`,
    mode: (n) => (WIDGETS[n.component]?.overlay ? 'overlay' : 'texture'),
    live(n, el) {
      if (!WIDGETS[n.component]?.live) return false;
      if (!el) return true; // policy question: capture at scale 1, no mips
      const media = el.querySelector('video');
      return !!media && !media.paused && media.readyState >= 2;
    },
  }),
  edit: { kind: 'activate' },
  deserialize(raw) {
    if (!baseNodeValid(raw) || raw.type !== 'widget') return null;
    const o = raw as WidgetNode;
    return typeof o.component === 'string' ? o : null;
  },
};
