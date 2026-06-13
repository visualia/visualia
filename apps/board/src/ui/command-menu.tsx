"use client"

import * as React from "react"
import { createRoot } from "react-dom/client"
import { BoxIcon, ClapperboardIcon, FrameIcon, Heading1Icon, ImageIcon, PlayIcon, TextIcon, TypeIcon } from "lucide-react"

import type { App } from "@/app"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@visualia/shadcn"
import { WIDGETS } from "@visualia/shadcn"

let setOpenRef: ((open: boolean) => void) | null = null
let openNow = false

function CommandMenuDialog({ app }: { app: App }) {
  const [open, setOpen] = React.useState(false)
  setOpenRef = setOpen
  openNow = open

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  // Radix restores focus to the pre-dialog element on close, which would
  // steal the caret from a freshly-created text node — keep focus on the
  // editing contenteditable instead so typing works immediately.
  const handleCloseAutoFocus = React.useCallback(
    (e: Event) => {
      e.preventDefault()
      app.edit.refocus()
    },
    [app]
  )

  const widgetItems = (group: "element" | "component" | "view") =>
    Object.entries(WIDGETS)
      .filter(([, def]) => def.group === group && !def.hidden)
      .map(([key, def]) => (
        <CommandItem
          key={key}
          value={`insert ${def.title} ${def.hint}`}
          onSelect={() => runCommand(() => app.createWidgetAtCenter(key))}
        >
          <def.icon />
          <span>Insert {def.title}</span>
        </CommandItem>
      ))

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Add to board"
      description="Insert an element on the board"
      className="top-[22%] max-w-[320px] translate-y-0 border-input"
      showCloseButton={false}
      onCloseAutoFocus={handleCloseAutoFocus}
    >
      <CommandInput placeholder="Type to search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          <CommandItem
            value="present slideshow start"
            onSelect={() => runCommand(() => app.startPresentation())}
          >
            <PlayIcon />
            <span>Present</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup>
          <CommandItem
            value="insert frame white empty"
            onSelect={() => runCommand(() => app.createFrameAtCenter())}
          >
            <FrameIcon />
            <span>Insert Frame</span>
          </CommandItem>
          <CommandItem
            value="insert display large title text"
            onSelect={() => runCommand(() => app.createDisplayAtCenter())}
          >
            <TypeIcon />
            <span>Insert Display</span>
          </CommandItem>
          <CommandItem
            value="insert heading title text"
            onSelect={() => runCommand(() => app.createHeadingAtCenter())}
          >
            <Heading1Icon />
            <span>Insert Heading</span>
          </CommandItem>
          <CommandItem
            value="insert description paragraph text"
            onSelect={() => runCommand(() => app.createDescriptionAtCenter())}
          >
            <TextIcon />
            <span>Insert Description</span>
          </CommandItem>
          <CommandItem
            value="insert 3d model three gltf glb"
            onSelect={() => runCommand(() => app.createThreeAtCenter())}
          >
            <BoxIcon />
            <span>Insert 3D model</span>
          </CommandItem>
          <CommandItem
            value="insert image picture photo media texture"
            onSelect={() => runCommand(() => app.createImageAtCenter())}
          >
            <ImageIcon />
            <span>Insert Image</span>
          </CommandItem>
          <CommandItem
            value="insert video movie mp4 media texture"
            onSelect={() => runCommand(() => app.createVideoAtCenter())}
          >
            <ClapperboardIcon />
            <span>Insert Video</span>
          </CommandItem>
          {widgetItems("element")}
        </CommandGroup>
        <CommandGroup>{widgetItems("component")}</CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

/** ⌘/ palette built on the shadcn Command component (cmdk). */
export class CommandMenu {
  constructor(app: App) {
    const host = document.createElement("div")
    host.id = "cmd-menu-root"
    document.body.appendChild(host)
    createRoot(host).render(<CommandMenuDialog app={app} />)
  }

  get isOpen(): boolean {
    return openNow
  }

  open(): void {
    setOpenRef?.(true)
  }

  close(): void {
    setOpenRef?.(false)
  }

  toggle(): void {
    setOpenRef?.(!openNow)
  }
}
