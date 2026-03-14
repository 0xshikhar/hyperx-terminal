import { CommandPalette } from "@/components/command-palette/CommandPalette";

type CommandPaletteV2Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPaletteV2(props: CommandPaletteV2Props) {
  return <CommandPalette {...props} />;
}
