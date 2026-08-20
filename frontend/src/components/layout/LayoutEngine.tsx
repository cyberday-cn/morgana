import { useLayoutStore } from '../../stores/useLayoutStore'
import { DesktopSplit } from './DesktopSplit'
import { UIFocus } from './UIFocus'
import { NLFocus } from './NLFocus'

export function LayoutEngine() {
  const mode = useLayoutStore((s) => s.mode)

  switch (mode) {
    case 'split':
      return <DesktopSplit />
    case 'ui-focus':
      return <UIFocus />
    case 'nl-focus':
      return <NLFocus />
    default:
      return <DesktopSplit />
  }
}
